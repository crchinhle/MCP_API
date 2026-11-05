import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../../EmuKey/frontend/src/presentation/app/App';
import { ProviderHandoffNotice } from '../../../EmuKey/frontend/src/presentation/components/ProviderHandoffNotice';
import type { LicenseProjectionDto } from '../../../EmuKey/frontend/src/infrastructure/api/generated';

afterEach(cleanup);

it.each([
  [{status:'PENDING_ONCHAIN',activationKeyTrustStatus:'PENDING_FINALITY',providerDeliveryStatus:null},'Đang xác nhận blockchain'],
  [{activationKeyTrustStatus:'UNTRUSTED_REORG',providerDeliveryStatus:'DELIVERED'},'Đang xác minh lại blockchain'],
  [{finality:'PROJECTION_STALE',providerDeliveryStatus:'DELIVERED'},'Đang xác minh lại blockchain'],
  [{providerDeliveryStatus:'PENDING'},'Đang bàn giao cho nhà cung cấp'],
  [{providerDeliveryStatus:'RETRY_WAIT'},'Đang bàn giao cho nhà cung cấp'],
  [{providerDeliveryStatus:'FAILED'},'Bàn giao bản quyền cần xử lý'],
  [{providerDeliveryStatus:'DELIVERED'},'Nhà cung cấp đã nhận bản quyền'],
  [{providerDeliveryStatus:'DELIVERED',activationKeyAvailable:false},'Mã bản quyền đã được nhận'],
  [{status:'SUSPENDED',providerDeliveryStatus:'DELIVERED'},'Bản quyền tạm ngưng'],
] as const)('describes the actual provider stage for %j', (override,title) => {
  const license={fulfillmentMode:'PROVIDER_HANDOFF',status:'ACTIVE',activationKeyTrustStatus:'TRUSTED',finality:'CHAIN_CONFIRMED',expiresAt:'2030-01-01T00:00:00Z',activationKeyAvailable:true,...override} as LicenseProjectionDto;
  render(<ProviderHandoffNotice license={license}/>);
  expect(screen.getByText(title,{exact:true})).toBeTruthy();
  if(['Đang xác nhận blockchain','Đang xác minh lại blockchain'].includes(title)) {
    expect(screen.queryByText('Nhà cung cấp đang tiếp nhận bản quyền.')).toBeNull();
    expect(screen.queryByText('Nhà cung cấp đã nhận bản quyền',{exact:true})).toBeNull();
  }
});

it.each([
  ['PENDING_ONCHAIN','PENDING_FINALITY',null,'Đang xác nhận blockchain'],
  ['ACTIVE','TRUSTED','PENDING','Đang bàn giao cho nhà cung cấp'],
] as const)('shows %s payment progress without claiming activation',async(status,trust,delivery,label)=>{
  const original=vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
    const response=await original(input,init);
    if(String(input).endsWith('/licenses') || /\/licenses\/[^/]+$/.test(String(input))) {
      const data=await response.json();
      const patch=(row:Record<string,unknown>)=>({...row,fulfillmentMode:'PROVIDER_HANDOFF',status,activationKeyTrustStatus:trust,providerDeliveryStatus:delivery,activationKeyAvailable:false});
      return Response.json(Array.isArray(data)?data.map(patch):patch(data));
    }
    return response;
  });
  try {
    render(<App initialEntries={['/buyer/orders/00000000-0000-4000-8000-000000000502/payment?sepay=success']}/>);
    expect(await screen.findByRole('dialog',{name:label})).toBeTruthy();
    expect(screen.queryByText('Kích hoạt bản quyền',{exact:true})).toBeNull();
    expect(screen.queryByText('Đang kích hoạt bản quyền',{exact:true})).toBeNull();
    expect(screen.getByRole('link',{name:'Bản quyền',exact:true})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Nhận mã bản quyền',exact:true})).toBeNull();
  } finally {vi.mocked(fetch).mockImplementation(original);}
});

it('waits for provider receipt after a recovery command is chain-confirmed',async()=>{
  const original=vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
    if(String(input).endsWith('/commands/recovery-handoff'))return Response.json({commandId:'recovery-handoff',status:'CONFIRMED'});
    const response=await original(input,init);
    if(String(input).endsWith('/licenses'))return Response.json((await response.json()).map((row:Record<string,unknown>)=>({...row,fulfillmentMode:'PROVIDER_HANDOFF',keyVersion:2,providerDeliveryStatus:'PENDING',activationKeyAvailable:false})));
    return response;
  });
  try {
    const id='00000000-0000-4000-8000-000000000401';
    render(<App initialEntries={[`/buyer/licenses?licenseId=${id}&recover=1&recoveryLicense=${id}&recoveryCommand=recovery-handoff`]}/>);
    const receive=await screen.findByRole('button',{name:'Nhận mã khôi phục'});
    expect((receive as HTMLButtonElement).disabled).toBe(true);
  } finally {vi.mocked(fetch).mockImplementation(original);}
});

it.each([false,true])('shows pending provider handoff without device or premature key controls (availability: %s)', async(activationKeyAvailable)=>{
  const original=vi.mocked(fetch).getMockImplementation()!;
  const deviceCalls:string[]=[];
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
    const url=String(input);
    if (url.includes('/devices')) deviceCalls.push(url);
    const response=await original(input,init);
    if (url.endsWith('/licenses')) {
      const licenses=await response.json();
      return Response.json(licenses.map((license:Record<string,unknown>)=>({...license,fulfillmentMode:'PROVIDER_HANDOFF',providerDeliveryStatus:'PENDING',activationKeyAvailable})));
    }
    return response;
  });
  try {
    render(<App initialEntries={['/buyer/licenses']}/>);
    fireEvent.click((await screen.findAllByRole('button',{name:'Chi tiết'}))[0]);
    expect((await screen.findAllByText('Đang bàn giao cho nhà cung cấp')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button',{name:'Thiết bị',exact:true})).toBeNull();
    expect(screen.queryByRole('button',{name:'Nhận mã bản quyền một lần',exact:true})).toBeNull();
    expect(deviceCalls).toEqual([]);
  } finally {vi.mocked(fetch).mockImplementation(original);}
});

it('keeps integration credentials out of reads and requires authorization before saving', async () => {
  const original=vi.mocked(fetch).getMockImplementation()!;
  let saved=false;
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
    if (String(input).endsWith('/provider/integration')) {
      if (init?.method==='PUT') {saved=true;return Response.json({endpointUrl:'https://provider.example/receive',configVersion:1,status:'DISABLED',hasCredential:true});}
      return Response.json(null);
    }
    if (String(input).includes('/provider/license-deliveries')) return Response.json([]);
    return original(input,init);
  });
  try {
    render(<App initialEntries={['/provider/operations']} />);
    fireEvent.click(await screen.findByRole('tab',{name:'Tích hợp'}));
    fireEvent.change(await screen.findByLabelText('URL nhận bản quyền'),{target:{value:'https://provider.example/receive'}});
    fireEvent.change(screen.getByLabelText('Token kết nối'),{target:{value:'provider-credential-for-testing-only'}});
    expect((screen.getByRole('button',{name:'Lưu cấu hình'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox',{name:/ủy quyền/}));
    fireEvent.click(screen.getByRole('button',{name:'Lưu cấu hình'}));
    await waitFor(()=>expect(saved).toBe(true));
    await waitFor(()=>expect((screen.getByLabelText('Token kết nối') as HTMLInputElement).value).toBe(''));
  } finally {vi.mocked(fetch).mockImplementation(original);}
});
