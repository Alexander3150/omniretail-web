import type { UserType } from "@/core/enums";

/**
 * Forma del formulario de login (capa UI). El futuro useLogin (PR6) la
 * mapea a AuthRepository.LoginInput (que ya tiene expectedUserType desde
 * PR3) agregando deviceLabel/rememberMe segun corresponda.
 */
export interface LoginFormDto {
  email: string;
  password: string;
  rememberMe: boolean;
  expectedUserType: UserType;
}
