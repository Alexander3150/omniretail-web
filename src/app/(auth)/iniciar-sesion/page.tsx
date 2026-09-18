import { Suspense } from "react";
import { LoginPage } from "@/modules/auth/pages/LoginPage";

export default function IniciarSesionPage() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
