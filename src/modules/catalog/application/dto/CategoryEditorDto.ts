import type { Category } from "@/core/entities";

export interface CategoryListItem {
  id: string;
  tenantId: string;
  parentId?: string;
  parentName?: string;
  name: string;
  code: string;
  slug: string;
  description?: string;
  status: Category["status"];
  productCount: number;
}

export interface CategoryEditorDto {
  name: string;
  code: string;
  description: string;
  parentId: string;
  status: Category["status"];
}

export interface CategoryEditorOptions {
  parents: CategoryListItem[];
}

