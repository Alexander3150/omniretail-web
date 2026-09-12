/**
 * Resolucion canonica de permisos. Unico lugar donde se decide que
 * "<recurso>.manage" implica "<recurso>.read" del mismo recurso -- antes
 * cada modulo repetia `permissions.includes("x.read") ||
 * permissions.includes("x.manage")` a mano (ver serviceHelpers.ts de
 * administration). Agregar un permiso nuevo no requiere tocar esta
 * funcion, solo respetar la convencion de sufijos ".read" / ".manage".
 *
 * Fail-closed: un permiso no otorgado ni por match exacto ni por el
 * manage->read implicito se deniega. Un `required` que no exista en
 * permissionsConfig tambien se deniega, porque nunca puede haber sido
 * otorgado exactamente ni tener un ".manage" otorgado.
 */
export function hasPermission(granted: readonly string[], required: string): boolean {
  if (granted.includes(required)) return true;

  if (required.endsWith(".read")) {
    const managePermission = `${required.slice(0, -".read".length)}.manage`;
    return granted.includes(managePermission);
  }

  return false;
}

export class PermissionDeniedError extends Error {
  constructor(permission: string) {
    super(`No tenés permiso para realizar esta acción (${permission}).`);
    this.name = "PermissionDeniedError";
  }
}

/**
 * Helper de enforcement para Application Services. No reemplaza los
 * checks especificos ya existentes por modulo (ensureCanManageX) -- esos
 * services adoptan esta funcion en PR3/PR4 (enforcement), no en esta
 * fundacion, para no mezclar "crear la utilidad" con "migrar todo el
 * backoffice" en el mismo PR.
 */
export function requireEmployeePermission(granted: readonly string[], required: string): void {
  if (hasPermission(granted, required)) return;
  throw new PermissionDeniedError(required);
}
