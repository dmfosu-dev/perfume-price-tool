import { logoutAction } from "@/app/actions/auth";
import { AppShell, type NavItem } from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/// Server wrapper: counts the badges, then hands the shell to the client.
export async function AppHeader({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const isAdmin = user.role === "admin";

  const [pendingUsers, openReports, openConflicts] = isAdmin
    ? await Promise.all([
        prisma.user.count({ where: { status: "pending" } }),
        prisma.discrepancyReport.count({ where: { status: "open" } }),
        prisma.priceConflict.count({ where: { status: "open" } }),
      ])
    : [0, 0, 0];

  const items: NavItem[] = [
    { href: "/dashboard", label: "Catalogue", icon: "🧴" },
    ...(isAdmin
      ? [
          { href: "/admin/catalogue", label: "Products", icon: "📦" },
          { href: "/admin/planning", label: "Planning", icon: "📈" },
          { href: "/admin/history", label: "History", icon: "🕘" },
          {
            href: "/admin/conflicts",
            label: "Conflicts",
            icon: "⚠️",
            badge: openConflicts,
          },
          { href: "/admin/discrepancies", label: "Issues", icon: "🚩", badge: openReports },
          { href: "/admin/fx", label: "Currencies", icon: "💱" },
          { href: "/admin/import", label: "Import", icon: "⬆️" },
          { href: "/admin/users", label: "Users", icon: "👥", badge: pendingUsers },
        ]
      : []),
    { href: "/account", label: "My account", icon: "⚙️" },
  ];

  return (
    <AppShell
      items={items}
      userEmail={user.email}
      role={user.role}
      signOut={
        <form action={logoutAction}>
          <SubmitButton variant="neutral" size="sm" className="w-full">
            Sign out
          </SubmitButton>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
