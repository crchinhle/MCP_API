export interface RequestErrorMessages {
  readonly notFound?: string;
  readonly forbidden?: string;
  readonly unauthorized?: string;
  readonly timeout?: string;
  readonly network?: string;
  readonly server?: string;
  readonly rateLimited?: string;
}

export function describeRequestError(
  error: unknown,
  fallback: string,
  messages: RequestErrorMessages = {},
): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status?: unknown }).status);
    const retryAfter = Number(
      (error as { retryAfterSeconds?: unknown }).retryAfterSeconds ?? 0,
    );
    if (status === 401) {
      return (
        messages.unauthorized ??
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      );
    }
    if (status === 403) {
      return messages.forbidden ?? 'Bạn không có quyền truy cập nội dung này.';
    }
    if (status === 404) {
      return messages.notFound ?? 'Không tìm thấy dữ liệu được yêu cầu.';
    }
    if (status === 429) {
      if (messages.rateLimited) return messages.rateLimited;
      return retryAfter > 0
        ? `Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ${retryAfter} giây.`
        : 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.';
    }
    if (status >= 500) {
      return (
        messages.server ??
        'Máy chủ đang gặp sự cố tạm thời. Vui lòng thử lại sau.'
      );
    }
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || /timeout|timed out/i.test(error.message)) {
      return (
        messages.timeout ??
        'Kết nối quá thời gian chờ. Vui lòng kiểm tra mạng và thử lại.'
      );
    }
    if (
      error instanceof TypeError ||
      /network|failed to fetch|offline|connection/i.test(error.message)
    ) {
      return (
        messages.network ??
        'Không thể kết nối máy chủ. Kiểm tra kết nối mạng và thử lại.'
      );
    }
  }

  return fallback;
}
