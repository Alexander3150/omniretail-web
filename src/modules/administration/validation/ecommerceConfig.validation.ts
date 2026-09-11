import { DeliveryMethod, PaymentMethod } from "@/core/enums";
import type { EcommerceConfigInputDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

/**
 * Web/App tienen una política fija de pago y entrega (tarjeta + envío a domicilio): no es una
 * decisión editable desde el formulario. Se fuerza acá, sin importar lo que traiga el payload, para
 * que ningún consumidor directo pueda persistir otro método. `PaymentMethod`/`DeliveryMethod` no se
 * tocan como enums: POS sigue usando el resto de sus valores para sus propios escenarios.
 */
const FIXED_ALLOWED_PAYMENT_METHODS = [PaymentMethod.card];
const FIXED_ALLOWED_DELIVERY_METHODS = [DeliveryMethod.home_delivery];

export function validateEcommerceConfigInput(dto: EcommerceConfigInputDto) {
  if (!dto.storeName.trim()) {
    throw new AdministrationServiceError("El nombre de la tienda es obligatorio.");
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
    allowedDeliveryMethods: [...FIXED_ALLOWED_DELIVERY_METHODS],
    allowedPaymentMethods: [...FIXED_ALLOWED_PAYMENT_METHODS],
    defaultBranchId: defaultBranchId || undefined,
  };
}
