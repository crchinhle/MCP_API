import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(() => {
  cleanup();
});

const handoffLicenses = [
  {
    id: 'lic-handoff-1',
    publicLicenseId: 'PUB-HO-1',
    productName: 'CloudSuite',
    plan: { name: 'Team' },
    status: 'PENDING_ONCHAIN',
    finality: 'PENDING',
    maxActiveDevices: 5,
    activeDeviceCount: 0,
    expiresAt: '2027-01-01T00:00:00.000Z',
    originOrderId: 'ord-ho-1',
    fulfillmentMode: 'PROVIDER_HANDOFF',
    providerDeliveryStatus: 'FAILED',
    activationKeyAvailable: false,
  },
  {
    id: 'lic-handoff-2',
    publicLicenseId: 'PUB-HO-2',
    productName: 'CloudSuite 2',
    plan: { name: 'Enterprise' },
    status: 'ACTIVE',
    finality: 'CONFIRMED',
    maxActiveDevices: 10,
    activeDeviceCount: 0,
    expiresAt: '2027-02-01T00:00:00.000Z',
    originOrderId: 'ord-ho-2',
    fulfillmentMode: 'PROVIDER_HANDOFF',
    providerDeliveryStatus: 'DELIVERED',
    activationKeyAvailable: true,
  },
];

describe('Buyer handoff support request (UC4)', () => {
  it('opens support request form from PROVIDER_HANDOFF license detail without creating conversation until submitted, and clears context on cancel', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const postedBodies: Array<Record<string, unknown>> = [];
    const createdConversations: Array<Record<string, unknown>> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/licenses')) return Response.json(handoffLicenses);
      if (url.endsWith('/conversations') && init?.method === 'POST') {
        const parsed = JSON.parse(String(init.body)) as Record<string, unknown>;
        postedBodies.push(parsed);
        const created = {
          id: `conv-${postedBodies.length}`,
          title: parsed.title,
          status: 'WAITING_SUPPORT',
          contextType: parsed.contextType,
          contextId: parsed.contextId ?? null,
        };
        createdConversations.push(created);
        return Response.json(created);
      }
      if (url.endsWith('/conversations')) return Response.json(createdConversations);
      if (url.includes('/messages')) return Response.json([]);
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/buyer/licenses']} />);

      // Open first PROVIDER_HANDOFF license detail
      const detailButtons = await screen.findAllByRole('button', { name: 'Chi tiết' });
      fireEvent.click(detailButtons[0]!);

      const supportBtn = await screen.findByRole('button', { name: 'Cần hỗ trợ bản quyền này' });
      fireEvent.click(supportBtn);

      // Navigating opens the form modal without creating a conversation
      expect(await screen.findByRole('dialog', { name: 'Tạo yêu cầu hỗ trợ' })).toBeTruthy();
      expect(screen.getByText(/lic-handoff-1/)).toBeTruthy();
      expect(postedBodies).toHaveLength(0);

      // Submit for lic-handoff-1
      fireEvent.change(await screen.findByLabelText('Mô tả vấn đề'), { target: { value: 'Chưa nhận được bàn giao' } });
      fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' }));

      await waitFor(() => expect(postedBodies).toHaveLength(1));
      expect(postedBodies[0]).toMatchObject({
        mode: 'SUPPORT',
        contextType: 'LICENSE',
        contextId: 'lic-handoff-1',
      });

      // Next general request has GENERAL context, not lic-handoff-1
      fireEvent.click(await screen.findByRole('button', { name: 'Tạo yêu cầu mới' }));
      expect(screen.queryByText(/lic-handoff-1/)).toBeNull();
      fireEvent.change(await screen.findByLabelText('Mô tả vấn đề'), { target: { value: 'Hỗ trợ chung' } });
      fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' }));

      await waitFor(() => expect(postedBodies).toHaveLength(2));
      expect(postedBodies[1]).toMatchObject({
        mode: 'SUPPORT',
        contextType: 'GENERAL',
      });
      expect(postedBodies[1]?.contextId).toBeUndefined();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('isolates support drafts per license/general context and preserves clientRequestId on retry', { timeout: 60_000 }, async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const postedBodies: Array<Record<string, unknown>> = [];
    let failFirstPost = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/licenses')) return Response.json(handoffLicenses);
      if (url.endsWith('/conversations') && init?.method === 'POST') {
        const parsed = JSON.parse(String(init.body)) as Record<string, unknown>;
        postedBodies.push(parsed);
        if (failFirstPost) {
          failFirstPost = false;
          return Response.json({ message: 'Tạm lỗi' }, { status: 500 });
        }
        return Response.json({
          id: `conv-${postedBodies.length}`,
          title: parsed.title,
          status: 'WAITING_SUPPORT',
          contextType: parsed.contextType,
          contextId: parsed.contextId ?? null,
        });
      }
      if (url.endsWith('/conversations')) return Response.json([]);
      if (url.includes('/messages')) return Response.json([]);
      return original(input, init);
    });

    try {
      render(<App initialEntries={['/buyer/licenses']} />);

      // Open license 1, type draft, then cancel
      const detailButtons = await screen.findAllByRole('button', { name: 'Chi tiết' });
      fireEvent.click(detailButtons[0]!);
      fireEvent.click(await screen.findByRole('button', { name: 'Cần hỗ trợ bản quyền này' }));
      const desc1 = await screen.findByLabelText('Mô tả vấn đề');
      fireEvent.change(desc1, { target: { value: 'Nháp bản quyền A' } });
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      // General request must NOT inherit draft A
      fireEvent.click(await screen.findByRole('button', { name: 'Tạo yêu cầu mới' }));
      expect((await screen.findByLabelText('Mô tả vấn đề') as HTMLTextAreaElement).value).toBe('');
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      // Navigate to license 2 -> must be empty, NOT draft A
      fireEvent.click(screen.getByRole('link', { name: 'Bản quyền' }));
      const detailButtons2 = await screen.findAllByRole('button', { name: 'Chi tiết' });
      fireEvent.click(detailButtons2[1]!);
      fireEvent.click(await screen.findByRole('button', { name: 'Cần hỗ trợ bản quyền này' }));
      const desc2 = (await screen.findByLabelText('Mô tả vấn đề')) as HTMLTextAreaElement;
      expect(desc2.value).toBe('');

      // Submit license 2 (first attempt fails, second succeeds with SAME clientRequestId)
      fireEvent.change(desc2, { target: { value: 'Nội dung bản quyền B' } });
      fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' }));
      expect(await screen.findByText(/Không thể tạo hội thoại/)).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' }));
      await waitFor(() => expect(postedBodies).toHaveLength(2));
      expect(postedBodies[0]).toMatchObject({
        contextType: 'LICENSE',
        contextId: 'lic-handoff-2',
        initialMessage: 'Nội dung bản quyền B',
      });
      expect(postedBodies[1]?.clientRequestId).toBe(postedBodies[0]?.clientRequestId);

      // Returning to license 1 restores draft A
      fireEvent.click(screen.getByRole('link', { name: 'Bản quyền' }));
      const detailButtons3 = await screen.findAllByRole('button', { name: 'Chi tiết' });
      fireEvent.click(detailButtons3[0]!);
      fireEvent.click(await screen.findByRole('button', { name: 'Cần hỗ trợ bản quyền này' }));
      expect(((await screen.findByLabelText('Mô tả vấn đề')) as HTMLTextAreaElement).value).toBe('Nháp bản quyền A');
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });
});
