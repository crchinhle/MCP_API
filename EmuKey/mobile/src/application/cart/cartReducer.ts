import type { CartDraft } from '../../infrastructure/cart-storage';

export interface CartState {
  readonly items: readonly CartDraft[];
  readonly loaded: boolean;
  readonly storageError: string | null;
}

export type CartUpsertInput = Omit<CartDraft, 'id' | 'createdAt' | 'updatedAt'> & {
  readonly id?: string;
};

export type CartAction =
  | { type: 'HYDRATE'; items: readonly CartDraft[] }
  | { type: 'STORAGE_ERROR'; message: string | null }
  | { type: 'UPSERT'; draft: CartDraft }
  | { type: 'ATTACH_ORDER'; draftId: string; orderId: string; updatedAt: string }
  | { type: 'REMOVE'; draftId: string }
  | { type: 'CLEAR' }
  | { type: 'RESET' };

export const initialCartState: CartState = {
  items: [],
  loaded: false,
  storageError: null,
};

export function findMatchingDraft(
  items: readonly CartDraft[],
  target: Pick<
    CartDraft,
    'ownerUserId' | 'productId' | 'planId' | 'deviceQuantity' | 'durationMonths'
  >,
): CartDraft | undefined {
  return items.find(
    (item) =>
      item.ownerUserId === target.ownerUserId &&
      item.productId === target.productId &&
      item.planId === target.planId &&
      item.deviceQuantity === target.deviceQuantity &&
      item.durationMonths === target.durationMonths &&
      !item.orderId,
  );
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        items: [...action.items],
        loaded: true,
        storageError: null,
      };
    case 'STORAGE_ERROR':
      return {
        ...state,
        loaded: true,
        storageError: action.message,
      };
    case 'UPSERT': {
      const existingById = state.items.find((item) => item.id === action.draft.id);
      if (existingById) {
        return {
          ...state,
          storageError: null,
          items: state.items.map((item) =>
            item.id === action.draft.id ? action.draft : item,
          ),
        };
      }
      const duplicate = findMatchingDraft(state.items, action.draft);
      if (duplicate) {
        // Same product/plan/devices/months updates existing entry instead of incrementing device quantity.
        return {
          ...state,
          storageError: null,
          items: state.items.map((item) =>
            item.id === duplicate.id
              ? {
                  ...duplicate,
                  productName: action.draft.productName,
                  planName: action.draft.planName,
                  referencePriceVnd: action.draft.referencePriceVnd,
                  updatedAt: action.draft.updatedAt,
                }
              : item,
          ),
        };
      }
      return {
        ...state,
        storageError: null,
        items: [action.draft, ...state.items],
      };
    }
    case 'ATTACH_ORDER':
      return {
        ...state,
        storageError: null,
        items: state.items.map((item) =>
          item.id === action.draftId
            ? { ...item, orderId: action.orderId, updatedAt: action.updatedAt }
            : item,
        ),
      };
    case 'REMOVE':
      return {
        ...state,
        storageError: null,
        items: state.items.filter((item) => item.id !== action.draftId),
      };
    case 'CLEAR':
      return {
        ...state,
        storageError: null,
        items: [],
      };
    case 'RESET':
      return initialCartState;
    default:
      return state;
  }
}
