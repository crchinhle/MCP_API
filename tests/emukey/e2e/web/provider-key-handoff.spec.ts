import { expect, test } from '@playwright/test';

// UI contract tests only. Payment/chain/receiver transactions are tested against
// disposable PostgreSQL databases in provider-delivery.integration.test.ts.
const key=`0x${'72'.repeat(32)}`;

test('provider config survives refresh without revealing its credential',async({page},testInfo)=>{
  let config={endpointUrl:'',configVersion:0,status:'DISABLED',verifiedAt:null as string|null,authorizedAt:null as string|null,hasCredential:false};
  let sentCredential='';
  await page.route('**/api/v1/**',async(route)=>{
    const path=new URL(route.request().url()).pathname.replace('/api/v1','');
    let body:unknown=[];
    if(path==='/auth/refresh')body={accessToken:'ui-provider',user:{id:'provider',role:'PROVIDER_ADMIN',status:'ACTIVE',displayName:'Provider',email:'provider@test.local',organizationName:'Test Provider'}};
    if(path==='/provider/integration'){
      if(route.request().method()==='PUT'){
        const input=route.request().postDataJSON();sentCredential=input.token;
        expect(input.authorized).toBe(true);
        config={endpointUrl:input.endpointUrl,configVersion:1,status:'DISABLED',verifiedAt:null,authorizedAt:'2026-11-04T00:00:00Z',hasCredential:true};
      }
      body=config;
    }
    if(path==='/provider/integration/test'){config={...config,verifiedAt:'2026-11-04T00:00:00Z'};body=config;}
    if(path==='/provider/integration/state'){config={...config,status:'ENABLED'};body=config;}
    await route.fulfill({json:body});
  });
  await page.goto('/provider/operations?tab=integration');
  await expect(page.getByRole('tab',{name:'Tích hợp'})).toHaveAttribute('aria-selected','true');
  await page.getByLabel('URL nhận bản quyền',{exact:true}).fill('https://provider.example/receive');
  await page.getByLabel('Token kết nối',{exact:true}).fill('server-credential-for-ui-test-only');
  await expect(page.getByRole('button',{name:'Lưu cấu hình'})).toBeDisabled();
  await page.getByRole('checkbox',{name:/ủy quyền/}).check();
  await page.getByRole('button',{name:'Lưu cấu hình'}).click();
  await expect(page.getByLabel('Token kết nối',{exact:true})).toHaveValue('');
  expect(sentCredential).toBe('server-credential-for-ui-test-only');
  await page.getByRole('button',{name:'Kiểm tra kết nối'}).click();
  await expect(page.getByRole('button',{name:'Bật tiếp nhận'})).toBeEnabled();
  await page.getByRole('button',{name:'Bật tiếp nhận'}).click();
  await expect(page.getByText('Đang bật',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Đang bật',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Token kết nối',{exact:true})).toHaveValue('');
  await page.screenshot({path:testInfo.outputPath('provider-integration.png'),fullPage:true});
});

for(const width of [390,1440])test(`buyer receives a provider-accepted key without device controls at ${width}px`,async({page},testInfo)=>{
  let accepted=false;let acknowledged=false;
  await page.setViewportSize({width,height:900});
  const license=()=>({id:'license-one',originOrderId:'order-one',productName:'Provider App',plan:{name:'Professional',version:1},status:'ACTIVE',keyVersion:1,
    activationKeyTrustStatus:'TRUSTED',finality:'CHAIN_CONFIRMED',maxActiveDevices:3,activeDeviceCount:0,publicLicenseId:'EMU-PROVIDER-TEST',
    expiresAt:'2030-01-01T00:00:00Z',fulfillmentMode:'PROVIDER_HANDOFF',providerDeliveryStatus:accepted?'DELIVERED':'PENDING',activationKeyAvailable:accepted&&!acknowledged});
  const deviceRequests:string[]=[];
  await page.route('**/api/v1/**',async(route)=>{
    const path=new URL(route.request().url()).pathname.replace('/api/v1','');let body:unknown=[];
    if(path==='/auth/refresh')body={accessToken:'ui-buyer',user:{id:'buyer',role:'CUSTOMER',status:'ACTIVE',displayName:'Buyer',email:'buyer@test.local'}};
    if(path==='/licenses')body=[license()];
    if(path==='/licenses/license-one')body=license();
    if(path==='/notifications')body={items:[],nextCursor:null,unreadCount:0};
    if(path.endsWith('/devices'))deviceRequests.push(path);
    if(path.endsWith('/activation-key/retrieve')){expect(accepted).toBe(true);body={activationKey:key,keyVersion:1,deliveryId:route.request().postDataJSON().deliveryId,retryUntil:'2030-01-01T00:00:00Z'};}
    if(path.endsWith('/activation-key/ack')){acknowledged=true;body={acknowledged:true};}
    await route.fulfill({json:body});
  });
  await page.goto('/buyer/licenses');
  await page.getByRole('button',{name:'Chi tiết',exact:true}).click();
  await expect(page.getByRole('alert').getByText('Đang bàn giao cho nhà cung cấp',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Mã bản quyền',exact:true}).click();
  await expect(page.getByRole('button',{name:'Nhận mã bản quyền một lần'})).toHaveCount(0);
  expect(deviceRequests).toEqual([]);
  accepted=true;await page.reload();
  await page.getByRole('button',{name:'Chi tiết',exact:true}).click();
  await expect(page.getByRole('alert').getByText('Nhà cung cấp đã nhận bản quyền',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Thiết bị',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Mã bản quyền',exact:true}).click();
  await page.getByRole('button',{name:'Nhận mã bản quyền một lần'}).click();
  await expect(page.getByLabel('Mã bản quyền đã cấp')).toHaveValue(key);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:testInfo.outputPath(`buyer-key-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Tôi đã lưu mã'}).click();
  await expect.poll(()=>acknowledged).toBe(true);
});

for(const width of [320,768,1024,1440])test(`payment shows blockchain, handoff and saved key in order at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});
  let confirmed=false;let accepted=false;let acknowledged=false;
  const license=()=>({id:'license-progress',originOrderId:'order-progress',productName:'Provider App',plan:{name:'Professional',version:1},status:confirmed?'ACTIVE':'PENDING_ONCHAIN',keyVersion:1,
    activationKeyTrustStatus:confirmed?'TRUSTED':'PENDING_FINALITY',finality:confirmed?'CHAIN_CONFIRMED':'PENDING_FINALITY',maxActiveDevices:3,activeDeviceCount:0,
    publicLicenseId:'EMU-PROGRESS-TEST',expiresAt:'2030-01-01T00:00:00Z',fulfillmentMode:'PROVIDER_HANDOFF',providerDeliveryStatus:accepted?'DELIVERED':confirmed?'PENDING':null,activationKeyAvailable:accepted&&!acknowledged});
  const order={id:'order-progress',orderNumber:'EMU-PROGRESS-ORDER',orderType:'NEW_PURCHASE',orderStatus:'PAYMENT_ACCEPTED',licenseId:'license-progress',priceVndSnapshot:149000,
    productNameSnapshot:'Provider App',planNameSnapshot:'Professional',serviceTermsAcceptedAt:'2026-11-05T00:00:00Z',createdAt:'2026-11-05T00:00:00Z'};
  await page.route('**/api/v1/**',async(route)=>{
    const path=new URL(route.request().url()).pathname.replace('/api/v1','');let body:unknown=[];
    if(path==='/auth/refresh')body={accessToken:'ui-buyer',user:{id:'buyer',role:'CUSTOMER',status:'ACTIVE',displayName:'Buyer',email:'buyer@test.local'}};
    if(path==='/orders/order-progress')body=order;
    if(path==='/orders')body=[order];
    if(path==='/licenses')body=[license()];
    if(path==='/licenses/license-progress')body=license();
    if(path==='/notifications')body={items:[],nextCursor:null,unreadCount:0};
    if(path.endsWith('/activation-key/retrieve')){expect(accepted).toBe(true);body={activationKey:key,keyVersion:1,deliveryId:route.request().postDataJSON().deliveryId,retryUntil:'2030-01-01T00:00:00Z'};}
    if(path.endsWith('/activation-key/ack')){acknowledged=true;body={acknowledged:true};}
    await route.fulfill({json:body});
  });
  await page.goto('/buyer/orders/order-progress/payment?sepay=success');
  await expect(page.getByRole('dialog',{name:'Đang xác nhận blockchain',exact:true})).toBeVisible();
  await expect(page.getByText('Nhà cung cấp đang tiếp nhận bản quyền.',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Kích hoạt bản quyền',{exact:true})).toHaveCount(0);
  confirmed=true;await page.reload();
  await expect(page.getByRole('dialog',{name:'Đang bàn giao cho nhà cung cấp',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Nhận mã bản quyền',exact:true})).toHaveCount(0);
  accepted=true;await page.reload();
  await expect(page.getByRole('alert').getByText('Nhà cung cấp đã nhận bản quyền',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Nhận mã bản quyền',exact:true}).click();
  await expect(page.getByLabel('Mã bản quyền',{exact:true})).toHaveValue(key);
  await page.getByRole('button',{name:'Tôi đã lưu mã',exact:true}).click();
  await expect.poll(()=>acknowledged).toBe(true);
  await expect(page.getByRole('button',{name:'Nhận mã bản quyền',exact:true})).toHaveCount(0);
  await expect(page.getByText('Đã nhận mã',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:testInfo.outputPath(`payment-progress-${width}.png`),fullPage:true});
  await page.getByRole('link',{name:'Xem đơn hàng đã mua',exact:true}).click();
  await expect(page).toHaveURL(/\/buyer\/orders$/);
  await expect(page.getByText('Mã bản quyền đã được nhận',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Mã bản quyền đã được nhận',{exact:true})).toBeVisible();
});
