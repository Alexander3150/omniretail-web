import { CategoryStatus } from "@/core/enums";
import type { CategoryListItem, CategoryEditorDto } from "@/modules/catalog/application/dto/CategoryEditorDto";

export interface CategoryValidationErrors {
  name?: string;
  code?: string;
  parentId?: string;
}

export function normalizeCategoryCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function formatCategoryCode(value: string) {
  return value.trim().toUpperCase();
}

export function buildDefaultCategoryDto(): CategoryEditorDto {
  return {
    name: "",
    code: "",
    description: "",
    parentId: "",
    status: CategoryStatus.active,
  };
}

export function categoryToDto(category: CategoryListItem): CategoryEditorDto {
  return {
    name: category.name,
    code: formatCategoryCode(category.slug),
    description: category.description ?? "",
    parentId: category.parentId ?? "",
    status: category.status,
  };
}

export function validateCategoryDto(
  dto: CategoryEditorDto,
  categories: CategoryListItem[],
  currentCategoryId?: string,
): CategoryValidationErrors {
  const errors: CategoryValidationErrors = {};
  const name = dto.name.trim();
  const code = normalizeCategoryCode(dto.code);

  if (!name) errors.name = "El nombre es requerido.";
  if (!code) {
    errors.code = "El código interno es requerido.";
  } else if (!/^[a-z0-9][a-z0-9-]*$/.test(code)) {
    errors.code = "Usa letras, números y guiones; debe iniciar con letra o número.";
  }

  if (dto.parentId && dto.parentId === currentCategoryId) {
    errors.parentId = "Una categoría no puede ser su propia categoría padre.";
  }

  const duplicate = categories.find(
    (category) =>
      category.id !== currentCategoryId &&
      (category.name.trim().toLowerCase() === name.toLowerCase() || category.slug === code),
  );
  if (duplicate) {
    if (duplicate.name.trim().toLowerCase() === name.toLowerCase()) {
      errors.name = "Ya existe una categoría con este nombre.";
    }
    if (duplicate.slug === code) {
      errors.code = "Ya existe una categoría con este código.";
    }
  }

  return errors;
}

export function hasCategoryValidationErrors(errors: CategoryValidationErrors) {
  return Object.values(errors).some(Boolean);
}

