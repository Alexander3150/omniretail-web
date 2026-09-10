import type { ReactNode } from "react";
import type {
  CardTerminalOutcome,
  CardTerminalResultDto,
  CheckoutBankAccountDto,
  CheckoutDto,
  CheckoutInvoiceDataDto,
  CheckoutPaymentMode,
} from "@/modules/pos/application/dto/CheckoutDto";
import type { CheckoutValidationErrors } from "@/modules/pos/validation/checkout.validation";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { Select } from "@/shared/components/Select";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { DeliveryMethod, TransportMode } from "@/core/enums";

interface CheckoutModalProps {
  open: boolean;
  checkout: CheckoutDto;
  errors: CheckoutValidationErrors;
  subtotal: number;
  discountTotal: number;
  total: number;
  appliedAmount: number;
  differenceAmount: number;
  bankAccounts: CheckoutBankAccountDto[];
  bankAccountsLoading: boolean;
  bankAccountsError: string | null;
  availablePaymentModes: CheckoutPaymentMode[];
  paymentMethodsLoading: boolean;
  paymentMethodsError: string | null;
  cashShiftLoading: boolean;
  cashShiftError: string | null;
  cashShiftRegisterCode: string | null;
  currentBranchName: string | null;
  hasOpenCashShift: boolean;
  hasPosSalesPermission: boolean;
  hasCurrentBranchAccess: boolean;
  hasUnsupportedTraceability: boolean;
  validated: boolean;
  readyToConfirm: boolean;
  hasOperationalBlock: boolean;
  message: string | null;
  confirmationLoading: boolean;
  confirmationError: string | null;
  onClose: () => void;
  onReset: () => void;
  onDocumentTypeChange: (documentType: CheckoutDto["documentType"]) => void;
  onPaymentModeChange: (paymentMode: CheckoutPaymentMode) => void;
  onCheckoutChange: (
    patch: Partial<Omit<CheckoutDto, "cardTerminalResult">>,
  ) => void;
  onProcessCardPayment: (outcome: CardTerminalOutcome) => void;
  onInvoiceDataChange: (patch: Partial<CheckoutInvoiceDataDto>) => void;
  onDeliveryAddressChange: (patch: Partial<NonNullable<CheckoutDto["deliveryAddress"]>>) => void;
  onValidate: () => void;
  onConfirm: () => void;
}

export function CheckoutModal({
  open,
  checkout,
  errors,
  subtotal,
  discountTotal,
  total,
  appliedAmount,
  differenceAmount,
  bankAccounts,
  bankAccountsLoading,
  bankAccountsError,
  availablePaymentModes,
  paymentMethodsLoading,
  paymentMethodsError,
  cashShiftLoading,
  cashShiftError,
  cashShiftRegisterCode,
  currentBranchName,
  hasOpenCashShift,
  hasPosSalesPermission,
  hasCurrentBranchAccess,
  hasUnsupportedTraceability,
  validated,
  readyToConfirm,
  hasOperationalBlock,
  message,
  confirmationLoading,
  confirmationError,
  onClose,
  onReset,
  onDocumentTypeChange,
  onPaymentModeChange,
  onCheckoutChange,
  onProcessCardPayment,
  onInvoiceDataChange,
  onDeliveryAddressChange,
  onValidate,
  onConfirm,
}: CheckoutModalProps) {
  const showCash =
    availablePaymentModes.includes("cash") &&
    (checkout.paymentMode === "cash" || checkout.paymentMode === "mixed");
  const showCard =
    availablePaymentModes.includes("card") &&
    (checkout.paymentMode === "card" || checkout.paymentMode === "mixed");
  const showTransfer =
    availablePaymentModes.includes("transfer") &&
    (checkout.paymentMode === "transfer" || checkout.paymentMode === "mixed");

  return (
    <Modal
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button disabled={confirmationLoading} onClick={onReset} type="button" variant="ghost">
            Restablecer
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button disabled={confirmationLoading} onClick={onClose} type="button" variant="secondary">
              Cerrar
            </Button>
            <Button
              disabled={confirmationLoading}
              form="pos-checkout-form"
              type="submit"
              variant="secondary"
            >
              Preparar cobro
            </Button>
            <Button
              disabled={!readyToConfirm || confirmationLoading}
              onClick={onConfirm}
              type="button"
            >
              {confirmationLoading ? "Procesando..." : "Confirmar venta"}
            </Button>
          </div>
        </div>
      }
      onClose={onClose}
      open={open}
      size="xl"
      subtitle="Valida el documento y el pago antes de confirmar la venta."
      title="Cobrar venta"
    >
      <form
        className="space-y-5"
        id="pos-checkout-form"
        onSubmit={(event) => {
          event.preventDefault();
          onValidate();
        }}
      >
        <CheckoutSummary
          discountTotal={discountTotal}
          subtotal={subtotal}
          total={total}
        />

        <CashShiftStatusPanel
          branchName={currentBranchName}
          error={cashShiftError}
          hasBranchAccess={hasCurrentBranchAccess}
          hasOpenCashShift={hasOpenCashShift}
          hasSalesPermission={hasPosSalesPermission}
          loading={cashShiftLoading}
          registerCode={cashShiftRegisterCode}
        />

        {hasUnsupportedTraceability ? (
          <div className="rounded-lg border border-[var(--color-warning)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Bloqueo operativo" tone="warning" />
              <p className="text-sm font-semibold text-[var(--color-text)]">
                El ticket contiene lote, serial o kit no soportado para confirmación.
              </p>
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Puedes validar el cobro, pero la venta no podrá confirmarse en esta fase.
            </p>
          </div>
        ) : null}

        <section className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="font-bold text-[var(--color-title)]">Documento</h3>
          <FormField id="checkout-document-type" label="Tipo de documento">
            <Select
              id="checkout-document-type"
              onChange={(event) =>
                onDocumentTypeChange(event.target.value as CheckoutDto["documentType"])
              }
              value={checkout.documentType}
            >
              <option value="ticket">Ticket</option>
              <option value="invoice">Factura</option>
            </Select>
          </FormField>

          {checkout.documentType === "invoice" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField id="checkout-tax-id" label="NIT *" error={errors.taxId}>
                <Input
                  id="checkout-tax-id"
                  maxLength={30}
                  onChange={(event) => onInvoiceDataChange({ taxId: event.target.value })}
                  value={checkout.invoiceData.taxId}
                />
              </FormField>
              <FormField
                id="checkout-legal-name"
                label="Nombre / Razón Social *"
                error={errors.legalName}
              >
                <Input
                  id="checkout-legal-name"
                  maxLength={160}
                  onChange={(event) => onInvoiceDataChange({ legalName: event.target.value })}
                  value={checkout.invoiceData.legalName}
                />
              </FormField>
              <div className="md:col-span-2">
                <FormField
                  id="checkout-fiscal-address"
                  label="Dirección Fiscal *"
                  error={errors.fiscalAddress}
                >
                  <Input
                    id="checkout-fiscal-address"
                    maxLength={240}
                    onChange={(event) =>
                      onInvoiceDataChange({ fiscalAddress: event.target.value })
                    }
                    value={checkout.invoiceData.fiscalAddress}
                  />
                </FormField>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="font-bold text-[var(--color-title)]">Entrega</h3>
          <FormField id="checkout-delivery-method" label="Modalidad">
            <Select
              id="checkout-delivery-method"
              onChange={(event) => {
                const deliveryMethod = event.target.value as CheckoutDto["deliveryMethod"];
                onCheckoutChange({
                  deliveryMethod,
                  transportMode:
                    deliveryMethod === DeliveryMethod.home_delivery
                      ? TransportMode.own_fleet
                      : deliveryMethod === DeliveryMethod.store_pickup
                        ? TransportMode.customer
                        : TransportMode.none,
                });
              }}
              value={checkout.deliveryMethod}
            >
              <option value={DeliveryMethod.immediate}>Entrega inmediata</option>
              <option value={DeliveryMethod.store_pickup}>Retiro en tienda</option>
              <option value={DeliveryMethod.home_delivery}>Entrega a domicilio</option>
            </Select>
          </FormField>
          {checkout.deliveryMethod === DeliveryMethod.home_delivery ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField id="delivery-recipient" label="Recibe *">
                <Input id="delivery-recipient" onChange={(event) => onDeliveryAddressChange({ recipientName: event.target.value })} value={checkout.deliveryAddress?.recipientName ?? ""} />
              </FormField>
              <FormField id="delivery-city" label="Ciudad *">
                <Input id="delivery-city" onChange={(event) => onDeliveryAddressChange({ city: event.target.value })} value={checkout.deliveryAddress?.city ?? ""} />
              </FormField>
              <div className="md:col-span-2"><FormField id="delivery-line1" label="DirecciÃ³n *">
                <Input id="delivery-line1" onChange={(event) => onDeliveryAddressChange({ line1: event.target.value })} value={checkout.deliveryAddress?.line1 ?? ""} />
              </FormField></div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="font-bold text-[var(--color-title)]">Método de pago</h3>
          <FormField
            id="checkout-payment-mode"
            label="Modalidad"
            error={paymentMethodsError ?? undefined}
          >
            <Select
              disabled={paymentMethodsLoading || availablePaymentModes.length === 0}
              id="checkout-payment-mode"
              onChange={(event) =>
                onPaymentModeChange(event.target.value as CheckoutPaymentMode)
              }
              value={checkout.paymentMode}
            >
              {!availablePaymentModes.includes(checkout.paymentMode) ? (
                <option disabled value={checkout.paymentMode}>
                  {paymentMethodsLoading
                    ? "Cargando métodos..."
                    : "Método no disponible"}
                </option>
              ) : null}
              {availablePaymentModes.map((paymentMode) => (
                <option key={paymentMode} value={paymentMode}>
                  {getPaymentModeLabel(paymentMode)}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            {showCash ? (
              <PaymentSection title="Efectivo">
                {checkout.paymentMode === "mixed" ? (
                  <MoneyField
                    error={errors.cashAmount}
                    id="checkout-cash-amount"
                    label="Monto aplicado"
                    value={checkout.cashAmount}
                    onChange={(cashAmount) => onCheckoutChange({ cashAmount })}
                  />
                ) : (
                  <ReadonlyAmount label="Monto aplicado" value={checkout.cashAmount} />
                )}
                <MoneyField
                  error={errors.cashReceived}
                  id="checkout-cash-received"
                  label="Monto recibido"
                  value={checkout.cashReceived}
                  onChange={(cashReceived) => onCheckoutChange({ cashReceived })}
                />
                <ReadonlyAmount
                  error={errors.changeAmount}
                  label="Cambio"
                  value={checkout.changeAmount}
                />
              </PaymentSection>
            ) : null}

            {showCard ? (
              <PaymentSection title="Tarjeta">
                <MoneyField
                  error={errors.cardAmount}
                  id="checkout-card-amount"
                  label="Monto"
                  value={checkout.cardAmount}
                  onChange={(cardAmount) => onCheckoutChange({ cardAmount })}
                />
                <CardTerminalPanel
                  amount={checkout.cardAmount}
                  error={errors.cardTerminal}
                  result={checkout.cardTerminalResult}
                  onProcess={onProcessCardPayment}
                />
              </PaymentSection>
            ) : null}

            {showTransfer ? (
              <PaymentSection title="Transferencia">
                <MoneyField
                  error={errors.transferAmount}
                  id="checkout-transfer-amount"
                  label="Monto"
                  value={checkout.transferAmount}
                  onChange={(transferAmount) => onCheckoutChange({ transferAmount })}
                />
                <FormField
                  id="checkout-bank-account"
                  label="Banco / cuenta"
                  error={
                    errors.bankAccountId ??
                    (checkout.transferAmount > 0 ? bankAccountsError ?? undefined : undefined)
                  }
                >
                  <Select
                    disabled={bankAccountsLoading || bankAccounts.length === 0}
                    id="checkout-bank-account"
                    onChange={(event) =>
                      onCheckoutChange({ bankAccountId: event.target.value })
                    }
                    value={checkout.bankAccountId}
                  >
                    <option value="">
                      {bankAccountsLoading
                        ? "Cargando cuentas..."
                        : bankAccounts.length === 0
                          ? "Sin cuentas disponibles"
                          : "Seleccionar cuenta"}
                    </option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  id="checkout-transfer-reference"
                  label="Referencia"
                  error={errors.transferReference}
                >
                  <Input
                    id="checkout-transfer-reference"
                    maxLength={100}
                    onChange={(event) =>
                      onCheckoutChange({ transferReference: event.target.value })
                    }
                    value={checkout.transferReference}
                  />
                </FormField>
                <div>
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border)] p-3 text-sm text-[var(--color-text)]"
                    htmlFor="checkout-transfer-verified"
                  >
                    <input
                      checked={checkout.transferExternallyVerified}
                      className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                      id="checkout-transfer-verified"
                      onChange={(event) =>
                        onCheckoutChange({
                          transferExternallyVerified: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    <span>
                      He verificado externamente que la transferencia fue recibida.
                    </span>
                  </label>
                  {errors.transferExternallyVerified ? (
                    <p className="mt-1 text-xs font-medium text-[var(--color-danger)]">
                      {errors.transferExternallyVerified}
                    </p>
                  ) : null}
                </div>
              </PaymentSection>
            ) : null}
          </div>

          {checkout.paymentMode === "mixed" ? (
            <div className="grid gap-3 rounded-lg bg-[var(--color-app-background)] p-4 sm:grid-cols-2">
              <ReadonlyAmount label="Total aplicado" value={appliedAmount} />
              <ReadonlyAmount
                label={differenceAmount >= 0 ? "Restante" : "Exceso"}
                value={Math.abs(differenceAmount)}
              />
            </div>
          ) : null}

          {errors.paymentTotal ? (
            <p className="text-sm font-semibold text-[var(--color-danger)]">
              {errors.paymentTotal}
            </p>
          ) : null}
        </section>

        {validated && message ? (
          <div
            className={`rounded-lg border p-4 text-sm font-semibold ${
              hasOperationalBlock
                ? "border-[var(--color-warning)] text-[var(--color-warning)]"
                : "border-[var(--color-success)] text-[var(--color-success)]"
            }`}
          >
            {message}
            {!readyToConfirm && hasOperationalBlock ? (
              <span className="mt-1 block">Estado: no listo para confirmar.</span>
            ) : null}
          </div>
        ) : null}

        {confirmationError ? (
          <p className="rounded-lg border border-[var(--color-danger)] p-4 text-sm font-semibold text-[var(--color-danger)]">
            {confirmationError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function CashShiftStatusPanel({
  branchName,
  error,
  hasBranchAccess,
  hasOpenCashShift,
  hasSalesPermission,
  loading,
  registerCode,
}: {
  branchName: string | null;
  error: string | null;
  hasBranchAccess: boolean;
  hasOpenCashShift: boolean;
  hasSalesPermission: boolean;
  loading: boolean;
  registerCode: string | null;
}) {
  if (loading) {
    return (
      <p className="rounded-lg border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">
        Verificando turno de caja...
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-[var(--color-danger)] p-4 text-sm font-semibold text-[var(--color-danger)]">
        {error}
      </p>
    );
  }

  if (!hasBranchAccess) {
    return (
      <p className="rounded-lg border border-[var(--color-warning)] p-4 text-sm font-semibold text-[var(--color-warning)]">
        No tienes acceso a la sucursal activa.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {hasOpenCashShift ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">
          <StatusBadge status="Caja abierta" tone="success" />
          <span>
            {[branchName, registerCode ? `Caja ${registerCode}` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      ) : (
        <p className="rounded-lg border border-[var(--color-warning)] p-4 text-sm font-semibold text-[var(--color-warning)]">
          No hay un turno de caja abierto para esta sucursal.
        </p>
      )}

      {!hasSalesPermission ? (
        <p className="rounded-lg border border-[var(--color-warning)] p-4 text-sm font-semibold text-[var(--color-warning)]">
          No tienes permiso para crear ventas POS.
        </p>
      ) : null}
    </div>
  );
}

function CheckoutSummary({
  subtotal,
  discountTotal,
  total,
}: {
  subtotal: number;
  discountTotal: number;
  total: number;
}) {
  return (
    <dl className="grid gap-3 rounded-lg bg-[var(--color-app-background)] p-4 sm:grid-cols-3">
      <SummaryAmount label="Subtotal" value={subtotal} />
      <SummaryAmount label="Descuentos" value={discountTotal} />
      <SummaryAmount label="Total" value={total} prominent />
    </dl>
  );
}

function SummaryAmount({
  label,
  value,
  prominent = false,
}: {
  label: string;
  value: number;
  prominent?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={
          prominent
            ? "mt-1 text-xl font-bold text-[var(--color-title)]"
            : "mt-1 font-semibold text-[var(--color-text)]"
        }
      >
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

function PaymentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-4">
      <h4 className="font-semibold text-[var(--color-title)]">{title}</h4>
      {children}
    </div>
  );
}

function CardTerminalPanel({
  amount,
  error,
  result,
  onProcess,
}: {
  amount: number;
  error?: string;
  result: CardTerminalResultDto;
  onProcess: (outcome: CardTerminalOutcome) => void;
}) {
  const processing = result.status === "processing";
  const approved = result.status === "approved";
  const rejected = result.status === "rejected";
  const statusLabel = processing
    ? "Procesando"
    : approved
      ? "Pago aprobado"
      : rejected
        ? "Pago rechazado"
        : "Pendiente de procesamiento";
  const statusTone = approved ? "success" : rejected ? "danger" : processing ? "info" : "neutral";

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-text)]">Terminal externa</p>
        <StatusBadge status={statusLabel} tone={statusTone} />
      </div>

      {processing ? (
        <p className="text-sm text-[var(--color-text-muted)]">Procesando pago...</p>
      ) : null}
      {approved ? (
        <div className="space-y-1 text-sm text-[var(--color-text)]">
          <p className="font-semibold">✓ Pago aprobado</p>
          <p>{formatCurrency(result.authorizedAmount ?? 0)}</p>
          <p>Autorización: {result.reference}</p>
        </div>
      ) : null}
      {rejected ? (
        <p className="text-sm font-semibold text-[var(--color-danger)]">
          ✕ Pago rechazado por terminal.
        </p>
      ) : null}
      {!processing && !approved && !rejected ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          Pendiente de procesamiento.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs font-medium text-[var(--color-danger)]">{error}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          disabled={processing || amount <= 0}
          onClick={() => onProcess("approved")}
          type="button"
          variant="secondary"
        >
          {approved
            ? "Procesar nuevamente"
            : rejected
              ? "Reintentar"
              : "Procesar con terminal"}
        </Button>
        <Button
          disabled={processing || amount <= 0}
          onClick={() => onProcess("rejected")}
          type="button"
          variant="ghost"
        >
          Simular rechazo
        </Button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        OmniRetail registra únicamente el resultado y la autorización de la terminal externa.
      </p>
    </div>
  );
}

function MoneyField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  return (
    <FormField id={id} label={label} error={error}>
      <Input
        id={id}
        inputMode="decimal"
        min="0"
        onChange={(event) => onChange(readMoneyInput(event.target.value))}
        step="0.01"
        type="number"
        value={value || ""}
      />
    </FormField>
  );
}

function ReadonlyAmount({
  label,
  value,
  error,
}: {
  label: string;
  value: number;
  error?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--color-text)]">{label}</p>
      <p className="mt-1 rounded-md bg-[var(--color-app-background)] px-3 py-2 text-sm font-bold text-[var(--color-title)]">
        {formatCurrency(value)}
      </p>
      {error ? <p className="mt-1 text-xs font-medium text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

function readMoneyInput(value: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPaymentModeLabel(paymentMode: CheckoutPaymentMode) {
  if (paymentMode === "cash") return "Efectivo";
  if (paymentMode === "card") return "Tarjeta";
  if (paymentMode === "transfer") return "Transferencia";
  return "Mixto";
}
