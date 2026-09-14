"use client";

import { useState } from "react";
import type {
  EmployeeDto,
  EmployeeInputDto,
} from "@/modules/administration/application/dto/EmployeeDto";
import { EmployeeForm } from "@/modules/administration/components/EmployeeForm";
import { EmployeeTable } from "@/modules/administration/components/EmployeeTable";
import { useEmployees } from "@/modules/administration/hooks/useEmployees";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

type EditorState = { mode: "create" } | { mode: "edit"; employee: EmployeeDto } | null;

export function EmployeesPage() {
  const {
    branchNames,
    branchOptions,
    busy,
    canManage,
    canRead,
    create,
    employees,
    error,
    loading,
    reload,
    roleNames,
    roleOptions,
    update,
  } = useEmployees();
  const { showToast } = useToast();
  const [editor, setEditor] = useState<EditorState>(null);

  async function handleSubmit(value: EmployeeInputDto) {
    try {
      if (editor?.mode === "edit") {
        await update(editor.employee.id, value);
        showToast({ title: "Empleado actualizado", tone: "success" });
      } else {
        await create(value);
        showToast({
          title: "Empleado creado",
          description: "Se envió la invitación para que active su cuenta.",
          tone: "success",
        });
      }
      setEditor(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar el empleado",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Intentá nuevamente en unos momentos.",
        tone: "danger",
      });
    }
  }

  if (!loading && !canRead) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader description="Administrá los empleados del negocio." title="Usuarios" />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a usuarios
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Consultar empleados requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">admin.users.read</span>. Pedí
            acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={() => setEditor({ mode: "create" })} type="button">
              Nuevo empleado
            </Button>
          ) : null
        }
        description="Administrá los empleados del negocio."
        title="Usuarios"
      />

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
          <Button onClick={() => void reload()} type="button" variant="secondary">
            Reintentar
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-56 items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm font-medium text-[var(--color-text-muted)] shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-structure)]"
          />
          Cargando empleados...
        </div>
      ) : (
        <EmployeeTable
          branchNames={branchNames}
          canManage={canManage}
          employees={employees}
          onEdit={(employee) => setEditor({ mode: "edit", employee })}
          roleNames={roleNames}
        />
      )}

      <Modal
        onClose={() => setEditor(null)}
        open={Boolean(editor)}
        size="lg"
        subtitle="Los cambios se aplican únicamente al negocio activo."
        title={editor?.mode === "edit" ? "Editar empleado" : "Nuevo empleado"}
      >
        {editor ? (
          <EmployeeForm
            branchOptions={branchOptions}
            busy={busy}
            employee={editor.mode === "edit" ? editor.employee : undefined}
            key={editor.mode === "edit" ? editor.employee.id : "new"}
            onCancel={() => setEditor(null)}
            onSubmit={handleSubmit}
            roleOptions={roleOptions}
          />
        ) : null}
      </Modal>
    </div>
  );
}
