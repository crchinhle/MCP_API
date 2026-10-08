import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Input } from 'antd';
import { useState } from 'react';

import { licenseStatusLabel, publicVerificationErrorLabel, usePublicLicenseVerification } from '../../application/licenses/licenseQueries';
import { SiteHeader } from '../components/SiteHeader';
import { FactList, StatusChip } from '../components/WorkspacePrimitives';

export function PublicVerificationScreen() {
  const [code, setCode] = useState('');
  const verification = usePublicLicenseVerification();
  const result = verification.data;
  const found = result && result.state !== 'NOT_FOUND';

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="verification-content">
        <section className="verification-query" aria-labelledby="verify-title">
          <h1 id="verify-title">Xác minh Blockchain</h1>
          <p>
            Nhập mã tra cứu công khai để kiểm tra trạng thái xác nhận trên blockchain.
            Không nhập mã bản quyền dùng trong phần mềm. Kết quả không hiển thị dữ liệu người mua.
          </p>
          <label>
            Mã xác thực
            <Input
              aria-label="Mã xác thực"
              placeholder="Nhập mã bản quyền công khai"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                verification.reset();
              }}
            />
          </label>
          <div className="workspace-actions">
            <Button
              onClick={() => {
                setCode('');
                verification.reset();
              }}
            >
              Xóa
            </Button>
            <><Button
              disabled={(!code.trim()) || (verification.isPending)}

              type="primary"
              onClick={() => verification.mutate(code.trim())}
            >
              Xác minh
            </Button><LoadingOverlay active={verification.isPending} label="Đang xử lý yêu cầu: Xác minh" /></>
          </div>
        </section>

        <section className="verification-result" aria-label="Kết quả xác minh">
          {verification.isPending ? <LoadingOverlay /> : null}
          {!verification.isPending && !result && !verification.error ? (
            <div className="verification-placeholder" role="status">
              <StatusChip tone="info">Sẵn sàng</StatusChip>
              <h2>Kết quả xác minh sẽ hiển thị tại đây</h2>
            </div>
          ) : null}
          {verification.error ? (
            <Alert
              showIcon
              message="Không thể xác minh lúc này."
              description={publicVerificationErrorLabel(verification.error)}
              role="alert"
              type="error"
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
          {found ? (
            <>
              <Alert
                showIcon
                message="Đã tìm thấy License"
                type={
                  result.state === 'CHAIN_CONFIRMED' ? 'success' : 'warning'
                }
              />
              <article className="workspace-card verification-summary">
                <header>
                  <h2>{result.licenseId}</h2>
                  <StatusChip
                    tone={
                      result.state === 'CHAIN_CONFIRMED' ? 'success' : 'warning'
                    }
                  >
                    {result.state === 'CHAIN_CONFIRMED' ? 'Đã xác nhận trên blockchain' : result.state === 'REORGED' ? 'Đang xác minh lại sau thay đổi blockchain' : result.state === 'PROJECTION_STALE' ? 'Dữ liệu đang được đồng bộ lại' : 'Đang chờ xác nhận trên blockchain'}
                  </StatusChip>
                </header>
                <FactList
                  facts={[
                    { label: 'Sản phẩm', value: result.productName ?? '—' },
                    { label: 'Trạng thái bản quyền', value: result.status ? licenseStatusLabel(result.status) : 'Chưa có thông tin' },
                    {
                      label: 'Nhà cung cấp',
                      value:
                        result.provider?.organizationName ??
                        result.provider?.displayName ??
                        '—',
                    },
                    {
                      label: 'Hết hạn',
                      value: result.expiresAt
                        ? new Date(result.expiresAt).toLocaleDateString('vi-VN')
                        : '—',
                    },
                    {
                      label: 'Mã đối chiếu gói',
                      value: result.plan?.commitment ?? '—',
                    },
                    {
                      label: 'Khối xác nhận',
                      value:
                        result.blockNumber == null
                          ? 'Chưa có xác nhận cuối cùng'
                          : String(result.blockNumber),
                    },
                  ]}
                />
              </article>
            </>
          ) : null}
          {result?.state === 'NOT_FOUND' ? (
            <Alert
              showIcon
              message="Không tìm thấy License phù hợp với mã xác thực."
              role="alert"
              type="error"
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
