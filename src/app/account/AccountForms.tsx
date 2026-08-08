"use client";

import { useActionState } from "react";
import { changeEmail, changePassword, type AccountState } from "@/app/actions/account";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";

function Feedback({ state }: { state: AccountState }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.notice) return <Alert tone="success">{state.notice}</Alert>;
  return null;
}

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action] = useActionState<AccountState, FormData>(changeEmail, {});

  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <Field
        label="Sign-in email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        defaultValue={currentEmail}
        required
      />
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        hint="Confirms it is really you."
      />
      <SubmitButton pendingLabel="Saving…">Change email</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<AccountState, FormData>(changePassword, {});

  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
      />
      <Field
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
      />
      <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
      <p className="text-xs text-muted">
        Changing your password signs you out everywhere, including here.
      </p>
    </form>
  );
}
