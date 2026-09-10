import { DeliveryMethod, PaymentMethod } from "@/core/enums";
import type { EcommerceConfigInputDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

const PAYMENT_METHODS = Object.values(PaymentMethod);
const DELIVERY_METHODS = Object.values(DeliveryMethod);

export function validateEcommerceConfigInput(dto: EcommerceConfigInputDto) {
  if (!dto.storeName.trim()) {
    throw new AdministrationServiceError("El nombre de la tienda es obligatorio.");
  }
  if (
    !Array.isArray(dto.allowedPaymentMethods) ||
    dto.allowedPaymentMethods.some((method) => !PAYMENT_METHODS.includes(method))
  ) {
    throw new AdministrationServiceError("Los métodos de pago seleccionados no son válidos.");
  }
  if (
    !Array.isArray(dto.allowedDeliveryMethods) ||
    dto.allowedDeliveryMethods.some((method) => !DELIVERY_METHODS.includes(method))
  ) {
    throw new AdministrationServiceError("Los métodos de entrega seleccionados no son válidos.");
  }
  if (dto.enabled && dto.allowedPaymentMethods.length === 0) {
    throw new AdministrationServiceError(
      "Seleccioná al menos un método de pago para habilitar la tienda.",
    );
  }
  if (dto.enabled && dto.allowedDeliveryMethods.length === 0) {
    throw new AdministrationServiceError(
      "Seleccioná al menos un método de entrega para habilitar la tienda.",
    );
  }
  if (dto.defaultBranchId !== undefined && !dto.defaultBranchId.trim()) {
    throw new AdministrationServiceError("La sucursal predeterminada no es válida.");
  }
}

export function normalizeEcommerceConfigInput(
  dto: EcommerceConfigInputDto,
): EcommerceConfigInputDto {
  const defaultBranchId = dto.defaultBranchId?.trim();

  return {
    enabled: dto.enabled,
    storeName: dto.storeName.trim(),
    requireAccountForCheckout: dto.requireAccountForCheckout,
    guestTrackingEnabled: dto.guestTrackingEnabled,
    allowedDeliveryMethods: [...new Set(dto.allowedDeliveryMethods)],
    allowedPaymentMethods: [...new Set(dto.allowedPaymentMethods)],
    defaultBranchId: defaultBranchId || undefined,
  };
}
