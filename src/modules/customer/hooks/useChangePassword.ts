"use client";

import { useCallback, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { ChangePasswordFormDto } from "@/modules/customer/application/dto/ChangePasswordFormDto";

/**
 * Resuelve el sessionId con repositories.auth.getCurrentSessionId() --
 * igual que hace CurrentSessionProvider internamente -- y nunca acepta un
 * userId/sessionId elegido por el caller. No cierra la sesión actual ni
 * redirige: sigue viva a propósito (solo se revocan las demás, ver
 * AuthRepository.changePassword).
 */
export function useChangePassword() {
  const repositories = useRepositories();
  const [busy, setBusy] = useState(false);

  const changePassword = useCallback(
    async (dto: ChangePasswordFormDto) => {
      setBusy(true);
      try {
        const sessionId = await repositories.auth.getCurrentSessionId();
        if (!sessionId) {
          throw new Error("Tu sesión ya no es válida. Vuelve a iniciar sesión.");
        }
        await repositories.auth.changePassword({
          sessionId,
          currentPasswordMock: dto.currentPassword,
          newPasswordMock: dto.newPassword,
        });
      } finally {
        setBusy(false);
      }
    },
    [repositories],
  );

  return { busy, changePassword };
}
