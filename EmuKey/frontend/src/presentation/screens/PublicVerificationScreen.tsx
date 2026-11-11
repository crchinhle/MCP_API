import {
  DownOutlined,
  HistoryOutlined,
  KeyOutlined,
  LaptopOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateFilled,
  StopOutlined,
  UnlockOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { Alert, Button, Input } from 'antd';
import { useState } from 'react';

import type {
  PublicLicenseHistoryChangeDto,
  PublicLicenseHistoryEventDto,
  PublicLicenseVerificationDto,
} from '../../infrastructure/api/generated';
import {
  publicVerificationErrorLabel,
  usePublicLicenseVerification,
} from '../../application/licenses/licenseQueries';
import { SiteHeader } from '../components/SiteHeader';
import { LoadingOverlay } from '../components/WorkspacePrimitives';

function formatDateOnlyVi(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTimeDotVi(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const datePart = parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = parsed.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} · ${timePart}`;
}

function formatChangeValue(
  field: string,
  value: string | null | undefined,
): string {
  if (!value) return '—';
  if (
    field === 'expiresAt' ||
    field === 'periodStart' ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
  ) {
    return formatDateTimeDotVi(value);
  }
  return value;
}

function eventVisualMeta(eventType: string): {
  icon: React.ReactNode;
  toneClass: string;
} {
  switch (eventType) {
    case 'LICENSE_ISSUED':
      return {
        icon: <KeyOutlined aria-hidden="true" />,
        toneClass: 'modern-node--green',
      };
    case 'LICENSE_RESUMED':
      return {
        icon: <UnlockOutlined aria-hidden="true" />,
        toneClass: 'modern-node--green',
      };
    case 'LICENSE_RENEWED':
      return {
        icon: <ReloadOutlined aria-hidden="true" />,
        toneClass: 'modern-node--blue',
      };
    case 'ACTIVE_DEVICE_COUNT_SYNCED':
    case 'DEVICE_ACTIVATED':
    case 'DEVICE_REVOKED':
      return {
        icon: <LaptopOutlined aria-hidden="true" />,
        toneClass: 'modern-node--amber',
      };
    case 'KEY_ROTATED':
      return {
        icon: <KeyOutlined aria-hidden="true" />,
        toneClass: 'modern-node--purple',
      };
    case 'LICENSE_SUSPENDED':
      return {
        icon: <LockOutlined aria-hidden="true" />,
        toneClass: 'modern-node--red',
      };
    case 'LICENSE_REVOKED':
      return {
        icon: <StopOutlined aria-hidden="true" />,
        toneClass: 'modern-node--red',
      };
    default:
      return {
        icon: <KeyOutlined aria-hidden="true" />,
        toneClass: 'modern-node--green',
      };
  }
}

function getEventTitle(event: PublicLicenseHistoryEventDto): string {
  if (event.title) return event.title;
  switch (event.eventType) {
    case 'LICENSE_ISSUED':
      return 'Kích hoạt bản quyền';
    case 'LICENSE_RENEWED':
      return 'Gia hạn bản quyền';
    case 'ACTIVE_DEVICE_COUNT_SYNCED':
    case 'DEVICE_ACTIVATED':
    case 'DEVICE_REVOKED':
      return 'Cập nhật giới hạn thiết bị';
    case 'KEY_ROTATED':
      return 'Cập nhật phiên bản Key';
    case 'LICENSE_SUSPENDED':
      return 'Tạm khóa bản quyền';
    case 'LICENSE_RESUMED':
      return 'Khôi phục bản quyền';
    case 'LICENSE_REVOKED':
      return 'Thu hồi bản quyền';
    default:
      return 'Sự kiện Blockchain';
  }
}

function getEventDescription(event: PublicLicenseHistoryEventDto): string {
  if (event.description) return event.description;
  switch (event.eventType) {
    case 'LICENSE_ISSUED':
      return 'Bản quyền được kích hoạt lần đầu.';
    case 'LICENSE_RENEWED':
      return 'Thời hạn sử dụng bản quyền đã được gia hạn.';
    case 'ACTIVE_DEVICE_COUNT_SYNCED':
    case 'DEVICE_ACTIVATED':
    case 'DEVICE_REVOKED':
      return 'Số lượng thiết bị được phép sử dụng đã thay đổi.';
    case 'KEY_ROTATED':
      return 'Phiên bản License Key được cập nhật.';
    case 'LICENSE_SUSPENDED':
      return 'Bản quyền tạm thời bị khóa theo yêu cầu.';
    case 'LICENSE_RESUMED':
      return 'Bản quyền đã được mở khóa và khôi phục hoạt động.';
    case 'LICENSE_REVOKED':
      return 'Bản quyền đã bị thu hồi vĩnh viễn trên chuỗi khối.';
    default:
      return 'Giao dịch thay đổi trạng thái đã được ghi nhận trên Blockchain.';
  }
}

function fallbackHistoryFromSummary(
  result: PublicLicenseVerificationDto,
): PublicLicenseHistoryEventDto[] {
  if (result.history && result.history.length > 0) {
    return result.history;
  }
  if (!result.transactionHash && result.blockNumber == null) {
    return [];
  }
  const isConfirmed =
    result.state === 'CHAIN_CONFIRMED' || result.finality === 'CONFIRMED';
  return [
    {
      id: `fallback-${result.licenseId ?? '1'}`,
      eventType: 'LICENSE_ISSUED',
      title: 'Kích hoạt bản quyền',
      description: 'Bản quyền được kích hoạt lần đầu.',
      status: isConfirmed ? 'CONFIRMED' : result.state === 'REORGED' ? 'REORGED' : 'PENDING',
      occurredAt: result.periodStart ?? result.expiresAt ?? new Date().toISOString(),
      blockTimestamp: result.periodStart ?? null,
      transactionHash: result.transactionHash ?? null,
      blockNumber: result.blockNumber ?? null,
      logIndex: 0,
      confirmationCount: result.confirmationCount ?? 0,
      changes: [
        ...(result.productName
          ? [
              {
                field: 'productPlan',
                label: 'Sản phẩm & Gói bản quyền',
                previousValue: null,
                currentValue: result.plan?.name
                  ? `${result.productName} — ${result.plan.name} (v${result.plan.version})`
                  : result.productName,
              },
            ]
          : []),
        ...(result.expiresAt
          ? [
              {
                field: 'expiresAt',
                label: 'Ngày hết hạn',
                previousValue: result.periodStart ?? null,
                currentValue: result.expiresAt,
              },
            ]
          : []),
      ],
    },
  ];
}

export function PublicVerificationScreen() {
  const [code, setCode] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const verification = usePublicLicenseVerification();
  const result = verification.data;
  const found = result && result.state !== 'NOT_FOUND';

  const historyEvents = result ? fallbackHistoryFromSummary(result) : [];
  const sortedEvents = [...historyEvents].sort((a, b) => {
    const timeA = new Date(a.occurredAt).getTime();
    const timeB = new Date(b.occurredAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    if (a.blockNumber != null && b.blockNumber != null && a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }
    if (a.logIndex != null && b.logIndex != null && a.logIndex !== b.logIndex) {
      return a.logIndex - b.logIndex;
    }
    if (a.commandSequence != null && b.commandSequence != null) {
      return a.commandSequence - b.commandSequence;
    }
    return 0;
  });

  const issuedAtValue =
    result?.periodStart ??
    sortedEvents.find((item) => item.eventType === 'LICENSE_ISSUED')?.occurredAt ??
    null;

  const isRevoked = result?.status === 'REVOKED';
  const isSuspended = result?.status === 'SUSPENDED';
  const isExpired = result?.expiresAt
    ? new Date(result.expiresAt).getTime() < Date.now()
    : false;
  const isActive = result?.status === 'ACTIVE' && !isExpired;

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="verification-content" id="main-content" tabIndex={-1}>
        {/* Cột trái: Tra cứu License */}
        <section className="verification-query" aria-labelledby="verify-title">
          <h1 id="verify-title">Xác minh Blockchain</h1>
          <p className="verification-query-lead">
            Tra cứu tính hợp lệ và toàn bộ lịch sử vòng đời bản quyền được ghi
            nhận trên sổ cái Blockchain.
          </p>
          <label className="verification-input-label">
            Mã xác thực
            <Input
              allowClear
              aria-label="Mã xác thực"
              placeholder="Nhập mã EMU-... hoặc khóa kích hoạt"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (verification.isPending || verification.isError || verification.data) {
                  verification.reset();
                }
              }}
              onPressEnter={() => {
                if (code.trim() && !verification.isPending) {
                  verification.mutate(code.trim());
                }
              }}
            />
          </label>
          <div className="verification-actions">
            <Button
              block
              disabled={!code.trim() || verification.isPending}
              type="primary"
              onClick={() => verification.mutate(code.trim())}
            >
              Xác minh
            </Button>
            <LoadingOverlay
              active={verification.isPending}
              label="Đang xử lý yêu cầu: Xác minh"
            />
          </div>
        </section>

        {/* Cột phải: Kết quả xác minh */}
        <section className="verification-result" aria-label="Kết quả xác minh">
          {verification.isPending ? <LoadingOverlay /> : null}

          {!verification.isPending && !result && !verification.error ? (
            <div className="verification-placeholder" role="status">
              <h2>Kết quả xác minh sẽ hiển thị tại đây</h2>
              <p>
                Nhập mã License Key ở khung bên trái để truy xuất thông tin tổng
                quan và dòng thời gian sự kiện Blockchain.
              </p>
            </div>
          ) : null}

          {verification.error ? (
            <Alert
              showIcon
              role="alert"
              type="error"
              title="Không thể kết nối hoặc xác minh dữ liệu Blockchain."
              description={publicVerificationErrorLabel(verification.error)}
              action={
                <Button
                  onClick={() => {
                    verification.reset();
                    verification.mutate(code.trim());
                  }}
                >
                  Thử lại
                </Button>
              }
            />
          ) : null}

          {result?.state === 'NOT_FOUND' ? (
            <Alert
              showIcon
              role="alert"
              type="error"
              title="Không tìm thấy License phù hợp với mã xác thực."
              description="Vui lòng kiểm tra lại mã bản quyền công khai hoặc khóa kích hoạt."
            />
          ) : null}

          {found ? (
            <>
              {/* 1. Thông báo xác minh */}
              <Alert
                showIcon
                role="alert"
                type={
                  isRevoked
                    ? 'error'
                    : isSuspended || isExpired
                      ? 'warning'
                      : 'success'
                }
                title={
                  <span>
                    <span>Đã tìm thấy License</span>
                    {isRevoked
                      ? ' — Bản quyền đã bị thu hồi'
                      : isSuspended
                        ? ' — Bản quyền đang bị tạm khóa'
                        : isExpired
                          ? ' — Bản quyền đã hết hạn'
                          : ' — Đã xác thực trên Blockchain'}
                  </span>
                }
                description={
                  isRevoked
                    ? 'Bản quyền đã bị thu hồi vĩnh viễn trên Blockchain và không còn giá trị sử dụng.'
                    : isSuspended
                      ? 'Bản quyền đang trong trạng thái tạm ngưng hoạt động trên hệ thống.'
                      : isExpired
                        ? 'Thời hạn sử dụng của bản quyền này đã kết thúc.'
                        : `Bản quyền hợp lệ và đã xác thực tính toàn vẹn dữ liệu trên Blockchain.${
                            result.matchedBy === 'HISTORICAL_ROTATED_KEY'
                              ? ` Đã tra cứu qua Key cũ (v${result.matchedKeyVersion ?? 1}) — Key này đã được nâng cấp lên v${result.keyVersion ?? 'mới'} trong cùng vòng đời.`
                              : result.matchedBy === 'CURRENT_KEY'
                                ? ` Đã đối chiếu khớp với khóa kích hoạt hiện hành (v${result.matchedKeyVersion ?? result.keyVersion ?? 1}).`
                                : ''
                          }`
                }
              />

              {/* 2. Card Tổng quan bản quyền */}
              <article
                className="modern-overview-card"
                aria-labelledby="overview-title"
              >
                <header className="modern-overview-header">
                  <h2 id="overview-title" className="modern-overview-title">
                    Tổng quan bản quyền
                  </h2>
                </header>
                <div className="modern-overview-inner">
                  <div className="modern-overview-left">
                    <div className="modern-overview-icon-box" aria-hidden="true">
                      <SafetyCertificateFilled />
                    </div>
                    <div className="modern-overview-product-meta">
                      <h3 className="modern-overview-product-name">
                        {result.productName ?? '—'}
                      </h3>
                      <div className="modern-overview-plan">
                        {result.plan?.name
                          ? `${result.plan.name} (v${result.plan.version})`
                          : 'Gói tiêu chuẩn'}
                      </div>
                      <div className="modern-overview-provider">
                        Nhà phát hành: <span>{result.provider?.organizationName ?? result.provider?.displayName ?? 'Emukey Software'}</span>
                      </div>
                      <div className="modern-overview-badge-row">
                        <span
                          className={`modern-status-badge badge--${
                            isRevoked
                              ? 'error'
                              : isSuspended || isExpired
                                ? 'warning'
                                : 'success'
                          }`}
                        >
                          {isRevoked
                            ? 'Đã thu hồi'
                            : isSuspended
                              ? 'Tạm khóa'
                              : isExpired
                                ? 'Đã hết hạn'
                                : 'Đang hoạt động'}
                        </span>
                        {result.licenseId ? (
                          <span className="modern-license-id-badge">
                            Mã: {result.licenseId}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="modern-overview-right">
                    <div className="modern-overview-stat">
                      <span className="stat-label">Ngày kích hoạt</span>
                      <strong className="stat-value">
                        {formatDateOnlyVi(issuedAtValue)}
                      </strong>
                    </div>
                    <div className="modern-overview-stat">
                      <span className="stat-label">Ngày hết hạn</span>
                      <strong className="stat-value">
                        {result.expiresAt
                          ? formatDateOnlyVi(result.expiresAt)
                          : 'Vĩnh viễn'}
                      </strong>
                    </div>
                    <div className="modern-overview-stat">
                      <span className="stat-label">Thiết bị</span>
                      <strong className="stat-value">
                        {result.maxActiveDevices !== undefined
                          ? `${result.activeDeviceCount ?? 0} / ${result.maxActiveDevices} thiết bị`
                          : `${result.activeDeviceCount ?? 0} thiết bị`}
                      </strong>
                    </div>
                  </div>
                </div>
              </article>

              {/* 3. Card Lịch sử bản quyền */}
              <article
                className="modern-history-card"
                aria-labelledby="history-title"
              >
                <header className="modern-history-header">
                  <div className="modern-history-header-left">
                    <HistoryOutlined
                      className="modern-history-icon"
                      aria-hidden="true"
                    />
                    <div>
                      <h2 id="history-title" className="modern-history-title">
                        Lịch sử bản quyền
                      </h2>
                      <p className="modern-history-subtitle">
                        Các thay đổi được ghi nhận trên Blockchain
                      </p>
                    </div>
                  </div>
                  <div className="modern-history-pill">
                    {sortedEvents.length} sự kiện
                  </div>
                </header>

                {sortedEvents.length === 0 ? (
                  <div className="modern-history-empty" role="status">
                    <HistoryOutlined aria-hidden="true" />
                    <p>
                      Chưa có sự kiện giao dịch nào được ghi nhận trên
                      Blockchain cho License này.
                    </p>
                  </div>
                ) : (
                  <ol
                    className="modern-timeline"
                    aria-label="Dòng thời gian sự kiện Blockchain"
                  >
                    {sortedEvents.map((event, index) => {
                      const visual = eventVisualMeta(event.eventType);
                      const title = getEventTitle(event);
                      const description = getEventDescription(event);
                      const isExpanded = expandedEventId === event.id;
                      const changes: PublicLicenseHistoryChangeDto[] =
                        event.changes ?? [];

                      return (
                        <li
                          key={event.id || `${event.eventType}-${index}`}
                          className="modern-timeline-item"
                          data-testid="blockchain-timeline-item"
                        >
                          <div className="modern-timeline-rail">
                            <span
                              className={`modern-timeline-node ${visual.toneClass}`}
                            >
                              {visual.icon}
                            </span>
                            {index < sortedEvents.length - 1 ? (
                              <span
                                className="modern-timeline-line"
                                aria-hidden="true"
                              />
                            ) : null}
                          </div>

                          <div
                            className={`modern-timeline-box ${
                              isExpanded ? 'is-expanded' : ''
                            }`}
                            onClick={() =>
                              setExpandedEventId((prev) =>
                                prev === event.id ? null : event.id,
                              )
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setExpandedEventId((prev) =>
                                  prev === event.id ? null : event.id,
                                );
                              }
                            }}
                            aria-expanded={isExpanded}
                          >
                            <div className="modern-timeline-box-header">
                              <h3 className="modern-timeline-box-title">
                                {title}
                              </h3>
                              <span
                                className="modern-timeline-box-chevron"
                                aria-hidden="true"
                              >
                                {isExpanded ? (
                                  <UpOutlined />
                                ) : (
                                  <DownOutlined />
                                )}
                              </span>
                            </div>
                            <time
                              className="modern-timeline-box-time"
                              dateTime={event.occurredAt}
                            >
                              {formatDateTimeDotVi(event.occurredAt)}
                            </time>
                            <p className="modern-timeline-box-desc">
                              {description}
                            </p>

                            {isExpanded ? (
                              <div
                                className="modern-timeline-changes"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {changes.length > 0 ? (
                                  changes.map((change) => (
                                    <div
                                      key={`${event.id}-${change.field}`}
                                      className="modern-change-row"
                                    >
                                      <span className="modern-change-label">
                                        {change.label}:
                                      </span>
                                      <span className="modern-change-values">
                                        {change.previousValue ? (
                                          <>
                                            <span className="modern-change-prev">
                                              {formatChangeValue(
                                                change.field,
                                                change.previousValue,
                                              )}
                                            </span>
                                            <span
                                              className="modern-change-arrow"
                                              aria-hidden="true"
                                            >
                                              →
                                            </span>
                                          </>
                                        ) : null}
                                        <strong className="modern-change-curr">
                                          {formatChangeValue(
                                            change.field,
                                            change.currentValue,
                                          )}
                                        </strong>
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="modern-change-empty">
                                    Không có thay đổi cấu hình bổ sung trong
                                    sự kiện này.
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </article>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
