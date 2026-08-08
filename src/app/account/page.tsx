import { logoutAction } from "@/app/actions/auth";
import { AppHeader } from "@/components/AppHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Card, PageHeader, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ChangeEmailForm, ChangePasswordForm } from "./AccountForms";

export const metadata = { title: "My account · Aromatic Ghana" };

const BLOCKED: Record<
  string,
  { tone: "warning" | "error"; title: string; body: string }
> = {
  pending: {
    tone: "warning",
    title: "Waiting for approval",
    body: "Your account has been created but an administrator has not approved it yet. You will get access to the catalogue as soon as they do.",
  },
  suspended: {
    tone: "warning",
    title: "Account suspended",
    body: "An administrator has suspended this account. Contact them to have it reinstated.",
  },
  rejected: {
    tone: "error",
    title: "Signup not approved",
    body: "This signup request was not approved. Contact an administrator if you think that is a mistake.",
  },
  revoked: {
    tone: "error",
    title: "Access revoked",
    body: "Access for this account has been revoked. Contact an administrator if you need it restored.",
  },
};

export default async function AccountPage() {
  const user = await requireUser();

  // Not yet approved: no shell, no settings — just why they cannot get in.
  if (user.status !== "approved") {
    const message = BLOCKED[user.status] ?? BLOCKED.pending;
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <Card>
          <div className="space-y-4">
            <Alert tone={message.tone} title={message.title}>
              {message.body}
            </Alert>
            <p className="text-sm text-muted">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>
            </p>
            <form action={logoutAction}>
              <SubmitButton variant="neutral" className="w-full">
                Sign out
              </SubmitButton>
            </form>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <AppHeader user={user}>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <PageHeader
          title="My account"
          description="Change the email and password you sign in with."
        />

        <div className="space-y-4">
          <Card>
            <SectionTitle>Email</SectionTitle>
            <div className="mt-3">
              <ChangeEmailForm currentEmail={user.email} />
            </div>
          </Card>

          <Card>
            <SectionTitle>Password</SectionTitle>
            <div className="mt-3">
              <ChangePasswordForm />
            </div>
          </Card>
        </div>
      </main>
    </AppHeader>
  );
}
