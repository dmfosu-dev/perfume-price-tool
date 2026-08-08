import { AppHeader } from "@/components/AppHeader";
import { OfflineProvider } from "@/components/OfflineSync";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { requireApprovedUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireApprovedUser();
  return (
    <>
      <ServiceWorkerRegistrar />
      <AppHeader user={user}>
        <OfflineProvider>{children}</OfflineProvider>
      </AppHeader>
    </>
  );
}
