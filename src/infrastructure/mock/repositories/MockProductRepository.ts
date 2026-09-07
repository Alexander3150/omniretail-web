import { ProductStatus } from "@/core/enums";
import type { ProductRepository } from "@/core/repositories";
import { normalizeSku } from "@/shared/utils/normalizeSku";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockProductRepository extends BaseMockRepository implements ProductRepository {
  async getAll() {
    return this.read((db) => db.products);
  }
  async getById(id: string) {
    return this.read((db) => db.products.find((item) => item.id === id) ?? null);
  }
  async getBySku(sku: string) {
    const normalizedSku = normalizeSku(sku);
    return this.read((db) => db.products.find((item) => item.sku === normalizedSku) ?? null);
  }
  async getPublishedForEcommerce() {
    return this.read((db) =>
      db.products.filter(
        (item) => item.status === ProductStatus.published && item.channels.ecommerce,
      ),
    );
  }
  async getAvailableForPos() {
    return this.read((db) =>
      db.products.filter((item) => item.status === ProductStatus.published && item.channels.pos),
    );
  }
  async create(input: Parameters<ProductRepository["create"]>[0]) {
    const product = this.store.mutate((db) => {
      const now = this.now();
      const created = {
        ...input,
        sku: normalizeSku(input.sku),
        id: this.id("product"),
        createdAt: now,
        updatedAt: now,
      };
      db.products.push(created);
      return created;
    });
    this.emit("product.changed", {
      entityId: product.id,
      tenantId: product.tenantId,
      productId: product.id,
      action: "created",
    });
    return product;
  }
  async update(id: string, input: Parameters<ProductRepository["update"]>[1]) {
    const product = this.store.mutate((db) =>
      this.updateById(
        db.products,
        id,
        input.sku ? { ...input, sku: normalizeSku(input.sku) } : input,
        "Product",
      ),
    );
    this.emit("product.changed", {
      entityId: product.id,
      tenantId: product.tenantId,
      productId: product.id,
      action: "updated",
    });
    return product;
  }
  async archive(id: string) {
    const product = this.store.mutate((db) =>
      this.updateById(db.products, id, { status: ProductStatus.archived }, "Product"),
    );
    this.emit("product.changed", {
      entityId: product.id,
      tenantId: product.tenantId,
      productId: product.id,
      action: "archived",
    });
    return product;
  }
}
