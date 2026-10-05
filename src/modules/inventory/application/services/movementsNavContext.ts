const STORAGE_KEY = "omniretail:inventory:movements-context:v1";
const MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Contexto de navegacion Inventario -> Historial de movimientos. Reemplaza los query params
 * (UUIDs en la URL): vive solo en sessionStorage de la pestana y es UX, no autorizacion; el
 * backend sigue validando productId/branchId en cada request.
 */
export interface MovementsNavContext {
  productId: string;
  productName: string;
  productSku?: string;
  branchId?: string;
  source: "inventory";
}

interface StoredContext extends MovementsNavContext {
  savedAt: number;
}

export function saveMovementsNavContext(context: MovementsNavContext) {
  try {
    const stored: StoredContext = { ...context, savedAt: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Sin storage disponible el historial se abre sin filtro previo.
  }
}

export function readMovementsNavContext(): MovementsNavContext | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredContext>;
    if (
      typeof parsed.productId !== "string" ||
      !parsed.productId ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      productId: parsed.productId,
      productName: typeof parsed.productName === "string" ? parsed.productName : "",
      ...(typeof parsed.productSku === "string" && parsed.productSku
        ? { productSku: parsed.productSku }
        : {}),
      ...(typeof parsed.branchId === "string" && parsed.branchId
        ? { branchId: parsed.branchId }
        : {}),
      source: "inventory",
    };
  } catch {
    return null;
  }
}

export function clearMovementsNavContext() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que limpiar.
  }
}
