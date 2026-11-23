import { Button, Tabs } from 'antd';
import { ProviderIntegrationPanel } from '../components/ProviderIntegrationPanel';
import { ProviderDeliveryPanel } from '../components/ProviderDeliveryPanel';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '../components/WorkspacePrimitives';
import { useAuth } from '../../application/auth/authContext';
import { PaymentReviewPanel } from '../components/PaymentReviewPanel';
import { PaymentHistorySection } from '../components/PaymentHistorySection';

export { paymentClassificationLabels, paymentClassificationTone } from '../components/WorkspacePrimitives';

export function ProviderOperationsScreen() {
  const isSystem = useAuth().user?.role === 'SYSTEM_ADMIN';
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const operationsTab = searchParams.get('tab') === 'integration' ? 'integration' : 'payments';
  const setOperationsTab = (value: string) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'integration') next.set('tab', 'integration');
      else next.delete('tab');
      return next;
    });

  return (
    <>
      <PageHeader title="Thanh toán & đối soát" />
      {!isSystem ? (
        <Tabs
          activeKey={operationsTab}
          onChange={setOperationsTab}
          items={[
            { key: 'payments', label: 'Thanh toán' },
            { key: 'integration', label: 'Tích hợp' },
          ]}
        />
      ) : null}
      {!isSystem && operationsTab === 'integration' ? <ProviderIntegrationPanel /> : null}
      <div hidden={!isSystem && operationsTab === 'integration'}>
        {isSystem ? <PaymentReviewPanel /> : null}
        {isSystem ? (
          <>
            <Button onClick={() => setShowDeliveries(!showDeliveries)}>Bàn giao bản quyền</Button>
            {showDeliveries ? <ProviderDeliveryPanel scope="operations" canRetry /> : null}
          </>
        ) : null}
        {isSystem ? <h2>Lịch sử thanh toán</h2> : null}
        <PaymentHistorySection
          isSystem={isSystem}
          introCopy={
            !isSystem
              ? 'Đối chiếu giao dịch theo mã đơn, số tiền và thời gian ghi nhận. Liên hệ bộ phận hỗ trợ khi có giao dịch cần kiểm tra.'
              : undefined
          }
        />
      </div>
    </>
  );
}
