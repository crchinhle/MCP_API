import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('public verification', () => {
  it('shows the backend allowlist without Buyer PII', async () => {
    render(<App initialEntries={['/verify']} />);
    fireEvent.change(screen.getByLabelText('Mã xác thực'), { target: { value: 'EMU-TEST-LICENSE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));
    expect(await screen.findByText('Đã tìm thấy License')).toBeTruthy();
    expect(await screen.findByText('SecureDesk Pro')).toBeTruthy();
    expect(await screen.findByText('Emukey Software')).toBeTruthy();
    expect(screen.queryByText('Công ty TNHH Minh An')).toBeNull();
  });

  it('shows an explicit not-found state for an unknown code', async () => {
    render(<App initialEntries={['/verify']} />);
    fireEvent.change(screen.getByLabelText('Mã xác thực'), {
      target: { value: 'UNKNOWN' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Không tìm thấy',
    );
  });
});
