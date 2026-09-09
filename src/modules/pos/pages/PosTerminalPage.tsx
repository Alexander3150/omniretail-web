"use client";

import { PageHeader } from "@/shared/components/PageHeader";
import { CheckoutModal } from "@/modules/pos/components/CheckoutModal";
import { ProductSearch } from "@/modules/pos/components/ProductSearch";
import { QuickProductList } from "@/modules/pos/components/QuickProductList";
import { SaleTicket } from "@/modules/pos/components/SaleTicket";
import { usePosTerminal } from "@/modules/pos/hooks/usePosTerminal";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatCurrency } from "@/shared/utils/formatCurrency";

export function PosTerminalPage() {
  const terminal = usePosTerminal();

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Terminal de Cobro"
        description="Registra ventas desde la sucursal activa."
      />

      {terminal.confirmationResult ? (
        <div
          className="rounded-xl border border-[var(--color-success)] bg-white p-4 shadow-sm"
          role="status"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="Venta confirmada" tone="success" />
            <p className="font-bold text-[var(--color-title)]">
              Venta {terminal.confirmationResult.sale.number}
            </p>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Total{" "}
            {formatCurrency(
              terminal.confirmationResult.sale.total,
              terminal.confirmationResult.payments[0]?.currency,
            )}
            {terminal.confirmationResult.idempotent
              ? " · Confirmación recuperada de forma idempotente."
              : " · Confirmación completada correctamente."}
          </p>
        </div>
      ) : null}

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
          canCheckout={terminal.canOpenCheckout}
          discountTotal={terminal.discountTotal}
          error={terminal.ticketError}
          items={terminal.ticketItems}
          subtotal={terminal.subtotal}
          total={terminal.total}
          onCheckout={terminal.openCheckout}
          onClear={terminal.clearTicket}
          onDecrease={terminal.decreaseQuantity}
          onIncrease={terminal.increaseQuantity}
          onRemove={terminal.removeItem}
        />
      </section>

      <CheckoutModal
        appliedAmount={terminal.checkoutAppliedAmount}
        bankAccounts={terminal.bankAccounts}
        bankAccountsError={terminal.bankAccountsError}
        bankAccountsLoading={terminal.bankAccountsLoading}
        cashShiftError={terminal.cashShiftError}
        cashShiftLoading={terminal.cashShiftLoading}
        cashShiftRegisterCode={terminal.cashShift?.registerCode ?? null}
        checkout={terminal.checkout}
        confirmationError={terminal.confirmationError}
        confirmationLoading={terminal.confirmationLoading}
        currentBranchName={terminal.currentBranchName}
        differenceAmount={terminal.checkoutDifferenceAmount}
        discountTotal={terminal.discountTotal}
        errors={terminal.checkoutErrors}
        hasCurrentBranchAccess={terminal.hasCurrentBranchAccess}
        hasOpenCashShift={terminal.hasOpenCashShift}
        hasOperationalBlock={terminal.checkoutHasOperationalBlock}
        hasPosSalesPermission={terminal.hasPosSalesPermission}
        hasUnsupportedTraceability={terminal.hasUnsupportedTraceability}
        message={terminal.checkoutMessage}
        open={terminal.checkoutOpen}
        readyToConfirm={terminal.checkoutReadyToConfirm}
        subtotal={terminal.subtotal}
        total={terminal.total}
        validated={terminal.checkoutValidated}
        onCheckoutChange={terminal.updateCheckout}
        onClose={terminal.closeCheckout}
        onConfirm={terminal.confirmSale}
        onDocumentTypeChange={terminal.setDocumentType}
        onInvoiceDataChange={terminal.updateInvoiceData}
        onPaymentModeChange={terminal.setPaymentMode}
        onReset={terminal.resetCheckout}
        onValidate={terminal.validateCheckout}
      />
    </div>
  );
}
