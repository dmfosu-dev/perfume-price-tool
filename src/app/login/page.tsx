import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, landingPathFor } from "@/lib/auth";
import { Card } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Aromatic Ghana" };

export default async function LoginPage() {
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
          Aromatic Ghana
        </h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to update source prices and stock.
        </p>
      </div>

      <Card>
        <LoginForm />
      </Card>

      <p className="mt-6 text-center text-xs text-muted-soft">
        Internal tool ·{" "}
        <Link href="/signup" className="underline underline-offset-2">
          Request access
        </Link>
      </p>
    </main>
  );
}
