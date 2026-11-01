import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * The single way emails are normalized before they are stored or looked up:
 * trimmed and lowercased. The database backs it with a CHECK constraint
 * (`users_email_normalized_check`), so an email that skipped this helper is
 * rejected instead of creating a case-variant duplicate.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Email typed by a user, normalized before it is validated. */
export const emailSchema = z
  .string()
  .overwrite(normalizeEmail)
  .pipe(z.email().max(254));

/**
 * Signed-in user as returned by the auth API. Never add credentials here:
 * the password hash must not leave the API.
 */
export const authUserSchema = z.object({
  id: idSchema,
  email: z.string(),
  name: z.string(),
  emailVerified: z.boolean(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const membershipRoleSchema = z.enum([
  'owner',
  'nutritionist',
  'assistant',
]);

export const patientRelationshipSchema = z.enum(['self', 'guardian']);

/** A clinic the signed-in user works in. */
export const authMembershipSchema = z.object({
  clinicId: idSchema,
  clinicName: z.string(),
  role: membershipRoleSchema,
});

/** A patient the signed-in user can see in the portal. */
export const authPatientAccessSchema = z.object({
  patientId: idSchema,
  firstName: z.string(),
  lastName: z.string(),
  relationship: patientRelationshipSchema,
});

/**
 * Response of `GET /api/auth/me`: who is signed in and where the web app can
 * send them. Lists only the user's own clinics and patients.
 */
export const authMeSchema = z.object({
  user: authUserSchema,
  memberships: z.array(authMembershipSchema),
  patientAccess: z.array(authPatientAccessSchema),
});

export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type PatientRelationship = z.infer<typeof patientRelationshipSchema>;
export type AuthMembership = z.infer<typeof authMembershipSchema>;
export type AuthPatientAccess = z.infer<typeof authPatientAccessSchema>;
export type AuthMe = z.infer<typeof authMeSchema>;

/**
 * Longest password accepted. Hashing cost grows with input length, so an
 * unbounded password would let one request burn CPU (denial of service).
 */
export const PASSWORD_MAX_LENGTH = 256;

/** Body of `POST /api/auth/sign-in`. The password is never trimmed. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type SignIn = z.infer<typeof signInSchema>;

/**
 * Shortest new password, in Unicode code points. NIST SP 800-63B-4 (§3.1.1.2)
 * requires 15 when the password is the only factor, as it is here.
 */
export const PASSWORD_MIN_LENGTH = 15;

/**
 * A new password (sign-up, password reset). Length is the only rule: NIST
 * forbids composition rules (mixtures of character types). Each code point
 * counts as one character, so emoji and accents are not penalized. Never
 * trimmed; the API applies NFC before hashing.
 */
export const passwordSchema = z
  .string()
  .max(PASSWORD_MAX_LENGTH)
  .refine((password) => Array.from(password).length >= PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  });

const signUpNameSchema = z.string().trim().min(1).max(100);

/** Body of `POST /api/auth/sign-up`. */
export const signUpSchema = z.object({
  name: signUpNameSchema,
  email: emailSchema,
  password: passwordSchema,
  clinicName: signUpNameSchema,
});

export type SignUp = z.infer<typeof signUpSchema>;

/** Body of `POST /api/auth/onboarding`. */
export const onboardingSchema = z.object({ clinicName: signUpNameSchema });

export type Onboarding = z.infer<typeof onboardingSchema>;

/** Body of `POST /api/auth/forgot-password`. */
export const forgotPasswordSchema = z.object({ email: emailSchema });

export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;

/**
 * A one-time token from an emailed link. Only bounded here: an unknown or
 * malformed token fails the same way as an expired one.
 */
export const oneTimeTokenSchema = z.string().min(1).max(256);

/** Body of `POST /api/auth/reset-password`. */
export const resetPasswordSchema = z.object({
  token: oneTimeTokenSchema,
  password: passwordSchema,
});

export type ResetPassword = z.infer<typeof resetPasswordSchema>;

/** Body of `POST /api/auth/verify-email`. */
export const verifyEmailSchema = z.object({ token: oneTimeTokenSchema });

export type VerifyEmail = z.infer<typeof verifyEmailSchema>;

/** Body of `POST /api/auth/resend-verification`. */
export const resendVerificationSchema = z.object({ email: emailSchema });

export type ResendVerification = z.infer<typeof resendVerificationSchema>;
