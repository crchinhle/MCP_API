import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Empty } from 'antd';
import { useEffect, useState } from 'react';
import { requestJson } from '../../application/auth/authContext';
import { useLocation } from 'react-router-dom';
import { useOptionalAuth } from '../../application/auth/authContext';

import { useAppendSupportMessage, useClaimConversation, useCloseSupportConversation, useReleaseSupportConversation, useRequestSupport, useSupportConversationMessages, useSupportQueue } from '../../application/assistance/supportQueries';
import { conversationContextLabels, conversationStatusLabels } from '../../application/assistance/assistanceQueries';
import { ConversationPanel } from '../components/ConversationPanel';
import { ProviderDeliveryPanel } from '../components/ProviderDeliveryPanel';
import {
  PageLoading,
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function SupportConsoleScreen() {
  const [showDeliveries,setShowDeliveries]=useState(false);
  const location = useLocation();
  const auth = useOptionalAuth();
  const queue = useSupportQueue(new URLSearchParams(location.search).get('view') === 'resolved');
  const [selectedId, setSelectedId] = useState<string | undefined>(() => new URLSearchParams(location.search).get('conversationId') ?? undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [lease, setLease] = useState<{ key: string; state: 'ACTIVE' | 'CHECKING' | 'LOST' | 'UNAVAILABLE' } | null>(null);
  const [leaseRevision, setLeaseRevision] = useState(0);
  const claim = useClaimConversation();
  const append = useAppendSupportMessage();
  const close = useCloseSupportConversation();
  const release = useReleaseSupportConversation();
  const requestSupport = useRequestSupport();
  const view = new URLSearchParams(location.search).get('view') ?? 'all';
  const queueData = (queue.data ?? []).filter((conversation) =>
    view === 'active'
      ? conversation.status === 'SUPPORT_ACTIVE'
      : view === 'resolved'
        ? conversation.status === 'CLOSED'
        : true,
  );
  const selected = selectedId ? queueData.find((item) => item.id === selectedId) : queueData[0];
  const assignedToMe = selected?.assignedSupportUserId === auth?.user?.id;
  const leaseKey = `${selected?.id}:${selected?.claimVersion}`;
  const mayHandle = selected?.status === 'SUPPORT_ACTIVE' && assignedToMe && lease?.key === leaseKey && lease.state === 'ACTIVE';
  const refetchQueue = queue.refetch;
  const messages = useSupportConversationMessages(selected?.id, Boolean(selected && !assignedToMe && selected.status === 'WAITING_SUPPORT'));
  useEffect(() => {
    if (!selected || !assignedToMe || selected.status!=='SUPPORT_ACTIVE' || !selected.claimVersion) return;
    let active = true;
    let generation = 0;
    let resuming = false;
    const isVisible = () => document.visibilityState !== 'hidden';
    const heartbeat=async () => {
      if (!isVisible()) return;
      const request = ++generation;
      try {
        await requestJson(`/conversations/${selected.id}/heartbeat`,{method:'POST',body:JSON.stringify({claimVersion:selected.claimVersion})});
        if (active && request === generation && isVisible()) setLease({ key: leaseKey, state: 'ACTIVE' });
      } catch (error) {
        if (active && request === generation) {
          const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
          setLease({ key: leaseKey, state: [401, 403, 404, 409].includes(status) ? 'LOST' : 'UNAVAILABLE' });
          void refetchQueue();
        }
      }
    };
    const visibility = () => {
      const request = ++generation;
      setLease({ key: leaseKey, state: 'CHECKING' });
      if (document.visibilityState === 'hidden') return;
      resuming = true;
      void refetchQueue().then((result) => {
        if (!active || request !== generation) return;
        resuming = false;
        const current = result.data?.find((item) => item.id === selected.id);
        if (result.isError || current?.status !== 'SUPPORT_ACTIVE' || current.assignedSupportUserId !== selected.assignedSupportUserId || current.claimVersion !== selected.claimVersion) {
          setLease({ key: leaseKey, state: 'LOST' }); return;
        }
        void heartbeat();
      });
    };
    void heartbeat();
    const timer=setInterval(() => { if (!resuming) void heartbeat(); },30_000);
    document.addEventListener('visibilitychange', visibility);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  },[selected?.id,selected?.claimVersion,selected?.status,selected?.assignedSupportUserId,assignedToMe,leaseKey,leaseRevision,refetchQueue]);

  if (queue.isLoading && !queue.data) return <PageLoading />;
  return (
    <>
      <Button onClick={()=>setShowDeliveries(!showDeliveries)}>Theo dõi bàn giao bản quyền</Button>{showDeliveries?<ProviderDeliveryPanel scope="operations"/>:null}
      <PageHeader
        title="Hàng đợi hỗ trợ"
        action={<><Button onClick={() => { setRefreshing(true); setLease({ key: leaseKey, state: 'CHECKING' }); void queue.refetch().finally(() => { setRefreshing(false); setLeaseRevision((value) => value + 1); }); }} disabled={refreshing}>Làm mới</Button><LoadingOverlay active={refreshing} label="Đang tải lại hàng đợi hỗ trợ" /></>}
      />
      {queue.isError ? <Alert showIcon type="error" message="Không thể tải hàng đợi hỗ trợ." action={<Button onClick={() => void queue.refetch()}>Thử lại</Button>} /> : null}
      {selectedId && !selected && !queue.isLoading && !queue.isError ? <Alert type="warning" title="Hội thoại không có trong hàng đợi hiện tại hoặc quyền truy cập đã thay đổi." action={<Button onClick={() => setSelectedId(undefined)}>Xem hàng đợi</Button>} /> : null}
          {claim.isError || close.isError || release.isError ? <Alert type="error" title="Không thể cập nhật hội thoại. Vui lòng thử lại." /> : null}
      {!queue.isLoading && !queue.isError && !selected ? <Empty description={view === 'resolved' ? 'Chưa có hội thoại đã giải quyết.' : view === 'active' ? 'Không có hội thoại đang xử lý.' : 'Hàng đợi trống'} /> : null}
      {selected ? <div className="console-grid support-console">
        <aside className="workspace-card queue-panel">
          <h2>Hàng đợi</h2>
          {queueData.map((conversation) => (
            <Button
              className={
                conversation.id === selected.id
                  ? 'queue-item queue-item--active'
                  : 'queue-item'
              }
              key={conversation.id}
              onClick={() => setSelectedId(conversation.id)}
            >
              <span>
                  <strong>{conversation.customerUserId.startsWith('Người mua') ? conversation.customerUserId : `Người mua #${conversation.customerUserId.slice(0, 4)}`}</strong>
                  <small>{conversation.title ?? conversation.id}</small>
              </span>
              <StatusChip tone="neutral">
                {conversationStatusLabels[conversation.status]}
              </StatusChip>
            </Button>
          ))}
        </aside>
        <section className="workspace-card conversation-card" key={selected.id}>
          <header>
            <small>#{selected.id}</small>
            <h2>{selected.title ?? 'Hội thoại hỗ trợ'}</h2>
            <div className="conversation-actions">
              {selected.status === 'CLOSED' ? <StatusChip tone="success">Đã hoàn tất</StatusChip> : (
                <>
                   <><Button  disabled={(selected.status === 'SUPPORT_ACTIVE') || (claim.isPending)} onClick={() => claim.mutate(selected.id)}>
                     {selected.status === 'SUPPORT_ACTIVE' ? selected.assignedSupportUserId === auth?.user?.id ? 'Đang xử lý bởi bạn' : 'Đã có người xử lý' : 'Nhận xử lý'}
                   </Button><LoadingOverlay active={claim.isPending} label="Đang xử lý yêu cầu" /></>
                    {selected.status === 'AI_ACTIVE' ? <><Button disabled={requestSupport.isPending} onClick={() => requestSupport.mutate({ conversationId: selected.id, reason: 'Yêu cầu cần nhân viên hỗ trợ.' })}>Chuyển cho nhân viên</Button><LoadingOverlay active={requestSupport.isPending} label="Đang xử lý yêu cầu: Chuyển cho nhân viên" /></> : null}
                    {selected.status === 'SUPPORT_ACTIVE' && assignedToMe ? <><Button disabled={!mayHandle || release.isPending} onClick={() => release.mutate({ conversationId: selected.id, claimVersion: selected.claimVersion ?? 0 })}>Trả về hàng đợi</Button><LoadingOverlay active={release.isPending} label="Đang xử lý yêu cầu: Trả về hàng đợi" /></> : null}
                    <><Button
                      disabled={!mayHandle || close.isPending}

                     onClick={() => close.mutate({ conversationId: selected.id, claimVersion: selected.claimVersion ?? 0 })}
                   >
                     Hoàn tất
                   </Button><LoadingOverlay active={close.isPending} label="Đang xử lý yêu cầu: Hoàn tất" /></>
                </>
              )}
            </div>
          </header>
          {messages.isError ? <Alert type="error" title="Không thể tải tin nhắn" action={<Button onClick={() => void messages.refetch()}>Thử lại</Button>} /> : null}
             <ConversationPanel
               author="Support"
               initialMessages={(messages.data ?? []).map((message) => ({
                 author: message.senderType === 'CUSTOMER' ? ('Buyer' as const) : message.senderType === 'AI' ? ('AI' as const) : ('Support' as const),
                 body: message.content,
                 id: message.id,
               }))}
               inputLabel="Phản hồi hỗ trợ"
               onSubmit={(content, clientMessageId) => append.mutateAsync({ clientMessageId, content, conversationId: selected.id, claimVersion: selected.claimVersion ?? 0 })}
               readOnly={!mayHandle}
               readOnlyReason={selected.status === 'CLOSED' ? undefined : !assignedToMe || selected.status !== 'SUPPORT_ACTIVE'
                 ? 'Nhận xử lý hội thoại để gửi phản hồi.' : lease?.state === 'LOST'
                   ? 'Phiên xử lý không còn hiệu lực. Vui lòng nhận lại hội thoại từ hàng đợi.' : lease?.state === 'UNAVAILABLE'
                     ? 'Chưa xác minh được phiên xử lý. Kiểm tra kết nối rồi bấm Làm mới.' : 'Đang xác minh phiên xử lý...'}
               submitLabel={selected.status === 'CLOSED' ? 'Đã hoàn tất' : selected.assignedSupportUserId === auth?.user?.id ? 'Gửi phản hồi' : 'Nhận xử lý để trả lời'}
             />
        </section>
        <aside className="workspace-card detail-card">
          <h2>Thông tin người mua</h2>
          <strong>{selected.customerUserId.startsWith('Người mua') ? selected.customerUserId : `Người mua #${selected.customerUserId.slice(0, 4)}`}</strong>
          <FactList
            facts={[
              { label: 'Nội dung cần hỗ trợ', value: conversationContextLabels[selected.contextType] },
              { label: 'Trạng thái', value: conversationStatusLabels[selected.status] },
            ]}
          />
          <p className="security-note">
            Chỉ hiển thị dữ liệu cần thiết cho vai trò hỗ trợ.
          </p>
        </aside>
      </div> : null}
    </>
  );
}
