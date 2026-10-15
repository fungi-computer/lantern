import { terminalPalette } from "@fungi.computer/stipe";
import { fungiWordmark } from "./art/ascii-fungi.js";
import { mushroom } from "./art/ascii-art.js";
import { compactMushroom, vishnuWordmark } from "./art/vishnu.js";

export { fungiWordmark, mushroom, compactMushroom, vishnuWordmark };

/** Semantic colors from the Stipe palette; internal to colorizeBanner. */
const cliColors = terminalPalette("mocha");
export type CliBrand = "fungi" | "vishnu" | "fungi-local-auth" | "computer";
export type BannerOptions = {
  brand: CliBrand;
  columns: number;
  interactive: boolean;
  noColor: boolean;
  rawPty?: boolean;
};

/**
 * Per-brand presentation: the wide and narrow art, the plain-text label for
 * pipes and `NO_COLOR`, and whether that label still follows the narrow art
 * (a `fungi-local-auth` CLI names itself at every width).
 */
const brandArt = {
  fungi: {
    wide: fungiWordmark,
    narrow: compactMushroom,
    label: "fungi",
    narrowLabel: true,
  },
  vishnu: {
    wide: vishnuWordmark,
    narrow: compactMushroom,
    label: "vishnu",
    narrowLabel: true,
  },
  "fungi-local-auth": {
    wide: fungiWordmark,
    narrow: compactMushroom,
    label: "fungi-local-auth",
    narrowLabel: true,
  },
  /** The Computer welcome shows its own name below the wide wordmark. */
  computer: {
    wide: fungiWordmark,
    narrow: undefined,
    label: "Fungi Computer",
    narrowLabel: false,
  },
} as const satisfies Record<
  CliBrand,
  {
    wide: string;
    narrow: string | undefined;
    label: string;
    narrowLabel: boolean;
  }
>;

/** A single truecolor wrap retains every space of the original art. */
export function colorizeBanner(art: string, brand: CliBrand = "fungi"): string {
  const primary = brand === "vishnu" ? cliColors?.blue : cliColors?.primary;
  if (primary === undefined) return art;
  const rgb = [1, 3, 5].map((start) =>
    parseInt(primary.slice(start, start + 2), 16),
  );
  return `\u001b[38;2;${rgb.join(";")}m${art}\u001b[0m`;
}

/** Browser-safe renderer. Raw terminal writes need CRLF; ordinary TTYs own ONLCR. */
export function renderBanner(options: BannerOptions): string {
  const { label, narrow, narrowLabel, wide } = brandArt[options.brand];
  let banner: string;
  if (!options.interactive || options.noColor) banner = `${label}\n`;
  else {
    const art = options.columns < 60 ? narrow : wide;
    banner = art === undefined ? "" : colorizeBanner(art, options.brand);
    if (
      (options.columns < 60 && narrowLabel) ||
      options.brand === "fungi-local-auth"
    )
      banner += `${label}\n`;
  }
  return options.rawPty ? banner.replace(/\r?\n/gu, "\r\n") : banner;
}
