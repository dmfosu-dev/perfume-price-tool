"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type DiscrepancyActionState = { error?: string; notice?: string };

async function resolveWith(
  formData: FormData,
  status: "resolved" | "dismissed",
): Promise<DiscrepancyActionState> {
  const admin = await requireAdmin();

  const id = String(formData.get("reportId") ?? "");
  if (!id) return { error: "No report specified." };

  const note = String(formData.get("resolutionNote") ?? "").trim();
  if (note.length > 1000) return { error: "That note is too long." };

  const report = await prisma.discrepancyReport.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!report) return { error: "That report no longer exists." };
  if (report.status !== "open") {
    // Someone else got there first; refresh so the admin sees reality.
    revalidatePath("/admin/discrepancies");
    return { error: `This report was already ${report.status}.` };
  }

  await prisma.discrepancyReport.update({
    where: { id },
    data: {
      status,
      resolvedById: admin.id,
      resolvedAt: new Date(),
      resolutionNote: note === "" ? null : note,
    },
  });

  revalidatePath("/admin/discrepancies");
  revalidatePath("/dashboard");
  return { notice: `Report ${status}.` };
}

export async function resolveDiscrepancy(
  _prev: DiscrepancyActionState,
  formData: FormData,
): Promise<DiscrepancyActionState> {
  return resolveWith(formData, "resolved");
}

export async function dismissDiscrepancy(
  _prev: DiscrepancyActionState,
  formData: FormData,
): Promise<DiscrepancyActionState> {
  return resolveWith(formData, "dismissed");
}
