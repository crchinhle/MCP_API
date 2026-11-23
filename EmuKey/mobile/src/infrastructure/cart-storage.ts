import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartDraft {
  readonly id: string;
  readonly ownerUserId: string;
  readonly productId: string;
  readonly productName: string;
  readonly planId: string;
  readonly planName: string;
  readonly deviceQuantity: number;
  readonly durationMonths: 1 | 2 | 3 | 6 | 12;
  readonly referencePriceVnd: number;
  readonly orderId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface StoredCartPayload {
  readonly version: 1;
  readonly items: CartDraft[];
}

const CART_STORAGE_PREFIX = 'emukey_cart_v1_';

function storageKey(userId: string): string {
  return `${CART_STORAGE_PREFIX}${userId}`;
}

function isValidDraft(value: unknown, expectedUserId: string): value is CartDraft {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartDraft>;
  return (
    typeof item.id === 'string' &&
    item.ownerUserId === expectedUserId &&
    typeof item.productId === 'string' &&
    typeof item.productName === 'string' &&
    typeof item.planId === 'string' &&
    typeof item.planName === 'string' &&
    typeof item.deviceQuantity === 'number' &&
    Number.isInteger(item.deviceQuantity) &&
    item.deviceQuantity >= 1 &&
    typeof item.durationMonths === 'number' &&
    [1, 2, 3, 6, 12].includes(item.durationMonths) &&
    typeof item.referencePriceVnd === 'number' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string'
  );
}

export async function loadCartDrafts(userId: string): Promise<CartDraft[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<StoredCartPayload> | null;
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter((item) => isValidDraft(item, userId));
  } catch {
    return [];
  }
}

export async function saveCartDrafts(
  userId: string,
  items: readonly CartDraft[],
): Promise<void> {
  const payload: StoredCartPayload = {
    version: 1,
    items: items.filter((item) => item.ownerUserId === userId),
  };
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(payload));
}

export async function clearCartDrafts(userId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId));
}
