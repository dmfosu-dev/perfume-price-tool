import { redirect } from "next/navigation";
import { getCurrentUser, landingPathFor } from "@/lib/auth";
import { Card } from "@/components/ui";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Request access · Aromatic Ghana" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(landingPathFor(user));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img
          src="/brand/aromatik-logo.png"
          alt=""
          aria-hidden
          style={{ background: "var(--logo-plate)" }}
          className="mb-3 h-14 w-14 rounded-xl object-contain p-1"
        />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Request access
        </h1>
        <p className="mt-1 text-sm text-muted">
          For sourcing agents working with the Aromatic Ghana catalogue.
        </p>
      </div>

      <Card>
        <SignupForm />
      </Card>
    </main>
  );
}
