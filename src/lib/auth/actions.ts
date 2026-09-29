"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { enforceRateLimit, RateLimitError } from "@/lib/rateLimit";
import { generateUniqueDisplayName } from "./displayName";
import { checkCustomDisplayName } from "./displayNameRules";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession, getCurrentUser } from "./session";
import { generateToken } from "./tokens";
import { consumeEmailVerificationToken } from "./verifyEmail";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type FormState = { error: string } | { success: true } | null;

function baseUrl() {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

export async function signup(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await enforceRateLimit("signup", 5);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }

  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists" };
  }

  const passwordHash = await hashPassword(password);
  const displayName = await generateUniqueDisplayName();

  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });

  const token = generateToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      token,
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  await sendVerificationEmail(email, `${baseUrl()}/verify?token=${token}`);

  redirect("/signup/check-email");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required"),
});

export async function login(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await enforceRateLimit("login", 15);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password" };
  }

  if (!user.emailVerified) {
    return {
      error:
        "Please verify your email before logging in — check your inbox for the link.",
    };
  }

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const requestResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function requestPasswordReset(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await enforceRateLimit("requestPasswordReset", 5);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }

  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  // Always report success, whether or not the account exists, so this
  // form can't be used to enumerate registered email addresses.
  if (user) {
    const token = generateToken();
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
    await sendPasswordResetEmail(
      user.email,
      `${baseUrl()}/reset-password?token=${token}`
    );
  }

  return { success: true };
}

const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function resetPassword(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { token, password } = parsed.data;

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (
    !verificationToken ||
    verificationToken.type !== "PASSWORD_RESET" ||
    verificationToken.usedAt ||
    verificationToken.expiresAt < new Date()
  ) {
    return {
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { passwordHash },
    }),
    prisma.verificationToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
    // Any active sessions were established under the old password; drop them.
    prisma.session.deleteMany({ where: { userId: verificationToken.userId } }),
  ]);

  redirect("/login");
}

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

// Self-service, immediate, hard delete (TASKS.md 8.2, resolved 2026-09-28):
// this is a small single-instance deployment with no admin queue to route
// deletion requests through, so gating it behind an admin adds latency and
// a second person to a request the user is already authenticated for.
// Cascading FKs on Session/VerificationToken/Submission (see schema.prisma)
// mean a single `user.delete` leaves no orphaned rows.
export async function deleteAccount(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to delete your account." };
  }

  if (formData.get("confirmDelete") !== "on") {
    return { error: "Please confirm you understand this cannot be undone." };
  }

  const parsed = deleteAccountSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect password" };
  }

  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/login?deleted=1");
}

// Consumes the emailed verification token. Triggered by the button on `/verify`
// rather than by loading the page, so link scanners that only GET the URL
// can't use up the single-use token before the user clicks.
export async function confirmEmail(formData: FormData) {
  const token = formData.get("token");
  const result =
    typeof token === "string" && token
      ? await consumeEmailVerificationToken(token)
      : "invalid";
  redirect(`/verify?result=${result}`);
}

// Lets a logged-in user pick their own display name, or swap to a fresh random
// laureate. Uniqueness is checked case-insensitively up front, with the DB's
// unique constraint (P2002) as the backstop for two people racing for a name.
export async function updateDisplayName(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be logged in to change your name." };

  try {
    await enforceRateLimit("rename", 10);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }

  let name: string;
  if (formData.get("intent") === "random") {
    name = await generateUniqueDisplayName();
  } else {
    const check = checkCustomDisplayName(
      String(formData.get("displayName") ?? "")
    );
    if ("error" in check) return { error: check.error };
    name = check.name;
  }

  const clash = await prisma.user.findFirst({
    where: {
      displayName: { equals: name, mode: "insensitive" },
      NOT: { id: user.id },
    },
    select: { id: true },
  });
  if (clash) return { error: "That name is already taken" };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { displayName: name },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { error: "That name is already taken" };
    }
    throw err;
  }

  revalidatePath("/");
  return { success: true };
}
