"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { ProductStatus } from "@/core/enums";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";
import { formatChannels, productTypeLabels } from "@/modules/catalog/components/productLabels";

interface ProductTableProps {
  products: ProductListItem[];
  emptyMessage: string;
  onArchive: (product: ProductListItem) => void;
}

export function ProductTable({ products, emptyMessage, onArchive }: ProductTableProps) {
  const router = useRouter();
  const columns: DataTableColumn<ProductListItem>[] = [
    {
      key: "image",
      header: "Imagen",
      cell: (product) => (
        <img
          alt={product.name}
          className="h-12 w-12 rounded-md border border-[var(--color-border)] object-cover"
          src={product.imageUrl}
        />
      ),
      className: "w-20",
    },
    { key: "sku", header: "Codigo / SKU", cell: (product) => product.sku },
    {
      key: "product",
      header: "Producto",
      cell: (product) => (
        <div>
          <p className="font-semibold text-[var(--color-title)]">{product.name}</p>
          {product.brand ? (
            <p className="text-xs text-[var(--color-text-muted)]">{product.brand}</p>
          ) : null}
        </div>
      ),
    },
    { key: "category", header: "Categoria", cell: (product) => product.categoryName },
    { key: "type", header: "Tipo", cell: (product) => productTypeLabels[product.productType] },
    { key: "price", header: "Precio", cell: (product) => formatCurrency(product.salePrice) },
    { key: "channels", header: "Canales", cell: (product) => formatChannels(product.channels) },
    { key: "status", header: "Estado", cell: (product) => <StatusBadge status={product.status} /> },
    {
      key: "actions",
      header: "Acciones",
      cell: (product) => (
        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <Button className="min-h-9 px-3 py-1.5" href={`/catalogo/productos/${product.id}`}>
            Ver
          </Button>
          <Button className="min-h-9 px-3 py-1.5" href={`/catalogo/productos/${product.id}/editar`}>
            Editar
          </Button>
          {product.status === ProductStatus.published ? (
            <Button
              className="min-h-9 px-3 py-1.5"
              onClick={() => onArchive(product)}
              type="button"
            >
              Archivar
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={products}
      emptyMessage={emptyMessage}
      onRowClick={(product) => router.push(`/catalogo/productos/${product.id}`)}
      onRowDoubleClick={(product) => router.push(`/catalogo/productos/${product.id}/editar`)}
      rowKey={(product) => product.id}
    />
  );
}
