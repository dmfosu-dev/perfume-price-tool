import type { Concentration, Gender } from "../src/lib/enums";
import { buildSkuCode } from "../src/lib/sku-code";

// Seed catalog, transcribed from PERFUME_PRICE_TOOL_SPEC.md §4.
//
// `code` is the fragment used to build sku_code (BRAND-VARIANT-SIZE-CONC) and is
// deliberately curated rather than slugified from `name`, so that abbreviations
// in the spec's examples hold: ARM-CDNIM-150-PARFUM, RAS-HAWAS-ICE-100-EDP.
//
// `gender` is not given in the spec; values below are best-effort and are among
// the details the spec asks the intermediary to confirm against physical stock.

export type SeedSku = {
  sizeMl: number;
  concentration: Concentration;
};

export type SeedVariant = {
  code: string;
  name: string;
  gender: Gender;
  skus: SeedSku[];
};

export type SeedBrand = {
  code: string;
  name: string;
  variants: SeedVariant[];
};

const edp = (sizeMl: number): SeedSku => ({ sizeMl, concentration: "EDP" });
const edt = (sizeMl: number): SeedSku => ({ sizeMl, concentration: "EDT" });
const extrait = (sizeMl: number): SeedSku => ({ sizeMl, concentration: "Extrait" });
const parfum = (sizeMl: number): SeedSku => ({ sizeMl, concentration: "Parfum" });

export const CATALOG: SeedBrand[] = [
  {
    code: "LAT",
    name: "Lattafa Perfumes",
    variants: [
      { code: "ECLAIRE", name: "Eclaire", gender: "female", skus: [edp(100)] },
      { code: "YARA", name: "Yara (Original Pink)", gender: "female", skus: [edp(100)] },
      { code: "PRIDE-VINTAGE-RADIO", name: "Pride Vintage Radio", gender: "unisex", skus: [edp(100)] },
      { code: "PRIDE-NEBRAS", name: "Pride Nebras", gender: "unisex", skus: [edp(100)] },
      { code: "PRIDE-INFINI-ROSE", name: "Pride Infini Rose", gender: "unisex", skus: [edp(100)] },
      { code: "MAAHIR-LEGACY", name: "Maahir Legacy", gender: "male", skus: [edp(100)] },
      { code: "KHAMRAH", name: "Khamrah (Original)", gender: "unisex", skus: [edp(100)] },
      { code: "KHAMRAH-QAHWA", name: "Khamrah Qahwa", gender: "unisex", skus: [edp(100)] },
      { code: "ASAD", name: "Asad", gender: "male", skus: [edp(100)] },
      { code: "FAKHAR-BLACK", name: "Fakhar Black (Fakhar Lattafa Men)", gender: "male", skus: [edp(100)] },
      { code: "ANGHAM", name: "Angham", gender: "female", skus: [edp(100)] },
      { code: "QAED-AL-FURSAN", name: "Qaed Al Fursan", gender: "male", skus: [edp(90)] },
      { code: "BAO-OUD-FOR-GLORY", name: "Bade'e Al Oud Oud for Glory", gender: "unisex", skus: [edp(100)] },
      {
        code: "BAO-HONOR-GLORY",
        name: "Bade'e Al Oud Honor & Glory (White Bottle)",
        gender: "unisex",
        skus: [edp(100)],
      },
      { code: "AL-NASHAMA-CAPRICE", name: "Al Nashama Caprice", gender: "male", skus: [edp(100)] },
    ],
  },
  {
    code: "AFN",
    name: "Afnan & Subsidiaries",
    variants: [
      { code: "9PM", name: "Afnan 9 PM (Original)", gender: "male", skus: [edp(100)] },
      { code: "9PM-REBEL", name: "Afnan 9 PM Rebel", gender: "male", skus: [edp(100)] },
      {
        code: "SUPREMACY-NOI",
        name: "Afnan Supremacy Not Only Intense",
        gender: "male",
        skus: [extrait(100), extrait(150)],
      },
      { code: "TURATHI-BLUE", name: "Afnan Turathi Blue", gender: "male", skus: [edp(100)] },
      { code: "ZIMAYA-SHARAF-BLEND", name: "Zimaya Sharaf Blend", gender: "unisex", skus: [edp(100)] },
    ],
  },
  {
    code: "RAS",
    name: "Rasasi",
    variants: [
      { code: "HAWAS", name: "Hawas for Him (Original)", gender: "male", skus: [edp(100)] },
      { code: "HAWAS-ICE", name: "Hawas Ice for Him", gender: "male", skus: [edp(100)] },
      { code: "HAWAS-DARE", name: "Hawas Dare for Him (Fire)", gender: "male", skus: [edp(100)] },
      { code: "HAWAS-BLACK", name: "Hawas Black", gender: "male", skus: [edp(100)] },
      { code: "LA-YUQAWAM", name: "La Yuqawam Pour Homme", gender: "male", skus: [edp(75)] },
      { code: "DAAREJ", name: "Daarej pour Homme", gender: "male", skus: [edp(100)] },
    ],
  },
  {
    code: "ARM",
    name: "Armaf",
    variants: [
      {
        code: "CDNIM",
        name: "Club de Nuit Intense Man (EDT)",
        gender: "male",
        skus: [edt(105), edt(200)],
      },
      {
        code: "CDNIM",
        name: "Club de Nuit Intense Man (Parfum)",
        gender: "male",
        skus: [parfum(150)],
      },
    ],
  },
  {
    code: "FRA",
    name: "French Avenue (Fragrance World)",
    variants: [
      { code: "LIQUID-BRUN", name: "Liquid Brun", gender: "male", skus: [extrait(100), extrait(150)] },
    ],
  },
  {
    code: "ALH",
    name: "Al Haramain",
    variants: [
      {
        code: "AMBER-OUD-GOLD",
        name: "Amber Oud Gold Edition",
        gender: "unisex",
        skus: [edp(60), edp(125)],
      },
    ],
  },
  {
    code: "SWA",
    name: "Swiss Arabian",
    variants: [
      { code: "SHAGHAF-OUD", name: "Shaghaf Oud (Original)", gender: "unisex", skus: [edp(75)] },
      { code: "SHAGHAF-OUD-TONKA", name: "Shaghaf Oud Tonka", gender: "unisex", skus: [edp(75)] },
    ],
  },
  {
    code: "FGW",
    name: "Fragrance World",
    variants: [{ code: "ESSENCE-DE-BLANC", name: "Essence de Blanc", gender: "unisex", skus: [edp(100)] }],
  },
  {
    code: "ARO",
    name: "Arabian Oud",
    variants: [{ code: "MADAWI", name: "Madawi", gender: "unisex", skus: [edp(90)] }],
  },
];

export { buildSkuCode };
