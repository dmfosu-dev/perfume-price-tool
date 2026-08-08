import { Alert, Card, StatusBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserAction } from "./UserActions";

export const metadata = { title: "Users · Perfume Price Tool" };

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      approvedAt: true,
      lastLoginAt: true,
      // Spec §3.5: per-user activity summary. Verification entries are excluded
      // — confirming a price is unchanged is not an update.
      _count: {
        select: { priceChanges: { where: { entryType: "price_change" } } },
      },
    },
  });

  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Users
      </h1>
      <p className="mt-1 text-sm text-muted">
        Approve sourcing agents before they can sign in.
      </p>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Pending signups
          {pending.length > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
              {pending.length}
            </span>
          ) : null}
        </h2>

        {pending.length === 0 ? (
          <Alert tone="info">No signups are waiting for a decision.</Alert>
        ) : (
          <ul className="space-y-3">
            {pending.map((user) => (
              <li key={user.id}>
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {user.email}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Requested {formatDate(user.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <UserAction userId={user.id} action="approve" variant="primary" />
                      <UserAction
                        userId={user.id}
                        action="reject"
                        confirm={`Reject the signup request from ${user.email}?`}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          All accounts
        </h2>

        <ul className="space-y-3">
          {others.map((user) => {
            const isSelf = user.id === admin.id;
            const isAdminAccount = user.role === "admin";

            return (
              <li key={user.id}>
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground">
                          {user.email}
                        </p>
                        <StatusBadge status={user.status} />
                        {isAdminAccount ? (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white-sunken">
                            admin
                          </span>
                        ) : null}
                        {isSelf ? (
                          <span className="text-xs text-muted">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Last login {formatDate(user.lastLoginAt)} ·{" "}
                        {user._count.priceChanges} price{" "}
                        {user._count.priceChanges === 1 ? "update" : "updates"} · approved{" "}
                        {formatDate(user.approvedAt)}
                      </p>
                    </div>

                    {isAdminAccount ? null : (
                      <div className="flex gap-2">
                        {user.status === "approved" ? (
                          <>
                            <UserAction
                              userId={user.id}
                              action="suspend"
                              confirm={`Suspend ${user.email}? They will be signed out immediately.`}
                            />
                            <UserAction
                              userId={user.id}
                              action="revoke"
                              variant="danger"
                              confirm={`Revoke access for ${user.email}? This cannot be undone.`}
                            />
                          </>
                        ) : null}
                        {user.status === "suspended" ? (
                          <>
                            <UserAction
                              userId={user.id}
                              action="approve"
                              variant="primary"
                            />
                            <UserAction
                              userId={user.id}
                              action="revoke"
                              variant="danger"
                              confirm={`Revoke access for ${user.email}? This cannot be undone.`}
                            />
                          </>
                        ) : null}
                        {user.status === "rejected" ? (
                          <UserAction userId={user.id} action="approve" variant="primary" />
                        ) : null}
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
