import { Alert, Button, Input, Modal, Select } from 'antd';
import { useState } from 'react';
import { useAssistanceHealth, useBlockchainReconciliation, useDeadLetterRecovery } from '../../application/operations/operationsQueries';
import type { DeadLetterRecoveryDto } from '../../infrastructure/api/generated';
import { FactList, PageHeader } from './WorkspacePrimitives';

export function SystemBlockchainPanel() {
  const reconciliation = useBlockchainReconciliation();
  const [confirming, setConfirming] = useState(false);
  const result = reconciliation.data;
  const health = useAssistanceHealth();
  const recovery = useDeadLetterRecovery();
  const [commandId, setCommandId] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<DeadLetterRecoveryDto['mode']>('REQUEUE_NO_SUBMISSION');
  const [evidence, setEvidence] = useState('');
  const [recoveryInput, setRecoveryInput] = useState<{ commandId: string; input: DeadLetterRecoveryDto }>();
  const [inputError, setInputError] = useState('');
  const prepareRecovery = () => {
    setInputError('');
    try {
      const parsed: unknown = evidence.trim() ? JSON.parse(evidence) : undefined;
      if (parsed !== undefined && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) throw new Error();
      if (mode === 'ABANDON_NO_EFFECT' && !parsed) throw new Error();
      setRecoveryInput({ commandId: commandId.trim(), input: { mode, reason: reason.trim(), ...(parsed ? { evidence: parsed as Record<string, unknown> } : {}) } });
    } catch { setInputError('Bằng chứng phải là JSON object; không được bỏ trống khi hủy theo bằng chứng vô hiệu.'); }
  };
  return <div className="system-screen">
    <PageHeader title="Đối soát blockchain" />
    <section className="workspace-card system-section" aria-label="Tình trạng worker và thông báo">
      <h2>Thông báo và hàng đợi hỗ trợ</h2>
      {health.isPending ? <p role="status">Đang tải tình trạng worker…</p> : health.isError ? <Alert type="error" title="Không thể tải tình trạng worker" action={<Button onClick={() => void health.refetch()}>Thử lại</Button>} /> : <FactList facts={[
        { label: 'Thông báo chờ gửi', value: health.data.notifications.pending },
        { label: 'Thông báo chờ thử lại', value: health.data.notifications.retryableFailed },
        { label: 'Thông báo cần xử lý thủ công', value: health.data.notifications.deadLetter },
        { label: 'Worker gửi thông báo', value: health.data.workers?.notifications ?? 'UNKNOWN' },
        { label: 'Worker phân công hỗ trợ', value: health.data.workers?.supportLeases ?? 'UNKNOWN' },
        { label: 'Worker nhắc hết hạn', value: health.data.workers?.expiry ?? 'UNKNOWN' },
      ]} />}
      <p>UP: có heartbeat trong hạn. DOWN: chưa nhận heartbeat hoặc worker đã dừng. UNKNOWN: chưa kiểm tra được Redis. Các trạng thái này không chứng minh dịch vụ bên ngoài đã gửi thành công.</p>
    </section>
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
    <section className="workspace-card system-section" aria-label="Phục hồi lệnh dead-letter">
      <h2>Phục hồi lệnh cần xử lý</h2>
      <Input aria-label="Mã lệnh cần xử lý" value={commandId} onChange={(event) => setCommandId(event.target.value)} placeholder="Command UUID từ chẩn đoán" />
      <Select aria-label="Cách phục hồi lệnh" value={mode} onChange={setMode} options={[
        { value: 'REQUEUE_NO_SUBMISSION', label: 'Đưa lại vào hàng đợi nếu chưa gửi' },
        { value: 'RECONCILE_SAME_RAW', label: 'Đối soát lại đúng giao dịch đã ký' },
        { value: 'ABANDON_REVERTED', label: 'Kết thúc lệnh có biên nhận revert' },
        { value: 'ABANDON_NO_EFFECT', label: 'Kết thúc khi có bằng chứng vô hiệu không thể đảo' },
      ]} />
      <Input.TextArea aria-label="Lý do phục hồi lệnh" value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} />
      <Input.TextArea aria-label="Bằng chứng phục hồi JSON" value={evidence} maxLength={16000} onChange={(event) => setEvidence(event.target.value)} placeholder="JSON bằng chứng, bắt buộc với ABANDON_NO_EFFECT" />
      <Button disabled={recovery.isPending || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(commandId.trim()) || reason.trim().length < 3} onClick={prepareRecovery}>Kiểm tra và phục hồi lệnh</Button>
      {inputError ? <Alert type="error" title={inputError} /> : null}
      {recovery.isError ? <Alert type="error" title="Backend chưa cho phép phục hồi lệnh. Kiểm tra trạng thái, chế độ và bằng chứng trước khi gửi lại." /> : null}
      {recovery.data ? <p role="status">Backend đã xử lý yêu cầu. Trạng thái lệnh: {recovery.data.status}</p> : null}
    </section>
    <Modal title="Xác nhận phục hồi lệnh" open={Boolean(recoveryInput)} okText="Xác nhận phục hồi" cancelText="Hủy" confirmLoading={recovery.isPending} onCancel={() => { if (!recovery.isPending) setRecoveryInput(undefined); }} onOk={() => { if (recoveryInput && !recovery.isPending) recovery.mutate(recoveryInput, { onSuccess: () => setRecoveryInput(undefined) }); }}>
      <p>Lệnh {recoveryInput?.commandId}, chế độ {recoveryInput?.input.mode}. Backend sẽ kiểm tra bằng chứng và giữ nguyên nonce/giao dịch đã ký theo quy tắc phục hồi. Chế độ kết thúc lệnh là quyết định cuối cho lệnh đó.</p>
    </Modal>
  </div>;
}
