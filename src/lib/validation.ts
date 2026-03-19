import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z
    .string()
    .min(8, "Пароль должен содержать минимум 8 символов")
    .max(128, "Пароль слишком длинный"),
  firstName: z.string().min(1, "Имя обязательно").max(100),
  lastName: z.string().min(1, "Фамилия обязательна").max(100),
  phone: z.string().max(20).optional(),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Пароль обязателен"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Некорректный email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  password: z
    .string()
    .min(8, "Пароль должен содержать минимум 8 символов")
    .max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
