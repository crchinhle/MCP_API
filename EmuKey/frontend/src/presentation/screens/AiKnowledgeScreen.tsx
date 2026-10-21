import { paginationTextControls } from '../theme';
import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Drawer, Empty, Input, Modal, Select, Table, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useState } from 'react';

import { useAdminProducts } from '../../application/catalog/catalogQueries';
import { knowledgeDocumentState, useCreateKnowledgeDocument, useKnowledgeDocument, useKnowledgeDocuments, usePublishKnowledgeDocument } from '../../application/assistance/knowledgeQueries';
import type { KnowledgeDocumentDto } from '../../infrastructure/api/generated';
import { PageLoading, PageHeader, StatusChip } from '../components/WorkspacePrimitives';
import { describeApiError, useAuth } from '../../application/auth/authContext';

export function AiKnowledgeScreen() {
  const { user } = useAuth();
  const canApprove = user?.role === 'SYSTEM_ADMIN';
  const publish = usePublishKnowledgeDocument();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(canApprove ? 'READY' : '');
  const [productFilter, setProductFilter] = useState('');
  const [file, setFile] = useState<File>();
  const [productId, setProductId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedSnapshot, setSelected] = useState<KnowledgeDocumentDto>();
  const [publishing, setPublishing] = useState<KnowledgeDocumentDto>();
  const [observedVersion, setObservedVersion] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const products = useAdminProducts(!canApprove);
  const documents = useKnowledgeDocuments();
  const selected = documents.data?.find((document) => document.id === selectedSnapshot?.id) ?? selectedSnapshot;
  const detail = useKnowledgeDocument(selected?.id);
  const create = useCreateKnowledgeDocument();
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (!/\.(pdf|txt)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      void messageApi.error('Vui lòng chọn tệp PDF hoặc TXT không quá 10 MB.');
      return Upload.LIST_IGNORE;
    }
    setFile(file);
    return false;
  };
  const documentState = (document: KnowledgeDocumentDto) => knowledgeDocumentState(document, documents.data ?? []);
  const confirmPublication = (document: KnowledgeDocumentDto) => {
    publish.reset();
    setObservedVersion(documents.data?.find((other) => other.providerUserId === document.providerUserId && other.logicalDocumentKey === document.logicalDocumentKey && other.isCurrent)?.version ?? 0);
    setPublishing(document);
  };
  const statusLabels: Record<string, string> = { PUBLISHED: 'Đã công bố', READY: 'Chờ duyệt', PREVIOUS: 'Phiên bản cũ', PENDING: 'Đang tiếp nhận', PROCESSING: 'Đang xử lý', FAILED: 'Xử lý thất bại', ARCHIVED: 'Đã lưu trữ' };
  const visibleDocuments = (documents.data ?? []).filter((document) => (!productFilter || document.productId === productFilter) && (!statusFilter || documentState(document) === statusFilter) && `${document.title} ${document.logicalDocumentKey}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
  const upload = () => {
    if (!file || !productId) return;
    const title = file.name.replace(/\.[^.]+$/, '');
    create.mutate({ file, productId, logicalDocumentKey: `${productId}/${title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 130) || 'document'}`, sourceType: file.name.toLocaleLowerCase('vi').endsWith('.pdf') ? 'PDF' : 'TXT', title }, {
      onSuccess: () => { setFile(undefined); setUploadOpen(false); void messageApi.success('Đã tải tài liệu lên.'); },
    });
  };
  if (!canApprove && (products.isLoading || documents.isLoading)) return <PageLoading />;

  return (
    <div className="knowledge-screen">
      {contextHolder}
      <PageHeader title={canApprove ? 'Duyệt tài liệu' : 'Tài liệu sản phẩm'} {...(canApprove ? { description: 'Xem xét tài liệu do nhà cung cấp gửi và quản lý phiên bản công bố.' } : {})} action={!canApprove ? <Button onClick={() => { create.reset(); setUploadOpen(true); }} type="primary">Tải tài liệu lên</Button> : undefined} />
      <Modal
        className="knowledge-upload-modal"
        destroyOnHidden
        footer={null}
        onCancel={() => { if (!create.isPending) setUploadOpen(false); }}
        open={uploadOpen}
        title="Tải tài liệu sản phẩm"
      >
        <p>Tải tài liệu hướng dẫn sử dụng để khách hàng và trợ lý AI cùng tham khảo sau khi System Admin duyệt. Chấp nhận PDF hoặc TXT tối đa 10 MB. Tải lại cùng tên cho cùng sản phẩm sẽ tạo phiên bản mới; phiên bản đang công bố vẫn được sử dụng cho đến khi bản mới được duyệt.</p>
        <div className="file-picker">
          <Select aria-label="Sản phẩm của tài liệu" onChange={setProductId} options={(products.data ?? []).filter((product) => product.status !== 'ARCHIVED').map((product) => ({ label: product.name, value: product.id }))} placeholder="Chọn sản phẩm" {...(productId ? { value: productId } : {})} />
          <label htmlFor="knowledge-upload">Chọn tài liệu hướng dẫn</label>
          <Upload
            accept=".pdf,.txt"
            beforeUpload={beforeUpload}
            id="knowledge-upload"
            showUploadList={false}
          >
            <Button>Chọn tệp</Button>
          </Upload>
          <><Button disabled={(!file || !productId) || (create.isPending)} onClick={upload} type="primary">Tải lên</Button><LoadingOverlay active={create.isPending} label="Đang xử lý yêu cầu: Tải lên" /></>
          {file ? <span>Đã chọn: {file.name}</span> : null}
          {create.isError ? <Alert showIcon type="error" title={describeApiError(create.error, 'Không thể tải tài liệu. Vui lòng thử lại.')} /> : null}
        </div>
      </Modal>
      {products.isError ? <Alert type="error" title="Không thể tải danh sách sản phẩm" action={<Button onClick={() => void products.refetch()}>Thử lại</Button>} /> : null}
      {create.isError ? <Alert type="error" title={describeApiError(create.error, 'Không thể tải tài liệu. Vui lòng thử lại.')} action={<Button onClick={() => { void documents.refetch(); create.reset(); }}>Tải lại danh sách</Button>} /> : null}
      {!canApprove ? <Alert showIcon type="info" title="Quy trình duyệt tài liệu" description="Tài liệu do nhà cung cấp tải lên cần được quản trị viên hệ thống duyệt và công bố trước khi khách hàng hoặc trợ lý AI sử dụng. Tài liệu đã công bố vẫn có hiệu lực trong lúc phiên bản mới chờ duyệt." /> : null}
      {publish.isError ? <Alert type="error" title={describeApiError(publish.error, 'Không thể công bố tài liệu.')} action={<Button onClick={() => { void documents.refetch(); publish.reset(); }}>Tải lại danh sách</Button>} /> : null}
      <section className="workspace-card document-list">
        <div className="card-heading">
          <h2>{canApprove ? 'Hàng đợi phê duyệt' : 'Danh sách tài liệu'}</h2>
          {!canApprove ? <Select aria-label="Lọc sản phẩm của tài liệu" value={productFilter} onChange={setProductFilter} options={[{ value: '', label: 'Tất cả sản phẩm' }, ...(products.data ?? []).map((product) => ({ value: product.id, label: product.name }))]} /> : null}
          <Select aria-label="Lọc trạng thái tài liệu" value={statusFilter} onChange={setStatusFilter} options={[{value:'',label:'Tất cả trạng thái'}, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
          <Input.Search
            aria-label="Tìm tài liệu"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tài liệu"
            value={query}
          />
        </div>

        {documents.isError ? <Alert showIcon type="error" message="Không thể tải tài liệu kiến thức." action={<Button disabled={documents.isFetching} onClick={() => void documents.refetch()}>Thử lại</Button>} /> : null}
        {documents.isLoading ? <p role="status">Đang tải tài liệu…</p> : null}
        {!documents.isLoading && !documents.isError && visibleDocuments.length === 0 ? <Empty description={canApprove ? documents.data?.length ? 'Không có tài liệu phù hợp với bộ lọc.' : 'Chưa có tài liệu được gửi.' : 'Chưa có tài liệu kiến thức phù hợp.'} /> : null}
        {!documents.isError && visibleDocuments.length > 0 ? <Table rowKey="id" dataSource={visibleDocuments} scroll={{ x: 640 }} pagination={{ ...paginationTextControls,pageSize:10,showSizeChanger:false,hideOnSinglePage:true}} columns={[
          {title:'Tài liệu',render:(_,document) => <><Button type="link" onClick={() => setSelected(document)}>{document.title}</Button>{!canApprove ? <div className="muted-copy">{document.logicalDocumentKey}</div> : null}</>},
          ...(!canApprove ? [{ title: 'Sản phẩm', render: (_: unknown, document: KnowledgeDocumentDto) => products.data?.find((product) => product.id === document.productId)?.name ?? '—' }] : []),
          {title:'Phiên bản',dataIndex:'version',render:(value:number) => `v${value}`},
          {title:'Trạng thái duyệt',render:(_,document) => <StatusChip tone={document.isCurrent ? 'success' : document.status === 'FAILED' ? 'error' : 'neutral'}>{statusLabels[documentState(document)] ?? 'Trạng thái chưa xác định'}</StatusChip>},
          ...(canApprove ? [{ title: 'Thao tác', render: (_: unknown, document: KnowledgeDocumentDto) => <div className="table-actions"><Button onClick={() => setSelected(document)}>Xem chi tiết</Button>{documentState(document) === 'READY' ? <Button disabled={publish.isPending} onClick={() => confirmPublication(document)}>Công bố</Button> : null}</div> }] : []),
        ]} /> : null}
      </section>
      <Drawer {...(canApprove ? { className: 'system-drawer' } : {})} title={selected?.title ?? 'Chi tiết tài liệu'} size="large" open={Boolean(selected)} onClose={() => setSelected(undefined)}>
        {selected ? <><p className="muted-copy">{selected.logicalDocumentKey} · v{selected.version} · {statusLabels[documentState(selected)] ?? selected.status}</p><h2>Nội dung tài liệu</h2></> : null}
        {detail.isPending ? <p role="status">Đang tải nội dung…</p> : detail.isError ? <Alert type="error" title="Không thể tải nội dung tài liệu" action={<Button onClick={() => void detail.refetch()}>Thử lại</Button>} /> : <div className="document-content">{detail.data?.chunks.join('\n\n') || 'Chưa có nội dung để hiển thị.'}</div>}
        {canApprove && selected ? <dl className="fact-list">
          <div><dt>Mã sản phẩm</dt><dd>{selected.productId ?? 'Chưa cung cấp'}</dd></div>
          <div><dt>Phiên bản hiện hành</dt><dd>{documents.data?.find((document) => document.providerUserId === selected.providerUserId && document.logicalDocumentKey === selected.logicalDocumentKey && document.isCurrent)?.version ?? 'Chưa có bản công bố'}</dd></div>
          <div><dt>Mã nhà cung cấp</dt><dd>{selected.providerUserId ?? 'Chưa cung cấp'}</dd></div>
        </dl> : null}
        {canApprove && selected && documentState(selected) === 'READY' ? <Button type="primary" disabled={detail.isPending || detail.isError || publish.isPending} onClick={() => confirmPublication(selected)}>Công bố tài liệu</Button> : null}
      </Drawer>
      <Modal title="Công bố tài liệu?" open={Boolean(publishing)} confirmLoading={publish.isPending} okText="Xác nhận công bố" cancelText="Hủy" onCancel={() => { if (!publish.isPending) setPublishing(undefined); }} onOk={() => {
        if (publishing && !publish.isPending) publish.mutate({ id: publishing.id, expectedCurrentVersion: observedVersion }, { onSuccess: () => { setPublishing(undefined); void messageApi.success('Đã công bố tài liệu.'); } });
      }}>
        <p>{publishing?.title} · v{publishing?.version}</p>
        <p>Phiên bản hiện hành đã đối chiếu: {observedVersion ? `v${observedVersion}` : 'Chưa có bản công bố'}.</p>
        <p>Phiên bản này sẽ được sử dụng cho khách hàng và trợ lý AI thay cho phiên bản hiện hành sau khi hệ thống xác nhận.</p>
        {publish.isError ? <Alert type="error" title={describeApiError(publish.error, 'Không thể công bố tài liệu.')} /> : null}
      </Modal>
    </div>
  );
}
