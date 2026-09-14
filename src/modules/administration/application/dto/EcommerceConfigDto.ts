import type { EcommerceConfig } from "@/core/entities";
import type { UpdateEcommerceConfigInput } from "@/core/repositories";

export type EcommerceConfigDto = Omit<EcommerceConfig, "tenantId">;

export type EcommerceConfigInputDto = UpdateEcommerceConfigInput;
