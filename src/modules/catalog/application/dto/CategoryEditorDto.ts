import type { Category } from "@/core/entities";
import type { CatalogImageUploadDraft } from "@/modules/catalog/application/dto/CatalogImageUploadDraft";

export interface CategoryListItem {
  id: string;
  tenantId: string;
  parentId?: string;
  parentName?: string;
  name: string;
  code: string;
  slug: string;
  description?: string;
  image?: Category["image"];
  status: Category["status"];
  productCount: number;
}

export interface CategoryEditorDto {
  name: string;
  code: string;
  description: string;
  parentId: string;
  status: Category["status"];
  image?: Category["image"];
  pendingImage?: CatalogImageUploadDraft;
  removeImage?: boolean;
}

export interface CategoryEditorOptions {
  parents: CategoryListItem[];
}
