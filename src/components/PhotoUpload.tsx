"use client";

import { useRef, useState, useTransition } from "react";
import { removeSkuPhoto, uploadSkuPhoto } from "@/app/actions/photos";

/**
 * Photo control shown to admins on the catalogue row. Deliberately small: it
 * sits beside the price fields and must never get in the way of price entry,
 * which is what the screen is really for.
 */
export function PhotoUpload({
  skuId,
  skuCode,
  photoUrl,
}: {
  skuId: string;
  skuCode: string;
  photoUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File | undefined) {
    if (!file) return;
    setError(null);

    const formData = new FormData();
    formData.set("skuId", skuId);
    formData.set("photo", file);

    startTransition(async () => {
      const result = await uploadSkuPhoto(formData);
      if (!result.ok) setError(result.error ?? "Upload failed.");
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeSkuPhoto(skuId);
      if (!result.ok) setError(result.error ?? "Could not remove the photo.");
    });
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => upload(event.target.files?.[0])}
        className="hidden"
        aria-label={`Upload a photo for ${skuCode}`}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="text-xs font-semibold text-muted underline underline-offset-2 disabled:opacity-50"
        >
          {pending ? "Uploading…" : photoUrl ? "Replace photo" : "Add photo"}
        </button>
        {photoUrl ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-xs text-muted underline underline-offset-2 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-danger-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
