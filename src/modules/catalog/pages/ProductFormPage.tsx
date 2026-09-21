"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { Product } from "@/core/entities";
import { ProductType } from "@/core/enums";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { AccessDeniedState } from "@/shared/components/AccessDeniedState";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { PageErrorState } from "@/shared/components/PageErrorState";
import { useToast } from "@/shared/components/Toast";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import { ProductForm } from "@/modules/catalog/components/ProductForm";
import type { ProductEditorDto } from "@/modules/catalog/application/dto/ProductEditorDto";
import { useProductEditorData } from "@/modules/catalog/hooks/useProductEditorData";
import { useProductFormOptions } from "@/modules/catalog/hooks/useProductFormOptions";
import { useProductMutations } from "@/modules/catalog/hooks/useProductMutations";
import { useProductPermissions } from "@/modules/catalog/hooks/useProductPermissions";

interface ProductFormPageProps {
  mode: "create" | "edit";
}

export function ProductFormPage({ mode }: ProductFormPageProps) {
  const params = useParams<{ id?: string }>();
  const productId = params.id ?? "";
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = mode === "edit";
  const { canCreate, canUpdate } = useProductPermissions();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const optionsState = useProductFormOptions();
  const editorState = useProductEditorData(
    isEdit ? productId : undefined,
    currentBranch?.id,
    currentBranch?.tenantId,
  );
  const mutations = useProductMutations();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [createdZeroStockProduct, setCreatedZeroStockProduct] = useState<Product | null>(null);

  async function submit(dto: ProductEditorDto) {
    try {
      const dtoWithActiveBranch = {
        ...dto,
        inventorySettings: {
          ...dto.inventorySettings,
          branchId: currentBranch?.id ?? dto.inventorySettings.branchId,
        },
      };
      const product = isEdit
        ? await mutations.updateWithCommercialData(productId, dtoWithActiveBranch)
        : await mutations.createWithCommercialData(dtoWithActiveBranch);
      showToast({
        title: isEdit ? "Producto actualizado" : "Producto creado",
        description: !isEdit && product.productType === ProductType.physical && product.tracking.stock
          ? "Actualmente no tiene existencia."
          : undefined,
        tone: "success",
      });
      if (!isEdit && product.productType === ProductType.physical && product.tracking.stock) {
        setCreatedZeroStockProduct(product);
        return;
      }
      router.push(`/catalogo/productos/${product.id}`);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    }
  }

  async function archiveProduct() {
    if (!editorState.data?.detail) return;
    try {
      await mutations.archive(editorState.data.detail.product.id);
      showToast({ title: "Producto archivado", tone: "success" });
      setConfirmArchive(false);
      router.push(`/catalogo/productos/${editorState.data.detail.product.id}`);
    } catch (caughtError) {
      showToast({
        title: "No se pudo archivar",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    }
  }

  // permission-enforcement-hardening-products (§5/§6 del ticket): RequirePermission solo valida
  // el nav a nivel de sub-árbol (/catalogo/productos/*), no distingue crear de editar -- sin este
  // guard, un usuario con SOLO catalog.products.read llegaría a un formulario editable con solo
  // esconder el botón "Nuevo producto"/"Editar" en las pantallas anteriores. No alcanza con
  // ocultar el botón: la ruta en sí debe denegar.
  if ((mode === "create" && !canCreate) || (mode === "edit" && !canUpdate)) {
    return <AccessDeniedState />;
  }

  if (branchLoading || optionsState.loading || editorState.loading) {
    return (
      <p className="rounded-md border border-[var(--color-border)] bg-white p-5 text-sm text-[var(--color-text-muted)]">
        Preparando formulario...
      </p>
    );
  }

  if (!optionsState.options || optionsState.error) {
    return <PageErrorState description={optionsState.error ?? "No se pudieron cargar las opciones del formulario."} />;
  }

  if (!currentBranch) {
    return <InlineAlert description="Seleccione una sucursal activa para configurar el inventario del producto." title="Sucursal activa requerida" tone="warning" />;
  }

  if (editorState.error) {
    return <PageErrorState description={editorState.error} />;
  }

  if (!editorState.data || (isEdit && !editorState.data.detail)) {
    return (
      <div className="space-y-4 rounded-md border border-[var(--color-border)] bg-white p-6">
        <h1 className="text-xl font-bold text-[var(--color-title)]">Producto no encontrado</h1>
        <p className="text-sm text-[var(--color-text)]">El producto solicitado no existe.</p>
      </div>
    );
  }

  return (
    <>
      <ProductForm
        busy={mutations.busy}
        editorData={editorState.data}
        error={mutations.error}
        key={`${mode}-${productId || "new"}-${currentBranch.id}`}
        mode={mode}
        onArchive={() => setConfirmArchive(true)}
        onSubmit={submit}
        options={optionsState.options}
      />
      <ConfirmDialog
        open={confirmArchive}
        title="Archivar producto"
        message="El producto dejara de estar disponible para nuevas operaciones, pero se conservara su historial."
        confirmLabel="Archivar"
        onCancel={() => setConfirmArchive(false)}
        onConfirm={archiveProduct}
      />
      <ConfirmDialog
        open={Boolean(createdZeroStockProduct)}
        title="Producto creado. Actualmente no tiene existencia."
        message={`La existencia pertenece a la sucursal activa (${currentBranch.name}). Registra el inventario inicial con el flujo de ajuste para mantener sus validaciones de lote, serie y vencimiento.`}
        confirmLabel="Agregar existencia inicial"
        onCancel={() => {
          if (createdZeroStockProduct) router.push(`/catalogo/productos/${createdZeroStockProduct.id}`);
          setCreatedZeroStockProduct(null);
        }}
        onConfirm={() => {
          if (createdZeroStockProduct) {
            router.push(`/inventario/alertas?productId=${encodeURIComponent(createdZeroStockProduct.id)}&openAdjustment=1`);
          }
          setCreatedZeroStockProduct(null);
        }}
      />
    </>
  );
}
