import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { ReportsDataDto } from "@/modules/administration/application/dto/ReportDto";
import {
  toMovementReportRow,
  toPaymentReportRow,
  toPurchasesReportRow,
  toSalesReportRow,
} from "@/modules/administration/application/mappers/ReportMappers";
import {
  ensureCanReadReports,
  ensureReportsTenant,
} from "@/modules/administration/application/services/serviceHelpers";

export class GetReportsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, permissions: readonly string[]): Promise<ReportsDataDto> {
    ensureCanReadReports(permissions);
    ensureReportsTenant(tenantId);

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
}

function byNewestFirst(left: { createdAt: string }, right: { createdAt: string }) {
  return right.createdAt.localeCompare(left.createdAt);
}
