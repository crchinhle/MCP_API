import { describe, expect, it } from 'vitest';

import { activationKeyErrorLabel, publicVerificationError, publicVerificationErrorLabel } from '../src/application/licenses/licenseQueries';

describe('publicVerificationError', () => {
  it('maps 400 to format error', () => {
    const result = publicVerificationError({ status: 400 });
    expect(result.message).toBe('Mã xác thực không đúng định dạng. Vui lòng kiểm tra và thử lại.');
    expect(result.retryable).toBe(false);
  });

  it('maps 404 to not found', () => {
    const result = publicVerificationError({ status: 404 });
    expect(result.message).toBe('Không tìm thấy License phù hợp với mã xác thực.');
    expect(result.retryable).toBe(false);
  });

  it('maps 429 with retryAfter', () => {
    const result = publicVerificationError({ status: 429, retryAfterSeconds: 30 });
    expect(result.message).toContain('30 giây');
    expect(result.retryable).toBe(true);
  });

  it('maps 429 without retryAfter', () => {
    const result = publicVerificationError({ status: 429 });
    expect(result.message).toContain('thử lại sau ít phút');
    expect(result.retryable).toBe(true);
  });

  it('maps unknown error to generic retryable', () => {
    const result = publicVerificationError({ status: 500 });
    expect(result.message).toBe('Không thể xác minh lúc này. Vui lòng kiểm tra kết nối và thử lại.');
    expect(result.retryable).toBe(true);
  });

  it('maps non-object error to generic retryable', () => {
    const result = publicVerificationError('network error');
    expect(result.message).toBe('Không thể xác minh lúc này. Vui lòng kiểm tra kết nối và thử lại.');
    expect(result.retryable).toBe(true);
  });
});

describe('publicVerificationErrorLabel', () => {
  it('returns message from publicVerificationError', () => {
    expect(publicVerificationErrorLabel({ status: 404 })).toBe('Không tìm thấy License phù hợp với mã xác thực.');
  });
});

describe('activationKeyErrorLabel', () => {
  it('maps 404 to unavailable message', () => {
    expect(activationKeyErrorLabel({ status: 404 })).toBe('Mã bản quyền đã được nhận hoặc hiện không còn sẵn sàng. Nếu bạn đã mất mã, hãy dùng quy trình khôi phục mã.');
  });

  it('maps ACTIVATION_KEY_UNAVAILABLE code', () => {
    expect(activationKeyErrorLabel({ status: 400, code: 'ACTIVATION_KEY_UNAVAILABLE' })).toBe('Mã bản quyền đã được nhận hoặc hiện không còn sẵn sàng. Nếu bạn đã mất mã, hãy dùng quy trình khôi phục mã.');
  });

  it('maps ACTIVATION_KEY_ALREADY_RETRIEVED code', () => {
    expect(activationKeyErrorLabel({ status: 400, code: 'ACTIVATION_KEY_ALREADY_RETRIEVED' })).toBe('Mã bản quyền đã được nhận hoặc hiện không còn sẵn sàng. Nếu bạn đã mất mã, hãy dùng quy trình khôi phục mã.');
  });

  it('maps 409 to conflict state', () => {
    expect(activationKeyErrorLabel({ status: 409 })).toBe('Mã bản quyền chưa thể nhận ở trạng thái hiện tại. Hãy kiểm tra lại trạng thái bản quyền.');
  });

  it('maps 403 to permission denied', () => {
    expect(activationKeyErrorLabel({ status: 403 })).toBe('Bạn không có quyền nhận mã bản quyền này.');
  });

  it('maps 429 to rate limit', () => {
    expect(activationKeyErrorLabel({ status: 429 })).toBe('Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.');
  });

  it('maps unknown error to generic', () => {
    expect(activationKeyErrorLabel({ status: 500 })).toBe('Không thể nhận mã bản quyền lúc này. Vui lòng thử lại khi bản quyền vẫn đang sẵn sàng.');
  });
});
