import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { PageLoading } from '../components/WorkspacePrimitives';
import { Alert, Button, Empty, Input, Modal, Table } from 'antd';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { licenseStatusLabel as statusLabel, activationKeyErrorLabel, useLicenseDevices, useLicenses, useRetrieveActivationKey, useResolveLicensingAction } from '../../application/licenses/licenseQueries';

import { LicenseRecoveryPanel } from '../components/LicenseRecoveryPanel';
import { ApiRequestError } from '../../application/auth/authContext';
import type { LicenseProjectionDto } from '../../infrastructure/api/generated';

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
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<LicenseTab>(searchParams.has('recover') || searchParams.has('activate') || searchParams.has('actionToken') ? 'key' : 'overview');
  const [activationKeys, setActivationKeys] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState('');
  const [keyDialogId, setKeyDialogId] = useState<string>();
  const [actionToken] = useState(() => searchParams.get('actionToken') ?? '');
  const resolution = useResolveLicensingAction(actionToken);
  const invalidActionLink = resolution.error instanceof ApiRequestError && [400, 401, 403, 404].includes(resolution.error.status);
  const visibleRows = rows.filter((license) => (filter === 'all' || license.status === filter) &&
    `${license.productName} ${license.plan.name} ${license.publicLicenseId} ${license.activationKeyLast4 ?? ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
  const selected = rows.find((license) => license.id === selectedId);
  const devices = useLicenseDevices(selected?.id);
  const activationKey = selected ? activationKeys[selected.id] : undefined;
  const setActivationKey = (value: string | undefined) => {
    if (selected) setActivationKeys((current) => ({ ...current, [selected.id]: value ?? '' }));
  };

  useEffect(() => {
    if (searchParams.has('actionToken')) {
      setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('actionToken'); return next; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (resolution.data) { setSelectedId(resolution.data.licenseId); setFilter('all'); setTab('key'); }
  }, [resolution.data]);

  if (actionToken && resolution.isPending) return <PageLoading />;
  if (actionToken && resolution.isError) return <Alert type="error" message={invalidActionLink ? 'Liên kết email không hợp lệ hoặc đã hết hạn.' : 'Chưa thể kiểm tra liên kết email. Vui lòng thử lại.'} description={invalidActionLink ? 'Mở lại bản quyền để yêu cầu email mới.' : 'Kiểm tra kết nối rồi tải lại trạng thái liên kết.'} action={invalidActionLink ? <Button href="/buyer/licenses">Danh sách bản quyền</Button> : <Button onClick={() => void resolution.refetch()}>Thử lại</Button>} />;
  if (resolution.data && resolution.data.action !== 'KEY_RECOVERY') return <Alert type="info" message="Liên kết này dành cho thao tác thiết bị hoặc đổi mã." description="Quay lại ứng dụng đã gửi yêu cầu để tiếp tục đúng thao tác." action={<Button href="/buyer/licenses">Danh sách bản quyền</Button>} />;
  if (licenses.isPending) return <PageLoading />;
  if (licenses.isError) return <Alert type="error" message="Không thể tải danh sách bản quyền." />;
  if (!rows.length) return <Empty description="Chưa có bản quyền"><Button href="/buyer/products">Khám phá sản phẩm</Button></Empty>;

  const activeDevices = (devices.data ?? []).filter((device) => device.status === 'ACTIVE').length;
  const remainingDevices = Math.max((selected?.maxActiveDevices ?? 0) - activeDevices, 0);
  const openDetails = (id: string, nextTab: LicenseTab) => {
    setSelectedId(id);
    setTab(nextTab);
    setCopyStatus('');
    retrieve.reset();
  };

  return (
    <div className="buyer-licenses-screen">
      <main className="buyer-licenses-main">
        <div className="buyer-licenses-tabs">{[['all', 'Tất cả'], ['ACTIVE', 'Đang hoạt động'], ['PENDING_ONCHAIN', 'Đang cấp'], ['EXPIRED', 'Đã hết hạn'], ['SUSPENDED', 'Tạm ngưng'], ['REVOKED', 'Đã thu hồi']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => { setFilter(value!); setPage(1); }} type="button">{label}</button>)}</div>
        <section className="buyer-license-table" aria-label="Danh sách bản quyền">
          <Input.Search aria-label="Tìm bản quyền" placeholder="Tìm sản phẩm, gói, mã tra cứu hoặc 4 ký tự cuối" allowClear value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
          <Table<LicenseProjectionDto> rowKey="id" dataSource={visibleRows} scroll={{ x: 1100 }}
            pagination={{ current: Math.min(page, Math.max(1, Math.ceil(visibleRows.length / 10))), pageSize: 10, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
            locale={{ emptyText: 'Không có bản quyền phù hợp bộ lọc.' }} columns={[
              { title: 'Sản phẩm / Gói', key: 'product', width: 260, render: (_, row) => <><strong>{row.productName}</strong><div>{row.plan.name}</div></> },
              { title: 'Mã bản quyền', dataIndex: 'activationKeyLast4', width: 180, render: (value: string | null | undefined) => value ? <code>•••• {value}</code> : 'Không có thông tin' },
              { title: 'Trạng thái', dataIndex: 'status', width: 145, render: (value: string) => <span className={`buyer-license-status buyer-license-status--${value.toLowerCase()}`}>{value === 'PENDING_ONCHAIN' ? 'Đang cấp' : statusLabel(value)}</span> },
              { title: 'Thiết bị', key: 'devices', width: 95, render: (_, row) => `${row.activeDeviceCount}/${row.maxActiveDevices}` },
              { title: 'Hết hạn', dataIndex: 'expiresAt', width: 120, render: (value: string) => dateLabel(value) },
              { title: 'Hành động', key: 'actions', width: 300, render: (_, row) => <div className="buyer-license-table-actions">
                <Button onClick={() => openDetails(row.id, 'key')}>Chi tiết</Button>
                <Button onClick={() => openDetails(row.id, 'devices')}>Thiết bị</Button>
                {['ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(row.status) ? <Button type="primary" href={`/buyer/licenses/${encodeURIComponent(row.id)}/renew`}>Gia hạn</Button> : null}
              </div> },
            ]} />
        </section>
        <Modal centered width={960} open={Boolean(selected)} title={tab === 'devices' ? 'Quản lý thiết bị' : 'Chi tiết bản quyền'}
          onCancel={() => { if (!retrieve.isPending) { setSelectedId(''); setKeyDialogId(undefined); } }} footer={null}>
          {selected ? <section aria-label="Chi tiết bản quyền" className="buyer-license-modal-content">
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
               {activationKey ? <Button type="primary" onClick={() => setKeyDialogId(selected.id)}>Xem mã bản quyền</Button>
                 : selected.activationKeyAvailable ? <>
                   <p>Mã bản quyền đã sẵn sàng. Bạn có thể nhận mã một lần và lưu lại để sử dụng trong phần mềm.</p>
                   <Button type="primary" disabled={retrieve.isPending} onClick={() => Modal.confirm({ centered: true, title: 'Nhận mã bản quyền một lần?', content: 'Hãy lưu mã an toàn sau khi nhận. Hệ thống không cung cấp lại mã đã nhận.', okText: 'Nhận mã', cancelText: 'Để sau', onOk: () => { retrieve.mutate({ id: selected.id }, { onSuccess: (value) => { setActivationKey(value.activationKey); setCopyStatus(''); setKeyDialogId(selected.id); } }); } })}>Nhận mã bản quyền</Button>
                 </> : <Alert showIcon type="info" title="Mã bản quyền không còn sẵn sàng để nhận" description="Mã có thể đã được nhận hoặc bản quyền chưa đủ điều kiện cấp mã. Nếu đã lưu mã, tiếp tục sử dụng mã đó trong phần mềm; nếu mất mã, sử dụng mục khôi phục bên dưới khi bản quyền đang hoạt động." />}
               <LoadingOverlay active={retrieve.isPending} label="Đang nhận mã bản quyền" />
               <Modal centered width={520} open={Boolean(activationKey) && keyDialogId === selected.id} title="Mã bản quyền của bạn"
                 mask={{ closable: false }} onCancel={() => setKeyDialogId(undefined)}
                 footer={<div className="workspace-actions">
                   <Button onClick={() => { if (!activationKey) return; if (!navigator.clipboard) { setCopyStatus('Không thể sao chép tự động. Vui lòng lưu mã thủ công.'); return; } void navigator.clipboard.writeText(activationKey).then(() => setCopyStatus('Đã sao chép mã bản quyền')).catch(() => setCopyStatus('Không thể sao chép. Vui lòng lưu mã thủ công.')); }}>Sao chép</Button>
                   <Button type="primary" onClick={() => setKeyDialogId(undefined)}>Tôi đã lưu mã</Button>
                 </div>}>
                 <div className="activation-key-dialog-content">
                   <p>{selected.productName} · {selected.plan.name}</p>
                   <Input.Password aria-label="Mã bản quyền đã cấp" readOnly value={activationKey ?? ''} />
                   <p>Hãy lưu mã an toàn trước khi tải lại hoặc rời trang. Bạn có thể mở lại cửa sổ này trong trang hiện tại.</p>
                   <span role="status" aria-live="polite">{copyStatus}</span>
                 </div>
               </Modal>
             </section> : null}
            {tab === 'devices' ? <section className="buyer-license-action-panel">
              <p>Đang sử dụng {devices.data ? activeDevices : '—'}/{selected.maxActiveDevices} thiết bị.</p>
              <LoadingOverlay active={devices.isPending} label="Đang tải thiết bị" />
              {!devices.isError && !devices.isPending ? <Table rowKey="id" dataSource={devices.data ?? []} scroll={{ x: 650 }}
                pagination={{ pageSize: 5, showSizeChanger: false, hideOnSinglePage: true }} locale={{ emptyText: 'Chưa có thiết bị.' }} columns={[
                  { title: 'Mã thiết bị', dataIndex: 'deviceRef', ellipsis: true },
                  { title: 'Trạng thái', dataIndex: 'status', width: 140, render: (value: string) => statusLabel(value) },
                  { title: 'Ngày kích hoạt', dataIndex: 'activatedAt', width: 150, render: (value: string | null) => value ? dateLabel(value) : '—' },
                  { title: 'Ngày thu hồi', dataIndex: 'revokedAt', width: 150, render: (value: string | null) => value ? dateLabel(value) : '—' },
                ]} /> : null}
            </section> : null}
            {tab === 'key' && selected.status === 'ACTIVE' ? <LicenseRecoveryPanel key={selected.id} licenseId={selected.id} initialToken={resolution.data?.licenseId === selected.id ? actionToken : ''} onKey={(id, key) => { setActivationKeys((current) => ({ ...current, [id]: key })); setCopyStatus(''); setKeyDialogId(id); void licenses.refetch(); }} /> : null}
          </section> : null}
        </Modal>
      </main>
    </div>
  );
}
