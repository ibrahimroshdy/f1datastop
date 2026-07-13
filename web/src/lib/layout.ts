/** Pit Wall layout utilities — see docs/F1_DATASTOP_DESIGN_MASTER.md §6 */

/** THE canonical content width. Every data/nav page centers on this so the
 *  occupying area is identical across the app (mobile full-bleed → md padding →
 *  capped at 6xl). Do NOT add ad-hoc max-w-* caps on pages; use this. */
export const pageShell =
  "mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8";

export const pageShellWide =
  "mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8";

export const pageShellNarrow =
  "mx-auto w-full max-w-lg px-4 py-8 md:px-6";

export const pageStack = "flex flex-col gap-6";

export const pageStackTight = "flex flex-col gap-4";
