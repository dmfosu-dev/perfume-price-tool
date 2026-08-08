"use client";

import { useActionState } from "react";
import {
  approveUserAction,
  rejectUserAction,
  revokeUserAction,
  suspendUserAction,
  type AdminActionState,
} from "@/app/actions/admin-users";
import { SubmitButton } from "@/components/SubmitButton";

const ACTIONS = {
  approve: approveUserAction,
  reject: rejectUserAction,
  suspend: suspendUserAction,
  revoke: revokeUserAction,
} as const;

const LABELS: Record<keyof typeof ACTIONS, string> = {
  approve: "Approve",
  reject: "Reject",
  suspend: "Suspend",
  revoke: "Revoke",
};

export function UserAction({
  userId,
  action,
  variant = "neutral",
  confirm,
}: {
  userId: string;
  action: keyof typeof ACTIONS;
  variant?: "primary" | "danger" | "neutral";
  confirm?: string;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    ACTIONS[action],
    {},
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton variant={variant} pendingLabel="Working…">
        {LABELS[action]}
      </SubmitButton>
      {state.error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-danger-fg">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
