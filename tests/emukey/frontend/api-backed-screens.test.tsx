import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('API-backed workspace screens', () => {
  it('loads Provider knowledge documents from the API', async () => {
    render(<App initialEntries={['/provider/knowledge']} />);

    expect(await screen.findByText('Chưa có tài liệu kiến thức phù hợp.')).toBeTruthy();
    expect(screen.getByLabelText('Sản phẩm của tài liệu')).toBeTruthy();
  });

  it('loads System readiness metrics from the API', async () => {
    render(<App initialEntries={['/system/console']} />);

    expect((await screen.findAllByText('up')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Tình trạng dịch vụ')).toBeTruthy();
  });
});
