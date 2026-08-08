import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";

export { getCurrentUser };
export type { SessionUser };

/// Signed in, whatever their status.
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/// Signed in AND approved. Anyone pending/suspended/rejected/revoked is sent to
/// /account, which explains their specific status rather than failing silently.
export async function requireApprovedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.status !== "approved") redirect("/account");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireApprovedUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

/// Where a freshly authenticated user belongs.
export function landingPathFor(user: Pick<SessionUser, "role" | "status">): string {
  if (user.status !== "approved") return "/account";
  return user.role === "admin" ? "/admin/users" : "/dashboard";
}
