import type { ReactNode } from "react";
import { CurrentSessionProvider } from "@/modules/auth/providers/CurrentSessionProvider";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <CurrentSessionProvider>
      {children}
    </CurrentSessionProvider>
  );
}
