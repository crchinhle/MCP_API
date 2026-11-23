import * as Crypto from 'expo-crypto';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  clearCartDrafts,
  loadCartDrafts,
  saveCartDrafts,
  type CartDraft,
} from '../../infrastructure/cart-storage';
import { clearCheckoutIntent } from '../../infrastructure/checkout-intent';
import { useCustomerSession } from '../auth/useCustomerSession';
import { cartReducer, findMatchingDraft, initialCartState } from './cartReducer';

export interface PendingPurchaseSelection {
  readonly productId: string;
  readonly planId?: string;
  readonly deviceQuantity?: number;
  readonly durationMonths?: 1 | 2 | 3 | 6 | 12;
  readonly action: 'cart' | 'checkout';
}

export interface SaveCartItemInput {
  readonly id?: string;
  readonly productId: string;
  readonly productName: string;
  readonly planId: string;
  readonly planName: string;
  readonly deviceQuantity: number;
  readonly durationMonths: 1 | 2 | 3 | 6 | 12;
  readonly referencePriceVnd: number;
}

export interface CartContextValue {
  readonly items: readonly CartDraft[];
  readonly count: number;
  readonly loaded: boolean;
  readonly storageError: string | null;
  readonly pendingSelection: PendingPurchaseSelection | null;
  readonly setPendingSelection: (selection: PendingPurchaseSelection | null) => void;
  readonly saveDraft: (input: SaveCartItemInput) => Promise<CartDraft | null>;
  readonly attachOrderToDraft: (draftId: string, orderId: string) => Promise<void>;
  readonly removeDraft: (draftId: string) => Promise<void>;
  readonly clearCart: () => Promise<void>;
  readonly retryStorage: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { readonly children: ReactNode }) {
  const { user, isAuthenticated } = useCustomerSession();
  const userId = isAuthenticated ? user?.id ?? null : null;
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const [pendingSelection, setPendingSelection] = useState<PendingPurchaseSelection | null>(null);
  const previousUserIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  const hydrate = useCallback(async (uid: string) => {
    const gen = generationRef.current;
    try {
      const items = await loadCartDrafts(uid);
      if (gen !== generationRef.current) return;
      dispatch({ type: 'HYDRATE', items });
    } catch {
      if (gen !== generationRef.current) return;
      dispatch({
        type: 'STORAGE_ERROR',
        message: 'Chưa tải được giỏ hàng đã lưu trên thiết bị.',
      });
    }
  }, []);

  useEffect(() => {
    const prevUserId = previousUserIdRef.current;
    if (prevUserId && prevUserId !== userId) {
      setPendingSelection(null);
      void clearCartDrafts(prevUserId).catch(() => undefined);
      void clearCheckoutIntent(prevUserId).catch(() => undefined);
    }
    previousUserIdRef.current = userId;
    generationRef.current += 1;
    dispatch({ type: 'RESET' });
    if (!userId) return;
    void hydrate(userId);
  }, [hydrate, userId]);

  const persistNext = useCallback(
    async (uid: string, nextItems: readonly CartDraft[]): Promise<boolean> => {
      try {
        await saveCartDrafts(uid, nextItems);
        return true;
      } catch {
        dispatch({
          type: 'STORAGE_ERROR',
          message: 'Chưa lưu được lựa chọn trên thiết bị. Vui lòng thử lại.',
        });
        return false;
      }
    },
    [],
  );

  const saveDraft = useCallback(
    async (input: SaveCartItemInput): Promise<CartDraft | null> => {
      if (!userId) return null;
      const now = new Date().toISOString();
      const existingById = input.id ? state.items.find((item) => item.id === input.id) : undefined;
      const duplicate = existingById
        ? undefined
        : findMatchingDraft(state.items, {
            ownerUserId: userId,
            productId: input.productId,
            planId: input.planId,
            deviceQuantity: input.deviceQuantity,
            durationMonths: input.durationMonths,
          });
      const draft: CartDraft = {
        id: existingById?.id ?? duplicate?.id ?? Crypto.randomUUID(),
        ownerUserId: userId,
        productId: input.productId,
        productName: input.productName,
        planId: input.planId,
        planName: input.planName,
        deviceQuantity: input.deviceQuantity,
        durationMonths: input.durationMonths,
        referencePriceVnd: input.referencePriceVnd,
        ...(existingById?.orderId ? { orderId: existingById.orderId } : {}),
        createdAt: existingById?.createdAt ?? duplicate?.createdAt ?? now,
        updatedAt: now,
      };
      const nextState = cartReducer(state, { type: 'UPSERT', draft });
      const saved = await persistNext(userId, nextState.items);
      if (!saved) return null;
      dispatch({ type: 'UPSERT', draft });
      return draft;
    },
    [persistNext, state, userId],
  );

  const attachOrderToDraft = useCallback(
    async (draftId: string, orderId: string) => {
      if (!userId) return;
      const updatedAt = new Date().toISOString();
      const nextState = cartReducer(state, {
        type: 'ATTACH_ORDER',
        draftId,
        orderId,
        updatedAt,
      });
      await persistNext(userId, nextState.items);
      dispatch({ type: 'ATTACH_ORDER', draftId, orderId, updatedAt });
    },
    [persistNext, state, userId],
  );

  const removeDraft = useCallback(
    async (draftId: string) => {
      if (!userId) return;
      const nextState = cartReducer(state, { type: 'REMOVE', draftId });
      const saved = await persistNext(userId, nextState.items);
      if (saved) dispatch({ type: 'REMOVE', draftId });
    },
    [persistNext, state, userId],
  );

  const clearCart = useCallback(async () => {
    if (!userId) return;
    try {
      await clearCartDrafts(userId);
      dispatch({ type: 'CLEAR' });
    } catch {
      dispatch({
        type: 'STORAGE_ERROR',
        message: 'Không thể xóa danh sách đã lưu trên thiết bị.',
      });
    }
  }, [userId]);

  const retryStorage = useCallback(async () => {
    if (!userId) return;
    await hydrate(userId);
  }, [hydrate, userId]);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      count: state.items.length,
      loaded: state.loaded,
      storageError: state.storageError,
      pendingSelection,
      setPendingSelection,
      saveDraft,
      attachOrderToDraft,
      removeDraft,
      clearCart,
      retryStorage,
    }),
    [
      attachOrderToDraft,
      clearCart,
      pendingSelection,
      removeDraft,
      retryStorage,
      saveDraft,
      state.items,
      state.loaded,
      state.storageError,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    return {
      items: [],
      count: 0,
      loaded: true,
      storageError: null,
      pendingSelection: null,
      setPendingSelection: () => undefined,
      saveDraft: () => Promise.resolve(null),
      attachOrderToDraft: () => Promise.resolve(),
      removeDraft: () => Promise.resolve(),
      clearCart: () => Promise.resolve(),
      retryStorage: () => Promise.resolve(),
    };
  }
  return ctx;
}
