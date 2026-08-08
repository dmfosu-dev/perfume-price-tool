"use client";

import { useActionState } from "react";
import {
  dismissDiscrepancy,
  resolveDiscrepancy,
  type DiscrepancyActionState,
} from "@/app/actions/discrepancies";
import { SubmitButton } from "@/components/SubmitButton";

export function ResolveForm({ reportId }: { reportId: string }) {
  const [resolveState, resolveAction] = useActionState<DiscrepancyActionState, FormData>(
    resolveDiscrepancy,
    {},
  );
  const [dismissState, dismissAction] = useActionState<DiscrepancyActionState, FormData>(
    dismissDiscrepancy,
    {},
  );

  const error = resolveState.error ?? dismissState.error;

  return (
    <div className="mt-3 border-t border-line pt-3">
      {/* One textarea, shared by both actions via form attributes. */}
      <textarea
        form={`resolve-${reportId}`}
        name="resolutionNote"
        rows={2}
        placeholder="What did you do about it? (optional)"
        aria-label="Resolution note"
        className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent"
      />

      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex gap-2">
        <form id={`resolve-${reportId}`} action={resolveAction}>
          <input type="hidden" name="reportId" value={reportId} />
          <SubmitButton pendingLabel="Saving…">Mark resolved</SubmitButton>
        </form>
        <form action={dismissAction}>
          <input type="hidden" name="reportId" value={reportId} />
          <SubmitButton variant="neutral" pendingLabel="Saving…">
            Dismiss
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
