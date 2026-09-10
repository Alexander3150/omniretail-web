import type {
  Product,
  PurchaseOrder,
  Supplier,
  SupplierCostTier,
  SupplierProduct,
  Unit,
} from "@/core/entities";
import { ReceiptStatus, SupplierStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  SupplierContactReadModel,
  SupplierListItemReadModel,
  SupplierProductReadModel,
  SupplierIncidentReadModel,
  SuppliersReadModel,
} from "@/modules/purchasing/application/dto/SupplierReadModel";
import { buildIncidentListItems } from "@/modules/receiving/application/services/buildIncidentListItems";

export class GetSuppliersReadModelService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(activeBranchId?: string, activeTenantId?: string): Promise<SuppliersReadModel> {
    const [
      allSuppliers,
      products,
      units,
      allPurchaseOrders,
      receipts,
      incidentTypes,
      users,
      branches,
    ] = await Promise.all([
      this.repositories.suppliers.getAll(),
      this.repositories.products.getAll(),
      this.repositories.units.getAll(),
      this.repositories.purchaseOrders.getAll(),
      this.repositories.receipts.getAll(),
      this.repositories.incidentTypes.getAll(),
      this.repositories.users.getAll(),
      this.repositories.branches.getAll(),
    ]);

    const tenantId =
      activeTenantId ?? branches.find((branch) => branch.id === activeBranchId)?.tenantId;
    const suppliers = tenantId
      ? allSuppliers.filter((supplier) => supplier.tenantId === tenantId)
      : [];
    const purchaseOrders = tenantId
      ? allPurchaseOrders.filter((order) => order.tenantId === tenantId)
      : [];
    const branchPurchaseOrders = purchaseOrders.filter(
      (order) => order.branchId === activeBranchId,
    );
    const confirmedReceipts = receipts.filter(
      (receipt) =>
        Boolean(activeBranchId && tenantId) &&
        receipt.branchId === activeBranchId &&
        receipt.tenantId === tenantId &&
        (receipt.status === ReceiptStatus.partial || receipt.status === ReceiptStatus.received),
    );
    const confirmedReceiptIds = new Set(confirmedReceipts.map((receipt) => receipt.id));
    const [receiptLines, allIncidents] = await Promise.all([
      Promise.all(
        confirmedReceipts.map((receipt) =>
          this.repositories.receipts.getLinesByReceipt(receipt.id),
        ),
      ).then((lines) => lines.flat()),
      this.repositories.receipts.getIncidents(),
    ]);
    const incidents = buildIncidentListItems({
      incidents: allIncidents.filter((incident) => confirmedReceiptIds.has(incident.receiptId)),
      receipts: confirmedReceipts,
      receiptLines,
      incidentTypes: tenantId
        ? incidentTypes.filter((incidentType) => incidentType.tenantId === tenantId)
        : [],
      products,
      purchaseOrders: branchPurchaseOrders,
      suppliers,
      branches,
      users,
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));

    const supplierItems = await Promise.all(
      suppliers.map(async (supplier) => {
        const supplierProducts = await this.repositories.supplierProducts.getBySupplier(
          supplier.id,
        );
        const productsWithCosts = await Promise.all(
          supplierProducts.map((supplierProduct) =>
            this.toSupplierProductReadModel(
              supplierProduct,
              productById,
              unitById,
              supplier.leadTimeDays,
            ),
          ),
        );
        return this.toSupplierReadModel(
          supplier,
          productsWithCosts,
          branchPurchaseOrders.filter((order) => order.supplierId === supplier.id),
          incidents.filter((incident) => incident.supplierId === supplier.id),
        );
      }),
    );

    return {
      suppliers: supplierItems.sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  private async toSupplierProductReadModel(
    supplierProduct: SupplierProduct,
    productById: Map<string, Product>,
    unitById: Map<string, Unit>,
    supplierLeadTimeDays?: number,
  ): Promise<SupplierProductReadModel> {
    const product = productById.get(supplierProduct.productId);
    const unit = unitById.get(supplierProduct.purchaseUnitId);
    const costTiers = await this.repositories.supplierProducts.getCostTiers(supplierProduct.id);

    return {
      id: supplierProduct.id,
      productName: product?.name ?? "Producto no disponible",
      productSku: product?.sku ?? supplierProduct.productId,
      supplierSku: supplierProduct.supplierSku,
      purchaseUnitLabel: unit?.symbol ?? unit?.name ?? supplierProduct.purchaseUnitId,
      minimumOrderQuantity: supplierProduct.minimumOrderQuantity,
      lastCost: supplierProduct.lastCost,
      leadTimeDays: supplierLeadTimeDays ?? supplierProduct.leadTimeDays,
      preferred: supplierProduct.preferred,
      active: supplierProduct.active,
      costTiers: this.sortCostTiers(costTiers),
    };
  }

  private toSupplierReadModel(
    supplier: Supplier,
    products: SupplierProductReadModel[],
    purchaseOrders: PurchaseOrder[],
    incidents: SupplierIncidentReadModel[],
  ): SupplierListItemReadModel {
    const contacts = this.getContacts(supplier);
    const deliveryLabel =
      typeof supplier.leadTimeDays === "number" ? `${supplier.leadTimeDays} dias` : "Sin plazo";
    const purchaseOrderItems = purchaseOrders
      .map((order) => ({
        id: order.id,
        number: order.number,
        createdAt: order.createdAt,
        expectedDate: order.expectedDate,
        total: order.total,
        status: order.status,
      }))
      .sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );

    return {
      id: supplier.id,
      name: supplier.name,
      legalName: supplier.legalName,
      taxId: supplier.taxId,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      notes: supplier.notes,
      status: supplier.status,
      archived: supplier.status === SupplierStatus.archived,
      paymentConditionLabel: "No definido",
      creditDaysLabel: "No definido",
      currencyLabel: "No definido",
      deliveryLabel,
      searchText: [
        supplier.name,
        supplier.legalName,
        supplier.taxId,
        supplier.email,
        supplier.phone,
        supplier.address,
        ...contacts.flatMap((contact) => [
          contact.name,
          contact.role,
          contact.phone,
          contact.email,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      contacts,
      products,
      purchaseOrders: purchaseOrderItems,
      incidents,
    };
  }

  private getContacts(supplier: Supplier): SupplierContactReadModel[] {
    if (!supplier.email && !supplier.phone) return [];
    return [
      {
        id: `${supplier.id}-main-contact`,
        name: supplier.name,
        role: "Contacto principal",
        phone: supplier.phone,
        email: supplier.email,
        primary: true,
      },
    ];
  }

  private sortCostTiers(costTiers: SupplierCostTier[]) {
    return [...costTiers]
      .map((tier) => ({
        id: tier.id,
        minQuantity: tier.minQuantity,
        unitCost: tier.unitCost,
      }))
      .sort((left, right) => left.minQuantity - right.minQuantity);
  }
}
