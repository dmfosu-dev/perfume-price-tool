"use client";

import { useActionState, useState } from "react";
import {
  addBrand,
  addSku,
  addVariant,
  deleteBrand,
  deleteSku,
  deleteVariant,
  moveBrand,
  renameBrand,
  setBrandActive,
  setLocalStock,
  setSkuActive,
  setVariantActive,
  togglePriority,
  updateSku,
  updateVariant,
  type CatalogueState,
} from "@/app/actions/catalogue";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, inputClass } from "@/components/ui";
import { CONCENTRATIONS, GENDERS } from "@/lib/enums";

function Feedback({ state }: { state: CatalogueState }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.notice) return <Alert tone="success">{state.notice}</Alert>;
  return null;
}

/**
 * Shown in place of Delete once price history exists. Without it the button
 * simply vanishes and the absence reads as a bug rather than a rule.
 */
function HistoryLock() {
  return (
    <p className="px-2 py-2 text-xs text-muted-soft">
      Has price history — archive rather than delete.
    </p>
  );
}

/// Shared confirm wrapper for destructive submits.
function ConfirmForm({
  action,
  message,
  children,
}: {
  action: (formData: FormData) => void;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}

export function AddBrandForm() {
  const [state, action] = useActionState<CatalogueState, FormData>(addBrand, {});
  return (
    <form action={action} className="space-y-2.5">
      <Feedback state={state} />
      {/* A grid rather than flex: inputClass sets w-full, so in a flex row the
          fields fight over width and wrap onto separate lines. */}
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
        <input
          name="name"
          placeholder="Brand name"
          aria-label="Brand name"
          className={inputClass}
        />
        <input
          name="code"
          placeholder="CODE"
          aria-label="Brand code"
          maxLength={6}
          className={`${inputClass} uppercase`}
        />
        <SubmitButton pendingLabel="Adding…">Add brand</SubmitButton>
      </div>
    </form>
  );
}

export function BrandToolbar({
  brandId,
  name,
  isActive,
  canDelete,
}: {
  brandId: string;
  name: string;
  isActive: boolean;
  canDelete: boolean;
}) {
  const [moveState, move] = useActionState<CatalogueState, FormData>(moveBrand, {});
  const [renameState, rename] = useActionState<CatalogueState, FormData>(renameBrand, {});
  const [activeState, setActive] = useActionState<CatalogueState, FormData>(setBrandActive, {});
  const [deleteState, remove] = useActionState<CatalogueState, FormData>(deleteBrand, {});
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-2">
      <Feedback state={moveState} />
      <Feedback state={renameState} />
      <Feedback state={activeState} />
      <Feedback state={deleteState} />

      <div className="flex flex-wrap items-center gap-1.5">
        <form action={move}>
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="direction" value="up" />
          <SubmitButton variant="ghost" size="sm" aria-label="Move up">
            ↑
          </SubmitButton>
        </form>
        <form action={move}>
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="direction" value="down" />
          <SubmitButton variant="ghost" size="sm">
            ↓
          </SubmitButton>
        </form>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="h-9 rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-surface-sunken hover:text-foreground"
        >
          Rename
        </button>
        <form action={setActive}>
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="active" value={isActive ? "false" : "true"} />
          <SubmitButton variant="ghost" size="sm">
            {isActive ? "Archive" : "Restore"}
          </SubmitButton>
        </form>
        {canDelete ? (
          <ConfirmForm
            action={remove}
            message={`Delete "${name}" and everything under it? This cannot be undone.`}
          >
            <input type="hidden" name="brandId" value={brandId} />
            <SubmitButton variant="dangerGhost" size="sm">
              Delete
            </SubmitButton>
          </ConfirmForm>
        ) : (
          <HistoryLock />
        )}
      </div>

      {editing ? (
        <form action={rename} className="flex gap-2">
          <input type="hidden" name="brandId" value={brandId} />
          <input
            name="name"
            defaultValue={name}
            aria-label="New brand name"
            className={inputClass}
          />
          <SubmitButton size="sm" pendingLabel="Saving…">
            Save
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

export function AddVariantForm({ brandId }: { brandId: string }) {
  const [state, action] = useActionState<CatalogueState, FormData>(addVariant, {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
        <input
          name="name"
          placeholder="Fragrance name"
          aria-label="Fragrance name"
          className={inputClass}
        />
        <select name="gender" defaultValue="unisex" aria-label="Gender" className={inputClass}>
          {GENDERS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input type="hidden" name="brandId" value={brandId} />
        <SubmitButton size="sm" pendingLabel="Adding…">
          Add
        </SubmitButton>
      </div>
    </form>
  );
}

export function VariantToolbar({
  variantId,
  name,
  gender,
  notes,
  isActive,
  canDelete,
}: {
  variantId: string;
  name: string;
  gender: string;
  notes: string | null;
  isActive: boolean;
  canDelete: boolean;
}) {
  const [editState, update] = useActionState<CatalogueState, FormData>(updateVariant, {});
  const [activeState, setActive] = useActionState<CatalogueState, FormData>(setVariantActive, {});
  const [deleteState, remove] = useActionState<CatalogueState, FormData>(deleteVariant, {});
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-2">
      <Feedback state={editState} />
      <Feedback state={activeState} />
      <Feedback state={deleteState} />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="h-9 rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-surface-sunken hover:text-foreground"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
        <form action={setActive}>
          <input type="hidden" name="variantId" value={variantId} />
          <input type="hidden" name="active" value={isActive ? "false" : "true"} />
          <SubmitButton variant="ghost" size="sm">
            {isActive ? "Archive" : "Restore"}
          </SubmitButton>
        </form>
        {canDelete ? (
          <ConfirmForm action={remove} message={`Delete "${name}" and its sizes?`}>
            <input type="hidden" name="variantId" value={variantId} />
            <SubmitButton variant="dangerGhost" size="sm">
              Delete
            </SubmitButton>
          </ConfirmForm>
        ) : (
          <HistoryLock />
        )}
      </div>

      {editing ? (
        <form action={update} className="space-y-2 rounded-lg bg-surface-sunken p-3">
          <input type="hidden" name="variantId" value={variantId} />
          <div className="flex flex-wrap gap-2">
            <input
              name="name"
              defaultValue={name}
              aria-label="Fragrance name"
              className={`${inputClass} min-w-40 flex-1`}
            />
            <select
              name="gender"
              defaultValue={gender}
              aria-label="Gender"
              className={`${inputClass} w-28`}
            >
              {GENDERS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <input
            name="notes"
            defaultValue={notes ?? ""}
            placeholder="Scent notes (optional)"
            aria-label="Notes"
            className={inputClass}
          />
          <SubmitButton size="sm" pendingLabel="Saving…">
            Save changes
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

export function AddSkuForm({ variantId }: { variantId: string }) {
  const [state, action] = useActionState<CatalogueState, FormData>(addSku, {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <div className="grid gap-2 sm:grid-cols-[6rem_9rem_auto] sm:justify-start">
        <input
          name="sizeMl"
          inputMode="numeric"
          placeholder="ml"
          aria-label="Size in millilitres"
          className={inputClass}
        />
        <select
          name="concentration"
          defaultValue="EDP"
          aria-label="Concentration"
          className={inputClass}
        >
          {CONCENTRATIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input type="hidden" name="variantId" value={variantId} />
        <SubmitButton size="sm" pendingLabel="Adding…">
          Add size
        </SubmitButton>
      </div>
    </form>
  );
}

export function SkuToolbar({
  skuId,
  skuCode,
  sizeMl,
  concentration,
  isActive,
  isPriority,
  priorityNote,
  localStockQty,
  canDelete,
}: {
  skuId: string;
  skuCode: string;
  sizeMl: number;
  concentration: string;
  isActive: boolean;
  isPriority: boolean;
  priorityNote: string | null;
  localStockQty: number | null;
  canDelete: boolean;
}) {
  const [editState, update] = useActionState<CatalogueState, FormData>(updateSku, {});
  const [activeState, setActive] = useActionState<CatalogueState, FormData>(setSkuActive, {});
  const [deleteState, remove] = useActionState<CatalogueState, FormData>(deleteSku, {});
  const [priorityState, priority] = useActionState<CatalogueState, FormData>(togglePriority, {});
  const [stockState, stock] = useActionState<CatalogueState, FormData>(setLocalStock, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <Feedback state={editState} />
      <Feedback state={activeState} />
      <Feedback state={deleteState} />
      <Feedback state={priorityState} />
      <Feedback state={stockState} />

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="h-9 rounded-lg px-2.5 text-sm font-medium text-muted transition hover:bg-surface-sunken hover:text-foreground"
      >
        {open ? "Hide options" : "Edit size, stock, priority"}
      </button>

      {open ? (
        <div className="mt-2 space-y-3 rounded-lg bg-surface-sunken p-3">
          <form action={update} className="flex flex-wrap items-end gap-2">
            <label className="w-20">
              <span className="mb-1 block text-xs font-medium text-muted">Size ml</span>
              <input
                name="sizeMl"
                inputMode="numeric"
                defaultValue={String(sizeMl)}
                aria-label={`Size for ${skuCode}`}
                className={inputClass}
              />
            </label>
            <label className="w-32">
              <span className="mb-1 block text-xs font-medium text-muted">Concentration</span>
              <select
                name="concentration"
                defaultValue={concentration}
                aria-label={`Concentration for ${skuCode}`}
                className={inputClass}
              >
                {CONCENTRATIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="skuId" value={skuId} />
            <SubmitButton size="sm" pendingLabel="Saving…">
              Save size
            </SubmitButton>
          </form>

          <form action={stock} className="flex flex-wrap items-end gap-2">
            <label className="w-28">
              <span className="mb-1 block text-xs font-medium text-muted">Local stock</span>
              <input
                name="localStockQty"
                inputMode="numeric"
                defaultValue={localStockQty === null ? "" : String(localStockQty)}
                placeholder="—"
                aria-label="Local stock quantity"
                className={inputClass}
              />
            </label>
            <input type="hidden" name="skuId" value={skuId} />
            <SubmitButton variant="neutral" size="sm">
              Save stock
            </SubmitButton>
          </form>

          <form action={priority} className="flex flex-wrap items-end gap-2">
            <label className="min-w-40 flex-1">
              <span className="mb-1 block text-xs font-medium text-muted">
                {isPriority ? "Priority note" : "Pin for priority checking"}
              </span>
              <input
                name="priorityNote"
                defaultValue={priorityNote ?? ""}
                placeholder="e.g. client waiting"
                aria-label="Priority note"
                className={inputClass}
              />
            </label>
            <input type="hidden" name="skuId" value={skuId} />
            <input type="hidden" name="on" value={isPriority ? "false" : "true"} />
            <SubmitButton variant={isPriority ? "neutral" : "primary"} size="sm">
              {isPriority ? "Unpin" : "Pin"}
            </SubmitButton>
          </form>

          <div className="flex flex-wrap gap-1.5 border-t border-line pt-2">
            <form action={setActive}>
              <input type="hidden" name="skuId" value={skuId} />
              <input type="hidden" name="active" value={isActive ? "false" : "true"} />
              <SubmitButton variant="ghost" size="sm">
                {isActive ? "Archive size" : "Restore size"}
              </SubmitButton>
            </form>
            {canDelete ? (
              <ConfirmForm action={remove} message={`Delete ${skuCode}?`}>
                <input type="hidden" name="skuId" value={skuId} />
                <SubmitButton variant="dangerGhost" size="sm">
                  Delete
                </SubmitButton>
              </ConfirmForm>
            ) : (
              <HistoryLock />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
