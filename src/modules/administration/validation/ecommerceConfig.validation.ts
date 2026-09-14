import { ecommercePaymentPolicy } from "@/config/ecommerce-payment-policy";
import { DeliveryMethod } from "@/core/enums";
import type { EcommerceConfigInputDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

/**
 * Web/App tienen una política fija de pago y entrega (tarjeta + envío a domicilio): no es una
 * decisión editable desde el formulario. Se fuerza acá, sin importar lo que traiga el payload, para
 * que ningún consumidor directo pueda persistir otro método. `PaymentMethod`/`DeliveryMethod` no se
 * tocan como enums: POS sigue usando el resto de sus valores para sus propios escenarios.
 */
const FIXED_ALLOWED_DELIVERY_METHODS = [DeliveryMethod.home_delivery];
const MAX_STORE_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const PHONE_PATTERN = /^[+0-9() .-]{7,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEcommerceConfigInput(dto: EcommerceConfigInputDto) {
  if (!dto.storeName.trim()) {
    throw new AdministrationServiceError("El nombre de la tienda es obligatorio.");
  }
  if (dto.storeName.trim().length > MAX_STORE_NAME_LENGTH) {
    throw new AdministrationServiceError("El nombre de la tienda no puede exceder 120 caracteres.");
  }
  const contactEmail = dto.contactEmail?.trim();
  if (
    contactEmail &&
    (contactEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(contactEmail))
  ) {
    throw new AdministrationServiceError("El correo publico de contacto no es valido.");
  }
  const contactPhone = dto.contactPhone?.trim();
  if (contactPhone && !PHONE_PATTERN.test(contactPhone)) {
    throw new AdministrationServiceError(
      "El telefono publico debe tener entre 7 y 32 caracteres validos.",
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
    contactPhone: dto.contactPhone?.trim() || undefined,
    contactEmail: dto.contactEmail?.trim().toLowerCase() || undefined,
    requireAccountForCheckout: dto.requireAccountForCheckout,
    guestTrackingEnabled: dto.guestTrackingEnabled,
    allowedDeliveryMethods: [...FIXED_ALLOWED_DELIVERY_METHODS],
    allowedPaymentMethods: [...ecommercePaymentPolicy.allowedMethods],
    defaultBranchId: defaultBranchId || undefined,
  };
}
