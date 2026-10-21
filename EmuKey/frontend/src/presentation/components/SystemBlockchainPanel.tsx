import { Alert, Button, Modal } from 'antd';
import { useState } from 'react';
import { useBlockchainReconciliation } from '../../application/operations/operationsQueries';
import { FactList, PageHeader } from './WorkspacePrimitives';

export function SystemBlockchainPanel() {
  const reconciliation = useBlockchainReconciliation();
  const [confirming, setConfirming] = useState(false);
  const result = reconciliation.data;
  return <div className="system-screen">
    <PageHeader title="Đối soát blockchain" description="Kiểm tra và đồng bộ trạng thái giữa dữ liệu hệ thống và các sự kiện blockchain." />
    <section className="workspace-card system-section" aria-label="Chạy đối soát blockchain">
      <div className="section-heading"><h2>Kiểm tra và đồng bộ</h2><Button type="primary" loading={reconciliation.isPending} onClick={() => setConfirming(true)}>Chạy đối soát</Button></div>
      <p className="muted-copy">Tác vụ kiểm tra biên nhận, tiếp nhận sự kiện và cập nhật dữ liệu hệ thống theo chuỗi đã xác nhận. Các sai lệch còn lại sẽ được báo cáo trong kết quả.</p>
      {reconciliation.isPending ? <p role="status" aria-live="polite">Đang đối soát. Vui lòng chờ kết quả từ hệ thống.</p> : null}
      {reconciliation.isError ? <Alert showIcon type="error" title="Không thể chạy đối soát blockchain." description="Kết quả lần chạy chưa xác định; dữ liệu có thể đã được cập nhật một phần. Kiểm tra trước khi chạy lại." action={<Button onClick={() => setConfirming(true)}>Thử lại</Button>} /> : null}
      {!result && !reconciliation.isPending && !reconciliation.isError ? <p className="system-inline-state">Chưa chạy đối soát trong phiên làm việc này.</p> : null}
    </section>
    {result ? <section className="workspace-card system-section" aria-label="Kết quả đối soát">
      <h2>Kết quả lần chạy gần nhất{reconciliation.isPending || reconciliation.isError ? ' thành công' : ''}</h2>
      <p role="status">{result.processed ? 'Đã thực hiện cập nhật dữ liệu.' : 'Không phát sinh cập nhật dữ liệu trong lần chạy này.'} Kết quả này không đồng nghĩa mọi sai lệch đã được khắc phục.</p>
      <FactList facts={[
        { label: 'Sự kiện đã ghi nhận', value: result.indexedEvents },
        { label: 'Lệnh đã đối chiếu', value: result.reconciledCommandIds.length },
        { label: 'Bản ghi bản quyền đã đồng bộ lại', value: result.projection.licenseRepairs },
        { label: 'Bản ghi lệnh đã đồng bộ lại', value: result.projection.commandRepairs },
        { label: 'Sai lệch projection còn lại', value: result.projection.remainingMismatches },
        { label: 'Yêu cầu chưa rõ kết quả', value: result.health.unknown_commands },
        { label: 'Sự kiện chờ xác nhận quá 5 phút', value: result.health.pending_events },
        { label: 'Sự kiện bị thay đổi do tổ chức lại chuỗi', value: result.health.reorged_events },
        { label: 'Bản quyền thiếu sự kiện xác nhận', value: result.health.active_without_finality },
      ]} />
      {result.projection.remainingMismatches > 0 || result.health.active_without_finality > 0 ? <Alert showIcon type="warning" title="Vẫn còn sai lệch cần kiểm tra." description="Các số liệu trên phản ánh kết quả do backend xác nhận; không có thao tác sửa thủ công tại đây." /> : null}
    </section> : null}
    <Modal title="Chạy đối soát blockchain?" open={confirming} okText="Chạy đối soát" cancelText="Hủy" onCancel={() => setConfirming(false)} onOk={() => { setConfirming(false); reconciliation.mutate(); }}>
      <p>Tác vụ có thể đồng bộ lại trạng thái lệnh và bản quyền trong hệ thống theo dữ liệu blockchain đã xác nhận. Tiếp tục chạy?</p>
    </Modal>
  </div>;
}
