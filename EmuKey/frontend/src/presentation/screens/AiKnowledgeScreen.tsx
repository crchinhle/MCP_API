import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Empty, Input, Modal, Select, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useState } from 'react';

import { useAdminProducts } from '../../application/catalog/catalogQueries';
import { useCreateKnowledgeDocument, useKnowledgeDocuments, usePublishKnowledgeDocument } from '../../application/assistance/knowledgeQueries';
import { PageLoading, PageHeader } from '../components/WorkspacePrimitives';
import { describeApiError } from '../../application/auth/authContext';

export function AiKnowledgeScreen() {
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File>();
  const [productId, setProductId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const products = useAdminProducts();
  const documents = useKnowledgeDocuments();
  const create = useCreateKnowledgeDocument();
  const publish = usePublishKnowledgeDocument();
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (!/\.(pdf|txt)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      void messageApi.error('Vui lòng chọn tệp PDF hoặc TXT không quá 10 MB.');
      return Upload.LIST_IGNORE;
    }
    setFile(file);
    return false;
  };
  const visibleDocuments = (documents.data ?? []).filter((document) => `${document.title} ${document.logicalDocumentKey}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
  const upload = () => {
    if (!file || !productId) return;
    const title = file.name.replace(/\.[^.]+$/, '');
    create.mutate({ file, productId, logicalDocumentKey: `${productId}/${title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 130) || 'document'}`, sourceType: file.name.toLocaleLowerCase('vi').endsWith('.pdf') ? 'PDF' : 'TXT', title }, {
      onSuccess: () => { setFile(undefined); setUploadOpen(false); void messageApi.success('Đã tải tài liệu lên.'); },
    });
  };
  if (products.isLoading || documents.isLoading) return <PageLoading />;

  return (
    <>
      {contextHolder}
      <PageHeader
        title="Kho tri thức AI"
      />
      <div className="workspace-actions knowledge-upload-actions">
        <Button onClick={() => setUploadOpen(true)} type="primary">Tải tài liệu</Button>
      </div>
      <Modal
        className="knowledge-upload-modal"
        destroyOnHidden
        footer={null}
        onCancel={() => { if (!create.isPending) setUploadOpen(false); }}
        open={uploadOpen}
        title="Tải tài liệu kiến thức"
      >
        <p>Tải hướng dẫn sản phẩm để trợ lý AI có nguồn tham khảo. Chấp nhận PDF hoặc TXT tối đa 10 MB. Tải lại cùng tên cho cùng sản phẩm sẽ tạo phiên bản mới; phiên bản cũ vẫn được dùng cho đến khi bạn công bố bản mới.</p>
        <div className="file-picker">
          <Select aria-label="Sản phẩm của tài liệu" onChange={setProductId} options={(products.data ?? []).filter((product) => product.status !== 'ARCHIVED').map((product) => ({ label: product.name, value: product.id }))} placeholder="Chọn sản phẩm" {...(productId ? { value: productId } : {})} />
          <label htmlFor="knowledge-upload">Chọn tài liệu kiến thức</label>
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
        </div>
      </Modal>
      {products.isError ? <Alert type="error" title="Không thể tải danh sách sản phẩm" action={<Button onClick={() => void products.refetch()}>Thử lại</Button>} /> : null}
      {create.isError || publish.isError ? <Alert type="error" title={describeApiError(publish.error ?? create.error, 'Không thể lưu hoặc công bố tài liệu. Vui lòng thử lại.')} action={<Button onClick={() => { void documents.refetch(); publish.reset(); }}>Tải lại danh sách</Button>} /> : null}
      <section className="workspace-card document-list">
        <div className="card-heading">
          <h2>Tài liệu đã nạp</h2>
          <Input.Search
            aria-label="Tìm tài liệu"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tài liệu"
            value={query}
          />
        </div>

        {documents.isError ? <Alert showIcon type="error" message="Không thể tải tài liệu kiến thức." /> : null}
        {!documents.isLoading && !documents.isError && visibleDocuments.length === 0 ? <Empty description="Chưa có tài liệu kiến thức phù hợp." /> : null}
        {visibleDocuments.map((document) => (
          <div className="data-row" key={document.id}>
            <span><strong>{document.title}</strong><small>{document.logicalDocumentKey} · v{document.version}</small></span>
            <span className="table-actions"><span className="status-chip status-chip--neutral">{document.isCurrent ? 'Đã công bố' : document.status === 'READY' ? 'Sẵn sàng' : document.status}</span>{document.status === 'READY' && !document.isCurrent ? <><Button disabled={(documents.isFetching || documents.isError) || (publish.isPending)}  onClick={() => publish.mutate({ id: document.id, expectedCurrentVersion: documents.data?.find((current) => current.logicalDocumentKey === document.logicalDocumentKey && current.isCurrent)?.version ?? 0 })}>Công bố</Button><LoadingOverlay active={publish.isPending} label="Đang xử lý yêu cầu: Công bố" /></> : null}</span>
          </div>
        ))}
      </section>
    </>
  );
}
