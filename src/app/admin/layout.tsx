import { AppHeader } from "@/components/AppHeader";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return <AppHeader user={user}>{children}</AppHeader>;
}
