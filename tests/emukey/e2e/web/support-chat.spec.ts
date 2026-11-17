import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Real API, identity, PostgreSQL/Redis and browser contexts. Only external
// providers use test adapters. Run through run-support-chat.mjs.
test.skip(process.env.EMUKEY_SUPPORT_E2E !== '1', 'Requires the disposable support runner');
test.use({ video: 'off', trace: 'retain-on-failure' });

test('direct support, claim race, replies, recovery, navigation and AI handoff', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const evidence = process.env.SUPPORT_EVIDENCE_DIR!;
  const measurements: Record<string, number | string | number[]> = {};
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [customer, staffA, staffB] = await Promise.all(contexts.map(context => context.newPage()));
  const login = async (page: Page, name: string) => {
    await page.goto(`${baseURL}/auth`);
    await page.getByLabel('Email', { exact: true }).fill(`${name}@support.example.test`);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.SUPPORT_FIXTURE_PASSWORD!);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).not.toHaveURL(/\/auth/);
  };
  const capture = async (page: Page, name: string) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(evidence, `${name}.png`), fullPage: true });
  };
  try {
    await Promise.all([login(customer!, 'customer'), login(staffA!, 'staff-a'), login(staffB!, 'staff-b')]);
    await Promise.all([customer!.goto(`${baseURL}/buyer/support`), staffA!.goto(`${baseURL}/support`), staffB!.goto(`${baseURL}/support`)]);
    await expect(staffA!.getByText('Hàng đợi trống', { exact: true })).toBeVisible();
    await customer!.getByRole('button', { name: 'Tạo yêu cầu mới', exact: true }).click();
    await customer!.getByLabel('Chủ đề hỗ trợ').fill('Kiểm tra kết nối ứng dụng');
    await customer!.getByLabel('Mô tả vấn đề').fill('Tôi cần nhân viên hỗ trợ kết nối trên máy mới.');
    await capture(customer!, 'customer-create');
    const createdResponse = customer!.waitForResponse(response => response.url().endsWith('/conversations') && response.request().method() === 'POST');
    const started = performance.now();
    await customer!.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' }).click();
    const response = await createdResponse;
    expect(response.status()).toBe(201);
    measurements.createAcknowledgedMs = performance.now() - started;
    const conversation = await response.json();
    const id = conversation.id as string;
    await expect(customer!.getByRole('heading', { name: 'Kiểm tra kết nối ứng dụng', exact: true })).toBeVisible();
    await capture(customer!, 'customer-waiting');
    await expect(staffA!.getByRole('heading', { name: 'Kiểm tra kết nối ứng dụng', exact: true })).toBeVisible({ timeout: 20_000 });
    measurements.queueVisibleMs = performance.now() - started;
    await expect(staffB!.getByRole('button', { name: 'Nhận xử lý', exact: true })).toBeVisible();
    await capture(staffA!, 'support-queue');
    await expect(staffA!.locator('.ant-badge-count')).toHaveText('1', { timeout: 12_000 });
    measurements.notificationBadgeVisibleMs = performance.now() - started;
    const notification = await staffA!.context().request.post(`${baseURL}/api/v1/auth/refresh`);
    expect(notification.ok()).toBe(true);
    const staffToken = (await notification.json()).accessToken;
    const inbox = await staffA!.context().request.get(`${baseURL}/api/v1/notifications`, { headers: { Authorization: `Bearer ${staffToken}` } });
    expect(JSON.stringify(await inbox.json())).toContain('Hội thoại cần hỗ trợ');
    measurements.notificationObservedMs = performance.now() - started;

    const claimResponses = [staffA!.waitForResponse(r => r.url().endsWith(`/${id}/claim`)), staffB!.waitForResponse(r => r.url().endsWith(`/${id}/claim`))];
    await Promise.all([staffA!.getByRole('button', { name: 'Nhận xử lý', exact: true }).click(), staffB!.getByRole('button', { name: 'Nhận xử lý', exact: true }).click()]);
    const claims = await Promise.all(claimResponses);
    expect(claims.map(r => r.status()).sort()).toEqual([200, 409]);
    const staff = claims[0]!.ok() ? staffA! : staffB!;
    const loser = staff === staffA ? staffB! : staffA!;
    await expect(loser.getByText(/Không thể nhận hội thoại/)).toBeVisible();
    await expect(staff.getByLabel('Phản hồi hỗ trợ')).toBeVisible();
    await capture(staff, 'staff-claimed');
    await staff.getByLabel('Phản hồi hỗ trợ').fill('Chào bạn, tôi đã nhận được yêu cầu.');
    const replyResponse = staff.waitForResponse(r => r.url().endsWith(`/${id}/messages`) && r.request().method() === 'POST');
    const replyStarted = performance.now();
    await staff.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
    expect((await replyResponse).status()).toBe(201);
    measurements.replyAcknowledgedMs = performance.now() - replyStarted;
    await expect(customer!.getByText('Chào bạn, tôi đã nhận được yêu cầu.', { exact: true })).toBeVisible({ timeout: 12_000 });
    measurements.replyVisibleMs = performance.now() - replyStarted;
    await customer!.getByLabel('Tin nhắn hỗ trợ').fill('Tôi đã thử đăng nhập lại.');
    const customerStarted = performance.now();
    await customer!.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect(staff.getByText('Tôi đã thử đăng nhập lại.', { exact: true })).toBeVisible({ timeout: 12_000 });
    measurements.customerMessageVisibleMs = performance.now() - customerStarted;
    await staff.getByLabel('Phản hồi hỗ trợ').fill('Cảm ơn bạn đã xác nhận.');
    await staff.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
    await expect(customer!.getByText('Cảm ơn bạn đã xác nhận.', { exact: true })).toBeVisible({ timeout: 12_000 });
    await capture(customer!, 'two-way-chat');
    await Promise.all([customer!.reload(), staff.reload()]);
    await expect(customer!.getByText('Cảm ơn bạn đã xác nhận.', { exact: true })).toBeVisible();
    await expect(staff.getByText('Tôi đã thử đăng nhập lại.', { exact: true })).toBeVisible();

    await contexts[0]!.setOffline(true);
    await customer!.getByLabel('Tin nhắn hỗ trợ').fill('Bản nháp khi ngoại tuyến');
    await expect(customer!.getByRole('button', { name: 'Gửi tin nhắn', exact: true })).toBeDisabled();
    await new Promise(resolve => setTimeout(resolve, 5000));
    const reconnect = performance.now();
    await contexts[0]!.setOffline(false);
    await expect(customer!.getByRole('button', { name: 'Gửi tin nhắn', exact: true })).toBeEnabled();
    await customer!.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect(staff.getByText('Bản nháp khi ngoại tuyến', { exact: true })).toBeVisible({ timeout: 12_000 });
    measurements.reconnectMessageVisibleMs = performance.now() - reconnect;

    // Deliver to the real backend, then lose only the response. A refresh and
    // retry must recover the saved intent and not append a second message.
    let lost = false;
    await customer!.route(`**/conversations/${id}/messages`, async route => {
      if (route.request().method() === 'POST' && !lost) {
        lost = true;
        expect((await route.fetch()).status()).toBe(201);
        await route.abort('failed');
      } else await route.continue();
    });
    await customer!.getByLabel('Tin nhắn hỗ trợ').fill('Tin nhắn bị mất phản hồi');
    await customer!.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect(customer!.getByText(/Chưa gửi được yêu cầu/)).toBeVisible();
    await customer!.reload();
    await expect(customer!.getByLabel('Tin nhắn hỗ trợ')).toHaveValue('Tin nhắn bị mất phản hồi');
    await customer!.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect(customer!.getByLabel('Tin nhắn hỗ trợ')).toHaveValue('');
    await expect(customer!.getByText('Tin nhắn bị mất phản hồi', { exact: true })).toHaveCount(1);
    await customer!.unroute(`**/conversations/${id}/messages`);
    let failLoad = true;
    await customer!.route(`**/conversations/${id}/messages`, async route => {
      if (failLoad && route.request().method() === 'GET') { failLoad = false; await route.fulfill({ status: 500, json: { error: { code: 'INJECTED_TEST_FAILURE' } } }); }
      else await route.continue();
    });
    await customer!.reload();
    await expect(customer!.getByText('Không thể tải tin nhắn', { exact: true })).toBeVisible();
    await customer!.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await expect(customer!.getByText('Tin nhắn bị mất phản hồi', { exact: true })).toBeVisible();
    await customer!.unroute(`**/conversations/${id}/messages`);

    for (const width of [1440, 1024, 768, 375]) {
      await customer!.setViewportSize({ width, height: 900 });
      await staff.setViewportSize({ width, height: 900 });
      for (const [page, role] of [[customer!, 'customer'], [staff, 'staff']] as const) {
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await capture(page, `${role}-${width}`);
      }
    }
    await staff.setViewportSize({ width: 1440, height: 1000 });
    const log = customer!.getByRole('log', { name: 'Lịch sử tin nhắn' });
    await log.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
    await staff.getByLabel('Phản hồi hỗ trợ').fill('Thông báo mới khi bạn đang đọc lịch sử.');
    await staff.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
    await expect(customer!.getByRole('button', { name: 'Có tin nhắn mới — Xem cuối hội thoại' })).toBeVisible({ timeout: 12_000 });
    expect(await log.evaluate(element => element.scrollTop)).toBeLessThan(16);
    await customer!.getByRole('button', { name: 'Có tin nhắn mới — Xem cuối hội thoại' }).click();
    expect(await log.evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(4);
    await staff.getByRole('button', { name: 'Hoàn tất', exact: true }).click();
    await expect(staff).toHaveURL(new RegExp(`view=resolved&conversationId=${id}`));
    await expect(customer!.getByText('Hội thoại đã hoàn tất. Không thể gửi thêm tin nhắn ở trạng thái này.')).toBeVisible({ timeout: 12_000 });
    await expect(customer!.getByLabel('Tin nhắn hỗ trợ')).toHaveCount(0);
    await staff.goto(`${baseURL}/support?view=resolved&conversationId=${id}`);
    await expect(staff.getByText('Cảm ơn bạn đã xác nhận.', { exact: true })).toBeVisible();
    await expect(staff.getByLabel('Phản hồi hỗ trợ')).toHaveCount(0);
    await capture(customer!, 'customer-closed');
    await capture(staff, 'staff-closed');

    await customer!.setViewportSize({ width: 1440, height: 1000 });
    await customer!.getByRole('button', { name: 'Mở trợ lý AI' }).click();
    const aiPanel = customer!.locator('#emukey-ai-assistant-panel');
    await aiPanel.getByRole('textbox').fill('Tôi cần gặp nhân viên hỗ trợ đơn hàng');
    await aiPanel.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await aiPanel.getByRole('button', { name: 'Liên hệ nhân viên hỗ trợ' }).click();
    await expect(aiPanel.getByText('Đã chuyển sang nhân viên hỗ trợ.', { exact: true })).toBeVisible();
    await aiPanel.getByRole('link', { name: 'Mở hội thoại hỗ trợ' }).click();
    const aiId = new URL(customer!.url()).searchParams.get('conversationId')!;
    expect(aiId).not.toBe(id);
    await customer!.getByRole('button', { name: 'Mở trợ lý AI' }).click();
    await staff.goto(`${baseURL}/support?conversationId=${aiId}`);
    await expect(staff.getByText('Tôi cần gặp nhân viên hỗ trợ đơn hàng', { exact: true })).toBeVisible();
    await staff.getByRole('button', { name: 'Nhận xử lý', exact: true }).click();
    await staff.getByLabel('Phản hồi hỗ trợ').fill('Tôi đã đọc ngữ cảnh tư vấn của bạn.');
    await staff.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
    await expect(customer!.getByText('Tôi đã đọc ngữ cảnh tư vấn của bạn.', { exact: true })).toBeVisible({ timeout: 12_000 });
    await capture(staff, 'ai-handoff-history');
    await staff.goto(`${baseURL}/support?view=resolved&conversationId=${id}`);
    await staff.goBack();
    await expect(staff.getByText('Tôi đã đọc ngữ cảnh tư vấn của bạn.', { exact: true })).toBeVisible();
    await staff.goForward();
    await expect(staff.getByText('Cảm ơn bạn đã xác nhận.', { exact: true })).toBeVisible();
    measurements.result = 'PASS: real identity/API/database + three browser contexts; external AI adapter is fake';
  } finally {
    await writeFile(join(evidence, 'measurements.json'), JSON.stringify(measurements, null, 2));
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('recovers a direct creation response lost across refresh without creating another request', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/auth`);
  await page.getByLabel('Email', { exact: true }).fill('customer@support.example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.SUPPORT_FIXTURE_PASSWORD!);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth/);
  await page.goto(`${baseURL}/buyer/support`);
  let createdId = '';
  let key = '';
  await page.route('**/api/v1/conversations', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataJSON();
    if (!createdId) {
      key = body.clientRequestId;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      createdId = (await response.json()).id;
      await route.abort('failed');
    } else {
      expect(body.clientRequestId).toBe(key);
      const response = await route.fetch();
      expect((await response.json()).id).toBe(createdId);
      await route.fulfill({ response });
    }
  });
  await page.getByRole('button', { name: 'Tạo yêu cầu mới', exact: true }).click();
  await page.getByLabel('Chủ đề hỗ trợ').fill('Khôi phục yêu cầu sau refresh');
  await page.getByLabel('Mô tả vấn đề').fill('Nội dung yêu cầu được giữ nguyên.');
  await page.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ', exact: true }).click();
  await expect(page.getByText('Không thể tạo hội thoại. Vui lòng thử lại.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Mô tả vấn đề')).toHaveValue('Nội dung yêu cầu được giữ nguyên.');
  await page.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`conversationId=${createdId}`));
  await expect(page.getByRole('log', { name: 'Lịch sử tin nhắn' }).getByText('Nội dung yêu cầu được giữ nguyên.', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Khôi phục yêu cầu sau refresh', exact: true })).toHaveCount(1);
});
