"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { destroyAllSessionsFor } from "@/lib/session";

export type AccountState = { error?: string; notice?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Changing your own sign-in address. The current password is required: an
 * unattended session would otherwise be enough to move the account to an
 * attacker's mailbox.
 */
export async function changeEmail(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("currentPassword") ?? "");

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (!password) return { error: "Enter your current password to confirm." };
  if (email === user.email) return { notice: "That is already your email." };

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return { error: "Account not found." };
  if (!(await verifyPassword(password, record.passwordHash))) {
    return { error: "That password is not correct." };
  }

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) return { error: "Another account already uses that email." };

  await prisma.user.update({ where: { id: user.id }, data: { email } });

  revalidatePath("/account");
  return { notice: `Sign-in email changed to ${email}.` };
}

export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current) return { error: "Enter your current password." };
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (next !== confirm) return { error: "The new passwords do not match." };
  if (next === current) return { error: "That is the same as your current password." };

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return { error: "Account not found." };
  if (!(await verifyPassword(current, record.passwordHash))) {
    return { error: "That password is not correct." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  // Every other device is signed out. A password change is normally a response
  // to a suspected leak, so leaving old sessions alive would defeat the point.
  await destroyAllSessionsFor(user.id);

  revalidatePath("/account");
  return { notice: "Password changed. You will need to sign in again." };
}
