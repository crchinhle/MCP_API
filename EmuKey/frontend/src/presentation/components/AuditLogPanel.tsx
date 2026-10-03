import { Alert, Button, Drawer, Input, Select, Table } from 'antd';
import { useState } from 'react';
import { useAuditLogs } from '../../application/operations/operationsQueries';
import type { AuditEntryDto } from '../../infrastructure/api/generated';
import { FactList } from './WorkspacePrimitives';

export function AuditLogPanel() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [draftAction, setDraftAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [selected, setSelected] = useState<AuditEntryDto>();
  const logs = useAuditLogs(page, action, outcome);
  return <section aria-label="Nhật ký hệ thống">
    <h2>Nhật ký hệ thống</h2>
    <p>Nhật ký chỉ đọc; không hiển thị metadata nội bộ hoặc thông tin bí mật.</p>
    <div className="inline-filter">
      <Input.Search aria-label="Lọc mã hành động" placeholder="Mã hành động chính xác" maxLength={120} value={draftAction} onChange={(event) => setDraftAction(event.target.value)} onSearch={(value) => { setAction(value); setPage(1); }} enterButton="Lọc" />
      <Select aria-label="Lọc kết quả nhật ký" value={outcome} onChange={(value) => { setOutcome(value); setPage(1); }} options={[{ value: '', label: 'Mọi kết quả' }, { value: 'SUCCESS', label: 'Thành công' }, { value: 'DENIED', label: 'Bị từ chối' }, { value: 'FAILED', label: 'Thất bại' }]} />
      <Button loading={logs.isFetching} onClick={() => void logs.refetch()}>Làm mới</Button>
    </div>
    {logs.isError ? <Alert type="error" title="Không thể tải nhật ký. Vui lòng thử lại." /> : null}
    <Table rowKey="id" pagination={false} loading={logs.isPending} dataSource={logs.data?.items ?? []} scroll={{ x: 800 }} columns={[
      { title: 'Thời gian', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString('vi-VN') },
      { title: 'Hành động', dataIndex: 'action' }, { title: 'Kết quả', dataIndex: 'outcome' }, { title: 'Vai trò', dataIndex: 'actorRole' },
      { title: 'Thao tác', render: (_: unknown, row: AuditEntryDto) => <Button onClick={() => setSelected(row)}>Chi tiết nhật ký</Button> },
    ]} />
    <div className="workspace-actions"><Button disabled={page === 1 || logs.isFetching} onClick={() => setPage(page - 1)}>Trang trước</Button><span>Trang {page}</span><Button disabled={!logs.data?.hasMore || logs.isFetching} onClick={() => setPage(page + 1)}>Trang sau</Button></div>
    <Drawer title="Chi tiết nhật ký" open={Boolean(selected)} onClose={() => setSelected(undefined)}>
      {selected ? <FactList facts={Object.entries(selected).map(([label, value]) => ({ label, value: value ?? '—' }))} /> : null}
    </Drawer>
  </section>;
}
