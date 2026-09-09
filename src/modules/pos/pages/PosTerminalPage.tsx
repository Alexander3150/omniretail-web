"use client";

import { PageHeader } from "@/shared/components/PageHeader";
import { ProductSearch } from "@/modules/pos/components/ProductSearch";
import { QuickProductList } from "@/modules/pos/components/QuickProductList";
import { SaleTicket } from "@/modules/pos/components/SaleTicket";
import { usePosTerminal } from "@/modules/pos/hooks/usePosTerminal";

export function PosTerminalPage() {
  const terminal = usePosTerminal();

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Terminal de Cobro"
        description="Registra ventas desde la sucursal activa."
      />

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-title)]">
                Productos disponibles
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Selecciona productos para agregarlos al ticket actual.
              </p>
            </div>
            <div className="w-full sm:max-w-sm">
              <ProductSearch value={terminal.search} onChange={terminal.setSearch} />
            </div>
          </div>

          <div className="mt-5">
            <QuickProductList
              error={terminal.error}
              hasProducts={terminal.products.length > 0}
              loading={terminal.loading}
              products={terminal.filteredProducts}
              onAdd={terminal.addProduct}
            />
          </div>
        </div>

        <SaleTicket
          discountTotal={terminal.discountTotal}
          error={terminal.ticketError}
          items={terminal.ticketItems}
          subtotal={terminal.subtotal}
          total={terminal.total}
          onClear={terminal.clearTicket}
          onDecrease={terminal.decreaseQuantity}
          onIncrease={terminal.increaseQuantity}
          onRemove={terminal.removeItem}
        />
      </section>
    </div>
  );
}
