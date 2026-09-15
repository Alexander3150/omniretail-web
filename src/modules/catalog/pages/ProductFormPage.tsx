"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
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
    return (
      <div
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
        role="alert"
      >
        <h2 className="text-base font-semibold text-[var(--color-title)]">
          No tenés acceso a {mode === "create" ? "crear productos" : "editar productos"}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Esta acción requiere el permiso{" "}
          <span className="font-medium text-[var(--color-text)]">
            {mode === "create" ? "catalog.products.create" : "catalog.products.update"}
          </span>
          . Pedí acceso a un administrador.
        </p>
      </div>
    );
  }

  if (branchLoading || optionsState.loading || editorState.loading) {
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

  if (!currentBranch) {
    return (
      <p className="rounded-md border border-[var(--color-danger)] bg-white p-5 text-sm font-medium text-[var(--color-danger)]">
        Selecciona una sucursal activa para configurar inventario del producto.
      </p>
    );
  }

  if (editorState.error) {
    return (
      <p className="rounded-md border border-[var(--color-danger)] bg-white p-5 text-sm font-medium text-[var(--color-danger)]">
        {editorState.error}
      </p>
    );
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
    </>
  );
}
