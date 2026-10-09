import { describe, expect, it, vi } from "vitest";
import {
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  ProductType,
  PromotionStatus,
  PromotionType,
  SaleStatus,
  SalesChannel,
  TransportMode,
} from "@/core/enums";
import type { CheckoutDto } from "@/modules/pos/application/dto/CheckoutDto";
import type { SaleTicketDto } from "@/modules/pos/application/dto/SaleTicketDto";
import {
  mapApiReturnResult,
  mapApiVoidResult,
} from "@/modules/pos/application/mappers/SaleReversalResultMapper";
import { ConfirmSaleService } from "@/modules/pos/application/services/ConfirmSaleService";
import { GetPosProductsService } from "@/modules/pos/application/services/GetPosProductsService";
import { GetPosSalesHistoryService } from "@/modules/pos/application/services/GetPosSalesHistoryService";
import { GetReturnSaleLookupService } from "@/modules/pos/application/services/GetReturnSaleLookupService";
import { ProcessSaleReturnService } from "@/modules/pos/application/services/ProcessSaleReturnService";
import { VoidSaleService } from "@/modules/pos/application/services/VoidSaleService";
import {
  apiHistoryPage,
  apiReturnEligibility,
  apiReversalEffect,
  apiSaleDetail,
  apiVoidResult,
  at,
  createPosRepositories,
  id,
  ids,
} from "./posFixtures";

const returnContext = { tenantId: ids.tenant, branchId: ids.branch, actorUserId: ids.user };

function ticket(overrides: Partial<SaleTicketDto> = {}): SaleTicketDto {
  return {
    items: [
      {
        productId: ids.product,
        sku: "POS-001",
        name: "Producto POS",
        quantity: 2,
        baseUnitPrice: 50,
        unitPrice: 50,
        discount: 0,
        subtotal: 100,
        availableQuantity: 10,
        saleUnitId: id(50),
        saleUnitName: "Unidad",
        tracksStock: true,
        requiresUnsupportedTraceability: false,
      },
    ],
    subtotal: 100,
    discountTotal: 0,
    total: 100,
    hasUnsupportedTraceability: false,
    ...overrides,
  };
}

function checkout(overrides: Partial<CheckoutDto> = {}): CheckoutDto {
  return {
    documentType: "ticket",
    invoiceData: { taxId: "", legalName: "", fiscalAddress: "" },
    paymentMode: "cash",
    cashAmount: 100,
    cashReceived: 100,
    changeAmount: 0,
    cardAmount: 0,
    cardTerminalResult: { status: "idle" },
    transferAmount: 0,
    bankAccountId: "",
    transferReference: "",
    transferExternallyVerified: false,
    deliveryMethod: DeliveryMethod.immediate,
    transportMode: TransportMode.none,
    notificationContact: { emailMode: "not_applicable" },
    ...overrides,
  } as CheckoutDto;
}

function confirmInput(overrides: Record<string, unknown> = {}) {
  return {
    confirmationId: ids.confirmation,
    branchId: ids.branch,
    cashShiftId: ids.shift,
    ticket: ticket(),
    checkout: checkout(),
    ...overrides,
  };
}

describe("ConfirmSaleService en modo API", () => {
  it("confirma una venta en efectivo con el contrato real y devuelve el resultado del backend", async () => {
    const { repositories, posApi } = createPosRepositories();

    const result = await new ConfirmSaleService(repositories).execute(confirmInput());

    expect(result).toEqual({
      sale: { id: ids.sale, number: "V-100", total: 100, sourceOrderId: undefined },
      payments: [{ currency: "GTQ" }],
      inventoryMovements: [{ id: ids.inventoryMovement }],
      idempotent: false,
    });
    expect(posApi.confirmSale).toHaveBeenCalledWith({
      branchId: ids.branch,
      cashShiftId: ids.shift,
      customerId: undefined,
      taxTotal: 0,
      items: [{ productId: ids.product, quantity: 2, discount: 0, trackingSelections: [] }],
      payments: [
        {
          method: PaymentMethod.cash,
          amount: 100,
          bankAccountId: undefined,
          reference: undefined,
          externallyVerified: undefined,
        },
      ],
      confirmationId: ids.confirmation,
      document: { type: "ticket" },
      sourceOrderId: null,
      deferredOrder: undefined,
    });
  });

  it("envía el pedido de retiro en tienda con el contacto recortado y la clave de pedido", async () => {
    const { repositories, posApi } = createPosRepositories();

    await new ConfirmSaleService(repositories).execute(
      confirmInput({
        orderIdempotencyKey: " order-attempt-1 ",
        checkout: checkout({
          deliveryMethod: DeliveryMethod.store_pickup,
          transportMode: TransportMode.customer,
          storePickupContact: { recipientName: " Ana López ", recipientPhone: " 55550101 " },
        }),
      }),
    );

    expect(posApi.confirmSale.mock.calls[0]?.[0].deferredOrder).toEqual({
      idempotencyKey: "order-attempt-1",
      deliveryMethod: DeliveryMethod.store_pickup,
      transportMode: TransportMode.customer,
      notificationContact: undefined,
      deliveryAddress: undefined,
      storePickupContact: { recipientName: "Ana López", recipientPhone: "55550101" },
    });
  });

  it("valida la cuenta bancaria y envía la verificación externa de la transferencia", async () => {
    const { repositories, posApi, raw } = createPosRepositories();

    await new ConfirmSaleService(repositories).execute(
      confirmInput({
        checkout: checkout({
          paymentMode: "mixed",
          cashAmount: 20,
          cashReceived: 20,
          cardAmount: 30,
          cardTerminalResult: { status: "approved", reference: "AUTH-123456", authorizedAmount: 30 },
          transferAmount: 50,
          bankAccountId: ids.bankAccount,
          transferReference: " TRX-300 ",
          transferExternallyVerified: true,
        }),
      }),
    );

    expect(raw.bankAccounts.getById).toHaveBeenCalledWith(ids.bankAccount);
    expect(posApi.confirmSale.mock.calls[0]?.[0].payments).toEqual([
      expect.objectContaining({ method: PaymentMethod.cash, amount: 20 }),
      expect.objectContaining({ method: PaymentMethod.card, amount: 30, reference: "AUTH-123456" }),
      expect.objectContaining({
        method: PaymentMethod.transfer,
        amount: 50,
        bankAccountId: ids.bankAccount,
        reference: "TRX-300",
        externallyVerified: true,
      }),
    ]);
  });

  it.each([
    ["sin pedido de origen en modo API", { sourceOrderId: ids.order }, "pedidos existentes"],
    ["ticket vacío", { ticket: ticket({ items: [], total: 0 }) }, "El ticket está vacío."],
    ["sin confirmationId", { confirmationId: "  " }, "intento de confirmación"],
    ["trazabilidad no soportada", { ticket: ticket({ hasUnsupportedTraceability: true }) }, "lote, serial o kit"],
    [
      "pedido diferido sin clave",
      {
        checkout: checkout({
          deliveryMethod: DeliveryMethod.store_pickup,
          storePickupContact: { recipientName: "Ana", recipientPhone: "55550101" },
        }),
      },
      "intento de pedido diferido",
    ],
    ["pago que no cubre el total", { checkout: checkout({ cashAmount: 80, cashReceived: 80 }) }, "revisarse"],
  ])("rechaza %s sin llamar al backend", async (_label, overrides, message) => {
    const { repositories, posApi } = createPosRepositories();
    await expect(
      new ConfirmSaleService(repositories).execute(confirmInput(overrides)),
    ).rejects.toThrow(message);
    expect(posApi.confirmSale).not.toHaveBeenCalled();
  });

  it("rechaza métodos de pago no habilitados y cuentas bancarias inválidas", async () => {
    const cashOnly = createPosRepositories({ allowedPosPaymentMethods: [PaymentMethod.card] });
    await expect(new ConfirmSaleService(cashOnly.repositories).execute(confirmInput())).rejects.toThrow();
    expect(cashOnly.posApi.confirmSale).not.toHaveBeenCalled();

    const badAccount = createPosRepositories();
    badAccount.raw.bankAccounts.getById.mockResolvedValueOnce(null);
    await expect(
      new ConfirmSaleService(badAccount.repositories).execute(
        confirmInput({
          checkout: checkout({
            paymentMode: "transfer",
            cashAmount: 0,
            cashReceived: 0,
            transferAmount: 100,
            bankAccountId: ids.bankAccount,
            transferReference: "TRX-1",
            transferExternallyVerified: true,
          }),
        }),
      ),
    ).rejects.toThrow("La cuenta bancaria ya no está activa");
    expect(badAccount.posApi.confirmSale).not.toHaveBeenCalled();
  });

  it("exige sesión, permiso de venta y turno de caja vigente", async () => {
    const noSession = createPosRepositories({ sessionId: null });
    await expect(new ConfirmSaleService(noSession.repositories).execute(confirmInput())).rejects.toThrow(
      "No existe una sesión activa.",
    );

    const noPermission = createPosRepositories({ role: { permissions: ["pos.sales.read"] } });
    await expect(
      new ConfirmSaleService(noPermission.repositories).execute(confirmInput()),
    ).rejects.toThrow("No dispone de permisos para crear ventas POS.");

    const noShift = createPosRepositories();
    noShift.posApi.getOpenCashShift.mockResolvedValue(null);
    await expect(new ConfirmSaleService(noShift.repositories).execute(confirmInput())).rejects.toThrow(
      "No hay un turno de caja abierto y vigente para esta sucursal.",
    );
    expect(noShift.posApi.confirmSale).not.toHaveBeenCalled();
  });

  it("propaga el rechazo del backend sin inventar una venta", async () => {
    const { repositories, posApi } = createPosRepositories();
    posApi.confirmSale.mockRejectedValueOnce(new Error("Stock insuficiente"));
    await expect(new ConfirmSaleService(repositories).execute(confirmInput())).rejects.toThrow(
      "Stock insuficiente",
    );
  });
});

describe("GetPosProductsService en modo API", () => {
  const unitId = id(60);
  const otherUnit = id(61);
  const product = (index: number, extra: Record<string, unknown> = {}) => ({
    id: id(100 + index),
    tenantId: ids.tenant,
    sku: `SKU-${index}`,
    name: `Producto ${index}`,
    productType: ProductType.physical,
    salePrice: 100,
    baseUnitId: unitId,
    saleUnitId: unitId,
    tracking: { stock: true, lot: false, serial: false, expiration: false },
    ...extra,
  });

  function catalogRepositories(products: ReturnType<typeof product>[]) {
    const calls = { applicable: vi.fn(), conversionsByProduct: vi.fn() };
    const { repositories } = createPosRepositories({
      extra: {
        inventoryStockDataSource: "api",
        products: { getAvailableForPos: vi.fn().mockResolvedValue(products) },
        inventory: {
          getStockPage: vi
            .fn()
            .mockResolvedValueOnce({
              items: [{ productId: products[0]!.id, productType: ProductType.physical, availableQuantity: 5 }],
              totalPages: 2,
            })
            .mockResolvedValueOnce({
              items: [{ productId: products[1]!.id, productType: ProductType.physical, availableQuantity: 0 }],
              totalPages: 2,
            }),
        },
        units: {
          getByTenant: vi.fn().mockResolvedValue([{ id: unitId, name: "Unidad" }]),
          getAllConversionsByTenant: vi.fn().mockResolvedValue([
            { productId: products[0]!.id, fromUnitId: unitId, toUnitId: unitId, factor: 1 },
            { productId: null, fromUnitId: unitId, toUnitId: otherUnit, factor: 12 },
          ]),
          getConversionsByProductScoped: calls.conversionsByProduct,
        },
        promotions: {
          getActiveByTenant: vi.fn().mockResolvedValue([
            {
              id: id(70),
              tenantId: ids.tenant,
              name: "10%",
              type: PromotionType.percentage,
              value: 10,
              channels: [SalesChannel.pos],
              startAt: "2020-01-01T00:00:00.000Z",
              untilStockEnds: false,
              branchIds: [],
              productIds: [products[0]!.id],
              status: PromotionStatus.active,
              createdAt: at,
              updatedAt: at,
            },
          ]),
          getApplicable: calls.applicable,
        },
        productSalesPriceTiers: {
          getByProduct: vi.fn().mockResolvedValue([
            { tenantId: ids.tenant, productId: products[0]!.id, minQuantity: 10, unitPrice: 80, active: true },
            { tenantId: ids.tenant, productId: products[0]!.id, minQuantity: 20, unitPrice: 70, active: false },
          ]),
        },
      },
    });
    return { repositories, calls };
  }

  it("arma el catálogo con stock, promociones y conversiones cargados una sola vez", async () => {
    const products = [
      product(1),
      product(2),
      product(3, { productType: ProductType.service, tracking: { stock: false, lot: false, serial: false, expiration: false } }),
      product(4, { tracking: { stock: true, lot: true, serial: false, expiration: false } }),
      product(5, { saleUnitId: otherUnit }),
    ];
    const { repositories, calls } = catalogRepositories(products);

    const result = await new GetPosProductsService(repositories).execute({
      tenantId: ids.tenant,
      branchId: ids.branch,
    });
    const byId = new Map(result.map((item) => [item.productId, item]));

    expect(calls.applicable).not.toHaveBeenCalled();
    expect(calls.conversionsByProduct).not.toHaveBeenCalled();
    expect(byId.get(products[0]!.id)).toMatchObject({
      effectivePrice: 90,
      availableQuantity: 5,
      isAvailableForSale: true,
      salesPriceTiers: [{ minQuantity: 10, unitPrice: 80, active: true }],
      saleUnitName: "Unidad",
    });
    expect(byId.get(products[1]!.id)).toMatchObject({ effectivePrice: 100, isAvailableForSale: false });
    expect(byId.get(products[2]!.id)).toMatchObject({ availableQuantity: null, isAvailableForSale: true });
    expect(byId.get(products[3]!.id)).toMatchObject({
      requiresUnsupportedTraceability: true,
      isAvailableForSale: false,
    });
    expect(byId.get(products[4]!.id)).toMatchObject({ availableQuantity: 0, isAvailableForSale: false });
    expect(result.map((item) => item.name)).toEqual([...result.map((item) => item.name)].sort());
  });
});

describe("GetPosSalesHistoryService en modo API", () => {
  it("recorre las páginas del backend, traduce filtros y arma las filas con el detalle", async () => {
    const { repositories, posApi } = createPosRepositories();
    posApi.getSalesHistory
      .mockResolvedValueOnce(apiHistoryPage({ totalPages: 2 }))
      .mockResolvedValueOnce(
        apiHistoryPage({
          page: 2,
          totalPages: 2,
          items: [
            {
              saleId: id(80),
              saleNumber: "V-101",
              createdAt: at,
              customerDisplayName: "Consumidor final",
              total: 20,
              status: SaleStatus.cancelled,
            },
          ],
          summary: { total: 2, completed: 1, partiallyReturned: 0, returned: 0, cancelled: 1 },
        }),
      );
    posApi.getSaleDetail.mockImplementation(async (saleId: string) =>
      saleId === ids.sale
        ? apiSaleDetail
        : { ...apiSaleDetail, sale: { ...apiSaleDetail.sale, id: saleId, document: { type: "ticket" } }, payments: [] },
    );

    const result = await new GetPosSalesHistoryService(repositories).execute({
      actorUserId: ids.user,
      branchId: ids.branch,
      filters: { search: "V-1" },
    });

    expect(posApi.getSalesHistory).toHaveBeenNthCalledWith(1, {
      branchId: ids.branch,
      search: "V-1",
      from: undefined,
      to: undefined,
      status: undefined,
      deliveryMethod: undefined,
      operationalStatus: undefined,
      page: 1,
      pageSize: 100,
    });
    expect(posApi.getSalesHistory).toHaveBeenCalledTimes(2);
    expect(result.summary).toEqual({ total: 2, active: 1, partiallyReturned: 0, returned: 0, cancelled: 1 });
    const pickup = result.sales.find((sale) => sale.saleId === ids.sale);
    expect(pickup).toMatchObject({
      documentNumber: "V-100",
      documentType: "invoice",
      taxId: "1234567-8",
      deliveryMethod: DeliveryMethod.store_pickup,
      orderStatus: OrderStatus.ready_for_pickup,
    });
    expect(pickup?.payments[0]).toMatchObject({ method: PaymentMethod.cash, amount: 100 });
    const cancelled = result.sales.find((sale) => sale.saleId === id(80));
    expect(cancelled).toMatchObject({ deliveryMethodLabel: "No disponible", operationalStatusLabel: "—", paymentSummary: "No disponible" });
  });

  it("no envía al backend los filtros que solo existen en el cliente", async () => {
    const { repositories, posApi } = createPosRepositories();
    await new GetPosSalesHistoryService(repositories).execute({
      actorUserId: ids.user,
      branchId: ids.branch,
      filters: { deliveryMethod: "unavailable", operationalStatus: "immediate" },
    });
    expect(posApi.getSalesHistory).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryMethod: undefined, operationalStatus: undefined, search: undefined }),
    );
  });

  it("envía al backend los filtros concretos de estado, entrega y fechas", async () => {
    const { repositories, posApi } = createPosRepositories();
    await new GetPosSalesHistoryService(repositories).execute({
      actorUserId: ids.user,
      branchId: ids.branch,
      filters: {
        dateFrom: "2026-10-01",
        dateTo: "2026-10-09",
        saleStatus: SaleStatus.completed,
        deliveryMethod: DeliveryMethod.store_pickup,
        operationalStatus: OrderStatus.ready_for_pickup,
      },
    });
    expect(posApi.getSalesHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-10-01",
        to: "2026-10-09",
        status: SaleStatus.completed,
        deliveryMethod: DeliveryMethod.store_pickup,
        operationalStatus: OrderStatus.ready_for_pickup,
      }),
    );
  });

  it("falla con un mensaje claro si la integración API no está configurada", async () => {
    const { repositories } = createPosRepositories({ extra: { posApi: undefined } });
    await expect(
      new GetPosSalesHistoryService(repositories).execute({ actorUserId: ids.user, branchId: ids.branch }),
    ).rejects.toThrow("La integración API de POS no está disponible.");
  });
});

describe("devoluciones y anulaciones en modo API", () => {
  it("GetReturnSaleLookup traduce la elegibilidad del backend al DTO de pantalla", async () => {
    const { repositories, posApi } = createPosRepositories();

    const lookup = await new GetReturnSaleLookupService(repositories).execute({
      ...returnContext,
      documentNumber: " V-100 ",
    });

    expect(posApi.getReturnEligibility).toHaveBeenCalledWith(ids.branch, "V-100");
    expect(lookup).toMatchObject({
      sale: { saleId: ids.sale, documentNumber: "V-100", customerDisplayName: "Consumidor final" },
      paymentSummary: `${PaymentMethod.cash} + ${PaymentMethod.card}`,
      isWithinCurrentShift: true,
      allowedOperations: { voidTotal: true, partialReturn: true },
    });
    expect(lookup?.returnableItems).toHaveLength(1);
    expect(lookup?.payments[0]).toEqual({
      paymentId: ids.paymentCash,
      method: PaymentMethod.cash,
      amount: 20,
      status: apiReturnEligibility.payments[0]!.status,
    });
  });

  it("GetReturnSaleLookup devuelve null si la venta no existe y exige documento", async () => {
    const { repositories, posApi } = createPosRepositories();
    posApi.getReturnEligibility.mockResolvedValueOnce(null);
    const service = new GetReturnSaleLookupService(repositories);

    expect(await service.execute({ ...returnContext, documentNumber: "V-999" })).toBeNull();
    await expect(service.execute({ ...returnContext, documentNumber: "  " })).rejects.toThrow(
      "El numero de documento es requerido.",
    );
  });

  it("ProcessSaleReturn envía líneas sin trazabilidad con la clave de idempotencia", async () => {
    const { repositories, posApi } = createPosRepositories();

    const result = await new ProcessSaleReturnService(repositories).execute({
      ...returnContext,
      saleId: ids.sale,
      idempotencyKey: ids.request,
      reason: "Producto incorrecto",
      lines: [{ saleItemId: ids.saleItem, quantity: 1 }],
    });

    expect(posApi.processReturn).toHaveBeenCalledWith(ids.sale, ids.request, {
      reason: "Producto incorrecto",
      lines: [{ saleItemId: ids.saleItem, quantity: 1, trackingSelections: [] }],
    });
    expect(result).toEqual(mapApiReturnResult(ids.sale, apiReversalEffect));
  });

  it("VoidSale anula en el backend con la clave de idempotencia", async () => {
    const { repositories, posApi } = createPosRepositories();

    const result = await new VoidSaleService(repositories).execute({
      ...returnContext,
      saleId: ids.sale,
      idempotencyKey: ids.request,
      reason: "Venta duplicada",
    });

    expect(posApi.voidSale).toHaveBeenCalledWith(ids.sale, ids.request, { reason: "Venta duplicada" });
    expect(result).toEqual(mapApiVoidResult(apiVoidResult));
  });

  it("las mutaciones exigen permiso y la capacidad POS del plan", async () => {
    const noPermission = createPosRepositories({ role: { permissions: ["pos.returns.read"] } });
    await expect(
      new VoidSaleService(noPermission.repositories).execute({
        ...returnContext,
        saleId: ids.sale,
        idempotencyKey: ids.request,
        reason: "x",
      }),
    ).rejects.toThrow("No dispone de permisos para realizar esta operación.");

    const noPos = createPosRepositories({ planCapabilities: [] });
    await expect(
      new ProcessSaleReturnService(noPos.repositories).execute({
        ...returnContext,
        saleId: ids.sale,
        idempotencyKey: ids.request,
        reason: "x",
        lines: [],
      }),
    ).rejects.toThrow();
    expect(noPos.posApi.processReturn).not.toHaveBeenCalled();
  });

  it("los mappers conservan los efectos confirmados por el backend", () => {
    expect(mapApiReturnResult(ids.sale, apiReversalEffect)).toEqual({
      saleId: ids.sale,
      saleStatus: SaleStatus.partially_returned,
      operationType: "return",
      operationId: ids.operation,
      amount: 48.76,
      inventoryMovementIds: [ids.inventoryMovement],
      cashMovementIds: [ids.movement],
      inventoryRestored: true,
      cashMovementRecorded: true,
      cashMovementAmount: 48.76,
      idempotent: false,
    });
    expect(mapApiVoidResult(apiVoidResult)).toMatchObject({
      saleId: ids.sale,
      documentNumber: "V-100",
      saleStatus: SaleStatus.cancelled,
      operationType: "void",
      amount: 98.76,
      cashMovementRecorded: false,
      cashMovementAmount: undefined,
      idempotent: true,
    });
  });
});
