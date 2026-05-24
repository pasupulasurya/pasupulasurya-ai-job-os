import { z } from "zod";

/**
 * Authentication schemas — used by both client (form validation)
 * and server (input sanitization).
 *
 * Single source of truth for what a valid email/password looks like.
 */

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Must be at least 8 characters")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const magicLinkSchema = z.object({
  email: emailSchema,
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
