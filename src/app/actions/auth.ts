"use server";

import { redirect } from "next/navigation";
import { landingPathFor } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { dummyPasswordHash, hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";

export type AuthFormState = {
  error?: string;
  /// Set when credentials were correct but the account cannot log in yet, so
  /// the form can explain why instead of showing a generic failure (spec §3.1).
  blockedStatus?: string;
  success?: boolean;
  /// Echoed back so a failed attempt does not clear the field. Retyping an
  /// address on a phone is exactly the friction this tool should avoid.
  email?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", email };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, email };
  }
  if (password !== confirmPassword) return { error: "Passwords do not match.", email };

  const passwordHash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: { email, passwordHash, role: "intermediary", status: "pending" },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { error: "An account with that email already exists.", email };
    }
    throw error;
  }

  return { success: true };
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password.", email };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, role: true, status: true },
  });

  // Always run a verification, even for unknown emails, so timing does not
  // reveal which addresses are registered.
  const matches = await verifyPassword(
    password,
    user?.passwordHash ?? (await dummyPasswordHash()),
  );

  if (!user || !matches) return { error: "Incorrect email or password.", email };
  if (user.status !== "approved") return { blockedStatus: user.status, email };

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id);

  // redirect() throws internally, so it must sit outside any try/catch.
  redirect(landingPathFor(user));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
