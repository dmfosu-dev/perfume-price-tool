"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type AuthFormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";

export function SignupForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signupAction, {});

  if (state.success) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Request received">
          Your account has been created and is waiting for an administrator to approve it.
          You will not be able to sign in until they do.
        </Alert>
        <Link
          href="/login"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Alert tone="info">
        Your account must be approved by the administrator before you can log in.
      </Alert>

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
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
      />

      <SubmitButton pendingLabel="Creating account…" className="w-full">
        Request access
      </SubmitButton>

      <p className="pt-1 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-foreground underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
