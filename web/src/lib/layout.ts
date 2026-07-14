/** Pit Wall layout utilities — see docs/F1_DATASTOP_DESIGN_MASTER.md §6 */

/** THE canonical content width. Every data/nav page centers on this so the
 *  occupying area is identical across the app, and it's RESPONSIVE so big
 *  monitors get used instead of a narrow floating column: 6xl on laptops →
 *  7xl on xl → 1600px on 2xl. Do NOT add ad-hoc max-w-* caps on pages; use this. */
export const pageShell =
  "mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 py-6 md:px-6 md:py-8 2xl:px-10";

export const pageShellWide =
  "mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8";

export const pageShellNarrow =
  "mx-auto w-full max-w-lg px-4 py-8 md:px-6";

export const pageStack = "flex flex-col gap-6";

export const pageStackTight = "flex flex-col gap-4";
