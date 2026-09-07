"use client";

import type { CreateProductDto } from "@/modules/catalog/application/dto/CreateProductDto";

interface ProductChannelsSectionProps {
  value: CreateProductDto;
  onChange: (value: Partial<CreateProductDto>) => void;
}

export function ProductChannelsSection({ value, onChange }: ProductChannelsSectionProps) {
  return (
    <section className="space-y-4 rounded-md border border-[var(--color-border)] bg-white p-5">
      <h2 className="text-lg font-semibold text-[var(--color-title)]">Canales</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-md border border-[var(--color-border)] p-3 text-sm font-semibold text-[var(--color-text)]">
          <input
            checked={value.channels.ecommerce}
            className="h-4 w-4 accent-[var(--color-structure)]"
            onChange={(event) =>
              onChange({ channels: { ...value.channels, ecommerce: event.target.checked } })
            }
            type="checkbox"
          />
          Mostrar en E-commerce
        </label>
        <label className="flex items-center gap-3 rounded-md border border-[var(--color-border)] p-3 text-sm font-semibold text-[var(--color-text)]">
          <input
            checked={value.channels.pos}
            className="h-4 w-4 accent-[var(--color-structure)]"
            onChange={(event) =>
              onChange({ channels: { ...value.channels, pos: event.target.checked } })
            }
            type="checkbox"
          />
          Disponible en POS
        </label>
      </div>
    </section>
  );
}
