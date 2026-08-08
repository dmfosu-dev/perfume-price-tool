"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isSupportedCurrency } from "@/lib/currencies";
import { FX_SOURCES } from "@/lib/enums";
import { fetchRates, providerLabel } from "@/lib/fx-providers";
import { FX_SETTING_ID, getFxSettings, normaliseSelection } from "@/lib/fx";
import { prisma } from "@/lib/prisma";

export type FxActionState = { error?: string; notice?: string };

const MIN_RATE = 0.000001;
const MAX_RATE = 10_000_000;

function parseRate(
  raw: string,
  currency: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const normalised = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s,]/g, "")
    .replace(/٫/, ".")
    .trim();

  if (normalised === "") return { ok: false, error: `Enter a rate for ${currency}.` };
  if (!/^\d*\.?\d+$/.test(normalised)) {
    return { ok: false, error: `${currency} rate must be a number.` };
  }

  const value = Number(normalised);
  if (!Number.isFinite(value)) {
    return { ok: false, error: `${currency} rate is not a number.` };
  }
  if (value < MIN_RATE) {
    return { ok: false, error: `${currency} rate must be greater than zero.` };
  }
  if (value > MAX_RATE) return { ok: false, error: `${currency} rate looks too large.` };

  return { ok: true, value };
}

/**
 * Base currency + which currencies to track. Only the selected ones are ever
 * fetched, stored or shipped to the browser.
 */
export async function saveCurrencySetup(
  _prev: FxActionState,
  formData: FormData,
): Promise<FxActionState> {
  const admin = await requireAdmin();

  const baseCurrency = String(formData.get("baseCurrency") ?? "");
  if (!isSupportedCurrency(baseCurrency)) {
    return { error: "Pick a supported base currency." };
  }

  const priceEntryCurrency = String(formData.get("priceEntryCurrency") ?? "");
  if (!isSupportedCurrency(priceEntryCurrency)) {
    return { error: "Pick a supported price-entry currency." };
  }

  const chosen = formData.getAll("currencies").map(String).filter(isSupportedCurrency);
  const selected = normaliseSelection(chosen, baseCurrency, priceEntryCurrency);

  await prisma.fxSetting.upsert({
    where: { id: FX_SETTING_ID },
    update: {
      baseCurrency,
      priceEntryCurrency,
      selectedCurrencies: JSON.stringify(selected),
      updatedById: admin.id,
    },
    create: {
      id: FX_SETTING_ID,
      baseCurrency,
      priceEntryCurrency,
      selectedCurrencies: JSON.stringify(selected),
      updatedById: admin.id,
    },
  });

  revalidatePath("/admin/fx");
  revalidatePath("/dashboard");

  const forced: string[] = [];
  if (!chosen.includes(baseCurrency)) forced.push(baseCurrency);
  if (!chosen.includes(priceEntryCurrency) && priceEntryCurrency !== baseCurrency) {
    forced.push(priceEntryCurrency);
  }

  return {
    notice:
      forced.length > 0
        ? `Saved. ${forced.join(" and ")} added automatically — rates are quoted from ${baseCurrency} and prices default to ${priceEntryCurrency}.`
        : `Tracking ${selected.length} currencies against ${baseCurrency}.`,
  };
}

export async function saveFxSource(
  _prev: FxActionState,
  formData: FormData,
): Promise<FxActionState> {
  const admin = await requireAdmin();

  const source = String(formData.get("source") ?? "");
  if (!(FX_SOURCES as readonly string[]).includes(source)) {
    return { error: "Unknown rate source." };
  }

  const interval = Number(String(formData.get("refreshIntervalHours") ?? "24"));
  if (!Number.isInteger(interval) || interval < 1 || interval > 24 * 30) {
    return { error: "Refresh interval must be between 1 and 720 hours." };
  }

  await prisma.fxSetting.upsert({
    where: { id: FX_SETTING_ID },
    update: {
      source,
      refreshIntervalHours: interval,
      lastFetchError: null,
      updatedById: admin.id,
    },
    create: {
      id: FX_SETTING_ID,
      source,
      refreshIntervalHours: interval,
      updatedById: admin.id,
    },
  });

  revalidatePath("/admin/fx");
  revalidatePath("/dashboard");
  return { notice: "Rate source saved." };
}

/**
 * Manual entry. Appends rather than editing, so the rate in force on any past
 * date stays recoverable.
 */
export async function saveManualRates(
  _prev: FxActionState,
  formData: FormData,
): Promise<FxActionState> {
  const admin = await requireAdmin();
  const settings = await getFxSettings();

  const parsed: { currency: string; value: number }[] = [];
  for (const currency of settings.selectedCurrencies) {
    // The base is 1 of itself by definition — not an input.
    if (currency === settings.baseCurrency) continue;
    const result = parseRate(String(formData.get(`rate_${currency}`) ?? ""), currency);
    if (!result.ok) return { error: result.error };
    parsed.push({ currency, value: result.value });
  }

  if (parsed.length === 0) {
    return { error: "Select at least one currency besides the base first." };
  }

  await prisma.$transaction([
    // Store the base against itself so cross-rate maths has a complete table.
    prisma.fxRate.create({
      data: {
        baseCurrency: settings.baseCurrency,
        currency: settings.baseCurrency,
        rate: "1",
        source: "manual",
        setById: admin.id,
      },
    }),
    ...parsed.map(({ currency, value }) =>
      prisma.fxRate.create({
        data: {
          baseCurrency: settings.baseCurrency,
          currency,
          rate: value.toString(),
          source: "manual",
          setById: admin.id,
        },
      }),
    ),
    prisma.fxSetting.upsert({
      where: { id: FX_SETTING_ID },
      update: { source: "manual", lastFetchError: null, updatedById: admin.id },
      create: { id: FX_SETTING_ID, source: "manual", updatedById: admin.id },
    }),
  ]);

  revalidatePath("/admin/fx");
  revalidatePath("/dashboard");
  return { notice: `Saved ${parsed.length} rates against ${settings.baseCurrency}.` };
}

/**
 * Pulls fresh rates. Only ever runs on an explicit admin action — the free tier
 * allows 1500 requests/month, so fetching on page load would burn the quota.
 * A failure keeps the previous rates in force (spec §3.6).
 */
export async function refreshRatesNow(
  _prev: FxActionState,
  _formData: FormData,
): Promise<FxActionState> {
  const admin = await requireAdmin();
  const settings = await getFxSettings();

  if (settings.source === "manual") {
    return { error: "Manual mode has nothing to fetch. Choose a provider first." };
  }

  try {
    const outcome = await fetchRates(
      settings.source,
      settings.baseCurrency,
      settings.selectedCurrencies,
    );
    const entries = Object.entries(outcome.rates);

    await prisma.$transaction([
      ...entries.map(([currency, value]) =>
        prisma.fxRate.create({
          data: {
            baseCurrency: settings.baseCurrency,
            currency,
            rate: value.toString(),
            source: outcome.provider,
          },
        }),
      ),
      prisma.fxSetting.upsert({
        where: { id: FX_SETTING_ID },
        update: { lastFetchAt: new Date(), lastFetchError: null, updatedById: admin.id },
        create: {
          id: FX_SETTING_ID,
          source: settings.source,
          lastFetchAt: new Date(),
          updatedById: admin.id,
        },
      }),
    ]);

    revalidatePath("/admin/fx");
    revalidatePath("/dashboard");

    const via = outcome.fellBackFrom
      ? ` (${providerLabel(outcome.fellBackFrom)} was unavailable, used ${providerLabel(outcome.provider)})`
      : ` from ${providerLabel(outcome.provider)}`;
    return { notice: `Updated ${entries.length} rates${via}.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";

    await prisma.fxSetting.upsert({
      where: { id: FX_SETTING_ID },
      update: { lastFetchAt: new Date(), lastFetchError: message },
      create: {
        id: FX_SETTING_ID,
        source: settings.source,
        lastFetchAt: new Date(),
        lastFetchError: message,
      },
    });

    revalidatePath("/admin/fx");
    revalidatePath("/dashboard");
    // Deliberately not rethrown: the previous rates remain usable.
    return { error: `Could not fetch rates: ${message} Previous rates are still in use.` };
  }
}
