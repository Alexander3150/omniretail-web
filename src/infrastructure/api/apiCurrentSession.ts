/**
 * Forma exacta de la respuesta de `GET /api/v1/auth/me` del backend, que los Route Handlers de
 * `app/api/auth` reenvian tal cual. Nunca incluye el token.
 */
export interface ApiCurrentSession {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    type: string;
    status: string;
    tenantId: string;
    customerId: string | null;
    employeeCode: string | null;
    roleId: string | null;
    branchId: string | null;
    allowedBranchIds: string[];
  };
  role: {
    id: string;
    name: string;
    permissions: string[];
    branchScope: string;
    status: string;
  } | null;
  tenant: { id: string; name: string; slug: string };
  session: { id: string; expiresAt: string; rememberMe: boolean; activeBranchId: string | null };
}
