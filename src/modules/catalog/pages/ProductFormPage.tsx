"use client";

import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";
import { ProductForm } from "@/modules/catalog/components/ProductForm";
import { useProductDetail } from "@/modules/catalog/hooks/useProductDetail";
import { useProductFormOptions } from "@/modules/catalog/hooks/useProductFormOptions";
import { useProductMutations } from "@/modules/catalog/hooks/useProductMutations";
import type { CreateProductDto } from "@/modules/catalog/application/dto/CreateProductDto";

interface ProductFormPageProps {
  mode: "create" | "edit";
}

export function ProductFormPage({ mode }: ProductFormPageProps) {
  const params = useParams<{ id?: string }>();
  const productId = params.id ?? "";
  const router = useRouter();
  const { showToast } = useToast();
  const optionsState = useProductFormOptions();
  const detailState = useProductDetail(productId);
  const mutations = useProductMutations();
  const isEdit = mode === "edit";

  async function submit(dto: CreateProductDto) {
    try {
      const product = isEdit ? await mutations.update(productId, dto) : await mutations.create(dto);
      showToast({
        title: isEdit ? "Producto actualizado" : "Producto creado",
        tone: "success",
      });
      router.push(`/catalogo/productos/${product.id}`);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    }
  }

  if (optionsState.loading || (isEdit && detailState.loading)) {
    return (
      <p className="rounded-md border border-[var(--color-border)] bg-white p-5 text-sm text-[var(--color-text-muted)]">
        Preparando formulario...
      </p>
    );
  }

  if (!optionsState.options || optionsState.error) {
    return (
      <p className="rounded-md border border-[var(--color-danger)] bg-white p-5 text-sm font-medium text-[var(--color-danger)]">
        {optionsState.error ?? "No se pudieron cargar las opciones del formulario."}
      </p>
    );
  }

  if (isEdit && !detailState.detail) {
    return (
      <div className="space-y-4 rounded-md border border-[var(--color-border)] bg-white p-6">
        <h1 className="text-xl font-bold text-[var(--color-title)]">Producto no encontrado</h1>
        <p className="text-sm text-[var(--color-text)]">El producto solicitado no existe.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isEdit ? "Editar producto" : "Nuevo producto"}
        description="Configura la informacion comercial, canales y trazabilidad del producto."
      />
      <ProductForm
        busy={mutations.busy}
        detail={detailState.detail}
        error={mutations.error}
        mode={mode}
        onSubmit={submit}
        options={optionsState.options}
      />
    </div>
  );
}
