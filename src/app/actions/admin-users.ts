"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { destroyAllSessionsFor } from "@/lib/session";
import type { UserStatus } from "@/lib/enums";

export type AdminActionState = { error?: string; notice?: string };

/// Which transitions an admin may make, keyed by the status the user is in now.
/// Anything not listed is rejected, so a stale page cannot drive an odd change
/// like reinstating an account that was never approved.
const ALLOWED_TRANSITIONS: Record<string, UserStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["suspended", "revoked"],
  suspended: ["approved", "revoked"],
  rejected: ["approved"],
  revoked: [],
};

async function changeStatus(
  userId: string,
  next: UserStatus,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  if (!userId) return { error: "No user specified." };
  // Without this an admin could suspend themselves and lock everyone out of
  // user management, since only an admin can undo it.
  if (userId === admin.id) return { error: "You cannot change your own account status." };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true, role: true },
  });
  if (!target) return { error: "That user no longer exists." };

  if (target.role === "admin") {
    return { error: "Admin accounts cannot be changed from this screen." };
  }

  const allowed = ALLOWED_TRANSITIONS[target.status] ?? [];
  if (!allowed.includes(next)) {
    // The page that offered this button is out of date — refresh it so the
    // admin sees the real current state alongside the error.
    revalidatePath("/admin/users");
    return { error: `Cannot move ${target.email} from ${target.status} to ${next}.` };
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: next,
      statusChangedAt: now,
      statusChangedById: admin.id,
      ...(next === "approved" ? { approvedAt: now, approvedById: admin.id } : {}),
    },
  });

  // Anything other than approved must cut off live sessions straight away,
  // otherwise a suspended user keeps working until their cookie expires.
  if (next !== "approved") {
    await destroyAllSessionsFor(userId);
  }

  revalidatePath("/admin/users");
  return { notice: `${target.email} is now ${next}.` };
}

export async function approveUserAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return changeStatus(String(formData.get("userId") ?? ""), "approved");
}

export async function rejectUserAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return changeStatus(String(formData.get("userId") ?? ""), "rejected");
}

export async function suspendUserAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return changeStatus(String(formData.get("userId") ?? ""), "suspended");
}

export async function revokeUserAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return changeStatus(String(formData.get("userId") ?? ""), "revoked");
}
