/**
 * Forma del formulario de login (capa UI). useLogin la mapea a
 * AuthRepository.LoginInput agregando deviceLabel segun corresponda.
 *
 * Sin selector de tipo de cuenta (Cliente/Personal): el sistema ya puede
 * identificar si la sesion es de un Customer o un Employee despues de
 * autenticar (Session.userId -> User.type), asi que pedirselo al usuario
 * en el form no aporta seguridad y era redundante -- ver AuthRepository.
 * LoginInput.expectedUserType, que sigue existiendo como campo opcional
 * para otros posibles llamadores, simplemente ya no lo alimenta el login.
 */
export interface LoginFormDto {
  email: string;
  password: string;
  rememberMe: boolean;
}
