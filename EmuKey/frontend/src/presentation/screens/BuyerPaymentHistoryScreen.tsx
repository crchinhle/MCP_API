import { Alert, Button, Empty, Result, Table } from 'antd';
import { Link, useNavigate } from 'react-router-dom';

import { describeApiError } from '../../application/auth/authContext';
import { usePaymentHistory } from '../../application/orders/orderQueries';
import type { PaymentHistoryDto } from '../../infrastructure/api/generated';
import { paginationTextControls } from '../theme';
import {
  formatMoney,
  PageHeader,
  PageLoading,
  paymentClassificationLabels,
  paymentClassificationTone,
  paymentReviewLabels,
  StatusChip,
} from '../components/WorkspacePrimitives';

function formatPaymentTime(value: string) {
  return Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('vi-VN')
    : 'Chưa xác định';
}

export function BuyerPaymentHistoryScreen() {
  const navigate = useNavigate();
  const payments = usePaymentHistory();
  const rows = payments.data ?? [];

  if (payments.isLoading) return <PageLoading label="Đang tải lịch sử thanh toán" />;
  if (payments.isError) {
    return (
      <Result
        status="error"
        title="Không thể tải lịch sử thanh toán"
        subTitle={describeApiError(payments.error, 'Lịch sử thanh toán đang tạm thời không khả dụng.')}
        extra={<Button onClick={() => void payments.refetch()}>Thử lại</Button>}
      />
    );
  }

  return (
    <div className="buyer-orders-screen">
      <main className="buyer-orders-main" id="main-content" tabIndex={-1}>
        <PageHeader
          title="Lịch sử thanh toán"
          action={
            <Button onClick={() => void navigate('/buyer/orders')}>
              Quay lại đơn hàng
            </Button>
          }
        />
        <section aria-label="Danh sách giao dịch thanh toán" className="workspace-card operations-card">
          {rows.length === 0 ? (
            <Empty description="Chưa có giao dịch thanh toán nào." />
          ) : (
            <Table<PaymentHistoryDto>
              rowKey="transactionId"
              dataSource={rows}
              scroll={{ x: 900 }}
              pagination={{ ...paginationTextControls, pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
              columns={[
                {
                  title: 'Đơn hàng',
                  render: (_, item) => (
                    <>
                      <strong>{item.orderNumber ?? 'Chưa gắn đơn'}</strong>
                      {item.orderType ? (
                        <div>
                          <small>{item.orderType === 'RENEWAL' ? 'Gia hạn' : 'Mua mới'}</small>
                        </div>
                      ) : null}
                    </>
                  ),
                },
                {
                  title: 'Sản phẩm / gói',
                  render: (_, item) => (
                    <>
                      <span>{item.productNameSnapshot ?? 'Chưa xác định'}</span>
                      {item.planNameSnapshot ? (
                        <div>
                          <small>{item.planNameSnapshot}</small>
                        </div>
                      ) : null}
                    </>
                  ),
                },
                {
                  title: 'Số tiền',
                  align: 'right',
                  dataIndex: 'amountVnd',
                  render: (value: number) => formatMoney(value),
                },
                {
                  title: 'Thời điểm giao dịch',
                  dataIndex: 'providerOccurredAt',
                  render: formatPaymentTime,
                },
                {
                  title: 'Mã tham chiếu',
                  dataIndex: 'providerTransactionReference',
                  render: (value: string | null | undefined) => value || 'Không có',
                },
                {
                  title: 'Kết quả',
                  dataIndex: 'classification',
                  render: (value: string, item) => (
                    <>
                      <StatusChip tone={paymentClassificationTone(value)}>
                        {paymentClassificationLabels[value] ?? value}
                      </StatusChip>
                      {item.reviewStatus ? (
                        <div>
                          <small>{paymentReviewLabels[item.reviewStatus] ?? item.reviewStatus}</small>
                        </div>
                      ) : null}
                    </>
                  ),
                },
                {
                  title: 'Hành động',
                  render: (_, item) =>
                    item.orderId ? (
                      <Link to={`/buyer/orders?orderId=${encodeURIComponent(item.orderId)}`}>
                        Xem đơn hàng
                      </Link>
                    ) : (
                      'Không có'
                    ),
                },
              ]}
            />
          )}
          {payments.isFetching && !payments.isLoading ? (
            <Alert type="info" showIcon title="Đang cập nhật lịch sử thanh toán..." />
          ) : null}
        </section>
      </main>
    </div>
  );
}
