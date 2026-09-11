"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CashShift } from "@/core/entities";
import type { CashMovementType } from "@/core/enums";
import type { DataEventPayload } from "@/core/types/events.types";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type { CashMovementDto } from "@/modules/pos/application/dto/CashMovementDto";
import type { CashShiftSummaryDto } from "@/modules/pos/application/dto/CashShiftSummaryDto";
import { CloseCashShiftService } from "@/modules/pos/application/services/CloseCashShiftService";
import { GetCashShiftMovementsService } from "@/modules/pos/application/services/GetCashShiftMovementsService";
import { GetCashShiftSummaryService } from "@/modules/pos/application/services/GetCashShiftSummaryService";
import { GetOpenCashShiftService } from "@/modules/pos/application/services/GetOpenCashShiftService";
import { OpenCashShiftService } from "@/modules/pos/application/services/OpenCashShiftService";
import { RegisterCashMovementService } from "@/modules/pos/application/services/RegisterCashMovementService";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

export interface OpenCashShiftFormInput {
  registerCode: string;
  openingAmount: number;
}

export interface CashMovementFormInput {
  type: CashMovementType;
  amount: number;
  reason: string;
}

export function usePosCashShift() {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const {
    user,
    canAccessBranch,
    hasPermission,
    loading: sessionLoading,
    error: sessionError,
  } = useCurrentSession();
  const services = useMemo(
    () => ({
      close: new CloseCashShiftService(repositories),
      getMovements: new GetCashShiftMovementsService(repositories),
      getOpen: new GetOpenCashShiftService(repositories),
      getSummary: new GetCashShiftSummaryService(repositories),
      open: new OpenCashShiftService(repositories),
      registerMovement: new RegisterCashMovementService(repositories),
    }),
    [repositories],
  );
  const [cashShift, setCashShift] = useState<CashShift | null>(null);
  const [summary, setSummary] = useState<CashShiftSummaryDto | null>(null);
  const [movements, setMovements] = useState<CashMovementDto[]>([]);
  const [lastClosedShift, setLastClosedShift] = useState<CashShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const mutationLockRef = useRef(false);
  const reloadSequenceRef = useRef(0);

  const hasBranchAccess = Boolean(
    user &&
    currentBranch &&
    user.tenantId === currentBranch.tenantId &&
    canAccessBranch(currentBranch.id),
  );

  const getContext = useCallback(() => {
    if (!user || !currentBranch || !hasBranchAccess) {
      throw new Error("No hay una sesión y sucursal válidas para operar caja.");
    }
    return {
      tenantId: currentBranch.tenantId,
      actorUserId: user.id,
      branchId: currentBranch.id,
    };
  }, [currentBranch, hasBranchAccess, user]);

  const reload = useCallback(async () => {
    const requestId = reloadSequenceRef.current + 1;
    reloadSequenceRef.current = requestId;
    if (branchLoading || sessionLoading) return;
    setLoading(true);
    setError(null);

    try {
      const context = getContext();
      const openShift = await services.getOpen.execute(context);
      if (requestId !== reloadSequenceRef.current) return;
      setCashShift(openShift);
      if (!openShift) {
        setSummary(null);
        setMovements([]);
        return;
      }

      const [nextSummary, nextMovements] = await Promise.all([
        services.getSummary.execute({ ...context, cashShiftId: openShift.id }),
        services.getMovements.execute({ ...context, cashShiftId: openShift.id }),
      ]);
      if (requestId !== reloadSequenceRef.current) return;
      setSummary(nextSummary);
      setMovements(nextMovements);
    } catch (loadError) {
      if (requestId !== reloadSequenceRef.current) return;
      setCashShift(null);
      setSummary(null);
      setMovements([]);
      setError(toMessage(loadError, sessionError ?? "No se pudo cargar el estado de caja."));
    } finally {
      if (requestId === reloadSequenceRef.current) setLoading(false);
    }
  }, [branchLoading, getContext, services, sessionError, sessionLoading]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (active) void reload();
    });
    return () => {
      active = false;
    };
  }, [reload]);

  const handleCashShiftEvent = useCallback(
    (payload: DataEventPayload) => {
      if (payload.tenantId && payload.tenantId !== currentBranch?.tenantId) return;
      if (payload.branchId && payload.branchId !== currentBranch?.id) return;
      if (payload.entityId && cashShift && payload.entityId !== cashShift.id) return;
      void reload();
    },
    [cashShift, currentBranch, reload],
  );
  useDataEvent("cash-shift.changed", handleCashShiftEvent);

  const runMutation = useCallback(async <T>(operation: () => Promise<T>) => {
    if (mutationLockRef.current) return null;
    mutationLockRef.current = true;
    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      return await operation();
    } catch (mutationError) {
      setError(toMessage(mutationError, "No se pudo completar la operación de caja."));
      return null;
    } finally {
      mutationLockRef.current = false;
      setMutationLoading(false);
    }
  }, []);

  const openCashShift = useCallback(
    async (input: OpenCashShiftFormInput) => {
      const opened = await runMutation(() => services.open.execute({ ...getContext(), ...input }));
      if (!opened) return false;
      setLastClosedShift(null);
      setSuccessMessage(`Caja ${opened.registerCode} abierta correctamente.`);
      await reload();
      return true;
    },
    [getContext, reload, runMutation, services.open],
  );

  const registerMovement = useCallback(
    async (input: CashMovementFormInput) => {
      if (!cashShift) return false;
      const movement = await runMutation(() =>
        services.registerMovement.execute({
          ...getContext(),
          cashShiftId: cashShift.id,
          ...input,
        }),
      );
      if (!movement) return false;
      setSuccessMessage("Movimiento de caja registrado correctamente.");
      await reload();
      return true;
    },
    [cashShift, getContext, reload, runMutation, services.registerMovement],
  );

  const closeCashShift = useCallback(
    async (countedAmount: number) => {
      if (!cashShift) return false;
      const closed = await runMutation(() =>
        services.close.execute({
          ...getContext(),
          cashShiftId: cashShift.id,
          countedAmount,
        }),
      );
      if (!closed) return false;
      setLastClosedShift(closed);
      setSuccessMessage("El turno de caja se cerró correctamente.");
      await reload();
      return true;
    },
    [cashShift, getContext, reload, runMutation, services.close],
  );

  const clearFeedback = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
    cashShift,
    summary,
    movements,
    lastClosedShift,
    currentBranchName: currentBranch?.name ?? null,
    currentUserName: user?.name ?? null,
    loading: loading || branchLoading || sessionLoading,
    mutationLoading,
    error,
    successMessage,
    hasBranchAccess,
    canOpen: hasPermission("pos.cash.open"),
    canRead: hasPermission("pos.cash.read"),
    canRegisterMovement: hasPermission("pos.cash.movement.create"),
    canClose: hasPermission("pos.cash.close"),
    reload,
    openCashShift,
    registerMovement,
    closeCashShift,
    clearFeedback,
  };
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
