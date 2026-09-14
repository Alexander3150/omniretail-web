import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { RoleDto, RoleInputDto } from "@/modules/administration/application/dto/RoleDto";
import { toRoleDto } from "@/modules/administration/application/mappers/RoleMapper";
import {
  ensureCanManageRoles,
  ensureRoleActor,
  ensureRoleTenant,
} from "@/modules/administration/application/services/serviceHelpers";
import {
  normalizeRoleInput,
  validateRoleInput,
} from "@/modules/administration/validation/role.validation";

export class CreateRoleService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    dto: RoleInputDto,
    permissions: readonly string[],
    actorUserId: string,
  ): Promise<RoleDto> {
    ensureCanManageRoles(permissions);
    ensureRoleTenant(tenantId);
    ensureRoleActor(actorUserId);
    const normalizedInput = normalizeRoleInput(dto);
    validateRoleInput(normalizedInput);

    // isSystem nunca viene del DTO: un rol creado desde esta pantalla nunca es un rol de plataforma.
    const role = await this.repositories.roles.create({
      tenantId,
      isSystem: false,
      ...normalizedInput,
    });
    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "role.created",
      entityType: "Role",
      entityId: role.id,
      metadata: {
        name: role.name,
        permissionCount: role.permissions.length,
        status: role.status,
      },
    });

    return toRoleDto(role);
  }
}
