import type { PermissionDefinition } from "@/shared/types/permissions.types";

export const authPermissions = [
  {
    key: "auth.profile.read",
    module: "auth",
    name: "Leer perfil",
    description: "Permite consultar el perfil propio.",
  },
  {
    key: "auth.profile.update",
    module: "auth",
    name: "Actualizar perfil",
    description: "Permite actualizar el perfil propio.",
  },
] satisfies PermissionDefinition[];
