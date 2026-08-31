import { z } from 'zod';

export const passwordValidation = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password is too long')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

export const usernameValidation = z
  .string()
  .min(3, 'Username must be at least 3 characters long')
  .max(30, 'Username must not exceed 30 characters')
  .regex(/^[a-zA-Z0-9._]+$/, 'Username can only contain letters, numbers, dots, and underscores')
  .refine((val) => !val.startsWith('.') && !val.endsWith('.'), {
    message: 'Username cannot start or end with a period',
  })
  .refine((val) => !val.includes('..'), {
    message: 'Username cannot contain consecutive periods',
  });

export const registerSchema = z.object({
  username: usernameValidation,
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must not exceed 50 characters')
    .trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  password: passwordValidation,
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  otp: z
    .string()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain only numbers'),
  type: z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET']).default('EMAIL_VERIFICATION'),
});

export const resendOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  type: z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET']),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  otp: z
    .string()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain only numbers'),
  newPassword: passwordValidation,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

