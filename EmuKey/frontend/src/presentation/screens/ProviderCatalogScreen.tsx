import { paginationTextControls } from '../theme';
import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Collapse, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Table, message, Dropdown } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  return 'neutral' as const;
}

export function ProviderCatalogScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const createRequested = searchParams.get('create') === 'product';
  const previousCreate = useRef(false);
  const [query, setQuery] = useState('');
  const [focusedProductId, setFocusedProductId] = useState<string | null>(null);
  const requestedStatus = searchParams.get('status') ?? '';
  const statusFilter = ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(requestedStatus) ? requestedStatus : '';
  const setStatusFilter = (value: string) => setSearchParams((previous) => {
    const next = new URLSearchParams(previous);
    if (value) next.set('status', value);
    else next.delete('status');
    return next;
  }, { replace: true });
  const [sortBy, setSortBy] = useState('name');
  const matches = (value: string) => value.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
  const [productOpen, setProductOpen] = useState(createRequested);
  const [planOpen, setPlanOpen] = useState(false);
  const [productDirty, setProductDirty] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<AdminProduct | null>(null);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [desktopChanged, setDesktopChanged] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [productForm] = Form.useForm<ProductFormValues>();
  const [planForm] = Form.useForm<PlanFormValues>();
  const billingCycle = Form.useWatch('billingCycle', planForm);
  const products = useAdminProducts();
  const plans = useAdminPlans();
  const mutations = useCatalogMutations();
  const resetCreateProduct = mutations.createProduct.reset;
  const resetUpdateProduct = mutations.updateProduct.reset;
  const catalogError = products.error ?? plans.error;
  const mutationError = Object.values(mutations).find((mutation) => mutation.error)?.error;
  const mutationPending = Object.values(mutations).some((mutation) => mutation.isPending);

  useEffect(() => {
    if (products.isPending || plans.isPending) return;
    if (createRequested) {
      resetCreateProduct();
      resetUpdateProduct();
      setEditingProduct(null);
      setProductDirty(false);
      productForm.resetFields();
      setProductOpen(true);
    } else if (previousCreate.current) {
      setProductOpen(false);
    }
    previousCreate.current = createRequested;
  }, [createRequested, productForm, resetCreateProduct, resetUpdateProduct, products.isPending, plans.isPending]);

  useEffect(() => {
    if (billingCycle) planForm.setFieldValue('durationMonths', billingCycle === 'MONTHLY' ? 1 : 12);
  }, [billingCycle, planForm]);

  const closeProduct = (force = false) => {
    if (!force && (mutations.createProduct.isPending || mutations.updateProduct.isPending)) return;
    if (!force && productDirty) {
      modal.confirm({ title: 'Bỏ thay đổi chưa lưu?', content: 'Các thay đổi trong form sẽ bị mất.', okText: 'Bỏ thay đổi', cancelText: 'Tiếp tục chỉnh sửa', onOk: () => closeProduct(true) });
      return;
    }
    setProductOpen(false);
    if (createRequested) setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('create');
      return next;
    });
    setEditingProduct(null);
    setProductDirty(false);
    productForm.resetFields();
  };
  const closePlan = (force = false) => {
    if (!force && (mutations.createPlan.isPending || mutations.updatePlan.isPending)) return;
    if (!force && planDirty) {
      modal.confirm({ title: 'Bỏ thay đổi chưa lưu?', content: 'Các thay đổi trong form sẽ bị mất.', okText: 'Bỏ thay đổi', cancelText: 'Tiếp tục chỉnh sửa', onOk: () => closePlan(true) });
      return;
    }
    setPlanOpen(false);
    setEditingPlan(null);
    setPlanDirty(false);
    planForm.resetFields();
  };
  const openProduct = (product?: AdminProduct) => {
    setProductDirty(false);
    mutations.createProduct.reset();
    mutations.updateProduct.reset();
    setEditingProduct(product ?? null);
    productForm.resetFields();
    productForm.setFieldsValue(product ? { code: product.code, name: product.name, description: product.description ?? '', imageUrl: product.imageUrl ?? '' } : {});
    setProductOpen(true);
  };
  const openPlan = (plan?: AdminPlan, productId?: string) => {
    setPlanDirty(false);
    mutations.createPlan.reset();
    mutations.updatePlan.reset();
    setDesktopChanged(false);
    setEditingPlan(plan ?? null);
    planForm.resetFields();
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
  const run = (action: 'publishProduct' | 'archiveProduct' | 'publishPlan' | 'archivePlan', id: string) => {
    if (mutationPending) return;
    const mutation = mutations[action];
    void mutation.mutateAsync(id).then(() => void messageApi.success('Đã cập nhật danh mục.')).catch(() => undefined);
  };
  const deleteDraft = (product: AdminProduct) => {
    if (product.status !== 'DRAFT' || mutationPending) return;
    mutations.deleteProduct.reset();
    setDeletingProduct(product);
  };
  const renderPlans = (product: AdminProduct) => (
      <section className="table-card">
        <div className="section-heading"><h2 className="section-title">Gói của {product.name}</h2><Button onClick={() => openPlan(undefined, product.id)} disabled={product.status === 'ARCHIVED' || mutationPending}>Tạo gói</Button></div>
        {!plans.isLoading && !plans.isError && !plans.data?.some((plan) => plan.productId === product.id) ? <Empty description="Chưa có gói sản phẩm" /> : null}
        {!plans.isLoading && !plans.isError && plans.data?.some((plan) => plan.productId === product.id) ? <Table dataSource={plans.data.filter((plan) => plan.productId === product.id)} pagination={{ ...paginationTextControls, pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }} rowKey="id" scroll={{ x: 1000 }} columns={[
          { title: 'Mã', dataIndex: 'code' }, { title: 'Tên gói', dataIndex: 'name' }, { title: 'Chu kỳ', dataIndex: 'billingCycle', render: (value: string) => value === 'MONTHLY' ? 'Hàng tháng' : 'Hàng năm' }, { title: 'Giá', dataIndex: 'priceVnd', render: (value: number) => formatVnd(value) }, { title: 'Thiết bị', dataIndex: 'maxActiveDevices' }, { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => <StatusChip tone={productStatusTone(value)}>{value === 'PUBLISHED' ? 'Đã công bố' : value === 'DRAFT' ? 'Bản nháp' : 'Đã lưu trữ'}</StatusChip> },
          { title: 'Thao tác', render: (_: unknown, record: AdminPlan) => <div className="table-actions">{record.status === 'DRAFT' ? <Button disabled={mutationPending} size="small" onClick={() => openPlan(record)}>Sửa</Button> : null}{record.status === 'DRAFT' ? <Button disabled={mutationPending} size="small" onClick={() => run('publishPlan', record.id)}>Công bố</Button> : null}{record.status === 'PUBLISHED' ? <Button disabled={mutationPending} size="small" onClick={() => run('archivePlan', record.id)}>Lưu trữ</Button> : null}{record.status === 'DRAFT' ? <Popconfirm title="Xóa gói nháp?" description="Thao tác này không thể hoàn tác." okText="Xóa" cancelText="Giữ lại" onConfirm={() => { void mutations.deletePlan.mutateAsync(record.id).then(() => { void messageApi.success('Đã xóa gói nháp.'); }).catch(() => undefined); }}><Button disabled={mutationPending} danger size="small">Xóa</Button></Popconfirm> : null}</div> },
        ]} /> : null}
      </section>
  );
  if (products.isLoading || plans.isLoading) return <PageLoading />;

  return (
    <div className="provider-catalog-screen">
      {contextHolder}
      {modalContextHolder}
      <PageHeader title="Sản phẩm và gói bán" action={<Button type="primary" onClick={() => openProduct()}>Thêm sản phẩm</Button>} />
      <p className="catalog-help">Quản lý sản phẩm và các gói giá bán. Chọn một sản phẩm để xem và chỉnh sửa gói của sản phẩm đó.</p>
      <div className="inline-filter"><Input.Search aria-label="Tìm sản phẩm hoặc gói" placeholder="Tìm theo tên hoặc mã" value={query} onChange={(event) => setQuery(event.target.value)} /><Select aria-label="Lọc trạng thái sản phẩm" value={statusFilter} onChange={setStatusFilter} options={[{value:'',label:'Tất cả trạng thái'},{value:'DRAFT',label:'Bản nháp'},{value:'PUBLISHED',label:'Đã công bố'},{value:'ARCHIVED',label:'Đã lưu trữ'}]} /><Select aria-label="Sắp xếp sản phẩm" value={sortBy} onChange={setSortBy} options={[{value:'name',label:'Tên A–Z'},{value:'name-desc',label:'Tên Z–A'},{value:'status',label:'Trạng thái'}]} /></div>
      {catalogError ? <Alert showIcon type="error" message="Không thể tải danh mục quản trị." description={describeApiError(catalogError, 'Kiểm tra quyền PROVIDER_ADMIN hoặc thử lại.')} action={<Button onClick={() => { void products.refetch(); void plans.refetch(); }}>Thử lại</Button>} /> : null}
        {plans.isError ? <Alert type="error" title="Không thể tải danh sách gói." action={<Button disabled={plans.isFetching} onClick={() => void plans.refetch()}>Thử lại</Button>} /> : null}
      {mutationError ? <Alert showIcon type="error" message={describeApiError(mutationError, 'Không thể cập nhật danh mục.')} /> : null}
      {focusedProductId && products.data?.some((product) => product.id === focusedProductId) ? <section className="workspace-card section-card"><Button type="link" onClick={() => setFocusedProductId(null)}>Danh sách sản phẩm</Button><h2>{products.data.find((product) => product.id === focusedProductId)?.name}</h2><p>{products.data.find((product) => product.id === focusedProductId)?.description}</p>{renderPlans(products.data.find((product) => product.id === focusedProductId)!)}</section> : <section className="workspace-card table-card">
        <div className="section-heading"><h2 className="section-title">Sản phẩm</h2></div>
        {products.isError ? <Alert type="error" title="Không thể tải danh sách sản phẩm." action={<Button disabled={products.isFetching} onClick={() => void products.refetch()}>Thử lại</Button>} /> : null}
        {!products.isLoading && !products.isError && products.data?.length === 0 ? <Empty description="Chưa có sản phẩm" /> : null}
        {!products.isLoading && !products.isError && products.data?.length ? <Table dataSource={products.data.filter((product) => (!statusFilter || product.status === statusFilter) && (matches(`${product.name} ${product.code}`) || plans.data?.some((plan) => plan.productId === product.id && matches(`${plan.name} ${plan.code}`)))).sort((a,b) => sortBy === 'status' ? a.status.localeCompare(b.status) : sortBy === 'name-desc' ? b.name.localeCompare(a.name,'vi') : a.name.localeCompare(b.name,'vi'))} pagination={{ ...paginationTextControls, pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }} rowKey="id" scroll={{ x: 750 }} columns={[
          { title: 'Sản phẩm', render: (_: unknown, product: AdminProduct) => <Button type="link" onClick={() => setFocusedProductId(product.id)}>{product.name}</Button> }, { title: 'Mã', dataIndex: 'code' },
          { title: 'Số gói', render: (_: unknown, product: AdminProduct) => plans.data?.filter((plan) => plan.productId === product.id).length ?? 0 },
          { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => <StatusChip tone={productStatusTone(value)}>{value === 'PUBLISHED' ? 'Đã công bố' : value === 'DRAFT' ? 'Bản nháp' : 'Đã lưu trữ'}</StatusChip> },
          { title: 'Thao tác', render: (_: unknown, record: AdminProduct) => <Dropdown trigger={['click']} menu={{ items: [{key:'detail',label:'Xem gói'},{key:'edit',label:'Sửa',disabled:record.status !== 'DRAFT'},{key:'publish',label:'Công bố',disabled:record.status !== 'DRAFT'},{key:'archive',label:'Lưu trữ',disabled:record.status !== 'PUBLISHED'}, ...(record.status === 'DRAFT' ? [{key:'delete',label:'Xóa bản nháp',danger:true}] : [])], onClick: ({key}) => {if(key==='detail')setFocusedProductId(record.id); if(key==='edit')openProduct(record); if(key==='publish')run('publishProduct',record.id); if(key==='archive')run('archiveProduct',record.id); if(key==='delete')deleteDraft(record);}}}><Button disabled={mutationPending} size="small">Thao tác</Button></Dropdown> },
        ]} /> : null}
      </section>}

      <Modal open={Boolean(deletingProduct)} title="Xóa sản phẩm nháp?" okText="Xóa" cancelText="Giữ lại" confirmLoading={mutations.deleteProduct.isPending} okButtonProps={{ danger: true, 'aria-label': 'Xóa' }} onCancel={() => { if (!mutations.deleteProduct.isPending) setDeletingProduct(null); }} onOk={() => {
        if (!deletingProduct || mutations.deleteProduct.isPending) return;
        void mutations.deleteProduct.mutateAsync(deletingProduct.id).then(() => { setDeletingProduct(null); setFocusedProductId(null); void messageApi.success('Đã xóa sản phẩm nháp.'); }).catch(() => undefined);
      }}>
        <p>Sản phẩm “{deletingProduct?.name}” sẽ bị xóa. Thao tác này không thể hoàn tác.</p>
        {mutations.deleteProduct.isError ? <Alert type="error" showIcon title={describeApiError(mutations.deleteProduct.error, 'Không thể xóa sản phẩm. Vui lòng thử lại.')} /> : null}
      </Modal>
      <Modal open={productOpen} title={editingProduct ? 'Sửa sản phẩm' : 'Tạo sản phẩm'} okText="Lưu" cancelText="Hủy" okButtonProps={{ disabled: mutations.createProduct.isPending || mutations.updateProduct.isPending }} onCancel={() => closeProduct()} onOk={() => void productForm.submit()}>
        <LoadingOverlay active={Boolean(productOpen) && (mutations.createProduct.isPending || mutations.updateProduct.isPending)} />
        <Form form={productForm} layout="vertical" onFinish={submitProduct} onValuesChange={() => setProductDirty(true)}>
          <Form.Item label="Mã sản phẩm" name="code" rules={[{ required: true, message: 'Vui lòng nhập mã sản phẩm.' }]}><Input disabled={Boolean(editingProduct)} /></Form.Item>
          <Form.Item label="Tên sản phẩm" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm.' }]}><Input /></Form.Item>
          <Form.Item label="Ảnh sản phẩm (URL HTTPS)" name="imageUrl" extra="Để trống để giữ ảnh hiện tại khi chỉnh sửa." rules={[{ type: 'url', message: 'Vui lòng nhập URL hợp lệ.' }, { pattern: /^https:\/\//, message: 'Ảnh phải sử dụng HTTPS.' }]}><Input placeholder="https://..." /></Form.Item>
          <Form.Item label="Mô tả" name="description"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
      <Modal open={planOpen} title={editingPlan ? 'Sửa gói' : 'Tạo gói'} okText="Lưu" cancelText="Hủy" okButtonProps={{ disabled: mutations.createPlan.isPending || mutations.updatePlan.isPending }} onCancel={() => closePlan()} onOk={() => void planForm.submit()}>
        <LoadingOverlay active={Boolean(planOpen) && (mutations.createPlan.isPending || mutations.updatePlan.isPending)} />
        <Form form={planForm} layout="vertical" onFinish={submitPlan} onValuesChange={() => setPlanDirty(true)}>
          <Form.Item label="Sản phẩm" name="productId" rules={[{ required: true, message: 'Vui lòng chọn sản phẩm.' }]}><Select disabled={Boolean(editingPlan)} options={(products.data ?? []).filter((product) => product.status !== 'ARCHIVED').map((product) => ({ value: product.id, label: `${product.name} (${product.code})` }))} /></Form.Item>
          <div className="form-grid"><Form.Item label="Mã gói" name="code" rules={[{ required: true, message: 'Vui lòng nhập mã gói.' }]}><Input disabled={Boolean(editingPlan)} /></Form.Item><Form.Item label="Tên gói" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên gói.' }]}><Input /></Form.Item></div>
          <div className="form-grid"><Form.Item label="Chu kỳ" name="billingCycle" rules={[{ required: true, message: 'Vui lòng chọn chu kỳ.' }]}><Select options={[{ value: 'MONTHLY', label: 'Hàng tháng' }, { value: 'YEARLY', label: 'Hàng năm' }]} /></Form.Item><Form.Item label="Thời hạn (tháng)" name="durationMonths" rules={[{ required: true, message: 'Vui lòng nhập thời hạn.' }, { type: 'number', min: 1, message: 'Phải là số nguyên dương.' }]}><InputNumber controls={{ upIcon: '+', downIcon: '−' }} readOnly precision={0} min={1} style={{ width: '100%' }} /></Form.Item></div>
           <div className="form-grid"><Form.Item label="Giá VND" name="priceVnd" rules={[{ required: true, message: 'Vui lòng nhập giá.' }, { type: 'number', min: 1, message: 'Giá phải lớn hơn 0.' }]}><InputNumber controls={{ upIcon: '+', downIcon: '−' }} precision={0} min={1} style={{ width: '100%' }} /></Form.Item><Form.Item label="Số thiết bị tối đa" name="maxActiveDevices" rules={[{ required: true, message: 'Vui lòng nhập số thiết bị.' }, { type: 'number', min: 1, message: 'Phải lớn hơn 0.' }]}><InputNumber controls={{ upIcon: '+', downIcon: '−' }} precision={0} min={1} style={{ width: '100%' }} /></Form.Item></div>
          <Form.Item label="Ứng dụng máy tính" name="desktopEntitlement" valuePropName="checked" extra="Bật quyền sử dụng ứng dụng máy tính cho gói này."><Switch checkedChildren="Bật" unCheckedChildren="Tắt" onChange={() => setDesktopChanged(true)} /></Form.Item>
          <Collapse items={[{ key: 'advanced', forceRender: true, label: 'Quyền lợi nâng cao', children: <Form.Item label="Quyền lợi bổ sung (JSON)" name="advancedEntitlementsText" extra='JSON object hỗ trợ chuỗi, số hữu hạn, boolean, null, mảng và object lồng nhau. Ví dụ: {"seats": 5, "support": "priority"}.'><Input.TextArea rows={5} placeholder='{"seats": 5}' /></Form.Item> }]} />
        </Form>
      </Modal>
    </div>
  );
}
