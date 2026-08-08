"use client";

import { useActionState } from "react";
import {
  keepExisting,
  takeIncoming,
  type ConflictActionState,
} from "@/app/actions/conflicts";
import { SubmitButton } from "@/components/SubmitButton";

export function ConflictActions({ conflictId }: { conflictId: string }) {
  const [keepState, keepAction] = useActionState<ConflictActionState, FormData>(
    keepExisting,
    {},
  );
  const [takeState, takeAction] = useActionState<ConflictActionState, FormData>(
    takeIncoming,
    {},
  );

  const error = keepState.error ?? takeState.error;

  return (
    <div className="mt-3 border-t border-line pt-3">
      {error ? (
        <p role="alert" className="mb-2 text-xs font-medium text-danger-fg">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <form action={keepAction}>
          <input type="hidden" name="conflictId" value={conflictId} />
          <SubmitButton variant="neutral" pendingLabel="Saving…">
            Keep current
          </SubmitButton>
        </form>
        <form action={takeAction}>
          <input type="hidden" name="conflictId" value={conflictId} />
          <SubmitButton pendingLabel="Saving…">Use queued</SubmitButton>
        </form>
      </div>
    </div>
  );
}
