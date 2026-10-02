export type ProductEditorFailedSection =
  | "price"
  | "conversions"
  | "attributes"
  | "priceTiers"
  | "suppliers"
  | "inventorySettings"
  | "kitComponents"
  | "restore"
  | "canonicalReload";

const SECTION_LABELS: Record<ProductEditorFailedSection, string> = {
  price: "precio",
  conversions: "conversiones",
  attributes: "atributos",
  priceTiers: "precios por cantidad",
  suppliers: "proveedores y costos",
  inventorySettings: "configuracion de inventario",
  kitComponents: "componentes del kit",
  restore: "restauracion del kit",
  canonicalReload: "recarga canonica",
};

export class ProductEditorPartialSaveError extends Error {
  constructor(
    readonly productId: string,
    readonly coreSaved: boolean,
    readonly failedSections: ProductEditorFailedSection[],
  ) {
    const sections = failedSections.map((section) => SECTION_LABELS[section]).join(", ");
    super(
      `${coreSaved ? "El producto fue guardado" : "El producto ya existe"}, pero quedaron secciones pendientes: ${sections}. ` +
        "Revise los datos recargados e intente guardar nuevamente.",
    );
    this.name = "ProductEditorPartialSaveError";
  }
}
