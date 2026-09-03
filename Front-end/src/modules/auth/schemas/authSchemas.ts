export type LoginFormErrors = Partial<Record<"email" | "password", string>>;

export type RegisterFormErrors = Partial<
  Record<"fullName" | "email" | "password" | "confirmPassword" | "terms", string>
>;

export function validateLoginForm(data: FormData): {
  isValid: boolean;
  errors: LoginFormErrors;
  firstErrorField?: "email" | "password";
} {
  const errors: LoginFormErrors = {};
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");

  if (!email || !email.includes("@")) {
    errors.email = "Informe um e-mail válido.";
  }

  if (!password) {
    errors.password = "Informe sua senha.";
  }

  const errorKeys = Object.keys(errors) as Array<keyof LoginFormErrors>;
  return {
    isValid: errorKeys.length === 0,
    errors,
    firstErrorField: errorKeys[0],
  };
}

export function validateRegisterForm(data: FormData): {
  isValid: boolean;
  errors: RegisterFormErrors;
  firstErrorField?: keyof RegisterFormErrors;
} {
  const errors: RegisterFormErrors = {};
  const fullName = String(data.get("fullName") ?? "").trim();
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");
  const confirmPassword = String(data.get("confirmPassword") ?? "");
  const terms = data.get("terms");

  if (fullName.length < 3) {
    errors.fullName = "Informe seu nome completo (mínimo de 3 caracteres).";
  }

  if (!email || !email.includes("@")) {
    errors.email = "Informe um e-mail válido.";
  }

  if (password.length < 8) {
    errors.password = "A senha deve ter pelo menos 8 caracteres.";
  }

  if (password && confirmPassword && password !== confirmPassword) {
    errors.confirmPassword = "As senhas não coincidem.";
  } else if (!confirmPassword) {
    errors.confirmPassword = "Confirme sua senha.";
  }

  if (terms !== "on" && terms !== "true") {
    errors.terms = "Você deve concordar com os Termos de Uso para continuar.";
  }

  const errorKeys = Object.keys(errors) as Array<keyof RegisterFormErrors>;
  return {
    isValid: errorKeys.length === 0,
    errors,
    firstErrorField: errorKeys[0],
  };
}
