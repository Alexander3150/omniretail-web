"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { useToast } from "@/shared/components/Toast";
import { ProductForm } from "@/modules/catalog/components/ProductForm";
import type { ProductEditorDto } from "@/modules/catalog/application/dto/ProductEditorDto";
import { useProductEditorData } from "@/modules/catalog/hooks/useProductEditorData";
import { useProductFormOptions } from "@/modules/catalog/hooks/useProductFormOptions";
import { useProductMutations } from "@/modules/catalog/hooks/useProductMutations";

interface ProductFormPageProps {
  mode: "create" | "edit";
}

export function ProductFormPage({ mode }: ProductFormPageProps) {
  const params = useParams<{ id?: string }>();
  const productId = params.id ?? "";
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = mode === "edit";
  const optionsState = useProductFormOptions();
  const editorState = useProductEditorData(isEdit ? productId : undefined);
  const mutations = useProductMutations();
  const [confirmArchive, setConfirmArchive] = useState(false);

  async function submit(dto: ProductEditorDto) {
    try {
      const product = isEdit
        ? await mutations.updateWithCommercialData(productId, dto)
        : await mutations.createWithCommercialData(dto);
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

  if (optionsState.loading || editorState.loading) {
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
