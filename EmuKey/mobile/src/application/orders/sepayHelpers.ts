import type { MobileCheckoutSession } from '../../infrastructure/api/client';

function htmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function checkoutDocument(checkout: MobileCheckoutSession): string {
  const fields = Object.entries(checkout.checkoutFields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${htmlAttribute(name)}" value="${htmlAttribute(value)}">`,
    )
    .join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;background:#f7f9fb;color:#1c1c1a;padding:24px"><p>Đang chuyển đến cổng thanh toán SePay…</p><form id="checkout" method="post" action="${htmlAttribute(checkout.checkoutUrl)}">${fields}</form><script>document.getElementById('checkout').submit()</script></body></html>`;
}

export function matchesPaymentReturn(
  raw: string,
  orderId: string,
  expectedWebUrl?: string,
): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol === 'emukey:') {
      return (
        url.hostname === 'payment' &&
        decodeURIComponent(url.pathname) === `/${orderId}`
      );
    }
    if (!expectedWebUrl) return false;
    const expected = new URL(expectedWebUrl);
    return (
      url.protocol === 'https:' &&
      url.origin === expected.origin &&
      url.pathname === `/buyer/orders/${encodeURIComponent(orderId)}/payment`
    );
  } catch {
    return false;
  }
}
