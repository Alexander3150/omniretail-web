import { LocationStatus } from "@/core/enums";
import type {
  LocationEditorDto,
  LocationListItem,
} from "@/modules/catalog/application/dto/LocationEditorDto";
import { TEXT_LIMITS } from "@/shared/utils/inputLimits";

export interface LocationValidationErrors {
  name?: string;
  code?: string;
  description?: string;
}

export function normalizeLocationCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function buildDefaultLocationDto(branchId = ""): LocationEditorDto {
  return {
    name: "",
    code: "",
    description: "",
    branchId,
    parentId: "",
    status: LocationStatus.active,
  };
}

export function locationToDto(location: LocationListItem): LocationEditorDto {
  return {
    name: location.name,
    code: location.code,
    description: location.description ?? "",
    branchId: location.branchId,
    parentId: location.parentId ?? "",
    status: location.status,
  };
}

export function validateLocationDto(
  dto: LocationEditorDto,
  locations: LocationListItem[],
  currentLocationId?: string,
): LocationValidationErrors {
  const errors: LocationValidationErrors = {};
  const name = dto.name.trim();
  const code = normalizeLocationCode(dto.code || dto.name);

  if (!name) errors.name = "El nombre es requerido.";
  else if (dto.name.length > TEXT_LIMITS.locationName)
    errors.name = "El nombre admite hasta 60 caracteres.";
  if (code && !/^[A-Z0-9][A-Z0-9-]*$/.test(code)) {
    errors.code = "Usa letras, numeros y guiones; debe iniciar con letra o numero.";
  }
  if (dto.code.length > TEXT_LIMITS.locationCode)
    errors.code = "El codigo admite hasta 30 caracteres.";
  if (dto.description.length > 500)
    errors.description = "La descripcion admite hasta 500 caracteres.";

  const duplicate = locations.find(
    (location) =>
      location.id !== currentLocationId &&
      location.branchId === dto.branchId &&
      (location.name.trim().toLowerCase() === name.toLowerCase() || location.code === code),
  );
  if (duplicate) {
    if (duplicate.name.trim().toLowerCase() === name.toLowerCase()) {
      errors.name = "Ya existe una ubicacion con este nombre en la sucursal.";
    }
    if (duplicate.code === code) {
      errors.code = "Ya existe una ubicacion con este codigo en la sucursal.";
    }
  }

  return errors;
}

export function hasLocationValidationErrors(errors: LocationValidationErrors) {
  return Object.values(errors).some(Boolean);
}
