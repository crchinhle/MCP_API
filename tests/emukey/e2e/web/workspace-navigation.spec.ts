import { expect, test } from '@playwright/test';

test('keeps the AI conversation and source snapshot across reload and human escalation', async ({ page }) => {
  const id = '00000000-0000-4000-8000-000000000707';
  let created = 0;
  let asked = 0;
  let sourceAvailable = true;
  let status = 'AI_ACTIVE';
  const history: Record<string, unknown>[] = [];
  const citation = { chunkId: 'original-chunk', documentId: 'original-document', documentTitle: 'Hướng dẫn thiết bị', documentVersion: 1, excerpt: 'Đoạn trích của phiên bản gốc.' };
  const conversation = () => ({ id, status, customerUserId: 'ai-buyer', assignedSupportUserId: null, contextType: 'GENERAL', contextId: null, title: 'Hỏi trợ lý AI' });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/refresh')) return route.fulfill({ json: { accessToken: 'buyer-fixture', user: { id: 'ai-buyer', role: 'CUSTOMER', status: 'ACTIVE', displayName: 'AI buyer', email: 'buyer@example.test' } } });
    if (path.endsWith('/notifications')) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null } });
    if (path.endsWith('/conversations') && method === 'POST') { created += 1; return route.fulfill({ status: 201, json: conversation() }); }
    if (path.endsWith('/conversations')) return route.fulfill({ json: created ? [conversation()] : [] });
    if (path.endsWith('/ai-ask')) {
      asked += 1;
      if (status !== 'AI_ACTIVE') return route.fulfill({ status: 409, json: { error: { code: 'CONVERSATION_AI_NOT_ACTIVE' } } });
      const input = route.request().postDataJSON();
      history.push({ id: 'question', conversationId: id, clientMessageId: input.clientMessageId, serverSequence: 1, senderType: 'CUSTOMER', content: input.question },
        { id: 'answer', conversationId: id, clientMessageId: 'answer-id', serverSequence: 2, senderType: 'AI', content: 'Câu trả lời dựa trên tài liệu gốc.', citationDetails: [citation] });
      return route.fulfill({ json: { answer: 'Câu trả lời dựa trên tài liệu gốc.', citations: [citation.chunkId], citationDetails: [citation], confidence: 0.9 } });
    }
    if (path.endsWith('/messages')) return route.fulfill({ json: history });
    if (path.endsWith('/request-support')) { status = 'WAITING_SUPPORT'; return route.fulfill({ json: conversation() }); }
    if (path.endsWith('/knowledge/documents/original-document/chunks/original-chunk')) return route.fulfill(sourceAvailable
      ? { json: { id: citation.chunkId, content: 'Toàn văn nguồn của phiên bản gốc.' } }
      : { status: 404, json: { error: { code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND' } } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/buyer/support');
  await page.getByRole('button', { name: 'Mở chat chăm sóc khách hàng' }).click();
  await page.getByLabel('Câu hỏi cho trợ lý AI').fill('Quản lý thiết bị thế nào?');
  await page.getByRole('button', { name: 'Hỏi', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Câu trả lời dựa trên tài liệu gốc.' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Mở chat chăm sóc khách hàng' }).click();
  await page.getByRole('link', { name: 'Mở hội thoại hỗ trợ' }).click();
  await expect(page).toHaveURL(new RegExp(`conversationId=${id}`));
  await page.getByRole('heading', { name: 'Hội thoại hỗ trợ', exact: true }).click();
  const answer = page.locator('.message--ai');
  await expect(answer).toContainText('Câu trả lời dựa trên tài liệu gốc.');
  await answer.getByRole('button', { name: 'Hướng dẫn thiết bị · phiên bản 1' }).click();
  const source = page.getByRole('dialog');
  await expect(source).toContainText('Toàn văn nguồn của phiên bản gốc.');
  await source.getByRole('button', { name: 'Đóng', exact: true }).click();
  sourceAvailable = false;
  await answer.getByRole('button', { name: 'Hướng dẫn thiết bị · phiên bản 1' }).click();
  await expect(answer.getByText('Không thể mở nguồn. Tài liệu có thể đã được thay thế hoặc quyền đọc đã thay đổi.')).toBeVisible();
  await expect(answer).toContainText(citation.excerpt);
  await page.getByRole('button', { name: 'Chuyển cho nhân viên' }).click();
  await expect(page.getByText('Chờ nhân viên hỗ trợ', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hỏi AI có nguồn' })).toHaveCount(0);
  await page.reload();
  await expect(answer).toContainText(citation.excerpt);
  await page.getByRole('button', { name: 'Mở chat chăm sóc khách hàng' }).click();
  await page.getByLabel('Câu hỏi cho trợ lý AI').fill('Câu hỏi sau khi chuyển hỗ trợ');
  await page.getByRole('button', { name: 'Hỏi', exact: true }).click();
  await expect(page.getByText('Hội thoại này đã kết thúc hoặc chuyển sang nhân viên. Mở hội thoại hỗ trợ để tiếp tục.')).toBeVisible();
  expect(created).toBe(1);
  expect(asked).toBe(2);
});

test('staff preserves a failed reply and resumes with the current claim generation', async ({ page }) => {
  const id = '00000000-0000-4000-8000-000000000703';
  let status = 'SUPPORT_ACTIVE';
  let claimVersion = 1;
  const sent: Array<{ content: string; clientMessageId: string; claimVersion: number }> = [];
  const messages: Array<Record<string, unknown>> = [];
  const conversation = () => ({ id, status, claimVersion, assignedSupportUserId: status === 'SUPPORT_ACTIVE' ? 'support-test' : null,
    claimExpiresAt: '2030-01-01T00:00:00.000Z', customerUserId: 'customer', contextType: 'GENERAL', contextId: null, title: 'Support lease browser regression' });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/refresh')) return route.fulfill({ json: { accessToken: 'support-fixture', user: { id: 'support-test', email: 'support@example.test', displayName: 'Support', role: 'SUPPORT_STAFF', status: 'ACTIVE' } } });
    if (path.endsWith('/notifications')) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null } });
    if (path.endsWith('/conversations/queue')) return route.fulfill({ json: [conversation()] });
    if (path.endsWith('/heartbeat')) return route.fulfill({ json: conversation() });
    if (path.endsWith('/claim')) { status = 'SUPPORT_ACTIVE'; claimVersion += 1; return route.fulfill({ json: conversation() }); }
    if (path.endsWith('/messages') && method === 'POST') {
      sent.push(route.request().postDataJSON());
      if (sent.length === 1) { status = 'WAITING_SUPPORT'; return route.fulfill({ status: 409, json: { error: { code: 'CONVERSATION_CLAIM_EXPIRED', message: 'Claim expired' } } }); }
      const message = { id: 'browser-reply', conversationId: id, ...sent.at(-1), senderType: 'SUPPORT', serverSequence: 1, createdAt: '2026-11-02T00:00:00.000Z' };
      messages.push(message);
      return route.fulfill({ json: message });
    }
    if (path.endsWith('/messages') || path.endsWith('/messages/queue-preview')) return route.fulfill({ json: messages });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/support?conversationId=${id}`);
  await page.getByLabel('Phản hồi hỗ trợ').fill('Nội dung cần giữ khi phiên hết hạn');
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
  await expect(page.getByText('Nhận xử lý hội thoại để gửi phản hồi.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nhận xử lý', exact: true }).click();
  await expect(page.getByLabel('Phản hồi hỗ trợ')).toHaveValue('Nội dung cần giữ khi phiên hết hạn');
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
  await expect(page.getByLabel('Phản hồi hỗ trợ')).toHaveValue('');
  expect(sent.map((input) => input.claimVersion)).toEqual([1, 2]);
  expect(sent[0].clientMessageId).toBe(sent[1].clientMessageId);
});

test('two support tabs preserve a draft and fence actions until the current claim is verified', async ({ page, context }) => {
  const sibling = await context.newPage();
  const id = '00000000-0000-4000-8000-000000000705';
  const draft = 'Bản nháp ở tab thứ hai';
  let status = 'SUPPORT_ACTIVE';
  let claimVersion = 1;
  let heldHeartbeats = 0;
  let releaseHeartbeat!: () => void;
  const verification = new Promise<void>((resolve) => { releaseHeartbeat = resolve; });
  const sent: Array<{ content: string; clientMessageId: string; claimVersion: number }> = [];
  const messages: Array<Record<string, unknown>> = [];
  const conversation = () => ({ id, status, claimVersion, assignedSupportUserId: status === 'SUPPORT_ACTIVE' ? 'support-test' : null,
    claimExpiresAt: '2030-01-01T00:00:00.000Z', customerUserId: 'customer', contextType: 'GENERAL', contextId: null, title: 'Two support tabs' });
  await context.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/refresh')) return route.fulfill({ json: { accessToken: 'support-fixture', user: { id: 'support-test', email: 'support@example.test', displayName: 'Support', role: 'SUPPORT_STAFF', status: 'ACTIVE' } } });
    if (path.endsWith('/notifications')) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null } });
    if (path.endsWith('/conversations/queue')) return route.fulfill({ json: [conversation()] });
    if (path.endsWith('/heartbeat')) {
      if (route.request().postDataJSON().claimVersion !== claimVersion) return route.fulfill({ status: 409, json: { error: { code: 'CONVERSATION_CLAIM_EXPIRED' } } });
      if (route.request().frame().page() === sibling && claimVersion === 2) { heldHeartbeats += 1; await verification; }
      return route.fulfill({ json: conversation() });
    }
    if (path.endsWith('/release')) { status = 'WAITING_SUPPORT'; return route.fulfill({ json: conversation() }); }
    if (path.endsWith('/claim')) { status = 'SUPPORT_ACTIVE'; claimVersion += 1; return route.fulfill({ json: conversation() }); }
    if (path.endsWith('/messages') && method === 'POST') {
      const input = route.request().postDataJSON();
      sent.push(input);
      if (input.claimVersion !== claimVersion) return route.fulfill({ status: 409, json: { error: { code: 'CONVERSATION_CLAIM_EXPIRED' } } });
      const message = { id: 'two-tab-reply', conversationId: id, ...input, senderType: 'SUPPORT', serverSequence: 1, createdAt: '2026-11-02T00:00:00.000Z' };
      messages.push(message);
      return route.fulfill({ json: message });
    }
    if (path.endsWith('/messages') || path.endsWith('/messages/queue-preview')) return route.fulfill({ json: messages });
    return route.fulfill({ json: [] });
  });
  try {
    await page.goto(`/support?conversationId=${id}`);
    await expect(page.getByLabel('Phản hồi hỗ trợ')).toBeVisible();
    await sibling.goto(`/support?conversationId=${id}`);
    await sibling.getByLabel('Phản hồi hỗ trợ').fill(draft);
    await page.getByRole('button', { name: 'Trả về hàng đợi', exact: true }).click();
    await page.getByRole('button', { name: 'Nhận xử lý', exact: true }).click();
    await expect(page.getByLabel('Phản hồi hỗ trợ')).toBeVisible();
    await sibling.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await expect.poll(() => heldHeartbeats).toBeGreaterThan(0);
    await expect(sibling.getByLabel('Phản hồi hỗ trợ')).toHaveCount(0);
    await expect(sibling.getByRole('button', { name: 'Trả về hàng đợi', exact: true })).toBeDisabled();
    await expect(sibling.getByRole('button', { name: 'Hoàn tất', exact: true })).toBeDisabled();
    expect(sent).toHaveLength(0);
    releaseHeartbeat();
    await expect(sibling.getByLabel('Phản hồi hỗ trợ')).toHaveValue(draft);
    await sibling.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
    await expect(sibling.getByLabel('Phản hồi hỗ trợ')).toHaveValue('');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ content: draft, claimVersion: 2 });
    await expect(page.getByText(draft, { exact: true })).toBeVisible();
    expect(messages).toHaveLength(1);
  } finally { releaseHeartbeat(); await sibling.close(); }
});

test('license command Retry stays reachable after lifecycle confirmation closes', async ({ page }) => {
  let failCommand = true;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/refresh')) return route.fulfill({ json: { accessToken: 'ux-fixture', user: { id: 'ux-user', email: 'ux@example.test', displayName: 'UX User', role: 'PROVIDER_ADMIN', status: 'ACTIVE' } } });
    if (path.endsWith('/licenses')) return route.fulfill({ json: [{ id: 'license-1', publicLicenseId: 'LICENSE-PUBLIC-ID', productName: 'UX Product', plan: { name: 'Plan', version: 1 }, status: 'ACTIVE', maxActiveDevices: 1, activeDeviceCount: 0, expiresAt: '2030-01-01T00:00:00Z', finality: 'CONFIRMED', confirmationCount: 2 }] });
    if (path.endsWith('/lifecycle')) {
      // A slow response exercises the confirmation's pending state before close.
      await new Promise((resolve) => setTimeout(resolve, 300));
      return route.fulfill({ json: { commandId: 'ux-command', licenseId: 'license-1', status: 'PENDING' } });
    }
    if (path.endsWith('/commands/ux-command')) return route.fulfill(failCommand ? { status: 500, json: { message: 'Unavailable' } } : { json: { commandId: 'ux-command', licenseId: 'license-1', status: 'CONFIRMED' } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/provider/licenses');
  await page.getByRole('button', { name: /Thao tác bản quyền/ }).click();
  await page.getByRole('menuitem', { name: 'Tạm ngưng bản quyền', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Tạm ngưng bản quyền?', exact: true });
  await confirmation.getByLabel('Lý do tạm ngưng').fill('UX regression reason');
  await confirmation.getByRole('button', { name: 'Xác nhận tạm ngưng', exact: true }).click();
  await expect(page.getByText('Không thể tải trạng thái yêu cầu')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  failCommand = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Yêu cầu đã được xác nhận. Đang cập nhật trạng thái bản quyền.')).toBeVisible();
});

test('draft deletion keeps errors visible and refreshes the filtered catalog after retry', async ({ page }) => {
  let attempts = 0;
  let deleted = false;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/refresh')) return route.fulfill({ json: { accessToken: 'provider-test', user: { id: 'provider', email: 'provider@example.test', displayName: 'Provider', role: 'PROVIDER_ADMIN', status: 'ACTIVE' } } });
    if (path.endsWith('/products/admin')) return route.fulfill({ json: deleted ? [] : [{ id: 'draft', name: 'Sản phẩm thử nghiệm', code: 'draft', status: 'DRAFT' }] });
    if (path.endsWith('/products/draft') && route.request().method() === 'DELETE') {
      attempts += 1;
      if (attempts === 1) return route.fulfill({ status: 409, json: { message: 'Không thể xóa sản phẩm đang được sử dụng.' } });
      deleted = true;
      return route.fulfill({ json: { deleted: true } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/provider/catalog?status=DRAFT');
  await page.getByRole('button', { name: /Thao tác/ }).click();
  await page.getByRole('menuitem', { name: 'Xóa bản nháp', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xóa sản phẩm nháp?', exact: true });
  await expect(dialog).toBeVisible();
  expect(attempts).toBe(0);
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Sản phẩm thử nghiệm', exact: true })).toHaveCount(0);
  expect(attempts).toBe(2);
});

test('provider mobile navigation traps focus and restores it on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: route.request().url().endsWith('/auth/refresh') ? { accessToken: 'provider-test', user: { id: 'provider', email: 'provider@example.test', displayName: 'Provider', role: 'PROVIDER_ADMIN', status: 'ACTIVE' } } : [] }));
  await page.goto('/provider');
  const trigger = page.getByRole('button', { name: 'Mở menu vai trò', exact: true });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Menu điều hướng' });
  await expect(menu.getByRole('button', { name: 'Đóng menu', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(menu.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('button', { name: 'Đóng menu', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

// Navigation/empty-state checks with an isolated API; these are not live integration evidence.
for (const width of [390, 1280]) {
  test(`public and auth pages keep titles without introductions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/**', (route) => route.fulfill(route.request().url().endsWith('/auth/refresh')
      ? { status: 401, json: { message: 'Unauthorized' } }
      : { json: [] }));
    for (const path of ['/', '/catalog', '/compare', '/verify', '/help', '/auth', '/auth?mode=register', '/auth?mode=forgot', '/auth?mode=verify']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('h1 + p, .auth-card > p')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}

const workspaces = [
  { role: 'PROVIDER_ADMIN', routes: [
    ['/provider', 'Tổng quan nhà cung cấp'],
    ['/provider/catalog', 'Sản phẩm và gói bán'],
    ['/provider/licenses', 'Bản quyền'],
    ['/provider/knowledge', 'Tài liệu sản phẩm'],
    ['/provider/operations', 'Thanh toán & đối soát'],
    ['/provider/profile', 'Hồ sơ tài khoản'],
  ] },
  { role: 'SUPPORT_STAFF', routes: [
    ['/support', 'Hàng đợi hỗ trợ'],
    ['/support?view=resolved', 'Hàng đợi hỗ trợ'],
    ['/support/profile', 'Hồ sơ tài khoản'],
  ] },
  { role: 'SYSTEM_ADMIN', routes: [
    ['/system/console', 'Tổng quan hệ thống'],
    ['/system/console?view=users', 'Quản lý người dùng'],
    ['/system/console?view=payments', 'Thanh toán & đối soát'],
    ['/system/console?view=blockchain', 'Đối soát blockchain'],
    ['/system/console/knowledge', 'Duyệt tài liệu'],
    ['/system/console/profile', 'Hồ sơ tài khoản'],
  ] },
] as const;

for (const workspace of workspaces) {
  for (const width of workspace.role === 'PROVIDER_ADMIN' ? [320, 768, 1024, 1440] : [390, 1280]) {
    test(`${workspace.role} routes and notifications at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/notifications')) {
          const next = new URL(route.request().url()).searchParams.has('cursor');
          return route.fulfill({ json: { items: Array.from({ length: next ? 1 : 8 }, (_, i) => ({ id: `notice-${next ? 8 : i}`, title: `Notice ${next ? 8 : i}`, content: `Content ${i}`, isRead: true })), nextCursor: next ? null : 'page-2' } });
        }
        if (path.endsWith('/health/ready')) return route.fulfill({ json: { status: 'ok', dependencies: { postgres: 'up', redis: 'up' } } });
        if (path.endsWith('/operations/health/assistance')) return route.fulfill({ json: { conversations: { supportActive: 0, waitingSupport: 0 }, notifications: { deadLetter: 0, pending: 0, retryableFailed: 0 } } });
        await route.fulfill({ json: path.endsWith('/auth/refresh') ? {
          accessToken: 'workspace-test',
          user: { id: 'workspace-user', email: 'workspace@example.test', displayName: 'Workspace test', role: workspace.role, status: 'ACTIVE' },
        } : [] });
      });
      for (const [path, heading] of workspace.routes) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
        await expect(page.locator('.role-label')).toHaveCount(0);
        await expect(page.locator('.workspace-page-header p, .catalog-help')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      if (width <= 760) await page.getByRole('button', { name: 'Mở menu vai trò' }).click();
      if (workspace.role === 'PROVIDER_ADMIN' || workspace.role === 'SYSTEM_ADMIN') {
        await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toHaveCount(0);
      } else {
        await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
        await page.getByRole('button', { name: 'Xem thêm thông báo' }).click();
        await expect(page.getByText('Notice 8', { exact: true })).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [390, 1280]) {
  test(`removed audit URL opens the system overview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const auditRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/operations/audit-logs')) auditRequests.push(request.url());
    });
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/refresh')) return route.fulfill({ json: { accessToken: 'audit-removal-test',
        user: { id: 'system-test', email: 'system@example.test', displayName: 'System', role: 'SYSTEM_ADMIN', status: 'ACTIVE' } } });
      if (path.endsWith('/health/ready')) return route.fulfill({ json: { status: 'ready', dependencies: { postgres: 'up', redis: 'up' } } });
      if (path.endsWith('/operations/health/assistance')) return route.fulfill({ json: { conversations: { supportActive: 0, waitingSupport: 0 }, notifications: { deadLetter: 0, pending: 0, retryableFailed: 0 } } });
      return route.fulfill({ json: [] });
    });
    await page.goto('/system/console?view=audit');
    await expect(page).toHaveURL('/system/console');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('a[href*="view=audit"]')).toHaveCount(0);
    expect(auditRequests).toEqual([]);
  });
}
