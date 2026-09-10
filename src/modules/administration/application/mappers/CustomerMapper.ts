import type { Customer } from "@/core/entities";
import type { CustomerDto } from "@/modules/administration/application/dto/CustomerDto";

export function toCustomerDto(customer: Customer): CustomerDto {
  return {
    id: customer.id,
    userId: customer.userId,
    code: customer.code,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    segmentId: customer.segmentId,
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}
