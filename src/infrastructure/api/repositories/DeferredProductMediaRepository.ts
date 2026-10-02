import type { ProductMedia } from "@/core/entities";
import type { ProductMediaRepository } from "@/core/repositories";
import { BackendRequestError } from "@/infrastructure/api/backendClient";

/** Boundary neutro de Bloque 2: evita que IDs API lleguen al repository multimedia mock. */
export class DeferredProductMediaRepository implements ProductMediaRepository {
  async getByProduct(_productId: string): Promise<ProductMedia[]> {
    void _productId;
    return [];
  }

  async getPrimaryByProduct(_productId: string): Promise<ProductMedia | null> {
    void _productId;
    return null;
  }

  async getByAssetId(_tenantId: string, _assetId: string): Promise<ProductMedia[]> {
    void _tenantId;
    void _assetId;
    return [];
  }

  async add(_input: Parameters<ProductMediaRepository["add"]>[0]): Promise<ProductMedia> {
    void _input;
    throw mediaDeferredError();
  }

  async update(_media: ProductMedia): Promise<ProductMedia> {
    void _media;
    throw mediaDeferredError();
  }

  async remove(_id: string): Promise<void> {
    void _id;
    throw mediaDeferredError();
  }

  async setPrimary(_productId: string, _mediaId: string): Promise<void> {
    void _productId;
    void _mediaId;
    throw mediaDeferredError();
  }
}

function mediaDeferredError() {
  return new BackendRequestError(
    "La gestion multimedia de productos se habilitara en el Bloque 3.",
    501,
    "PRODUCT_MEDIA_DEFERRED",
  );
}
