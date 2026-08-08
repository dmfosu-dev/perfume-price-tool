"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field } from "@/components/ui";

const BLOCKED_MESSAGES: Record<string, { title: string; body: string }> = {
  pending: {
    title: "Awaiting approval",
    body: "Your details are correct, but an administrator has not approved this account yet. You will be able to sign in once they do.",
  },
  suspended: {
    title: "Account suspended",
    body: "This account has been suspended by an administrator. Contact them to have it reinstated.",
  },
  rejected: {
    title: "Signup not approved",
    body: "This signup request was not approved. Contact an administrator if you think that is a mistake.",
  },
  revoked: {
    title: "Access revoked",
    body: "Access for this account has been revoked. Contact an administrator if you need it restored.",
  },
};

export function LoginForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(loginAction, {});
  const blocked = state.blockedStatus ? BLOCKED_MESSAGES[state.blockedStatus] : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {blocked ? (
        <Alert tone="warning" title={blocked.title}>
          {blocked.body}
        </Alert>
      ) : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        placeholder="you@example.com"
        defaultValue={state.email ?? ""}
        key={state.email ?? ""}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <SubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>

      <p className="pt-1 text-center text-sm text-muted">
        Need an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-foreground underline underline-offset-2"
        >
          Request access
        </Link>
      </p>
    </form>
  );
}
