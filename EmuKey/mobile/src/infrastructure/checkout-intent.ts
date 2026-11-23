import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MobileCheckoutIntent {
  readonly orderId: string;
  readonly planId: string;
  readonly productId: string;
  readonly draftId?: string;
  readonly deviceQuantity?: number;
  readonly durationMonths?: number;
}

const CHECKOUT_INTENT_PREFIX = 'emukey_checkout_intent_v1_';

function storageKey(userId: string): string {
  return `${CHECKOUT_INTENT_PREFIX}${userId}`;
}

export async function readCheckoutIntent(
  userId: string | null | undefined,
): Promise<MobileCheckoutIntent | null> {
  if (!userId) return null;
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as Partial<MobileCheckoutIntent> | null;
  if (
    !parsed ||
    typeof parsed.orderId !== 'string' ||
    typeof parsed.planId !== 'string' ||
    typeof parsed.productId !== 'string'
  ) {
    throw new Error('Invalid saved checkout intent');
  }
  return {
    orderId: parsed.orderId,
    planId: parsed.planId,
    productId: parsed.productId,
    ...(typeof parsed.draftId === 'string' ? { draftId: parsed.draftId } : {}),
    ...(typeof parsed.deviceQuantity === 'number'
      ? { deviceQuantity: parsed.deviceQuantity }
      : {}),
    ...(typeof parsed.durationMonths === 'number'
      ? { durationMonths: parsed.durationMonths }
      : {}),
  };
}

export async function writeCheckoutIntent(
  userId: string | null | undefined,
  intent: MobileCheckoutIntent,
): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(intent));
  } catch {
    // Storage failure must not block purchase progression.
  }
}

export async function clearCheckoutIntent(
  userId: string | null | undefined,
  expectedOrderId?: string,
): Promise<void> {
  if (!userId) return;
  try {
    if (expectedOrderId) {
      const current = await readCheckoutIntent(userId);
      if (current && current.orderId !== expectedOrderId) return;
    }
    await AsyncStorage.removeItem(storageKey(userId));
  } catch {
    // Best-effort cleanup.
  }
}
