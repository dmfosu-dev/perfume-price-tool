import { redirect } from "next/navigation";
import { getCurrentUser, landingPathFor } from "@/lib/auth";
import { Card } from "@/components/ui";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Request access · Perfume Price Tool" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(landingPathFor(user));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Request access
        </h1>
        <p className="mt-1 text-sm text-muted">
          For sourcing agents working with this catalogue.
        </p>
      </div>

      <Card>
        <SignupForm />
      </Card>
    </main>
  );
}
