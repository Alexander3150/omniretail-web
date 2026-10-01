import type { Branch } from "@/core/entities";
import type { BranchType } from "@/core/enums";
import type { BranchRepository } from "@/core/repositories";
import type { PaginatedResult } from "@/core/types";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { type ApiBranch, toBranch, toBranchRequest } from "@/infrastructure/api/apiBranchMapper";
import { BackendRequestError, backendFetch } from "@/infrastructure/api/backendClient";

const BASE_PATH = "/administration/branches";
/** Tamaño de pagina al recorrer el listado completo. */
const PAGE_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * BranchRepository de modo api contra `/api/backend/administration/branches`. El backend resuelve
 * la tienda desde el JWT, asi que los metodos `*ByTenant`/`*Scoped` solo filtran el resultado por
 * `tenantId` para respetar el contrato: nunca se envia el tenantId al backend.
 *
 * Los errores del backend (VALIDATION_ERROR, LIMIT_REACHED, BRANCH_CODE_EXISTS...) se propagan como
 * `BackendRequestError` con el mensaje descriptivo del ApiError.
 */
export class ApiBranchRepository implements BranchRepository {
  constructor(private readonly eventBus: DataEventBus) {}

  async getAll(): Promise<Branch[]> {
    const branches: Branch[] = [];
    for (let page = 1; ; page++) {
      const result = await backendFetch<PaginatedResult<ApiBranch>>(BASE_PATH, {
        query: { page, size: PAGE_SIZE },
      });
      branches.push(...result.items.map(toBranch));
      if (page >= result.totalPages) return branches;
    }
  }

  async getById(id: string): Promise<Branch | null> {
    // Los ids del backend son UUID; cualquier otro (p. ej. un id del mock) no puede existir alli.
    if (!UUID_PATTERN.test(id)) return null;
    try {
      return toBranch(await backendFetch<ApiBranch>(`${BASE_PATH}/${id}`));
    } catch (error) {
      if (error instanceof BackendRequestError && error.status === 404) return null;
      throw error;
    }
  }

  async getByIdScoped(tenantId: string, id: string): Promise<Branch | null> {
    const branch = await this.getById(id);
    return branch?.tenantId === tenantId ? branch : null;
  }

  async getActive(): Promise<Branch[]> {
    const branches = await backendFetch<ApiBranch[]>(`${BASE_PATH}/active`);
    return branches.map(toBranch);
  }

  async getActiveByTenant(tenantId: string): Promise<Branch[]> {
    return (await this.getActive()).filter((branch) => branch.tenantId === tenantId);
  }

  async listByTenant(tenantId: string): Promise<Branch[]> {
    return (await this.getAll()).filter((branch) => branch.tenantId === tenantId);
  }

  async getActiveByTenantAndType(tenantId: string, type: BranchType): Promise<Branch[]> {
    return (await this.getActiveByTenant(tenantId)).filter((branch) => branch.type === type);
  }

  async create(input: Omit<Branch, "id" | "createdAt" | "updatedAt">): Promise<Branch> {
    const created = toBranch(
      await backendFetch<ApiBranch>(BASE_PATH, { method: "POST", body: toBranchRequest(input) }),
    );
    this.eventBus.emit("branch.changed", {
      entityId: created.id,
      tenantId: created.tenantId,
      action: "created",
    });
    return created;
  }

  async update(
    id: string,
    input: Partial<Omit<Branch, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Branch> {
    const current = await this.getById(id);
    if (!current) throw new Error("Sucursal no encontrada.");
    const updated = toBranch(
      await backendFetch<ApiBranch>(`${BASE_PATH}/${id}`, {
        method: "PUT",
        body: toBranchRequest({ ...current, ...input, status: input.status ?? current.status }),
      }),
    );
    this.eventBus.emit("branch.changed", {
      entityId: updated.id,
      tenantId: updated.tenantId,
      action: "updated",
    });
    return updated;
  }
}
