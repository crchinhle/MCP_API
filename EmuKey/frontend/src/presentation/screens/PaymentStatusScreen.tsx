import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Input, Modal, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  activationKeyErrorLabel,
  useOrderLicense,
  useRetrieveActivationKey,
} from '../../application/licenses/licenseQueries';
import {
  orderStatusLabel,
  usePaymentHistory,
  useOrder,
  useOrderMutations,
} from '../../application/orders/orderQueries';
import {
  FactList,
  PageHeader,
  ProgressList,
  StatusChip,
  formatMoney,
} from '../components/WorkspacePrimitives';

export function PaymentStatusScreen() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const order = useOrder(id);
  const checkout = useOrderMutations().checkout;
  const waitingPayment = order.data?.orderStatus === 'WAITING_PAYMENT';
  const history = usePaymentHistory(waitingPayment, waitingPayment);
  const paymentNeedsReview = waitingPayment && history.data?.some((item) => item.orderId === id && ['UNMATCHED', 'AMOUNT_MISMATCH'].includes(item.classification));
  const [confirmationDelayed, setConfirmationDelayed] = useState(false);
  const retrieveKey = useRetrieveActivationKey();
  const [activationKey, setActivationKey] = useState<string | null>(null);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [retrieveError, setRetrieveError] = useState<unknown>(null);
  const providerReturned = ['success', 'error', 'cancel'].includes(searchParams.get('sepay') ?? '') || searchParams.get('returned') === 'sepay';
  const unsuccessfulReturn = ['error', 'cancel'].includes(searchParams.get('sepay') ?? '');
  const isRenewal = order.data?.orderType === 'RENEWAL';
  const renewalConfirmed = order.data?.renewalStatus === 'CONFIRMED';
  const license = useOrderLicense(
    id,
    order.data?.orderStatus === 'PAYMENT_ACCEPTED',
    order.data?.licenseId ?? order.data?.targetLicenseId,
    isRenewal,
    isRenewal ? order.data?.renewalExpiresAt : undefined,
  );
  const checkoutStarted = useRef(false);
  const checkoutSubmitted = useRef(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  // PAY-12: loading the status page only reads the order. Creating a signed
  // checkout attempt and submitting it are both explicit user actions.
  useEffect(() => {
    checkoutStarted.current = false;
    checkoutSubmitted.current = false;
  }, [id]);
  const renewalProjectionUpdated = Boolean(order.data?.renewalExpiresAt && license.data &&
    Math.floor(Date.parse(license.data.expiresAt) / 1000) >= Math.floor(Date.parse(order.data.renewalExpiresAt) / 1000));
  const licenseReady = license.data?.status === 'ACTIVE' && license.data.activationKeyTrustStatus === 'TRUSTED' &&
    (!isRenewal || (renewalConfirmed && renewalProjectionUpdated));
  const licenseNeedsReview = license.data?.activationKeyTrustStatus === 'UNTRUSTED_REORG' ||
    ['SUSPENDED', 'REVOKED'].includes(license.data?.status ?? '') ||
    (license.data?.status === 'EXPIRED' && (!isRenewal || (renewalConfirmed && renewalProjectionUpdated))) ||
    (isRenewal && ['DEAD_LETTER', 'ABANDONED', 'SUPERSEDED'].includes(order.data?.renewalStatus ?? ''));
  const [dismissedOrder, setDismissedOrder] = useState<string>();
  const [checking, setChecking] = useState(false);
  const processingStage = order.isPending ? 'loading'
    : order.isError || paymentNeedsReview ? null
    : waitingPayment && providerReturned && !unsuccessfulReturn ? 'payment'
    : order.data?.orderStatus === 'PAYMENT_ACCEPTED' && !licenseReady && !licenseNeedsReview && !license.isError ? 'license'
    : null;
  useEffect(() => {
    setConfirmationDelayed(false);
    if (!processingStage) return;
    const timer = window.setTimeout(() => setConfirmationDelayed(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [id, processingStage]);
  const checkStatus = async () => {
    setDismissedOrder(undefined);
    setChecking(true);
    try {
      await Promise.all([
        order.refetch(),
        ...(waitingPayment ? [history.refetch()] : []),
        ...(order.data?.orderStatus === 'PAYMENT_ACCEPTED' ? [license.refetch()] : []),
      ]);
    } finally { setChecking(false); }
  };
  const processingTitle = confirmationDelayed
    ? processingStage === 'payment' ? 'Chưa nhận được xác nhận thanh toán'
      : processingStage === 'license' ? 'Bản quyền vẫn đang được xử lý' : 'Tải đơn hàng lâu hơn dự kiến'
    : processingStage === 'loading' ? 'Đang tải đơn hàng'
      : processingStage === 'license' ? isRenewal ? 'Đang gia hạn bản quyền' : 'Đang cấp bản quyền'
        : 'Đang xác nhận thanh toán';
  const processingModal = (
    <Modal centered open={Boolean(processingStage) && dismissedOrder !== id}
      title={processingTitle} onCancel={() => setDismissedOrder(id)}
      footer={<div className="workspace-actions">
        {confirmationDelayed ? <Button type="primary" disabled={checking} onClick={() => void checkStatus()}>Kiểm tra lại</Button> : null}
        <Button onClick={() => void navigate('/buyer/orders')}>Về đơn hàng</Button>
        {confirmationDelayed ? <Button onClick={() => void navigate('/buyer/support')}>Liên hệ hỗ trợ</Button> : null}
        <Button onClick={() => setDismissedOrder(id)}>Đóng</Button>
      </div>}>
      <div className="payment-processing" role="status" aria-live="polite">
        {!confirmationDelayed || checking ? <Spin size="large" /> : null}
        {checking ? <p>Đang kiểm tra lại trạng thái…</p> : null}
        <p>{processingStage === 'loading' ? 'Đang lấy thông tin đơn hàng của bạn.'
          : processingStage === 'payment' ? confirmationDelayed
            ? 'Việc xác nhận đang lâu hơn dự kiến. Nếu đã bị trừ tiền, không thanh toán lại; hãy liên hệ hỗ trợ kèm mã đơn.'
            : 'Bạn đã quay lại từ SePay. Vui lòng chờ hệ thống xác nhận giao dịch.'
          : isRenewal ? 'Thanh toán đã xác nhận. Hạn sử dụng đang được cập nhật; mã bản quyền hiện tại được giữ nguyên.'
            : 'Thanh toán đã xác nhận. Bản quyền đang được chuẩn bị, bạn không cần thanh toán lại.'}</p>
        <small>Bạn có thể đóng thông báo. Trạng thái sẽ tiếp tục được cập nhật tự động.</small>
      </div>
    </Modal>
  );
  if (order.isPending) return <div className="workspace-screen"><PageHeader title="Thanh toán đơn hàng" />{processingModal}<Button onClick={() => setDismissedOrder(undefined)}>Xem tiến trình tải đơn hàng</Button></div>;
  if (!order.data)
    return <Alert type="error" message="Không thể tải đơn hàng." />;
  const current = order.data;
  const payment = checkout.data;
  const checkoutAttemptExpired = Boolean(payment && Date.parse(payment.expiresAt) <= Date.now());
  const paymentStatus = current.orderStatus === 'PAYMENT_ACCEPTED'
    ? license.data
      ? 'LICENSE_ISSUING'
      : 'PAYMENT_ACCEPTED'
    : current.orderStatus !== 'WAITING_PAYMENT'
      ? current.orderStatus
    : providerReturned && !unsuccessfulReturn
      ? 'PAYMENT_CONFIRMING'
      : 'WAITING_PAYMENT';
  const screenState = paymentNeedsReview ? 'PAYMENT_REVIEW' : activationKey
    ? 'KEY_RETRIEVED'
    : licenseReady
      ? 'LICENSE_READY'
      : licenseNeedsReview
        ? 'REVIEW'
        : paymentStatus;
  const paymentTone = current.orderStatus === 'PAYMENT_ACCEPTED' ? 'success' : paymentNeedsReview ? 'warning' : ['CANCELLED', 'EXPIRED'].includes(current.orderStatus) || searchParams.get('sepay') === 'error' ? 'error' : confirmationDelayed || unsuccessfulReturn ? 'warning' : current.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? 'neutral' : 'info';
  const keyAvailable = license.data?.activationKeyAvailable !== false;
  const retrieveErrorMessage = retrieveError !== null ? activationKeyErrorLabel(retrieveError) : null;
  const licenseQueryErrorMessage = license.error
    ? 'Thanh toán đã xác nhận. Bản quyền đang được xử lý; trạng thái blockchain chưa thể tải ngay lúc này.'
    : null;

  const copyActivationKey = async () => {
    const key = activationKey;
    if (!key || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopyStatus('Đã sao chép');
    } catch { setCopyStatus('Không thể sao chép. Vui lòng lưu mã thủ công.'); }
  };

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Thanh toán đơn hàng"
      />
      {processingModal}
      <LoadingOverlay active={checking && !processingStage} label="Đang kiểm tra trạng thái thanh toán" />
      <div className="payment-grid">
        <section className="workspace-card payment-card">
          <header>
            <h2>{screenState === 'LICENSE_READY' || screenState === 'KEY_RETRIEVED'
              ? isRenewal ? 'Gia hạn đã hoàn tất' : 'Bản quyền đã sẵn sàng'
              : current.orderStatus === 'PAYMENT_ACCEPTED'
                ? 'Thanh toán đã được xác nhận'
                : current.orderStatus === 'WAITING_PAYMENT' ? 'Thanh toán qua SePay' : 'Trạng thái đơn hàng'}</h2>
            <StatusChip tone={screenState === 'REVIEW' ? 'warning' : current.orderStatus === 'PAYMENT_ACCEPTED' ? licenseReady ? 'success' : 'info' : paymentTone}>
              {screenState === 'PAYMENT_REVIEW' ? 'Thanh toán cần kiểm tra' : screenState === 'WAITING_PAYMENT' ? 'Đang chờ thanh toán' :
                screenState === 'PAYMENT_CONFIRMING' ? 'Đang xác nhận thanh toán' :
                  screenState === 'PAYMENT_ACCEPTED' ? 'Thanh toán đã được xác nhận' :
                    screenState === 'LICENSE_ISSUING' ? 'Đang kích hoạt bản quyền' :
                      screenState === 'LICENSE_READY' ? isRenewal ? 'Gia hạn đã hoàn tất' : 'Bản quyền đã sẵn sàng' :
                        screenState === 'KEY_RETRIEVED' ? 'Mã bản quyền đã được cấp' : screenState === 'REVIEW' ? 'Cần kiểm tra' : orderStatusLabel(current)}
            </StatusChip>
          </header>
          {paymentNeedsReview ? <Alert showIcon type="warning" title="Giao dịch đã được ghi nhận nhưng cần kiểm tra" description={<>Backend chưa chấp nhận giao dịch cho đơn {current.orderNumber}. Không thanh toán lại. <a href="/buyer/support">Liên hệ hỗ trợ</a> và cung cấp mã đơn để đối chiếu thời gian, số tiền và chứng từ.</>} /> : null}
          {processingStage ? <div className="workspace-actions"><Button onClick={() => setDismissedOrder(undefined)}>Xem tiến trình</Button><Button href="/buyer/orders">Về đơn hàng</Button></div> : null}
          {waitingPayment && !processingStage ? <div className="workspace-actions"><Button disabled={checking} onClick={() => void checkStatus()}>Kiểm tra lại trạng thái</Button><Button href="/buyer/support">Liên hệ hỗ trợ</Button></div> : null}
          {order.isError || (waitingPayment && history.isError) ? <Alert type="warning" title="Không thể cập nhật đầy đủ trạng thái. Dữ liệu đang hiển thị có thể chưa mới nhất." /> : null}
          {licenseQueryErrorMessage ? <Alert showIcon type="info" message={licenseQueryErrorMessage} /> : null}
          {licenseReady ? (
            <Alert
              showIcon
              type="success"
              message={isRenewal ? 'Gia hạn đã hoàn tất' : 'Bản quyền đã sẵn sàng'}
              description={isRenewal ? 'Hạn sử dụng mới đã được xác nhận trên blockchain. Tiếp tục sử dụng mã bản quyền hiện tại, không cần nhận mã mới.' : 'Bản quyền đã được xác nhận trên blockchain. Bạn có thể nhận mã bản quyền một lần.'}
            />
          ) : null}
          {searchParams.get('sepay') === 'error' && current.orderStatus === 'WAITING_PAYMENT' && !paymentNeedsReview ? (
            <Alert
              showIcon
              type="error"
              message="SePay báo giao dịch không thành công. Bạn có thể tạo lại yêu cầu thanh toán."
            />
          ) : null}
          {searchParams.get('sepay') === 'cancel' && current.orderStatus === 'WAITING_PAYMENT' && !paymentNeedsReview ? (
            <Alert
              showIcon
              type="warning"
              message="Bạn đã hủy thanh toán trên SePay. Đơn hàng vẫn được giữ đến thời hạn thanh toán."
            />
          ) : null}
          {licenseNeedsReview && current.orderStatus === 'PAYMENT_ACCEPTED' ? (
            <Alert
              showIcon
              type="warning"
              message="Thanh toán đã xác nhận. Bản quyền đang cần được kiểm tra thêm."
              description="Quyền sử dụng và mã bản quyền vẫn bị khóa cho đến khi trạng thái blockchain được xác nhận lại."
            />
          ) : current.orderStatus === 'PAYMENT_ACCEPTED' ? null : current.orderStatus !== 'WAITING_PAYMENT' ? (
            <Alert type="warning" title="Đơn hàng chưa thể thanh toán" description={<a href="/buyer/orders">Mở đơn hàng để kiểm tra điều khoản hoặc trạng thái hủy/hết hạn.</a>} />
          ) : paymentNeedsReview ? null : unsuccessfulReturn ? (
            <Button
              type="primary"
              onClick={() => {
                checkout.reset();
                checkoutStarted.current = false;
                checkoutSubmitted.current = false;
                setCheckoutNotice(null);
                setSearchParams({});
              }}
            >
              Thanh toán lại
            </Button>
          ) : providerReturned ? null : !payment ? (
            checkout.isPending ? (
              <LoadingOverlay label="Đang tạo yêu cầu thanh toán" />
            ) : (
              <>
                <Alert
                  showIcon
                  type="info"
                  message="Đơn hàng đã sẵn sàng thanh toán."
                  description="Chọn nút bên dưới để tạo yêu cầu thanh toán SePay. Không có yêu cầu nào được gửi đi khi bạn vừa mở trang này."
                />
                {checkoutNotice ? <Alert showIcon type="warning" message={checkoutNotice} /> : null}
                <Button
                  type="primary"
                  disabled={checkout.isPending}
                  onClick={() => {
                    checkoutStarted.current = true;
                    checkout.mutate(id);
                  }}
                >
                  Tạo yêu cầu thanh toán
                </Button>
              </>
            )
          ) : (
            <>
              <FactList
                facts={[
                  { label: 'Mã thanh toán', value: payment.checkoutReference },
                  { label: 'Số tiền', value: formatMoney(payment.amountVnd) },
                  {
                    label: payment.expiresWithOrder ? 'Hết hạn cùng đơn hàng' : 'Hết hạn yêu cầu',
                    value: new Date(payment.expiresAt).toLocaleString('vi-VN'),
                  },
                ]}
              />
              {checkoutAttemptExpired ? (
                <Alert
                  showIcon
                  type="warning"
                  message="Yêu cầu thanh toán đã hết hạn."
                  description="Tạo yêu cầu mới để tiếp tục thanh toán đơn hàng này."
                  action={
                    <Button
                      onClick={() => {
                        checkout.reset();
                        checkoutStarted.current = false;
                        checkoutSubmitted.current = false;
                      }}
                    >
                      Tạo yêu cầu mới
                    </Button>
                  }
                />
              ) : (
                <form
                  action={payment.checkoutUrl}
                  id="sepay-checkout-form"
                  data-testid="sepay-checkout-form"
                  method="post"
                >
                  {Object.entries(payment.checkoutFields).map(([name, value]) => (
                    <input key={name} name={name} type="hidden" value={value} />
                  ))}
                  <Button htmlType="submit" type="primary">
                    {payment.checkoutUrl.includes('sandbox')
                      ? 'Thanh toán trên SePay Sandbox'
                      : 'Thanh toán trên SePay'}
                  </Button>
                </form>
              )}
              <Alert
                showIcon
                type="info"
                message="Trạng thái sẽ tự cập nhật sau khi hệ thống nhận được xác nhận từ cổng thanh toán."
              />
            </>
          )}
          {licenseReady ? (
            <>
              <FactList
                facts={[
                  { label: 'Sản phẩm', value: license.data?.productName ?? current.productNameSnapshot },
                  { label: 'Gói', value: license.data?.plan.name ?? current.planNameSnapshot },
                  { label: 'Mã bản quyền', value: license.data?.publicLicenseId ?? 'Đang cập nhật' },
                  { label: 'Hạn dùng', value: license.data ? new Date(license.data.expiresAt).toLocaleDateString('vi-VN') : 'Đang cập nhật' },
                  { label: 'Thiết bị tối đa', value: license.data?.maxActiveDevices ?? current.maxActiveDevicesSnapshot },
                ]}
              />
              {isRenewal ? <Button href={`/buyer/licenses?licenseId=${encodeURIComponent(license.data!.id)}`}>Xem bản quyền đã gia hạn</Button> : <div className="workspace-actions">
                {activationKey ? null : keyAvailable ? (
                  <>
                    <p>Mã bản quyền chỉ được hiển thị một lần. Hãy lưu lại trước khi rời trang.</p>
                    <><Button
                      type="primary"

                      disabled={retrieveKey.isPending}
                      onClick={() => {
                        setRetrieveError(null);
                        retrieveKey.mutate(
                          { id: license.data!.id },
                          {
                            onSuccess: (value) => {
                              setActivationKey(value.activationKey);
                              setCopyStatus('');
                              setKeyDialogOpen(true);
                              retrieveKey.reset();
                            },
                            onError: (error) => {
                              setRetrieveError(error);
                              retrieveKey.reset();
                            },
                          },
                        );
                      }}
                    >
                      Nhận mã bản quyền
                    </Button><LoadingOverlay active={retrieveKey.isPending} label="Đang xử lý yêu cầu: Nhận mã bản quyền" /></>
                  </>
                ) : (
                  <Alert
                    showIcon
                    type="info"
                    message="Mã bản quyền đã được nhận"
                    description={
                      <>
                        Nếu bạn đã mất mã, hãy sử dụng quy trình khôi phục mã.{' '}
                        <a href={`/buyer/licenses?licenseId=${encodeURIComponent(license.data!.id)}&recover=1`}>
                          Mở quản lý bản quyền
                        </a>
                      </>
                    }
                  />
                )}
                {activationKey ? (
                  <>
                    <Button type="primary" onClick={() => setKeyDialogOpen(true)}>Xem mã bản quyền</Button>
                    <Modal centered width={520} open={keyDialogOpen} title="Mã bản quyền của bạn"
                      mask={{ closable: false }} onCancel={() => setKeyDialogOpen(false)}
                      footer={<div className="workspace-actions">
                        <Button onClick={() => void copyActivationKey()}>Sao chép</Button>
                        <Button type="primary" onClick={() => {
                          setKeyDialogOpen(false);
                          void navigate(`/buyer/licenses?licenseId=${encodeURIComponent(license.data!.id)}&activate=1`);
                        }}>Tôi đã lưu mã</Button>
                      </div>}>
                      <div className="activation-key-dialog-content">
                        <p>Mã bản quyền chỉ được cấp một lần. Hãy sao chép và lưu ở nơi an toàn trước khi rời trang.</p>
                        <Input.Password aria-label="Mã bản quyền" readOnly value={activationKey} />
                        <span role="status" aria-live="polite">{copyStatus || 'Đóng cửa sổ này vẫn có thể xem lại mã trong trang hiện tại. Tải lại hoặc rời trang sẽ mất mã đang hiển thị.'}</span>
                      </div>
                    </Modal>
                  </>
                ) : null}
                {retrieveErrorMessage ? <Alert type="warning" message={retrieveErrorMessage} /> : null}
              </div>}
            </>
          ) : null}
          {checkout.error ? (
            <Alert type="error" message="Không thể tạo yêu cầu thanh toán." action={current.orderStatus === 'WAITING_PAYMENT' ? <><Button disabled={checkout.isPending} onClick={() => checkout.mutate(id)}>Thử lại</Button><LoadingOverlay active={checkout.isPending} label="Đang xử lý yêu cầu: Thử lại" /></> : undefined} />
          ) : null}
        </section>
        <aside className="checkout-stack">
          <section className="workspace-card section-card">
            <h2>Tiến trình đơn hàng</h2>
            <ProgressList
              items={[
                {
                  label: 'Chấp nhận điều khoản',
                  status: current.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? 'Chưa xác nhận' : 'Đã xác nhận',
                  tone: current.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? 'warning' : 'success',
                },
                { label: 'Tạo đơn hàng', status: 'Hoàn tất', tone: 'success' },
                 {
                   label: 'Thanh toán',
                   status: paymentNeedsReview ? 'Cần kiểm tra' : current.orderStatus === 'PAYMENT_ACCEPTED' ? 'Hoàn tất' : ['CANCELLED', 'EXPIRED'].includes(current.orderStatus) ? orderStatusLabel(current) : unsuccessfulReturn ? 'Chưa hoàn tất' : providerReturned ? 'Đang xác nhận' : 'Đang chờ',
                   tone: paymentTone,
                 },
                 {
                   label: isRenewal ? 'Gia hạn bản quyền' : 'Kích hoạt bản quyền',
                   status: licenseReady ? 'Hoàn tất' : licenseNeedsReview ? 'Cần kiểm tra' : current.orderStatus === 'PAYMENT_ACCEPTED' ? 'Đang xử lý' : 'Chưa bắt đầu',
                   tone: licenseReady ? 'success' : licenseNeedsReview ? 'warning' : current.orderStatus === 'PAYMENT_ACCEPTED' ? 'info' : 'neutral',
                 },
              ]}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
