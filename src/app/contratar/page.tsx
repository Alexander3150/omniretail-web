import type { Metadata } from "next";
import { PublicContractPage } from "@/modules/contracting/pages/PublicContractPage";

export const metadata: Metadata = {
  title: "Contrata MARJYM Base",
  description: "Crea tu negocio con MARJYM Base.",
};

export default function ContractRoutePage() {
  return <PublicContractPage />;
}
