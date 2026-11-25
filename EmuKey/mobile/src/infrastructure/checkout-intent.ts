import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MobileCheckoutIntent {
  readonly orderId: string;
  readonly planId: string;
  readonly productId: string;
  readonly draftId?: string;
  readonly targetLicenseId?: string;
  readonly deviceQuantity?: number;
  readonly durationMonths?: number;
}

const CHECKOUT_INTENT_PREFIX = 'emukey_checkout_intent_v1_';

function storageKey(userId: string): string {
  return `${CHECKOUT_INTENT_PREFIX}${userId}`;
}

type CheckoutSelection = Pick<
  MobileCheckoutIntent, 'planId' | 'draftId' | 'targetLicenseId' | 'deviceQuantity' | 'durationMonths'
>;

let storageChanges = Promise.resolve();

function changeStorage(work: () => Promise<void>): Promise<void> {
  const change = storageChanges.then(work);
  storageChanges = change.catch(() => undefined);
  return change;
}

async function readSavedIntents(userId: string): Promise<MobileCheckoutIntent[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  // Previously the same storage entry held a single order.
  const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  return entries.map((entry) => {
    const intent = entry as Partial<MobileCheckoutIntent> | null;
    if (!intent || typeof intent.orderId !== 'string' ||
        typeof intent.planId !== 'string' || typeof intent.productId !== 'string') {
      throw new Error('Invalid saved checkout intent');
    }
    return {
      orderId: intent.orderId,
      planId: intent.planId,
      productId: intent.productId,
      ...(typeof intent.draftId === 'string' ? { draftId: intent.draftId } : {}),
      ...(typeof intent.targetLicenseId === 'string' ? { targetLicenseId: intent.targetLicenseId } : {}),
      ...(typeof intent.deviceQuantity === 'number' ? { deviceQuantity: intent.deviceQuantity } : {}),
      ...(typeof intent.durationMonths === 'number' ? { durationMonths: intent.durationMonths } : {}),
    };
  });
}

function matchesSelection(left: CheckoutSelection, right: CheckoutSelection): boolean {
  return left.planId === right.planId && left.draftId === right.draftId &&
    left.targetLicenseId === right.targetLicenseId &&
    left.deviceQuantity === right.deviceQuantity && left.durationMonths === right.durationMonths;
}

export async function readCheckoutIntent(
  userId: string | null | undefined,
  selection: CheckoutSelection,
): Promise<MobileCheckoutIntent | null> {
  if (!userId) return null;
  await storageChanges;
  const entries = await readSavedIntents(userId);
  return entries.find((entry) => matchesSelection(entry, selection)) ?? null;
}

export async function writeCheckoutIntent(userId: string, intent: MobileCheckoutIntent): Promise<void> {
  await changeStorage(async () => {
    const entries = await readSavedIntents(userId);
    const remaining = entries.filter((entry) => entry.orderId !== intent.orderId && !matchesSelection(entry, intent));
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify([...remaining, intent]));
  });
}

export async function clearCheckoutIntent(
  userId: string | null | undefined,
  expectedOrderId?: string,
): Promise<void> {
  if (!userId) return;
  await changeStorage(async () => {
    if (expectedOrderId) {
      const entries = await readSavedIntents(userId);
      const remaining = entries.filter((entry) => entry.orderId !== expectedOrderId);
      if (remaining.length === entries.length) return;
      if (remaining.length) {
        await AsyncStorage.setItem(storageKey(userId), JSON.stringify(remaining));
        return;
      }
    }
    await AsyncStorage.removeItem(storageKey(userId));
  }).catch(() => undefined); // Best-effort cleanup.
}
