import {
  Alert,
  Badge,
  Card,
  PageHeader,
  SectionTitle,
  Stat,
  StatusBadge,
  Th,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserAction } from "./UserActions";

export const metadata = { title: "Users · Aromatic Ghana" };

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
  const approved = users.filter((u) => u.status === "approved").length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      <PageHeader
        title="Users"
        description="Sourcing agents must be approved before they can sign in."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <Stat
          label="Pending"
          value={pending.length}
          tone={pending.length > 0 ? "warning" : "default"}
        />
        <Stat label="Approved" value={approved} />
      </div>

      <section className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <SectionTitle>Pending signups</SectionTitle>
          {pending.length > 0 ? (
            <span className="nums inline-flex min-w-5 items-center justify-center rounded-full bg-warning-bg px-1.5 text-[11px] font-bold text-warning-fg">
              {pending.length}
            </span>
          ) : null}
        </div>

        {pending.length === 0 ? (
          <Alert tone="info">No signups are waiting for a decision.</Alert>
        ) : (
          <ul className="space-y-2.5">
            {pending.map((user) => (
              <li key={user.id}>
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
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

      <section>
        <div className="mb-2">
          <SectionTitle>All accounts</SectionTitle>
        </div>

        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] border-collapse text-left">
              <thead className="bg-surface-sunken">
                <tr>
                  <Th>Account</Th>
                  <Th>Status</Th>
                  <Th>Last login</Th>
                  <Th align="right">Updates</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {others.map((user) => {
                  const isSelf = user.id === admin.id;
                  const isAdminAccount = user.role === "admin";

                  return (
                    <tr key={user.id} className="border-t border-line align-middle">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {user.email}
                          </span>
                          {isAdminAccount ? <Badge tone="solid">admin</Badge> : null}
                          {isSelf ? (
                            <span className="text-xs text-muted-soft">you</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs capitalize text-muted-soft">
                          {user.role}
                          {user.approvedAt
                            ? ` · approved ${formatDate(user.approvedAt)}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="nums px-4 py-3 text-sm text-muted">
                        {formatDate(user.lastLoginAt)}
                      </td>
                      <td className="nums px-4 py-3 text-right text-sm text-foreground">
                        {user._count.priceChanges}
                      </td>
                      <td className="px-4 py-3">
                        {isAdminAccount ? null : (
                          <div className="flex justify-end gap-2">
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
                              <UserAction
                                userId={user.id}
                                action="approve"
                                variant="primary"
                              />
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </main>
  );
}
