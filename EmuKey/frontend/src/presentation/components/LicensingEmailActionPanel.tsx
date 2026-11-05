import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import type { LicensingActionResolutionDto } from '../../infrastructure/api/generated';
import { useRemoteRevokeDevice, useRotateActivationKey, usePhase6Command } from '../../application/licenses/licenseQueries';

/** Completes the exact owner/action/device resolved by the backend email token. */
export function LicensingEmailActionPanel({ action, token }: { action:LicensingActionResolutionDto; token:string }) {
  const [password,setPassword]=useState('');
  const [currentKey,setCurrentKey]=useState('');
  const [commandId,setCommandId]=useState<string>();
  const revoke=useRemoteRevokeDevice();
  const rotate=useRotateActivationKey();
  const status=usePhase6Command(commandId);
  if (action.action==='REVOKE_DEVICE') return <Alert type="info" title="Thao tác cần chữ ký thiết bị" description="Trở lại phần mềm trên thiết bị đã gửi yêu cầu. Nếu không còn thiết bị, dùng Thu hồi từ xa trong trang quản lý thiết bị." />;
  const rotating=action.action==='ROTATE_KEY';
  const pending=rotate.isPending||revoke.isPending;
  return <section className="workspace-card" aria-label="Xác nhận thao tác từ email">
    <h2>{rotating?'Đổi mã bản quyền':'Thu hồi thiết bị từ xa'}</h2>
    <p>Bản quyền: {action.licenseId}{action.deviceId?` · Thiết bị: ${action.deviceId}`:''}</p>
    {rotating?<Input.Password aria-label="Mã bản quyền hiện tại" autoComplete="off" value={currentKey} onChange={(event)=>setCurrentKey(event.target.value)} />:
      <Input.Password aria-label="Mật khẩu xác nhận thao tác" autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} />}
    <Button type="primary" danger loading={pending} disabled={Boolean(commandId)||revoke.isSuccess||(rotating?!/^0x[0-9a-fA-F]{64}$/.test(currentKey):!password)} onClick={()=>{
      if (rotating) rotate.mutate({licenseId:action.licenseId,input:{actionToken:token,currentKey}}, {onSuccess:(value)=>{setCommandId(value.commandId);setCurrentKey('');}});
      else if (action.deviceId) revoke.mutate({licenseId:action.licenseId,deviceId:action.deviceId,input:{actionToken:token,currentPassword:password}}, {onSuccess:()=>setPassword('')});
    }}>Xác nhận {rotating?'đổi mã':'thu hồi'}</Button>
    {rotate.isError||revoke.isError?<Alert type="error" title="Chưa thể hoàn tất. Kiểm tra thông tin và trạng thái trước khi thử lại." />:null}
    {commandId?<Alert type="info" title={status.data?.status==='CONFIRMED'?'Đã ghi nhận đổi mã. Mở bản quyền để theo dõi bàn giao và nhận mã.':'Yêu cầu đổi mã đang được xử lý. Không gửi yêu cầu khác.'} />:null}
    {revoke.isSuccess?<Alert type="success" title="Đã thu hồi thiết bị. Trở lại ứng dụng để cập nhật danh sách." />:null}
    <Button href={`/buyer/licenses?licenseId=${encodeURIComponent(action.licenseId)}`}>Mở bản quyền</Button>
    <Button href={`emukey://licenses?licenseId=${encodeURIComponent(action.licenseId)}`}>Quay lại ứng dụng</Button>
  </section>;
}
