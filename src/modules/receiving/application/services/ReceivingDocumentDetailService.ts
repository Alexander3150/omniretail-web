import type {
  BusinessCapabilitiesConfig,
  InventoryTransferItem,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Receipt,
  ReceiptIncident,
  ReceiptLine,
  StorageLocation,
  Unit,
  User,
} from "@/core/entities";
import {
  InventoryTransferStatus,
  LocationStatus,
  PurchaseOrderStatus,
  ReceiptLineStatus,
  ReceiptStatus,
} from "@/core/enums";
import {
  EXPIRATION_BEFORE_ENTRY_MESSAGE,
  getLocalCalendarDate,
  isExpirationBeforeOperationDate,
} from "@/core/inventory/expirationDate";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  ConfirmReceivingInput,
  ReceivingCapabilityFlags,
  ReceivingDocumentDetail,
  ReceivingDocumentDetailType,
  ReceivingDocumentIncident,
  ReceivingDocumentLine,
  SaveReceivingProgressInput,
} from "@/modules/receiving/application/dto/ReceivingDocumentDetailDto";
import {
  ensureCanConfirmReceiving,
  ensureCanReadReceiving,
  ensureCanSaveReceivingProgress,
  ensureTenantCanUseReceiving,
  ensureUserCanOperateBranch,
  ReceivingServiceError,
  resolveReceivingContext,
} from "@/modules/receiving/application/services/serviceHelpers";
import type { TenantEntitlementsDto } from "@/shared/application/dto/EntitlementDto";
import { ResolveTenantEntitlementsService } from "@/shared/application/services/ResolveTenantEntitlementsService";
import { isEffectiveBusinessCapabilityEnabled } from "@/shared/application/services/businessCapabilityEntitlement";
import { isQuantityCompatibleWithUnit, toFiniteNumber } from "@/shared/utils/numberInput";
import {
  MAX_SAFE_INVENTORY_QUANTITY,
  QUANTITY_DECIMAL_PLACES,
  TEXT_LIMITS,
} from "@/shared/utils/inputLimits";

export class ReceivingDocumentDetailService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async getDocument(
    documentType: ReceivingDocumentDetailType,
    documentId: string,
    activeBranchId?: string,
  ): Promise<ReceivingDocumentDetail> {
    const { tenantId, user, permissions } = await resolveReceivingContext(this.repositories);
    ensureCanReadReceiving(permissions);
    if (documentType === "purchase_order") {
      return this.getPurchaseOrderDocument(tenantId, user, documentId, activeBranchId);
    }
    return this.getTransferDocument(tenantId, user, documentId, activeBranchId);
  }

  async saveProgress(input: SaveReceivingProgressInput): Promise<Receipt> {
    if (input.documentType !== "purchase_order") {
      throw new ReceivingServiceError(
        "La recepcion de traslados aun no esta soportada por el contrato Receipt.",
      );
    }
    const { tenantId, actorUserId, user, permissions } = await resolveReceivingContext(
      this.repositories,
    );
    ensureCanSaveReceivingProgress(permissions);
    await ensureTenantCanUseReceiving(this.repositories, tenantId);
    const order = await this.requirePurchaseOrder(tenantId, user, input.documentId);
    const detail = await this.getPurchaseOrderDocument(tenantId, user, input.documentId);
    const validationErrors = validateIncidentQuantities(input.lines, input.incidents, detail);
    if (validationErrors.length > 0) throw new ReceivingServiceError(validationErrors[0]);
    const receipt = await this.ensureInProgressReceipt(order, actorUserId);
    await this.persistDraft(receipt, input, detail, actorUserId);
    return this.repositories.receipts.update(receipt.id, { status: ReceiptStatus.in_progress });
  }

  async confirm(input: ConfirmReceivingInput): Promise<Receipt> {
    if (input.documentType !== "purchase_order") {
      throw new ReceivingServiceError(
        "La recepcion de traslados aun no esta soportada por el contrato Receipt.",
      );
    }
    const { tenantId, actorUserId, user, permissions } = await resolveReceivingContext(
      this.repositories,
    );
    ensureCanConfirmReceiving(permissions);
    await ensureTenantCanUseReceiving(this.repositories, tenantId);
    const order = await this.requirePurchaseOrder(tenantId, user, input.documentId);
    const confirmationId = input.confirmationId.trim();
    if (!confirmationId) {
      throw new ReceivingServiceError("La confirmacion de recepcion requiere una identidad.");
    }
    const confirmationFingerprint = getReceivingConfirmationFingerprint(input, order);
    const existingConfirmation = await this.repositories.receipts.getByConfirmationId(
      order.tenantId,
      confirmationId,
    );
    if (existingConfirmation) {
      if (existingConfirmation.confirmationFingerprint !== confirmationFingerprint) {
        throw new ReceivingServiceError(
          `La confirmacion ${confirmationId} ya fue usada con datos distintos.`,
        );
      }
      return existingConfirmation;
    }
    const detail = await this.getPurchaseOrderDocument(tenantId, user, input.documentId);
    const now = new Date().toISOString();
    const operationDate = getLocalCalendarDate();
    const validationErrors = validateLines(input.lines, input.incidents, detail, operationDate);
    if (validationErrors.length > 0) {
      throw new ReceivingServiceError(validationErrors[0]);
    }
    const receipt = await this.ensureInProgressReceipt(order, actorUserId);
    const receiptLines = input.lines.map((line) => toReceiptLineInput(line, input.incidents));
    const receiptIncidents = toReceiptIncidentInputs(input, detail, actorUserId);

    return this.repositories.receipts.confirmReceiptInventory({
      receiptId: receipt.id,
      tenantId: order.tenantId,
      confirmationId,
      confirmationFingerprint,
      receivedByUserId: actorUserId,
      receivedAt: now,
      notes: buildReceiptNotes(receiptLines),
      lines: receiptLines,
      incidents: receiptIncidents,
    });
  }

  private async persistDraft(
    receipt: Receipt,
    input: SaveReceivingProgressInput,
    detail: ReceivingDocumentDetail,
    actorUserId: string,
  ) {
    const savedLines = await this.repositories.receipts.replaceLines(
      receipt.id,
      input.lines.map((line) => toReceiptLineInput(line, input.incidents)),
    );
    const lineByProductId = new Map(savedLines.map((line) => [line.productId, line]));
    const validProductIds = new Set(detail.lines.map((line) => line.productId));
    await this.repositories.receipts.replaceIncidents(
      receipt.id,
      input.incidents
        .filter(
          (incident) =>
            incident.editable && incident.productId && validProductIds.has(incident.productId),
        )
        .map((incident) => {
          const receiptLine = lineByProductId.get(incident.productId!);
          return {
            ...(!incident.id.startsWith("draft-") ? { id: incident.id } : {}),
            ...(incident.createdAt ? { createdAt: incident.createdAt } : {}),
            ...(receiptLine ? { receiptLineId: receiptLine.id } : {}),
            incidentTypeId: incident.incidentTypeId,
            description: incident.description.trim(),
            quantityAffected: incident.quantityAffected,
            evidence: incident.evidence,
            // Un incidente NUEVO (id "draft-...") solo tiene un placeholder de UI en
            // createdByUserId (nunca la identidad real, que solo la sesion conoce) -- se
            // ignora y se usa siempre el actor resuelto server-side. Uno YA persistido
            // conserva su atribucion original.
            createdByUserId: incident.id.startsWith("draft-")
              ? actorUserId
              : incident.createdByUserId || actorUserId,
          };
        }),
    );
    return savedLines;
  }

  private async getPurchaseOrderDocument(
    tenantId: string,
    user: User,
    documentId: string,
    activeBranchId?: string,
  ): Promise<ReceivingDocumentDetail> {
    const order = await this.requirePurchaseOrder(tenantId, user, documentId);
    // Filtro de VISTA opcional (no de seguridad): si el hook pasa una sucursal activa distinta
    // a la del documento, se rechaza para no mostrar un documento de otra sucursal dentro de un
    // contexto ya filtrado -- la autorizacion real (User.allowedBranchIds) ya ocurrio arriba, en
    // requirePurchaseOrder.
    if (activeBranchId && order.branchId !== activeBranchId) {
      throw new ReceivingServiceError("El documento no pertenece a la sucursal activa.");
    }
    const [suppliers, branches, products, units, locations, receipts, incidentTypes, users] =
      await Promise.all([
        this.repositories.suppliers.getAll(),
        this.repositories.branches.getAll(),
        this.repositories.products.getAll(),
        this.repositories.units.getAll(),
        this.repositories.inventory.getLocations(order.branchId),
        this.repositories.receipts.listByTenant(tenantId),
        this.repositories.incidentTypes.getAll(),
        this.repositories.users.getAll(),
      ]);
    const branch = branches.find((item) => item.id === order.branchId);
    const [capabilities, entitlements] = await Promise.all([
      this.getCapabilities(order.tenantId),
      new ResolveTenantEntitlementsService(this.repositories).execute(order.tenantId),
    ]);
    const orderReceipts = receipts.filter(
      (receipt) =>
        receipt.purchaseOrderId === order.id &&
        receipt.branchId === order.branchId &&
        receipt.status !== ReceiptStatus.cancelled,
    );
    const receiptLines = (
      await Promise.all(
        orderReceipts.map((receipt) => this.repositories.receipts.getLinesByReceipt(receipt.id)),
      )
    ).flat();
    const incidents = await this.repositories.receipts.getIncidents();
    const settings = await this.getInventorySettings(order);
    const productById = new Map(products.map((product) => [product.id, product]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const lineByReceiptLineId = new Map(receiptLines.map((line) => [line.id, line]));
    const receiptById = new Map(orderReceipts.map((receipt) => [receipt.id, receipt]));
    const userNameById = new Map(users.map((user) => [user.id, user.name]));
    const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
    const inProgressReceipt = orderReceipts.find(
      (receipt) => receipt.status === ReceiptStatus.in_progress,
    );
    const inProgressLines = receiptLines.filter((line) => line.receiptId === inProgressReceipt?.id);
    const confirmedReceipts = orderReceipts.filter(
      (receipt) =>
        receipt.status === ReceiptStatus.partial || receipt.status === ReceiptStatus.received,
    );
    const confirmedLines = receiptLines.filter((line) =>
      confirmedReceipts.some(
        (receipt) =>
          receipt.id === line.receiptId &&
          (receipt.status === ReceiptStatus.partial || receipt.status === ReceiptStatus.received),
      ),
    );

    return {
      document: {
        id: order.id,
        type: "purchase_order",
        number: order.number,
        typeLabel: "Orden de compra",
        originLabel: "Proveedor",
        originName:
          suppliers.find((supplier) => supplier.id === order.supplierId)?.name ??
          "Proveedor no disponible",
        branchId: order.branchId,
        branchName: branch?.name ?? "Sucursal destino",
        tenantId: order.tenantId,
        ...(order.expectedDate ? { expectedDate: order.expectedDate } : {}),
        statusLabel: getPurchaseOrderStatusLabel(order.status),
        ...(inProgressReceipt
          ? { receiptId: inProgressReceipt.id, receiptNumber: inProgressReceipt.number }
          : {}),
      },
      lines: await Promise.all(
        (order.items ?? []).map((item) =>
          this.toPurchaseOrderDetailLine({
            item,
            product: productById.get(item.productId),
            unit: unitById.get(item.unitId),
            baseUnitById: unitById,
            inProgressLine: inProgressLines.find((line) => line.productId === item.productId),
            confirmedLines: confirmedLines.filter((line) => line.productId === item.productId),
            settingsDefaultLocationId: settings.get(item.productId)?.defaultLocationId ?? undefined,
          }),
        ),
      ),
      locations: toLocationOptions(locations, capabilities),
      incidentTypes: incidentTypes
        .filter((type) => type.tenantId === order.tenantId && type.active)
        .map((type) => ({ id: type.id, name: type.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      incidents: toIncidentRows(
        incidents.filter((incident) =>
          orderReceipts.some((receipt) => receipt.id === incident.receiptId),
        ),
        incidentTypes,
        lineByReceiptLineId,
        productById,
        receiptById,
        userNameById,
        inProgressReceipt?.id,
      ),
      previousReceipts: buildPreviousReceipts({
        receipts: confirmedReceipts,
        receiptLines,
        incidents,
        incidentTypes,
        productById,
        unitById,
        locationNameById,
        userNameById,
        orderItems: order.items ?? [],
        orderNumber: order.number,
        orderedTotal: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
      }),
      capabilities: toCapabilityFlags(capabilities, entitlements),
      readOnly: order.status === PurchaseOrderStatus.received,
    };
  }

  private async getTransferDocument(
    tenantId: string,
    user: User,
    documentId: string,
    activeBranchId?: string,
  ): Promise<ReceivingDocumentDetail> {
    const transfer = await this.repositories.inventoryTransfers.getById(documentId);
    // El id llega desde la URL/estado del cliente: un traslado de otro tenant se trata igual
    // que uno inexistente, mismo criterio que requirePurchaseOrder.
    if (!transfer || transfer.transfer.tenantId !== tenantId) {
      throw new ReceivingServiceError("Traslado no encontrado.");
    }
    await ensureUserCanOperateBranch(
      this.repositories,
      user,
      transfer.transfer.destinationBranchId,
    );
    if (activeBranchId && transfer.transfer.destinationBranchId !== activeBranchId) {
      throw new ReceivingServiceError("El traslado no pertenece a la sucursal activa.");
    }
    const [branches, products, units, locations] = await Promise.all([
      this.repositories.branches.getAll(),
      this.repositories.products.getAll(),
      this.repositories.units.getAll(),
      this.repositories.inventory.getLocations(transfer.transfer.destinationBranchId),
    ]);
    const [capabilities, entitlements] = await Promise.all([
      this.getCapabilities(transfer.transfer.tenantId),
      new ResolveTenantEntitlementsService(this.repositories).execute(transfer.transfer.tenantId),
    ]);
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const productById = new Map(products.map((product) => [product.id, product]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    return {
      document: {
        id: transfer.transfer.id,
        type: "transfer",
        number: transfer.transfer.number,
        typeLabel: "Traslado",
        originLabel: "Sucursal origen",
        originName:
          branchById.get(transfer.transfer.sourceBranchId)?.name ?? "Sucursal origen no disponible",
        branchId: transfer.transfer.destinationBranchId,
        branchName:
          branchById.get(transfer.transfer.destinationBranchId)?.name ?? "Sucursal destino",
        tenantId: transfer.transfer.tenantId,
        statusLabel:
          transfer.transfer.status === InventoryTransferStatus.received
            ? "Recibida"
            : "En transito",
      },
      lines: transfer.items.map((item) =>
        this.toTransferDetailLine(item, productById.get(item.productId), unitById),
      ),
      locations: toLocationOptions(locations, capabilities),
      incidentTypes: [],
      incidents: [],
      previousReceipts: [],
      capabilities: toCapabilityFlags(capabilities, entitlements),
      readOnly: true,
    };
  }

  private async toPurchaseOrderDetailLine(input: {
    item: PurchaseOrderItem;
    product?: Product;
    unit?: Unit;
    baseUnitById: Map<string, Unit>;
    inProgressLine?: ReceiptLine;
    confirmedLines: ReceiptLine[];
    settingsDefaultLocationId?: string | null;
  }): Promise<ReceivingDocumentLine> {
    const product = input.product;
    const baseUnit = product ? input.baseUnitById.get(product.baseUnitId) : undefined;
    const acceptedPreviously = input.confirmedLines.reduce(
      (sum, line) => sum + line.receivedQuantity,
      0,
    );
    const receivedNow = input.inProgressLine ? input.inProgressLine.receivedQuantity : "";
    const purchaseToBaseFactor = input.item.purchaseToBaseFactor;
    return {
      id: input.item.id,
      sourceLineId: input.item.id,
      ...(input.inProgressLine?.id ? { receiptLineId: input.inProgressLine.id } : {}),
      productId: input.item.productId,
      productName: product?.name ?? "Producto no disponible",
      sku: product?.sku ?? "-",
      unitId: input.item.unitId,
      unitName: input.unit?.name ?? "Unidad",
      unitAllowsDecimals: input.unit?.allowsDecimals ?? false,
      baseUnitId: product?.baseUnitId ?? input.item.unitId,
      baseUnitName: baseUnit?.name ?? input.unit?.name ?? "Unidad base",
      orderedQuantity: input.item.quantity,
      acceptedPreviously,
      receivedNow,
      pendingQuantity: Math.max(
        0,
        input.item.quantity - acceptedPreviously - Math.max(0, toFiniteNumber(receivedNow)),
      ),
      locationId: input.inProgressLine?.locationId ?? input.settingsDefaultLocationId ?? "",
      defaultLocationId: input.settingsDefaultLocationId ?? undefined,
      tracking: product?.tracking ?? { stock: false, lot: false, expiration: false, serial: false },
      lotNumber: input.inProgressLine?.lotNumber ?? input.inProgressLine?.lotId ?? "",
      expirationDate: input.inProgressLine?.expirationDate?.slice(0, 10) ?? "",
      serialNumbersText: input.inProgressLine?.serialNumbers?.join("\n") ?? "",
      notes: input.inProgressLine?.notes ?? "",
      purchaseToBaseFactor,
    };
  }

  private toTransferDetailLine(
    item: InventoryTransferItem,
    product: Product | undefined,
    unitById: Map<string, Unit>,
  ): ReceivingDocumentLine {
    const orderedQuantity =
      item.dispatchedQuantity > 0 ? item.dispatchedQuantity : item.requestedQuantity;
    const baseUnit = product ? unitById.get(product.baseUnitId) : undefined;
    return {
      id: item.id,
      sourceLineId: item.id,
      productId: item.productId,
      productName: product?.name ?? "Producto no disponible",
      sku: product?.sku ?? "-",
      unitId: product?.baseUnitId ?? "",
      unitName: baseUnit?.name ?? "Unidad",
      unitAllowsDecimals: baseUnit?.allowsDecimals ?? false,
      baseUnitId: product?.baseUnitId ?? "",
      baseUnitName: baseUnit?.name ?? "Unidad base",
      orderedQuantity,
      acceptedPreviously: item.receivedQuantity,
      receivedNow: "",
      pendingQuantity: Math.max(0, orderedQuantity - item.receivedQuantity),
      locationId: "",
      tracking: product?.tracking ?? { stock: false, lot: false, expiration: false, serial: false },
      lotNumber: "",
      expirationDate: "",
      serialNumbersText: "",
      notes: "",
      purchaseToBaseFactor: 1,
    };
  }

  // El id llega desde la URL/estado del cliente: `getByIdScoped` trata una orden de otro tenant
  // igual que una inexistente. La validacion de sucursal (User.allowedBranchIds) corre siempre
  // aca, incondicional -- antes de este fix dependia de que el caller pasara `activeBranchId`,
  // que era opcional y por lo tanto evitable.
  private async requirePurchaseOrder(
    tenantId: string,
    user: User,
    id: string,
  ): Promise<PurchaseOrder> {
    const order = await this.repositories.purchaseOrders.getByIdScoped(tenantId, id);
    if (!order) throw new ReceivingServiceError("Documento de compra no encontrado.");
    await ensureUserCanOperateBranch(this.repositories, user, order.branchId);
    return order;
  }

  private async ensureInProgressReceipt(
    order: PurchaseOrder,
    actorUserId: string,
  ): Promise<Receipt> {
    const receipts = await this.repositories.receipts.listByTenant(order.tenantId);
    const existing = receipts.find(
      (receipt) =>
        receipt.purchaseOrderId === order.id && receipt.status === ReceiptStatus.in_progress,
    );
    if (existing) return existing;
    return this.repositories.receipts.create({
      tenantId: order.tenantId,
      branchId: order.branchId,
      number: await this.nextReceiptNumber(order.tenantId),
      purchaseOrderId: order.id,
      supplierId: order.supplierId,
      status: ReceiptStatus.in_progress,
      receivedByUserId: actorUserId,
    });
  }

  private async nextReceiptNumber(tenantId: string) {
    const receipts = await this.repositories.receipts.listByTenant(tenantId);
    const next =
      receipts.reduce((max, receipt) => {
        const match = /^REC-(\d+)$/.exec(receipt.number);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0) + 1;
    return `REC-${String(next).padStart(3, "0")}`;
  }

  private async getCapabilities(tenantId: string): Promise<BusinessCapabilitiesConfig> {
    const capabilities = await this.repositories.businessConfig.getCapabilities(tenantId);
    if (!capabilities)
      throw new ReceivingServiceError("No hay configuracion operativa para este tenant.");
    return capabilities;
  }

  private async getInventorySettings(order: PurchaseOrder) {
    const entries = await Promise.all(
      (order.items ?? []).map(
        async (item) =>
          [
            item.productId,
            await this.repositories.inventory.getProductInventorySettings(
              item.productId,
              order.branchId,
            ),
          ] as const,
      ),
    );
    return new Map(entries);
  }
}

function getReceivingConfirmationFingerprint(
  input: ConfirmReceivingInput,
  order: Pick<PurchaseOrder, "tenantId" | "branchId" | "id">,
): string {
  const lines = input.lines
    .map((line) => ({
      productId: line.productId,
      acceptedQuantity: getAcceptedNow(line),
      incidentQuantity: getRejectedNow(line, input.incidents),
      locationId: line.locationId || null,
      lotNumber: line.lotNumber.trim() || null,
      expirationDate: line.expirationDate || null,
      serialNumbers: parseSerialNumbers(line.serialNumbersText).sort(),
      purchaseToBaseFactor: line.purchaseToBaseFactor,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const incidents = input.incidents
    .filter((incident) => incident.editable)
    .map((incident) => ({
      productId: incident.productId ?? null,
      incidentTypeId: incident.incidentTypeId,
      quantityAffected: incident.quantityAffected ?? 0,
      description: incident.description.trim(),
      evidence: incident.evidence,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify({
    tenantId: order.tenantId,
    branchId: order.branchId,
    purchaseOrderId: order.id,
    lines,
    incidents,
  });
}

function toReceiptIncidentInputs(
  input: SaveReceivingProgressInput,
  detail: ReceivingDocumentDetail,
  actorUserId: string,
) {
  const validProductIds = new Set(detail.lines.map((line) => line.productId));
  return input.incidents
    .filter(
      (incident) =>
        incident.editable && incident.productId && validProductIds.has(incident.productId),
    )
    .map((incident) => ({
      ...(!incident.id.startsWith("draft-") ? { id: incident.id } : {}),
      ...(incident.createdAt ? { createdAt: incident.createdAt } : {}),
      productId: incident.productId,
      incidentTypeId: incident.incidentTypeId,
      description: incident.description.trim(),
      quantityAffected: incident.quantityAffected,
      evidence: incident.evidence,
      createdByUserId: incident.id.startsWith("draft-")
        ? actorUserId
        : incident.createdByUserId || actorUserId,
    }));
}

export function validateLines(
  lines: ReceivingDocumentLine[],
  incidents: ReceivingDocumentIncident[],
  detail: ReceivingDocumentDetail,
  operationDate = getLocalCalendarDate(),
) {
  const unitAllowsDecimals = new Map(
    detail.lines.map((line) => [line.id, line.unitAllowsDecimals]),
  );
  return lines
    .flatMap((line) => {
      const errors: string[] = [];
      const acceptedNow = toFiniteNumber(line.receivedNow);
      const incidentQuantity = getRejectedNow(line, incidents);
      const allowsDecimals = unitAllowsDecimals.get(line.id) ?? false;
      if (
        line.receivedNow !== "" &&
        !isQuantityCompatibleWithUnit(line.receivedNow, allowsDecimals)
      ) {
        errors.push(
          allowsDecimals
            ? `${line.productName}: la cantidad admite hasta ${QUANTITY_DECIMAL_PLACES} decimales.`
            : `${line.productName}: la unidad no admite fracciones.`,
        );
      }
      if (!isQuantityCompatibleWithUnit(incidentQuantity, allowsDecimals)) {
        errors.push(
          allowsDecimals
            ? `${line.productName}: la incidencia admite hasta ${QUANTITY_DECIMAL_PLACES} decimales.`
            : `${line.productName}: la unidad no admite incidencias fraccionarias.`,
        );
      }
      if (
        detail.capabilities.supportsMultipleLocations &&
        detail.capabilities.supportsInventory &&
        line.tracking.stock &&
        acceptedNow > 0 &&
        !line.locationId
      ) {
        errors.push(`${line.productName}: selecciona ubicacion.`);
      }
      if (
        line.tracking.lot &&
        detail.capabilities.supportsLots &&
        acceptedNow > 0 &&
        !line.lotNumber.trim()
      ) {
        errors.push(`${line.productName}: lote requerido.`);
      }
      if (
        line.tracking.expiration &&
        detail.capabilities.supportsExpiration &&
        acceptedNow > 0 &&
        !line.expirationDate
      ) {
        errors.push(`${line.productName}: fecha de vencimiento requerida.`);
      }
      if (
        line.tracking.expiration &&
        detail.capabilities.supportsExpiration &&
        acceptedNow > 0 &&
        line.expirationDate &&
        isExpirationBeforeOperationDate(line.expirationDate, operationDate)
      ) {
        errors.push(`${line.productName}: ${EXPIRATION_BEFORE_ENTRY_MESSAGE}`);
      }
      if (line.tracking.serial && detail.capabilities.supportsSerials && acceptedNow > 0) {
        const serials = parseSerialNumbers(line.serialNumbersText);
        const expectedSerials = toBaseQuantity(line, acceptedNow);
        if (serials.length !== expectedSerials) {
          errors.push(`${line.productName}: registra ${expectedSerials} numeros de serie.`);
        }
        if (new Set(serials).size !== serials.length) {
          errors.push(`${line.productName}: los numeros de serie no pueden repetirse.`);
        }
      }
      return errors;
    })
    .concat(validateIncidentQuantities(lines, incidents, detail));
}

export function validateIncidentQuantities(
  lines: ReceivingDocumentLine[],
  incidents: ReceivingDocumentIncident[],
  detail?: ReceivingDocumentDetail,
) {
  const lineByProductId = new Map(
    (detail?.lines ?? lines).map((line) => [line.productId, line]),
  );
  const validIncidentTypeIds = detail
    ? new Set(detail.incidentTypes.map((type) => type.id))
    : undefined;
  const errors: string[] = [];
  for (const incident of incidents.filter((item) => item.editable)) {
    const line = incident.productId ? lineByProductId.get(incident.productId) : undefined;
    if (!line) {
      errors.push("Selecciona un producto valido para cada incidencia.");
      continue;
    }
    if (
      !incident.incidentTypeId ||
      (validIncidentTypeIds && !validIncidentTypeIds.has(incident.incidentTypeId))
    ) {
      errors.push(`${line.productName}: selecciona un tipo de incidencia valido.`);
    }
    if (!incident.description.trim()) {
      errors.push(`${line.productName}: agrega la observacion de la incidencia.`);
    }
    if (incident.description.length > TEXT_LIMITS.notes) {
      errors.push(`${line.productName}: la observacion admite hasta 500 caracteres.`);
    }
    const quantity = incident.quantityAffected ?? 0;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`${line.productName}: la cantidad de la incidencia debe ser mayor que cero.`);
    }
    if (quantity > MAX_SAFE_INVENTORY_QUANTITY) {
      errors.push(`${line.productName}: la cantidad de la incidencia no puede superar 999,999.99.`);
    }
    if (!isQuantityCompatibleWithUnit(quantity, line.unitAllowsDecimals)) {
      errors.push(
        line.unitAllowsDecimals
          ? `${line.productName}: la incidencia admite hasta ${QUANTITY_DECIMAL_PLACES} decimales.`
          : `${line.productName}: la unidad no admite incidencias fraccionarias.`,
      );
    }
  }
  for (const line of lines) {
    const incidentQuantity = getRejectedNow(line, incidents);
    const acceptedNow = toFiniteNumber(line.receivedNow);
    const remainingBefore = Math.max(0, line.orderedQuantity - line.acceptedPreviously);
    if (
      line.receivedNow !== "" &&
      (typeof line.receivedNow !== "number" || !Number.isFinite(line.receivedNow))
    ) {
      errors.push(`${line.productName}: aceptado ahora no es valido.`);
    }
    if (acceptedNow > MAX_SAFE_INVENTORY_QUANTITY) {
      errors.push(`${line.productName}: la cantidad no puede superar 999,999.99.`);
    }
    if ((line.lotNumber?.length ?? 0) > TEXT_LIMITS.lotNumber) {
      errors.push(`${line.productName}: el lote admite hasta 50 caracteres.`);
    }
    if ((line.serialNumbersText?.length ?? 0) > TEXT_LIMITS.serialNumbers) {
      errors.push(`${line.productName}: las series admiten hasta 5,000 caracteres.`);
    }
    if ((line.notes?.length ?? 0) > TEXT_LIMITS.notes) {
      errors.push(`${line.productName}: las notas admiten hasta 500 caracteres.`);
    }
    if (acceptedNow < 0 || acceptedNow > remainingBefore) {
      errors.push(`${line.productName}: aceptado ahora debe estar entre 0 y ${remainingBefore}.`);
    }
    if (acceptedNow + incidentQuantity > remainingBefore) {
      const available = Math.max(0, remainingBefore - Math.min(acceptedNow, incidentQuantity));
      errors.push(
        `${line.productName}: solo quedan ${available} unidades disponibles para registrar entre aceptadas e incidencias.`,
      );
    }
  }
  return errors;
}

export function toBaseQuantity(line: ReceivingDocumentLine, quantity: number) {
  return quantity * line.purchaseToBaseFactor;
}

function toReceiptLineInput(line: ReceivingDocumentLine, incidents: ReceivingDocumentIncident[]) {
  const rejectedQuantity = getRejectedNow(line, incidents);
  const receivedQuantity = toFiniteNumber(line.receivedNow);
  const pending = Math.max(0, line.orderedQuantity - line.acceptedPreviously - receivedQuantity);
  return {
    ...(line.receiptLineId ? { id: line.receiptLineId } : {}),
    productId: line.productId,
    orderedQuantity: line.orderedQuantity,
    receivedQuantity,
    inventoryQuantity: toBaseQuantity(line, receivedQuantity),
    rejectedQuantity,
    status: getLineStatus(receivedQuantity, rejectedQuantity, pending),
    locationId: line.locationId || undefined,
    lotId: line.lotNumber.trim() || undefined,
    lotNumber: line.lotNumber.trim() || undefined,
    expirationDate: line.expirationDate || undefined,
    serialNumbers: parseSerialNumbers(line.serialNumbersText),
    notes: line.notes.trim() || undefined,
  };
}

function getLineStatus(
  receivedQuantity: number,
  rejectedQuantity: number,
  pendingQuantity: number,
) {
  if (rejectedQuantity > 0) return ReceiptLineStatus.incident;
  if (pendingQuantity <= 0) return ReceiptLineStatus.complete;
  if (receivedQuantity > 0) return ReceiptLineStatus.partial;
  return ReceiptLineStatus.pending;
}

function parseSerialNumbers(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toIncidentRows(
  incidents: ReceiptIncident[],
  incidentTypes: Array<{ id: string; name: string }>,
  lineByReceiptLineId: Map<string, ReceiptLine>,
  productById: Map<string, Product>,
  receiptById: Map<string, Receipt>,
  userNameById: Map<string, string>,
  inProgressReceiptId?: string,
): ReceivingDocumentIncident[] {
  const incidentTypeById = new Map(incidentTypes.map((type) => [type.id, type]));
  return incidents
    .map((incident) => {
      const line = incident.receiptLineId
        ? lineByReceiptLineId.get(incident.receiptLineId)
        : undefined;
      const product = line ? productById.get(line.productId) : undefined;
      return {
        id: incident.id,
        receiptId: incident.receiptId,
        ...(incident.receiptLineId ? { receiptLineId: incident.receiptLineId } : {}),
        ...(line?.productId ? { productId: line.productId } : {}),
        productName: product?.name ?? "Producto no disponible",
        sku: product?.sku ?? "-",
        incidentTypeId: incident.incidentTypeId,
        incidentTypeName: incidentTypeById.get(incident.incidentTypeId)?.name ?? "Tipo archivado",
        quantityAffected: incident.quantityAffected,
        description: incident.description,
        evidence: incident.evidence ?? [],
        createdAt: incident.createdAt,
        createdByUserId: incident.createdByUserId,
        createdByName: userNameById.get(incident.createdByUserId) ?? incident.createdByUserId,
        receiptNumber: receiptById.get(incident.receiptId)?.number ?? incident.receiptId,
        editable: incident.receiptId === inProgressReceiptId,
      };
    })
    .sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

function buildPreviousReceipts(input: {
  receipts: Receipt[];
  receiptLines: ReceiptLine[];
  incidents: ReceiptIncident[];
  incidentTypes: Array<{ id: string; name: string }>;
  productById: Map<string, Product>;
  unitById: Map<string, Unit>;
  locationNameById: Map<string, string>;
  userNameById: Map<string, string>;
  orderItems: PurchaseOrderItem[];
  orderNumber: string;
  orderedTotal: number;
}) {
  const sortedReceipts = [...input.receipts].sort(
    (left, right) =>
      new Date(left.receivedAt ?? left.updatedAt).getTime() -
      new Date(right.receivedAt ?? right.updatedAt).getTime(),
  );
  const receiptById = new Map(sortedReceipts.map((receipt) => [receipt.id, receipt]));
  const lineByReceiptLineId = new Map(input.receiptLines.map((line) => [line.id, line]));
  const orderItemByProductId = new Map(input.orderItems.map((item) => [item.productId, item]));
  const acceptedByProductId = new Map<string, number>();
  let cumulativeAccepted = 0;

  return sortedReceipts.map((receipt, receiptIndex) => {
    const lines = input.receiptLines.filter((line) => line.receiptId === receipt.id);
    const receiptIncidents = input.incidents.filter(
      (incident) => incident.receiptId === receipt.id,
    );
    const acceptedQuantity = lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
    cumulativeAccepted += acceptedQuantity;
    return {
      id: receipt.id,
      sequenceNumber: receiptIndex + 1,
      orderNumber: input.orderNumber,
      number: receipt.number,
      receivedAt: receipt.receivedAt ?? receipt.updatedAt,
      responsibleName:
        (receipt.receivedByUserId && input.userNameById.get(receipt.receivedByUserId)) ??
        receipt.receivedByUserId ??
        "No disponible",
      statusLabel: receipt.status === ReceiptStatus.received ? "Recibida" : "Parcial",
      acceptedQuantity,
      incidentQuantity: receiptIncidents.reduce(
        (sum, incident) => sum + (incident.quantityAffected ?? 0),
        0,
      ),
      pendingAfter: Math.max(0, input.orderedTotal - cumulativeAccepted),
      lines: lines.map((line) => {
        const product = input.productById.get(line.productId);
        const orderItem = orderItemByProductId.get(line.productId);
        const unit = orderItem ? input.unitById.get(orderItem.unitId) : undefined;
        const orderedQuantity = line.orderedQuantity ?? orderItem?.quantity ?? 0;
        const previousAccepted = acceptedByProductId.get(line.productId) ?? 0;
        const incidentQuantity = receiptIncidents
          .filter((incident) => incident.receiptLineId === line.id)
          .reduce((sum, incident) => sum + (incident.quantityAffected ?? 0), 0);
        const pendingAfter = Math.max(
          0,
          orderedQuantity - previousAccepted - line.receivedQuantity,
        );
        acceptedByProductId.set(line.productId, previousAccepted + line.receivedQuantity);
        return {
          id: line.id,
          productName: product?.name ?? "Producto no disponible",
          sku: product?.sku ?? "-",
          acceptedQuantity: line.receivedQuantity,
          orderedQuantity,
          incidentQuantity,
          pendingAfter,
          unitName: unit?.name ?? "Unidad",
          locationName:
            (line.locationId && input.locationNameById.get(line.locationId)) ?? "No especificada",
          lotNumber: line.lotNumber ?? line.lotId ?? "",
          expirationDate: line.expirationDate ?? "",
          serialNumbers: line.serialNumbers ?? [],
        };
      }),
      incidents: toIncidentRows(
        receiptIncidents,
        input.incidentTypes,
        lineByReceiptLineId,
        input.productById,
        receiptById,
        input.userNameById,
      ),
    };
  });
}

export function getRejectedNow(
  line: ReceivingDocumentLine,
  incidents: ReceivingDocumentIncident[],
) {
  return incidents
    .filter((incident) => incident.editable && incident.productId === line.productId)
    .reduce((sum, incident) => sum + (incident.quantityAffected ?? 0), 0);
}

export function getAcceptedNow(line: ReceivingDocumentLine) {
  return Math.max(0, toFiniteNumber(line.receivedNow));
}

function toLocationOptions(locations: StorageLocation[], capabilities: BusinessCapabilitiesConfig) {
  if (!capabilities.supportsMultipleLocations) return [];
  return locations
    .filter((location) => location.status === LocationStatus.active)
    .map((location) => ({ id: location.id, name: location.name, code: location.code }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function toCapabilityFlags(
  capabilities: BusinessCapabilitiesConfig,
  entitlements: TenantEntitlementsDto,
): ReceivingCapabilityFlags {
  return {
    supportsInventory: capabilities.supportsInventory,
    supportsLots: isEffectiveBusinessCapabilityEnabled(entitlements, capabilities, "supportsLots"),
    supportsExpiration: isEffectiveBusinessCapabilityEnabled(
      entitlements,
      capabilities,
      "supportsExpiration",
    ),
    supportsSerials: isEffectiveBusinessCapabilityEnabled(entitlements, capabilities, "supportsSerials"),
    supportsMultipleLocations: capabilities.supportsMultipleLocations,
    supportsUnitsAndPackaging: capabilities.supportsUnitsAndPackaging,
  };
}

function buildReceiptNotes(lines: Array<Pick<ReceiptLine, "rejectedQuantity">>) {
  const rejected = lines.reduce((sum, line) => sum + (line.rejectedQuantity ?? 0), 0);
  return rejected > 0 ? `Recepcion confirmada con ${rejected} unidades rechazadas.` : undefined;
}

function getPurchaseOrderStatusLabel(status: PurchaseOrderStatus) {
  const labels: Record<PurchaseOrderStatus, string> = {
    draft: "Borrador",
    pending_approval: "Pendiente de aprobacion",
    approved: "Aprobada",
    sent: "En proceso",
    partially_received: "Parcial",
    received: "Recibida",
    cancelled: "Cancelada",
  };
  return labels[status];
}
