/**
 * Almacen JSON en `sessionStorage` (por pestana: sobrevive a una recarga, no a cerrar la pestana).
 * Nunca lanza: si el navegador lo bloquea o el valor esta corrupto, se comporta como vacio.
 */
export class SessionJsonStore {
  get<T>(key: string): T | null {
    try {
      if (typeof window === "undefined") return null;
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        this.remove(key);
        return null;
      }
    } catch {
      return null;
    }
  }

  /** `true` si el valor quedo guardado. */
  set<T>(key: string, value: T): boolean {
    try {
      if (typeof window === "undefined") return false;
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
    } catch {
      // Sin almacenamiento disponible no hay nada que borrar.
    }
  }
}
