import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "./prisma";

const COOKIE_NAME = "ppt_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Only the digest is persisted; the raw token lives solely in the cookie.
function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await prisma.session.create({
    data: { userId, tokenHash: digest(token), expiresAt },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: digest(token) } });
  }
  store.delete(COOKIE_NAME);
}

/// Drops every session for a user. Called when an admin suspends or revokes an
/// account so the change takes effect immediately rather than at cookie expiry.
export async function destroyAllSessionsFor(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  status: string;
};

/// Wrapped in cache() so a layout, its page and the header share one lookup per
/// request instead of each hitting the database.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, role: true, status: true } },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
});
