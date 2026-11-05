import { paginationTextControls } from '../theme';
import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { CopyableId, PageLoading, StatusChip, useDebouncedValue } from '../components/WorkspacePrimitives';
import { Alert, Button, Empty, Input, Modal, Table } from 'antd';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { licenseStatusLabel as statusLabel, activationKeyErrorLabel, providerHandoffStatus, providerLicenseReady, useLicenseDevices, useLicenses, useRetrieveActivationKey, useResolveLicensingAction, useAcknowledgeActivationKey } from '../../application/licenses/licenseQueries';

import { LicenseRecoveryPanel } from '../components/LicenseRecoveryPanel';
import { ProviderHandoffNotice } from '../components/ProviderHandoffNotice';
import { LicensingEmailActionPanel } from '../components/LicensingEmailActionPanel';
import { useRequestLicensingActionVerification } from '../../application/licenses/licenseQueries';
import { requestJson } from '../../application/auth/authContext';
import { ApiRequestError } from '../../application/auth/authContext';
import type { LicenseProjectionDto, LicenseDeviceDto } from '../../infrastructure/api/generated';

type LicenseTab = 'overview' | 'key' | 'devices';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

export function BuyerLicenseHubScreen() {
  const licenses = useLicenses();
  const retrieve = useRetrieveActivationKey();
  const acknowledge = useAcknowledgeActivationKey();
  const actionEmail = useRequestLicensingActionVerification();
  const [searchParams, setSearchParams] = useSearchParams();
  const rows = licenses.data ?? [];
  const [selectedId, setSelectedId] = useState(searchParams.get('licenseId') ?? '');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [query, filter]);
  const [tab, setTab] = useState<LicenseTab>(searchParams.has('recover') || searchParams.has('activate') || searchParams.has('actionToken') ? 'key' : 'overview');
  const [activationKeys, setActivationKeys] = useState<Record<string, { value: string; keyVersion: number }>>({});
  const [copyStatus, setCopyStatus] = useState('');
  const [keyDialogId, setKeyDialogId] = useState<string>();
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [actionToken] = useState(() => {
    const token=searchParams.get('actionToken');
    if (token) sessionStorage.setItem('emukey-pending-license-action',JSON.stringify({token,until:Date.now()+15*60_000}));
    try { const pending=JSON.parse(sessionStorage.getItem('emukey-pending-license-action')??'null') as {token:string;until:number}|null;
      return token??(pending&&pending.until>Date.now()?pending.token:''); } catch { return token??''; }
  });
  const resolution = useResolveLicensingAction(actionToken);
  const invalidActionLink = resolution.error instanceof ApiRequestError && [400, 401, 403, 404].includes(resolution.error.status);
  const visibleRows = rows.filter((license) => (filter === 'all' || license.status === filter) &&
    `${license.productName} ${license.plan.name} ${license.publicLicenseId} ${license.activationKeyLast4 ?? ''}`.toLocaleLowerCase('vi').includes(debouncedQuery.trim().toLocaleLowerCase('vi')));
  const selected = rows.find((license) => license.id === selectedId);
  const providerManaged = selected?.fulfillmentMode==='PROVIDER_HANDOFF';
  const devices = useLicenseDevices(providerManaged ? undefined : selected?.id);
  const receipt = selected ? activationKeys[selected.id] : undefined;
  const activationKey = receipt && selected?.activationKeyTrustStatus === 'TRUSTED' && receipt.keyVersion === selected.keyVersion ? receipt.value : undefined;

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
  if (resolution.data && resolution.data.action !== 'KEY_RECOVERY') return <LicensingEmailActionPanel action={resolution.data} token={actionToken} />;
  if (licenses.isPending) return <PageLoading />;
  if (licenses.isError) return <Alert type="error" title="Không thể tải danh sách bản quyền." action={<Button onClick={() => void licenses.refetch()}>Thử lại</Button>} />;
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
            pagination={{ ...paginationTextControls, current: Math.min(page, Math.max(1, Math.ceil(visibleRows.length / 10))), pageSize: 10, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
            locale={{ emptyText: 'Không có bản quyền phù hợp bộ lọc.' }} columns={[
              { title: 'Sản phẩm / Gói', key: 'product', width: 260, render: (_, row) => <><strong>{row.productName}</strong><div>{row.plan.name}</div><CopyableId value={row.publicLicenseId} /></> },
              { title: 'Mã bản quyền', dataIndex: 'activationKeyLast4', width: 180, render: (value: string | null | undefined) => value ? <code>•••• {value}</code> : 'Không có thông tin' },
              { title: 'Trạng thái', dataIndex: 'status', width: 200, render: (value: string,row) => {
                const progress=providerHandoffStatus(row);
                return progress ? <StatusChip tone={progress.tone}>{progress.label}</StatusChip>
                  : <span className={`buyer-license-status buyer-license-status--${value.toLowerCase()}`}>{value === 'PENDING_ONCHAIN' ? 'Đang cấp' : statusLabel(value)}</span>;
              } },
              { title: 'Phạm vi', key: 'devices', width: 150, render: (_, row) => row.fulfillmentMode==='PROVIDER_HANDOFF' ? `${row.maxActiveDevices} thiết bị · bên bán quản lý` : `${row.activeDeviceCount}/${row.maxActiveDevices}` },
              { title: 'Hết hạn', dataIndex: 'expiresAt', width: 120, render: (value: string) => dateLabel(value) },
              { title: 'Hành động', key: 'actions', width: 300, render: (_, row) => <div className="buyer-license-table-actions">
                <Button onClick={() => openDetails(row.id, 'key')}>Chi tiết</Button>
                {row.fulfillmentMode!=='PROVIDER_HANDOFF'?<Button onClick={() => openDetails(row.id, 'devices')}>Thiết bị</Button>:null}
                {['ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(row.status) ? <Button type="primary" href={`/buyer/licenses/${encodeURIComponent(row.id)}/renew`}>Gia hạn</Button> : null}
              </div> },
            ]} />
        </section>
        <Modal className="buyer-license-detail-modal" centered width={keyDialogOpen ? 520 : 960} open={Boolean(selected)} title={keyDialogOpen ? 'Mã bản quyền của bạn' : tab === 'devices' ? 'Quản lý thiết bị' : 'Chi tiết bản quyền'}
          onCancel={() => { if (retrieve.isPending) return; if (keyDialogOpen) { setKeyDialogOpen(false); return; } setSelectedId(''); setKeyDialogId(undefined); }}
          footer={keyDialogOpen && activationKey ? <div className="workspace-actions">
            <Button aria-label="Sao chép mã bản quyền" onClick={() => { if (!activationKey) return; if (!navigator.clipboard) { setCopyStatus('Không thể sao chép tự động. Vui lòng lưu mã thủ công.'); return; } void navigator.clipboard.writeText(activationKey).then(() => setCopyStatus('Đã sao chép mã bản quyền')).catch(() => setCopyStatus('Không thể sao chép. Vui lòng lưu mã thủ công.')); }}>Sao chép mã bản quyền</Button>
            <Button type="primary" loading={acknowledge.isPending} onClick={() => { if (selected) acknowledge.mutate(selected.id, { onSuccess: () => { setKeyDialogOpen(false); setActivationKeys((current) => { const next = { ...current }; delete next[selected.id]; return next; }); void licenses.refetch(); } }); }}>Tôi đã lưu mã</Button>
            <Button onClick={() => setKeyDialogOpen(false)}>Đóng</Button>
          </div> : null} destroyOnHidden>
          {selected && keyDialogOpen && activationKey && keyDialogId === selected.id ? <div className="activation-key-dialog-content">
            <p>{selected.productName} · {selected.plan.name}</p>
            <Input.Password aria-label="Mã bản quyền đã cấp" readOnly value={activationKey} />
            <p>Hãy lưu mã an toàn trước khi đóng. Mã không được lưu trên thiết bị này và sẽ mất khi tải lại trang.</p>
            <span role="status" aria-live="polite">{copyStatus}</span>
            {acknowledge.isError ? <Alert type="error" title="Chưa thể xác nhận đã lưu mã. Hãy thử lại." /> : null}
          </div> : selected ? <section aria-label="Chi tiết bản quyền" className="buyer-license-modal-content">
            <ProviderHandoffNotice license={selected}/>
            <header className="buyer-license-detail-header"><div><h2>{selected.productName} · {selected.plan.name}</h2><p>Mã tra cứu: {selected.publicLicenseId} · Hết hạn {dateLabel(selected.expiresAt)}</p></div><span className={`buyer-license-status buyer-license-status--${selected.status.toLowerCase()}`}>{statusLabel(selected.status)}</span></header>
            {devices.isError ? <Alert type="error" title="Không thể tải thiết bị" action={<Button onClick={() => void devices.refetch()}>Thử lại</Button>} /> : null}
               {retrieve.isError ? <Alert type="error" message={activationKeyErrorLabel(retrieve.error)} action={<Button disabled={licenses.isFetching} onClick={() => void licenses.refetch()}>Thử lại</Button>} /> : null}
            <nav aria-label="Chi tiết bản quyền" className="buyer-license-detail-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')} type="button">Tổng quan</button><button className={tab === 'key' ? 'active' : ''} onClick={() => setTab('key')} type="button">Mã bản quyền</button>{!providerManaged?<button className={tab === 'devices' ? 'active' : ''} onClick={() => setTab('devices')} type="button">Thiết bị</button>:null}</nav>
            {tab === 'overview' ? <>
              <p>Đơn hàng gốc: <CopyableId value={selected.originOrderId} /></p>
              {['ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(selected.status) ? <div className="workspace-actions"><Button href={`/buyer/licenses/${encodeURIComponent(selected.id)}/renew`} type="primary">Gia hạn bản quyền</Button></div> : null}
              {providerManaged?<p>Gói cho phép tối đa {selected.maxActiveDevices} thiết bị. Nhà cung cấp quản lý việc sử dụng trong sản phẩm của họ.</p>:<><div className="buyer-license-summary"><article><span>Phạm vi</span><strong>{selected.maxActiveDevices} thiết bị</strong></article><article><span>Đã kích hoạt</span><strong>{devices.data ? activeDevices : '—'}</strong></article><article><span>Còn lại</span><strong>{devices.data ? remainingDevices : '—'}</strong></article></div>
              <section className="buyer-license-devices"><h3>Thiết bị gần đây</h3>{(devices.data ?? []).slice(0, 2).map((device) => <div className="buyer-license-device-row" key={device.id}><span>{device.deviceRef} · {statusLabel(device.status)}</span><Button onClick={() => setTab('devices')}>Xem thiết bị</Button></div>)}</section></>}
            </> : null}
             {tab === 'key' ? <>
              <section aria-label="Mã bản quyền" className="buyer-license-action-panel">
               {!activationKey ? providerManaged && !providerLicenseReady(selected) ? <p>Chưa thể nhận mã. Theo dõi tiến trình bản quyền ở trên; bạn không cần thanh toán lại.</p> : selected.activationKeyAvailable ? <>
                 <p>Mã bản quyền đã sẵn sàng. Bạn chỉ có thể nhận mã một lần; hãy chuẩn bị lưu mã an toàn.</p>
                 <Button type="primary" disabled={retrieve.isPending} onClick={() => retrieve.mutate({ id: selected.id, keyVersion: selected.keyVersion }, { onSuccess: (value) => {
                   setActivationKeys((current) => ({ ...current, [selected.id]: { value: value.activationKey, keyVersion: value.keyVersion } }));
                   setCopyStatus('');
                   setKeyDialogId(selected.id);
                   setKeyDialogOpen(true);
                 } })}>Nhận mã bản quyền một lần</Button>
               </> : <Alert showIcon type="info" title="Mã bản quyền không còn sẵn sàng để nhận" description="Mã có thể đã được nhận hoặc bản quyền chưa đủ điều kiện cấp mã. Nếu đã lưu mã, tiếp tục sử dụng mã đó trong phần mềm; nếu mất mã, sử dụng mục khôi phục bên dưới khi bản quyền đang hoạt động." /> : <Button type="primary" onClick={() => setKeyDialogOpen(true)}>Xem mã bản quyền</Button>}
               <LoadingOverlay active={retrieve.isPending} label="Đang nhận mã bản quyền" />
              </section>
              {selected.status === 'ACTIVE' ? <LicenseRecoveryPanel key={selected.id} licenseId={selected.id} providerManaged={providerManaged} providerReady={!licenses.isFetching && providerLicenseReady(selected) && selected.activationKeyAvailable===true} initialToken={resolution.data?.licenseId === selected.id ? actionToken : ''} onKey={(id, key, keyVersion) => { setActivationKeys((current) => ({ ...current, [id]: { value: key, keyVersion } })); setCopyStatus(''); setKeyDialogId(id); setKeyDialogOpen(true); void licenses.refetch(); }} /> : null}
            </> : null}
            {tab === 'devices' && !providerManaged ? <section aria-label="Thiết bị" className="buyer-license-action-panel">
              <p>Đang sử dụng {devices.data ? activeDevices : '—'}/{selected.maxActiveDevices} thiết bị.</p>
              <LoadingOverlay active={devices.isPending} label="Đang tải thiết bị" />
              {!devices.isError && !devices.isPending ? <Table<LicenseDeviceDto> rowKey="id" dataSource={devices.data ?? []} scroll={{ x: 650 }}
                pagination={{ ...paginationTextControls, pageSize: 5, showSizeChanger: false, hideOnSinglePage: true }} locale={{ emptyText: 'Chưa có thiết bị.' }} columns={[
                  { title: 'Mã thiết bị', dataIndex: 'deviceRef', ellipsis: true },
                  { title: 'Tên thiết bị', dataIndex: 'displayName', render: (value: string | null, device: {id:string;deviceRef:string}) => <Input aria-label={`Tên thiết bị ${device.id}`} defaultValue={value??''} maxLength={80} placeholder={`Thiết bị ${device.deviceRef.slice(0,8)}`} onBlur={(event)=>{
                    if (event.target.value===(value??'')) return;
                    void requestJson(`/licenses/${selected.id}/devices/${device.id}`,{method:'PATCH',body:JSON.stringify({displayName:event.target.value})}).then(()=>devices.refetch()).catch(()=>setCopyStatus('Không thể đổi tên thiết bị.'));
                  }} /> },
                  { title: 'Trạng thái', dataIndex: 'status', width: 140, render: (value: string) => statusLabel(value) },
                  { title: 'Ngày kích hoạt', dataIndex: 'activatedAt', width: 150, render: (value: string | null) => value ? dateLabel(value) : '—' },
                  { title: 'Ngày thu hồi', dataIndex: 'revokedAt', width: 150, render: (value: string | null) => value ? dateLabel(value) : '—' },
                  { title: 'Thao tác', render: (_:unknown,device:{id:string;status:string}) => device.status==='ACTIVE'?<Button loading={actionEmail.isPending} onClick={()=>actionEmail.mutate({licenseId:selected.id,deviceId:device.id,action:'REMOTE_REVOKE_DEVICE'})}>Thu hồi từ xa</Button>:null },
                ]} /> : null}
              {actionEmail.isSuccess?<Alert type="success" title="Đã gửi email xác nhận. Mở liên kết trong email để tiếp tục." />:null}
              {actionEmail.isError?<Alert type="error" title="Không thể gửi email xác nhận. Hãy thử lại." />:null}
            </section> : null}
          </section> : null}
        </Modal>
      </main>
    </div>
  );
}
