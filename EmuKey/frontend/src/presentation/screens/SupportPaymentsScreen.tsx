import { PaymentHistorySection } from '../components/PaymentHistorySection';
import { PageHeader } from '../components/WorkspacePrimitives';

export function SupportPaymentsScreen() {
  return (
    <>
      <PageHeader title="Lịch sử thanh toán" />
      <PaymentHistorySection
        emptyDescription="Chưa có giao dịch thanh toán phù hợp."
        introCopy="Tra cứu giao dịch thanh toán chỉ đọc để hỗ trợ khách hàng đối chiếu mã đơn, số tiền và kết quả đối soát."
      />
    </>
  );
}
