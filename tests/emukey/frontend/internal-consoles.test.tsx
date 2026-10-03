import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('W17-W18 Internal consoles', () => {
  it('renders an empty support queue when the real API has no conversations', () => {
    render(<App initialEntries={['/support']} />);
    expect(screen.queryByText('Người mua #B204')).toBeNull();
  });

  it('does not display fabricated audit entries', () => {
    render(<App initialEntries={['/system/console']} />);
    expect(screen.queryByText('BLOCKCHAIN_RETRY')).toBeNull();
  });

  it('marks only the selected query-string section active', async () => {
    const { container } = render(<App initialEntries={['/system/console?view=users']} />);
    await screen.findByRole('heading', { name: 'Quản lý người dùng' });
    const active = container.querySelectorAll('.role-desktop-nav a.active');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toBe('Người dùng');
  });

  it('makes provider licenses reachable from navigation', async () => {
    render(<App initialEntries={['/provider']} />);
    expect(await screen.findByRole('link', { name: 'Bản quyền' })).toHaveProperty('pathname', '/provider/licenses');
  });
});
