"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { detectImage, MAX_PHOTO_BYTES, photoFilename } from "@/lib/image-upload";
import { deletePhoto, storePhoto } from "@/lib/photo-storage";
import { prisma } from "@/lib/prisma";

export type PhotoResult = { ok: boolean; error?: string; photoUrl?: string };

/**
 * Spec §3.4 / §5: an admin attaches a photo per SKU. Optional and never
 * blocking — a SKU without a photo works exactly as before.
 *
 * Storage backend is chosen in lib/photo-storage: Supabase Storage when
 * configured, the local filesystem otherwise.
 */
export async function uploadSkuPhoto(formData: FormData): Promise<PhotoResult> {
  await requireAdmin();

  const skuId = String(formData.get("skuId") ?? "");
  const file = formData.get("photo");

  if (!skuId) return { ok: false, error: "No product specified." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image first." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`,
    };
  }

  const sku = await prisma.sku.findUnique({
    where: { id: skuId },
    select: { id: true, skuCode: true, photoUrl: true },
  });
  if (!sku) return { ok: false, error: "That product no longer exists." };

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Content decides the format, not the declared type or extension.
  const kind = detectImage(bytes);
  if (!kind) {
    return { ok: false, error: "That file is not a JPEG, PNG or WebP image." };
  }

  const filename = photoFilename(sku.skuCode, kind.ext, randomBytes(6).toString("hex"));

  let photoUrl: string;
  try {
    photoUrl = await storePhoto(filename, bytes, kind.mime);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not store the image.",
    };
  }

  await prisma.sku.update({ where: { id: sku.id }, data: { photoUrl } });

  // Remove the superseded file, but only once the new one is safely recorded.
  await deletePhoto(sku.photoUrl);

  revalidatePath("/dashboard");
  revalidatePath("/admin/catalogue");
  return { ok: true, photoUrl };
}

export async function removeSkuPhoto(skuId: string): Promise<PhotoResult> {
  await requireAdmin();

  const sku = await prisma.sku.findUnique({
    where: { id: skuId },
    select: { id: true, photoUrl: true },
  });
  if (!sku) return { ok: false, error: "That product no longer exists." };

  await prisma.sku.update({ where: { id: sku.id }, data: { photoUrl: null } });
  await deletePhoto(sku.photoUrl);

  revalidatePath("/dashboard");
  revalidatePath("/admin/catalogue");
  return { ok: true };
}
