import { Alert, Button, Empty, Input, Modal, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { licenseStatusLabel as statusLabel, activationKeyErrorLabel, useLicenseDevices, useLicenses, useRetrieveActivationKey, useResolveLicensingAction } from '../../application/licenses/licenseQueries';

import { LicenseRecoveryPanel } from '../components/LicenseRecoveryPanel';
import { ApiRequestError } from '../../application/auth/authContext';

type LicenseTab = 'overview' | 'key' | 'devices';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

export function BuyerLicenseHubScreen() {
  const licenses = useLicenses();
  const retrieve = useRetrieveActivationKey();
  const [searchParams, setSearchParams] = useSearchParams();
  const rows = licenses.data ?? [];
  const [selectedId, setSelectedId] = useState(searchParams.get('licenseId') ?? '');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState<LicenseTab>(searchParams.has('recover') || searchParams.has('activate') || searchParams.has('actionToken') ? 'key' : 'overview');
  const [activationKeys, setActivationKeys] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState('');
  const [actionToken] = useState(() => searchParams.get('actionToken') ?? '');
  const resolution = useResolveLicensingAction(actionToken);
  const invalidActionLink = resolution.error instanceof ApiRequestError && [400, 401, 403, 404].includes(resolution.error.status);
  const visibleRows = rows.filter((license) => filter === 'all' || license.status === filter);
  const selected = visibleRows.find((license) => license.id === selectedId) ?? visibleRows[0];
  const devices = useLicenseDevices(selected?.id);
  const activationKey = selected ? activationKeys[selected.id] : undefined;
  const setActivationKey = (value: string | undefined) => {
    if (selected) setActivationKeys((current) => ({ ...current, [selected.id]: value ?? '' }));
  };

  useEffect(() => {
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  useEffect(() => {
    if (searchParams.has('actionToken')) {
      setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('actionToken'); return next; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (resolution.data) { setSelectedId(resolution.data.licenseId); setFilter('all'); setTab('key'); }
  }, [resolution.data]);

  if (actionToken && resolution.isPending) return <Spin aria-label="Đang kiểm tra liên kết email" />;
  if (actionToken && resolution.isError) return <Alert type="error" message={invalidActionLink ? 'Liên kết email không hợp lệ hoặc đã hết hạn.' : 'Chưa thể kiểm tra liên kết email. Vui lòng thử lại.'} description={invalidActionLink ? 'Mở lại bản quyền để yêu cầu email mới.' : 'Kiểm tra kết nối rồi tải lại trạng thái liên kết.'} action={invalidActionLink ? <Button href="/buyer/licenses">Danh sách bản quyền</Button> : <Button onClick={() => void resolution.refetch()}>Thử lại</Button>} />;
  if (resolution.data && resolution.data.action !== 'KEY_RECOVERY') return <Alert type="info" message="Liên kết này dành cho thao tác thiết bị hoặc đổi mã." description="Quay lại ứng dụng đã gửi yêu cầu để tiếp tục đúng thao tác." action={<Button href="/buyer/licenses">Danh sách bản quyền</Button>} />;
  if (licenses.isPending) return <Spin aria-label="Đang tải bản quyền" />;
  if (licenses.isError) return <Alert type="error" message="Không thể tải danh sách bản quyền." />;
  if (!rows.length) return <Empty description="Chưa có bản quyền"><Button href="/buyer/products">Khám phá sản phẩm</Button></Empty>;

  const activeDevices = (devices.data ?? []).filter((device) => device.status === 'ACTIVE').length;
  const remainingDevices = Math.max((selected?.maxActiveDevices ?? 0) - activeDevices, 0);

  return (
    <div className="buyer-licenses-screen">
      <main className="buyer-licenses-main">
        <header className="buyer-licenses-title"><h1>Bản quyền &amp; thiết bị</h1><p>Quản lý quyền sử dụng, mã bản quyền và thiết bị.</p></header>
        <div className="buyer-licenses-tabs">{[['all', 'Tất cả'], ['ACTIVE', 'Đang hoạt động'], ['EXPIRED', 'Đã hết hạn'], ['SUSPENDED', 'Tạm ngưng'], ['REVOKED', 'Đã thu hồi']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} disabled={retrieve.isPending} onClick={() => { setFilter(value!); setCopyStatus(''); retrieve.reset(); }} type="button">{label}</button>)}</div>
        {!selected ? <Empty description="Không có bản quyền phù hợp bộ lọc." /> :
        <div className="buyer-licenses-layout">
          <aside aria-label="Danh sách bản quyền" className="buyer-licenses-list">
            {visibleRows.map((license) => (
              <button className={`buyer-license-list-item ${license.id === selected.id ? 'selected' : ''}`} key={license.id} disabled={retrieve.isPending} onClick={() => { setSelectedId(license.id); setTab('overview'); setCopyStatus(''); retrieve.reset(); }} type="button">
                <span className="buyer-license-list-heading"><strong>{license.productName}</strong><span className={`buyer-license-status buyer-license-status--${license.status.toLowerCase()}`}>{statusLabel(license.status)}</span></span>
                <span>Tối đa {license.maxActiveDevices} thiết bị</span>
              </button>
            ))}
          </aside>
          <section aria-label="Chi tiết bản quyền" className="buyer-license-detail">
            <header className="buyer-license-detail-header"><div><h2>{selected.productName} · {selected.plan.name}</h2><p>Mã tra cứu: {selected.publicLicenseId} · Hết hạn {dateLabel(selected.expiresAt)}</p></div><span className={`buyer-license-status buyer-license-status--${selected.status.toLowerCase()}`}>{statusLabel(selected.status)}</span></header>
            {devices.isError ? <Alert type="error" title="Không thể tải thiết bị" action={<Button onClick={() => void devices.refetch()}>Thử lại</Button>} /> : null}
               {retrieve.isError ? <Alert type="error" message={activationKeyErrorLabel(retrieve.error)} /> : null}
            <nav aria-label="Chi tiết bản quyền" className="buyer-license-detail-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')} type="button">Tổng quan</button><button className={tab === 'key' ? 'active' : ''} onClick={() => setTab('key')} type="button">Mã bản quyền</button><button className={tab === 'devices' ? 'active' : ''} onClick={() => setTab('devices')} type="button">Thiết bị</button></nav>
            {tab === 'overview' ? <>
              {['ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(selected.status) ? <div className="workspace-actions"><Button href={`/buyer/licenses/${encodeURIComponent(selected.id)}/renew`} type="primary">Gia hạn bản quyền</Button></div> : null}
              <div className="buyer-license-summary"><article><span>Phạm vi</span><strong>{selected.maxActiveDevices} thiết bị</strong></article><article><span>Đã kích hoạt</span><strong>{devices.data ? activeDevices : '—'}</strong></article><article><span>Còn lại</span><strong>{devices.data ? remainingDevices : '—'}</strong></article></div>
              <section className="buyer-license-devices"><h3>Thiết bị gần đây</h3>{(devices.data ?? []).slice(0, 2).map((device) => <div className="buyer-license-device-row" key={device.id}><span>{device.deviceRef} · {statusLabel(device.status)}</span><Button onClick={() => setTab('devices')}>Xem thiết bị</Button></div>)}</section>
            </> : null}
             {tab === 'key' ? <section className="buyer-license-action-panel">
               <Input.Password aria-label="Mã bản quyền" onChange={(event) => setActivationKey(event.target.value || undefined)} placeholder="Dán mã bản quyền đã lưu" value={activationKey ?? ''} />
                <Button disabled={!selected.activationKeyAvailable || Boolean(activationKey)} loading={retrieve.isPending} onClick={() => Modal.confirm({ title: 'Nhận mã bản quyền một lần?', content: 'Mã chỉ hiển thị một lần. Hãy chắc chắn bạn có thể lưu mã an toàn trước khi tiếp tục.', okText: 'Nhận mã', cancelText: 'Hủy', onOk: () => retrieve.mutateAsync({ id: selected.id }).then((value) => { setActivationKey(value.activationKey); }).catch(() => undefined) })}>Nhận mã bản quyền</Button>
               {activationKey ? <><code>{activationKey}</code><Button onClick={() => { if (!navigator.clipboard) { setCopyStatus('Không thể sao chép tự động. Vui lòng lưu mã thủ công.'); return; } void navigator.clipboard.writeText(activationKey).then(() => setCopyStatus('Đã sao chép mã bản quyền')).catch(() => setCopyStatus('Không thể sao chép. Vui lòng lưu mã thủ công.')); }}>Sao chép mã bản quyền</Button></> : null}
               <span aria-live="polite">{copyStatus}</span>
             </section> : null}
            {tab === 'devices' ? <section className="buyer-license-action-panel"><h3>Thiết bị đã đăng ký</h3>{devices.isPending ? <Spin /> : null}{devices.data?.length ? devices.data.map((device) => <div className="buyer-license-device-row" key={device.id}><span>{device.deviceRef} · {statusLabel(device.status)}</span></div>) : !devices.isPending && !devices.isError ? <Empty description="Chưa có thiết bị." /> : null}</section> : null}
            {tab === 'key' ? <p>Để kích hoạt, mở phần mềm trên thiết bị cần sử dụng và nhập mã đã lưu. Nếu mất mã, <a href="/buyer/support">liên hệ hỗ trợ</a> để được hướng dẫn khôi phục.</p> : null}
            {tab === 'key' && selected.status === 'ACTIVE' ? <LicenseRecoveryPanel key={selected.id} licenseId={selected.id} initialToken={resolution.data?.licenseId === selected.id ? actionToken : ''} onKey={(id, key) => { setActivationKeys((current) => ({ ...current, [id]: key })); setCopyStatus(''); void licenses.refetch(); }} /> : null}
          </section>
        </div>}
      </main>
    </div>
  );
}
