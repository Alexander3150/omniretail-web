import { UserStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { ReportsDataDto } from "@/modules/administration/application/dto/ReportDto";
import {
  toMovementReportRow,
  toPaymentReportRow,
  toPurchasesReportRow,
  toSalesReportRow,
} from "@/modules/administration/application/mappers/ReportMappers";
import {
  AdministrationServiceError,
  ensureCanExportReports,
  ensureCanReadReports,
} from "@/modules/administration/application/services/serviceHelpers";

export class GetReportsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(): Promise<ReportsDataDto> {
    const { tenantId, permissions } = await this.resolveAuthenticatedContext();
    ensureCanReadReports(permissions);

    const [sales, purchases, movements, payments, branches, suppliers, products] =
      await Promise.all([
        this.repositories.sales.getAll(),
        this.repositories.purchaseOrders.getAll(),
        this.repositories.inventory.getMovements(),
        this.repositories.payments.getAll(),
        this.repositories.branches.getAll(),
        this.repositories.suppliers.getAll(),
        this.repositories.products.getAll(),
      ]);
    const branchNames = new Map(
      branches
        .filter((branch) => branch.tenantId === tenantId)
        .map((branch) => [branch.id, branch.name]),
    );
    const supplierNames = new Map(
      suppliers
        .filter((supplier) => supplier.tenantId === tenantId)
        .map((supplier) => [supplier.id, supplier.name]),
    );
    const productNames = new Map(
      products
        .filter((product) => product.tenantId === tenantId)
        .map((product) => [product.id, product.name]),
    );

    return {
      tenantId,
      sales: sales
        .filter((sale) => sale.tenantId === tenantId)
        .sort(byNewestFirst)
        .map((sale) => toSalesReportRow(sale, branchNames)),
      purchases: purchases
        .filter((purchase) => purchase.tenantId === tenantId)
        .sort(byNewestFirst)
        .map((purchase) => toPurchasesReportRow(purchase, branchNames, supplierNames)),
      movements: movements
        .filter((movement) => movement.tenantId === tenantId)
        .sort(byNewestFirst)
        .map((movement) => toMovementReportRow(movement, branchNames, productNames)),
      payments: payments
        .filter((payment) => payment.tenantId === tenantId)
        .sort(byNewestFirst)
        .map(toPaymentReportRow),
    };
  }

  async authorizeExport(): Promise<string> {
    const { tenantId, permissions } = await this.resolveAuthenticatedContext();
    ensureCanExportReports(permissions);
    return tenantId;
  }

  private async resolveAuthenticatedContext() {
    const sessionId = await this.repositories.auth.getCurrentSessionId();
    if (!sessionId) {
      throw new AdministrationServiceError("No se pudo resolver la sesión actual.");
    }

    const session = await this.repositories.auth.getSession(sessionId);
    if (!session) {
      throw new AdministrationServiceError("No se pudo resolver la sesión actual.");
    }

    const actor = await this.repositories.users.getById(session.userId);
    if (!actor || actor.status !== UserStatus.active || !actor.tenantId.trim()) {
      throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
    }

    const role = actor.roleId ? await this.repositories.roles.getById(actor.roleId) : null;
    if (!role || role.tenantId !== actor.tenantId) {
      throw new AdministrationServiceError("No se pudo resolver el rol del usuario actual.");
    }

    return { tenantId: actor.tenantId, permissions: role.permissions };
  }
}

function byNewestFirst(left: { createdAt: string }, right: { createdAt: string }) {
  return right.createdAt.localeCompare(left.createdAt);
}
