import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Collapse, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Table, message } from 'antd';
import { useEffect, useState } from 'react';
import { mergePlanEntitlements, splitPlanEntitlements } from './planEntitlements.js';

import { describeApiError } from '../../application/auth/authContext';
import {
  useAdminPlans,
  useAdminProducts,
  useCatalogMutations,
  formatVnd,
  type AdminPlan,
  type AdminProduct,
  type PlanInput,
  type ProductInput,
} from '../../application/catalog/catalogQueries';
import { PageLoading, PageHeader, StatusChip } from '../components/WorkspacePrimitives';

type ProductFormValues = ProductInput;

interface PlanFormValues extends Omit<PlanInput, 'entitlements'> {
  readonly desktopEntitlement?: boolean;
  readonly advancedEntitlementsText?: string;
}

function productStatusTone(status: string) {
  if (status === 'PUBLISHED') return 'success' as const;
  if (status === 'ARCHIVED') return 'error' as const;
  return 'warning' as const;
}

export function ProviderCatalogScreen() {
  const [query, setQuery] = useState('');
  const matches = (value: string) => value.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
  const [productOpen, setProductOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [desktopChanged, setDesktopChanged] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [productForm] = Form.useForm<ProductFormValues>();
  const [planForm] = Form.useForm<PlanFormValues>();
  const billingCycle = Form.useWatch('billingCycle', planForm);
  const products = useAdminProducts();
  const plans = useAdminPlans();
  const mutations = useCatalogMutations();
  const catalogError = products.error ?? plans.error;
  const mutationError = Object.values(mutations).find((mutation) => mutation.error)?.error;

  useEffect(() => {
    if (billingCycle) planForm.setFieldValue('durationMonths', billingCycle === 'MONTHLY' ? 1 : 12);
  }, [billingCycle, planForm]);

  const closeProduct = (force = false) => {
    if (!force && productForm.isFieldsTouched()) {
      Modal.confirm({ title: 'Bỏ thay đổi chưa lưu?', content: 'Các thay đổi trong form sẽ bị mất.', okText: 'Bỏ thay đổi', cancelText: 'Tiếp tục chỉnh sửa', onOk: () => closeProduct(true) });
      return;
    }
    setProductOpen(false);
    setEditingProduct(null);
    productForm.resetFields();
  };
  const closePlan = (force = false) => {
    if (!force && planForm.isFieldsTouched()) {
      Modal.confirm({ title: 'Bỏ thay đổi chưa lưu?', content: 'Các thay đổi trong form sẽ bị mất.', okText: 'Bỏ thay đổi', cancelText: 'Tiếp tục chỉnh sửa', onOk: () => closePlan(true) });
      return;
    }
    setPlanOpen(false);
    setEditingPlan(null);
    planForm.resetFields();
  };
  const openProduct = (product?: AdminProduct) => {
    setEditingProduct(product ?? null);
    productForm.setFieldsValue(product ? { code: product.code, name: product.name, description: product.description ?? '', imageUrl: product.imageUrl ?? '' } : {});
    setProductOpen(true);
  };
  const openPlan = (plan?: AdminPlan, productId?: string) => {
    setDesktopChanged(false);
    setEditingPlan(plan ?? null);
    const entitlements = splitPlanEntitlements(plan?.entitlements);
    planForm.setFieldsValue(plan ? { productId: plan.productId, code: plan.code, name: plan.name, billingCycle: plan.billingCycle, durationMonths: plan.durationMonths, priceVnd: plan.priceVnd, maxActiveDevices: plan.maxActiveDevices, desktopEntitlement: entitlements.desktop, advancedEntitlementsText: Object.keys(entitlements.advanced).length ? JSON.stringify(entitlements.advanced, null, 2) : '' } : { ...(productId ? { productId } : {}), desktopEntitlement: false, advancedEntitlementsText: '' });
    setPlanOpen(true);
  };
  const submitProduct = (values: ProductFormValues) => {
    const common = {
      name: values.name.trim(),
      ...(values.imageUrl?.trim() ? { imageUrl: values.imageUrl.trim() } : {}),
      ...(values.description !== undefined ? { description: values.description.trim() } : {}),
    };
    const request = editingProduct
      ? mutations.updateProduct.mutateAsync({ id: editingProduct.id, input: common })
      : mutations.createProduct.mutateAsync({ code: values.code.trim(), ...common });
    void request.then(() => { closeProduct(true); void messageApi.success(editingProduct ? 'Đã cập nhật sản phẩm.' : 'Đã tạo sản phẩm nháp.'); }).catch(() => undefined);
  };
  const submitPlan = (values: PlanFormValues) => {
    const expectedDuration = values.billingCycle === 'MONTHLY' ? 1 : 12;
    if (values.durationMonths !== expectedDuration) {
      planForm.setFields([{ name: 'durationMonths', errors: [`Gói ${values.billingCycle === 'MONTHLY' ? 'MONTHLY' : 'YEARLY'} phải có thời hạn ${expectedDuration} tháng.`] }]);
      return;
    }
    if (![values.priceVnd, values.maxActiveDevices].every((value) => Number.isSafeInteger(value) && value > 0)) {
      planForm.setFields([{ name: 'priceVnd', errors: ['Giá và các giới hạn phải là số nguyên dương.'] }]);
      return;
    }
    let entitlements: Record<string, unknown>;
    try {
      entitlements = mergePlanEntitlements(Boolean(values.desktopEntitlement), values.advancedEntitlementsText ?? '', desktopChanged ? undefined : editingPlan?.entitlements.desktop);
    } catch {
      planForm.setFields([{ name: 'advancedEntitlementsText', errors: ['Quyền lợi nâng cao phải là JSON object hợp lệ với khóa chuẩn và giá trị JSON hợp lệ (kể cả object, mảng và null). Không nhập desktop ở đây.'] }]);
      return;
    }
    const updateInput = { name: values.name.trim(), billingCycle: values.billingCycle, durationMonths: values.durationMonths, priceVnd: values.priceVnd, maxActiveDevices: values.maxActiveDevices, entitlements };
    const createInput = { productId: values.productId, code: values.code.trim(), ...updateInput };
    const request = editingPlan ? mutations.updatePlan.mutateAsync({ id: editingPlan.id, input: updateInput }) : mutations.createPlan.mutateAsync(createInput);
    void request.then(() => { closePlan(true); void messageApi.success(editingPlan ? 'Đã cập nhật gói.' : 'Đã tạo gói nháp.'); }).catch(() => undefined);
  };
  const run = (action: keyof typeof mutations, id: string) => {
    const mutation = mutations[action] as { mutateAsync: (value: string) => Promise<unknown> };
    void mutation.mutateAsync(id).then(() => void messageApi.success('Đã cập nhật danh mục.')).catch(() => undefined);
  };
  const renderPlans = (product: AdminProduct) => (
      <section className="table-card">
        <div className="section-heading"><h2 className="section-title">Gói sản phẩm</h2><Button onClick={() => openPlan(undefined, product.id)} disabled={product.status === 'ARCHIVED'}>Tạo gói</Button></div>
        {!plans.isLoading && !plans.isError && !plans.data?.some((plan) => plan.productId === product.id) ? <Empty description="Chưa có gói sản phẩm" /> : null}
        {!plans.isLoading && !plans.isError && plans.data?.length ? <Table dataSource={plans.data.filter((plan) => plan.productId === product.id && matches(`${plan.name} ${plan.code} ${products.data?.find((product) => product.id === plan.productId)?.name ?? ''}`))} pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }} rowKey="id" scroll={{ x: 1150 }} columns={[
          { title: 'Sản phẩm', dataIndex: 'productId', render: (id: string) => products.data?.find((product) => product.id === id)?.name ?? id },
          { title: 'Mã', dataIndex: 'code' }, { title: 'Tên gói', dataIndex: 'name' }, { title: 'Chu kỳ', dataIndex: 'billingCycle', render: (value: string) => value === 'MONTHLY' ? 'Hàng tháng' : 'Hàng năm' }, { title: 'Giá', dataIndex: 'priceVnd', render: (value: number) => formatVnd(value) }, { title: 'Thiết bị', dataIndex: 'maxActiveDevices' }, { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => <StatusChip tone={productStatusTone(value)}>{value === 'PUBLISHED' ? 'Đã công bố' : value === 'DRAFT' ? 'Bản nháp' : 'Đã lưu trữ'}</StatusChip> },
          { title: 'Thao tác', render: (_: unknown, record: AdminPlan) => <div className="table-actions"><Button size="small" onClick={() => openPlan(record)} disabled={record.status !== 'DRAFT'}>{record.status === 'PUBLISHED' ? 'Tạo bản nháp' : 'Sửa'}</Button>{record.status === 'DRAFT' ? <Button size="small" onClick={() => run('publishPlan', record.id)}>Công bố</Button> : null}{record.status === 'PUBLISHED' ? <Button size="small" onClick={() => run('archivePlan', record.id)}>Lưu trữ</Button> : null}{record.status === 'DRAFT' ? <Popconfirm title="Xóa gói nháp?" description="Thao tác này không thể hoàn tác." okText="Xóa" cancelText="Giữ lại" onConfirm={() => run('deletePlan', record.id)}><Button danger size="small">Xóa</Button></Popconfirm> : null}</div> },
        ]} /> : null}
      </section>
  );
  if (products.isLoading || plans.isLoading) return <PageLoading />;

  return (
    <>
      {contextHolder}
      <PageHeader title="Danh mục sản phẩm" action={<Button type="primary" onClick={() => openProduct()}>Tạo sản phẩm</Button>} />
      <Input.Search aria-label="Tìm sản phẩm hoặc gói" placeholder="Tìm theo tên sản phẩm, tên gói hoặc mã" value={query} onChange={(event) => setQuery(event.target.value)} />
      {catalogError ? <Alert showIcon type="error" message="Không thể tải danh mục quản trị." description={describeApiError(catalogError, 'Kiểm tra quyền PROVIDER_ADMIN hoặc thử lại.')} action={<Button onClick={() => { void products.refetch(); void plans.refetch(); }}>Thử lại</Button>} /> : null}
        {plans.isError ? <Alert type="error" title="Không thể tải danh sách gói." action={<Button disabled={plans.isFetching} onClick={() => void plans.refetch()}>Thử lại</Button>} /> : null}
      {mutationError ? <Alert showIcon type="error" message={describeApiError(mutationError, 'Không thể cập nhật danh mục.')} /> : null}
      <section className="workspace-card table-card">
        <div className="section-heading"><h2 className="section-title">Sản phẩm</h2></div>
        {products.isError ? <Alert type="error" title="Không thể tải danh sách sản phẩm." action={<Button disabled={products.isFetching} onClick={() => void products.refetch()}>Thử lại</Button>} /> : null}
        {!products.isLoading && !products.isError && products.data?.length === 0 ? <Empty description="Chưa có sản phẩm" /> : null}
        {!products.isLoading && !products.isError && products.data?.length ? <Table expandable={{ defaultExpandAllRows: true, expandedRowRender: renderPlans }} dataSource={products.data.filter((product) => matches(`${product.name} ${product.code}`) || plans.data?.some((plan) => plan.productId === product.id && matches(`${plan.name} ${plan.code}`)))} pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }} rowKey="id" scroll={{ x: 1050 }} columns={[
          { title: 'Mã', dataIndex: 'code' }, { title: 'Sản phẩm', dataIndex: 'name' }, { title: 'Mô tả', dataIndex: 'description' },
          { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => <StatusChip tone={productStatusTone(value)}>{value === 'PUBLISHED' ? 'Đã công bố' : value === 'DRAFT' ? 'Bản nháp' : 'Đã lưu trữ'}</StatusChip> },
          { title: 'Thao tác', render: (_: unknown, record: AdminProduct) => <div className="table-actions"><Button size="small" onClick={() => openProduct(record)} disabled={record.status !== 'DRAFT'}>Sửa</Button>{record.status === 'DRAFT' ? <Button size="small" onClick={() => run('publishProduct', record.id)}>Công bố</Button> : null}{record.status === 'PUBLISHED' ? <Button size="small" onClick={() => run('archiveProduct', record.id)}>Lưu trữ</Button> : null}{record.status === 'DRAFT' ? <Popconfirm title="Xóa sản phẩm nháp?" description="Thao tác này không thể hoàn tác." okText="Xóa" cancelText="Giữ lại" onConfirm={() => run('deleteProduct', record.id)}><Button danger size="small">Xóa</Button></Popconfirm> : null}</div> },
        ]} /> : null}
      </section>

      <Modal open={productOpen} title={editingProduct ? 'Sửa sản phẩm' : 'Tạo sản phẩm'} okText="Lưu" cancelText="Hủy" okButtonProps={{ disabled: mutations.createProduct.isPending || mutations.updateProduct.isPending }} onCancel={() => closeProduct()} onOk={() => void productForm.submit()}>
        <LoadingOverlay active={Boolean(productOpen) && (mutations.createProduct.isPending || mutations.updateProduct.isPending)} />
        <Form form={productForm} layout="vertical" onFinish={submitProduct}>
          <Form.Item label="Mã sản phẩm" name="code" rules={[{ required: true, message: 'Vui lòng nhập mã sản phẩm.' }]}><Input disabled={Boolean(editingProduct)} /></Form.Item>
          <Form.Item label="Tên sản phẩm" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm.' }]}><Input /></Form.Item>
          <Form.Item label="Ảnh sản phẩm (URL HTTPS)" name="imageUrl" extra="Để trống để giữ ảnh hiện tại khi chỉnh sửa." rules={[{ type: 'url', message: 'Vui lòng nhập URL hợp lệ.' }, { pattern: /^https:\/\//, message: 'Ảnh phải sử dụng HTTPS.' }]}><Input placeholder="https://..." /></Form.Item>
          <Form.Item label="Mô tả" name="description"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
      <Modal open={planOpen} title={editingPlan ? 'Sửa gói' : 'Tạo gói'} okText="Lưu" cancelText="Hủy" okButtonProps={{ disabled: mutations.createPlan.isPending || mutations.updatePlan.isPending }} onCancel={() => closePlan()} onOk={() => void planForm.submit()}>
        <LoadingOverlay active={Boolean(planOpen) && (mutations.createPlan.isPending || mutations.updatePlan.isPending)} />
        <Form form={planForm} layout="vertical" onFinish={submitPlan}>
          <Form.Item label="Sản phẩm" name="productId" rules={[{ required: true, message: 'Vui lòng chọn sản phẩm.' }]}><Select disabled={Boolean(editingPlan)} options={(products.data ?? []).filter((product) => product.status !== 'ARCHIVED').map((product) => ({ value: product.id, label: `${product.name} (${product.code})` }))} /></Form.Item>
          <div className="form-grid"><Form.Item label="Mã gói" name="code" rules={[{ required: true, message: 'Vui lòng nhập mã gói.' }]}><Input disabled={Boolean(editingPlan)} /></Form.Item><Form.Item label="Tên gói" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên gói.' }]}><Input /></Form.Item></div>
          <div className="form-grid"><Form.Item label="Chu kỳ" name="billingCycle" rules={[{ required: true, message: 'Vui lòng chọn chu kỳ.' }]}><Select options={[{ value: 'MONTHLY', label: 'Hàng tháng' }, { value: 'YEARLY', label: 'Hàng năm' }]} /></Form.Item><Form.Item label="Thời hạn (tháng)" name="durationMonths" rules={[{ required: true, message: 'Vui lòng nhập thời hạn.' }, { type: 'number', min: 1, message: 'Phải là số nguyên dương.' }]}><InputNumber readOnly precision={0} min={1} style={{ width: '100%' }} /></Form.Item></div>
           <div className="form-grid"><Form.Item label="Giá VND" name="priceVnd" rules={[{ required: true, message: 'Vui lòng nhập giá.' }, { type: 'number', min: 1, message: 'Giá phải lớn hơn 0.' }]}><InputNumber precision={0} min={1} style={{ width: '100%' }} /></Form.Item><Form.Item label="Số thiết bị tối đa" name="maxActiveDevices" rules={[{ required: true, message: 'Vui lòng nhập số thiết bị.' }, { type: 'number', min: 1, message: 'Phải lớn hơn 0.' }]}><InputNumber precision={0} min={1} style={{ width: '100%' }} /></Form.Item></div>
          <Form.Item label="Ứng dụng máy tính" name="desktopEntitlement" valuePropName="checked" extra="Bật quyền sử dụng ứng dụng máy tính cho gói này."><Switch checkedChildren="Bật" unCheckedChildren="Tắt" onChange={() => setDesktopChanged(true)} /></Form.Item>
          <Collapse items={[{ key: 'advanced', forceRender: true, label: 'Quyền lợi nâng cao', children: <Form.Item label="Quyền lợi bổ sung (JSON)" name="advancedEntitlementsText" extra='JSON object hỗ trợ chuỗi, số hữu hạn, boolean, null, mảng và object lồng nhau. Ví dụ: {"seats": 5, "support": "priority"}.'><Input.TextArea rows={5} placeholder='{"seats": 5}' /></Form.Item> }]} />
        </Form>
      </Modal>
    </>
  );
}
