import type { User } from "@/core/entities";
import type { UserStatus } from "@/core/enums";
export interface UserRepository {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  create(input: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
  update(id: string, input: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User>;
  updateStatus(id: string, status: UserStatus): Promise<User>;
}
