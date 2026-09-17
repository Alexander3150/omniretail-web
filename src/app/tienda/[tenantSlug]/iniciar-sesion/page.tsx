import { Suspense } from "react";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
export default function Page() { return <Suspense fallback={null}><LoginPage /></Suspense>; }
