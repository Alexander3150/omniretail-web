"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/core/entities";
import {
  createStorefrontCartItem,
  type StorefrontCartItemDto,
} from "@/modules/storefront/application/dto/StorefrontCartDto";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

interface StorefrontCartContextValue {
  items: StorefrontCartItemDto[];
  itemCount: number;
  subtotal: number;
  addProduct: (product: Product) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
  clearCart: () => void;
}

const StorefrontCartContext = createContext<StorefrontCartContextValue | null>(null);

export function StorefrontCartProvider({ children }: { children: ReactNode }) {
  const { tenantId } = usePublicTenant();
  const [allItems, setAllItems] = useState<StorefrontCartItemDto[]>([]);
  const items = useMemo(
    () => allItems.filter((item) => item.tenantId === tenantId),
    [allItems, tenantId],
  );
  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );
  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [items],
  );

  const addProduct = useCallback(
    (product: Product) => {
      if (!tenantId || product.tenantId !== tenantId) return;

      setAllItems((current) => {
        const existing = current.find(
          (item) => item.tenantId === tenantId && item.productId === product.id,
        );
        if (!existing) return [...current, createStorefrontCartItem(product)];

        return current.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + 1 } : item,
        );
      });
    },
    [tenantId],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (!tenantId) return;
      const nextQuantity = Math.floor(quantity);
      setAllItems((current) =>
        nextQuantity <= 0
          ? current.filter((item) => item.tenantId !== tenantId || item.productId !== productId)
          : current.map((item) =>
              item.tenantId === tenantId && item.productId === productId
                ? { ...item, quantity: nextQuantity }
                : item,
            ),
      );
    },
    [tenantId],
  );

  const removeProduct = useCallback(
    (productId: string) => updateQuantity(productId, 0),
    [updateQuantity],
  );
  const clearCart = useCallback(() => {
    if (!tenantId) return;
    setAllItems((current) => current.filter((item) => item.tenantId !== tenantId));
  }, [tenantId]);

  const value = useMemo<StorefrontCartContextValue>(
    () => ({ items, itemCount, subtotal, addProduct, updateQuantity, removeProduct, clearCart }),
    [addProduct, clearCart, itemCount, items, removeProduct, subtotal, updateQuantity],
  );

  return <StorefrontCartContext.Provider value={value}>{children}</StorefrontCartContext.Provider>;
}

export function useStorefrontCart() {
  const context = useContext(StorefrontCartContext);
  if (!context) throw new Error("useStorefrontCart must be used inside StorefrontCartProvider");
  return context;
}
