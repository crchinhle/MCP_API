import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Checkbox, Drawer, Empty, Input, Modal, Pagination, Result, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { describeApiError } from '../../application/auth/authContext';
import { useCreateConversation } from '../../application/assistance/assistanceQueries';
import { useNavigate } from 'react-router-dom';
import { orderStatusLabel, orderStatusTone, type OrderSummary, useOrder, useOrderMutations, useOrders, useOrderTerms } from '../../application/orders/orderQueries';
import { PageLoading, formatMoney, FactList, StatusChip } from '../components/WorkspacePrimitives';
import { entitlementLabel } from '../components/OrderSummary';

type OrderTab = 'all' | 'sign' | 'payment' | 'complete';

function tableStatus(orderStatus: OrderSummary['orderStatus']) {
  return { label: orderStatusLabel({ orderStatus }), tone: orderStatusTone({ orderStatus }) };
}

function matchesTab(status: string, tab: OrderTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'sign') return status === 'WAITING_SERVICE_TERMS_ACCEPTANCE';
  if (tab === 'payment') return status === 'WAITING_PAYMENT';
  return status === 'PAYMENT_ACCEPTED';
}

function downloadOrdersCsv(orders: readonly OrderSummary[]) {
  const rows = [
    ['Mã đơn', 'Sản phẩm / gói', 'Thành tiền', 'Trạng thái'],
    ...orders.map((order) => [order.orderNumber, order.productNameSnapshot, String(order.priceVndSnapshot), tableStatus(order.orderStatus).label]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'emukey-orders.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BuyerOrdersScreen() {
  const [tab, setTab] = useState<OrderTab>('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string>();
  const [cancelTarget, setCancelTarget] = useState<OrderSummary>();
  const [accepted, setAccepted] = useState(false);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const createConversation = useCreateConversation();
  const ordersQuery = useOrders();
  const detailQuery = useOrder(selectedId ?? '');
  const terms = useOrderTerms(detailQuery.data?.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? selectedId ?? '' : '');
  const mutations = useOrderMutations();
  useEffect(() => { setAccepted(false); }, [selectedId, terms.data?.version, terms.data?.hash]);
  const orders = ordersQuery.data ?? [];
  const data = useMemo(() => orders.filter((order) => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    const matchesSearch = !normalized || `${order.orderNumber} ${order.productNameSnapshot} ${order.planNameSnapshot}`.toLocaleLowerCase('vi').includes(normalized);
    const matchesStatus = status === 'all' || order.orderStatus === status;
    return matchesSearch && matchesStatus && matchesTab(order.orderStatus, tab);
  }), [orders, query, status, tab]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(data.length / 10)));

  if (ordersQuery.isLoading) return <PageLoading />;
  if (ordersQuery.isError) return <Result status="error" title="Không thể tải đơn hàng" subTitle={describeApiError(ordersQuery.error, 'Lịch sử đơn hàng đang tạm thời không khả dụng.')} />;

  return (
    <div className="buyer-orders-screen">

      <main className="buyer-orders-main">
        <nav aria-label="Bộ lọc đơn hàng" className="buyer-orders-tabs">
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')} type="button">Tất cả {orders.length}</button>
          <button className={tab === 'sign' ? 'active' : ''} onClick={() => { setTab('sign'); setPage(1); }} type="button">Chờ đồng ý điều khoản</button>
          <button className={tab === 'payment' ? 'active' : ''} onClick={() => setTab('payment')} type="button">Chờ thanh toán</button>
          <button className={tab === 'complete' ? 'active' : ''} onClick={() => { setTab('complete'); setPage(1); }} type="button">Đã thanh toán</button>
        </nav>
        <section aria-label="Công cụ đơn hàng" className="buyer-orders-toolbar">
          <Input aria-label="Tìm đơn hàng" onChange={(event) => setQuery(event.target.value)} placeholder="Mã đơn hoặc sản phẩm" value={query} />
          <Select aria-label="Lọc trạng thái đơn hàng" onChange={(value) => { setStatus(value); setPage(1); }} options={[{ label: 'Tất cả trạng thái', value: 'all' }, ...(['WAITING_SERVICE_TERMS_ACCEPTANCE', 'WAITING_PAYMENT', 'PAYMENT_ACCEPTED', 'CANCELLED', 'EXPIRED'] as const).map((orderStatus) => ({ label: orderStatusLabel({ orderStatus }), value: orderStatus }))]} value={status} />
          <Button onClick={() => downloadOrdersCsv(data)}>Xuất CSV</Button>
        </section>
        <section aria-label="Danh sách đơn hàng" className="buyer-orders-table-wrap">
          <table className="buyer-orders-table">
            <thead><tr><th>Mã đơn</th><th>Sản phẩm / gói</th><th>Thành tiền</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
            <tbody>
              {data.slice((currentPage - 1) * 10, currentPage * 10).map((order) => {
                const state = tableStatus(order.orderStatus);
                return <tr key={order.id}>
                  <td><button className="buyer-orders-id" onClick={() => setSelectedId(order.id)} type="button">{order.orderNumber}</button></td>
                  <td><span className="buyer-orders-cell-text">{order.productNameSnapshot} · {order.planNameSnapshot}</span></td>
                  <td className="buyer-orders-money">{formatMoney(order.priceVndSnapshot)}</td>
                  <td><StatusChip tone={state.tone}>{state.label}</StatusChip></td>
                  <td><div className="buyer-orders-actions">
                    {order.orderStatus === 'WAITING_PAYMENT' ? <Button href={`/buyer/orders/${encodeURIComponent(order.id)}/payment`} type="primary">Thanh toán</Button> : <Button onClick={() => setSelectedId(order.id)} type="primary">Xem chi tiết</Button>}
                    {['WAITING_SERVICE_TERMS_ACCEPTANCE', 'WAITING_PAYMENT'].includes(order.orderStatus) ? (
                      <Button danger disabled={mutations.cancel.isPending}
                        onClick={() => { mutations.cancel.reset(); setCancelTarget(order); }}>Hủy đơn</Button>
                    ) : null}
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
          {data.length === 0 ? <Empty description={orders.length ? 'Không có đơn hàng phù hợp bộ lọc.' : 'Bạn chưa có đơn hàng nào.'} /> : null}
        </section>
        <Pagination current={currentPage} pageSize={10} total={data.length} onChange={setPage} hideOnSinglePage showSizeChanger={false} />
      </main>
      <Modal centered width={460} open={Boolean(cancelTarget)} title="Xác nhận hủy đơn hàng"
        okText="Hủy đơn" cancelText="Giữ đơn" okButtonProps={{ ...({ danger: true }), disabled: mutations.cancel.isPending }}
         cancelButtonProps={{ disabled: mutations.cancel.isPending }}
        closable={!mutations.cancel.isPending} keyboard={!mutations.cancel.isPending} mask={{ closable: false }}
        onCancel={() => { if (!mutations.cancel.isPending) setCancelTarget(undefined); }}
        onOk={() => {
          if (cancelTarget && !mutations.cancel.isPending) mutations.cancel.mutate(cancelTarget.id, {
            onSuccess: () => setCancelTarget(undefined),
          });
        }}>
        <LoadingOverlay active={Boolean(cancelTarget) && (mutations.cancel.isPending)} />
        <p>Bạn muốn hủy đơn <strong>{cancelTarget?.orderNumber}</strong>?</p>
        <p>Yêu cầu thanh toán đang chờ sẽ ngừng hiệu lực.</p>
        <Alert showIcon type="warning" title="Nếu đã chuyển tiền, hãy giữ đơn và liên hệ hỗ trợ để kiểm tra giao dịch." />
        {mutations.cancel.isError ? <Alert showIcon type="error" title={describeApiError(mutations.cancel.error, 'Không thể hủy đơn hàng. Vui lòng thử lại.')} /> : null}
      </Modal>
      <Drawer open={Boolean(selectedId)} onClose={() => { setSelectedId(undefined); setAccepted(false); }} motion={{ motionName: '' }} title={`Chi tiết ${detailQuery.data?.orderNumber ?? ''}`}>
        {detailQuery.isLoading ? <LoadingOverlay label="Đang tải chi tiết đơn hàng" /> : detailQuery.isError ? <Alert type="error" message={describeApiError(detailQuery.error, 'Không thể tải chi tiết đơn hàng.')} /> : detailQuery.data ? <FactList facts={[{ label: 'Sản phẩm', value: detailQuery.data.productNameSnapshot }, { label: 'Gói', value: detailQuery.data.planNameSnapshot }, { label: 'Tổng thanh toán', value: formatMoney(detailQuery.data.priceVndSnapshot) }]} /> : null}
        {detailQuery.data ? <section className="checkout-stack">
          <h3>Thông tin chi tiết gói</h3>
          <FactList facts={[
            { label: 'Nhà cung cấp', value: detailQuery.data.providerNameSnapshot },
            { label: 'Thời hạn', value: `${detailQuery.data.durationMonthsSnapshot} tháng` },
            { label: 'Số thiết bị tối đa', value: `${detailQuery.data.maxActiveDevicesSnapshot} thiết bị` },
            { label: 'Phiên bản gói', value: detailQuery.data.planVersionSnapshot },
            { label: 'Loại đơn', value: detailQuery.data.orderType === 'RENEWAL' ? 'Gia hạn bản quyền' : 'Mua bản quyền mới' },
          ]} />
          <h4>Quyền lợi của gói</h4>
          <ul>{Object.entries(detailQuery.data.entitlementsSnapshot ?? {}).map(([key, value]) => <li key={key}>{entitlementLabel(key, value)}</li>)}</ul>
          <p className="muted-copy">Thông tin được lưu tại thời điểm tạo đơn. Đơn chưa thanh toán có thời hạn 30 phút.</p>
        </section> : null}
        {detailQuery.data?.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? <section className="checkout-stack">{terms.isPending ? <LoadingOverlay /> : terms.isError ? <Alert type="error" title="Không thể tải điều khoản" action={<Button onClick={() => void terms.refetch()}>Thử lại</Button>} /> : <><details><summary>Xem điều khoản dịch vụ</summary><pre className="terms-document">{terms.data?.content}</pre></details><Checkbox checked={accepted} onChange={(event) => setAccepted(event.target.checked)}>Tôi đã đọc và đồng ý điều khoản</Checkbox><><Button type="primary" disabled={(!accepted || !terms.data || terms.isFetching || terms.isError) || (mutations.acceptServiceTerms.isPending)}  onClick={() => terms.data && mutations.acceptServiceTerms.mutate({ order: detailQuery.data!, terms: terms.data })}>Xác nhận điều khoản</Button><LoadingOverlay active={mutations.acceptServiceTerms.isPending} label="Đang xử lý yêu cầu: Xác nhận điều khoản" /></></>}{mutations.acceptServiceTerms.isError ? <Alert type="error" title="Không thể xác nhận điều khoản. Vui lòng thử lại." /> : null}</section> : null}
         {createConversation.isError ? <Alert role="alert" type="error" message={describeApiError(createConversation.error, 'Không thể tạo yêu cầu hỗ trợ. Vui lòng thử lại.')} /> : null}
         {detailQuery.data ? <><Button disabled={createConversation.isPending} onClick={() => createConversation.mutate({ contextType: 'ORDER', contextId: detailQuery.data.id, title: `Hỗ trợ đơn ${detailQuery.data.orderNumber}` }, { onSuccess: (conversation) => { setSelectedId(undefined); void navigate(`/buyer/support?conversation=${encodeURIComponent(conversation.id)}`); } })}>Cần hỗ trợ về đơn này</Button><LoadingOverlay active={createConversation.isPending} label="Đang xử lý yêu cầu: Cần hỗ trợ về đơn này" /></> : null}
         {detailQuery.data?.orderStatus === 'WAITING_PAYMENT' ? <Button type="primary" href={`/buyer/orders/${encodeURIComponent(detailQuery.data.id)}/payment`}>Tiếp tục thanh toán</Button> : null}

      </Drawer>
    </div>
  );
}
