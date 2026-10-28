import { terminalPalette } from "@fungi.computer/stipe";
import { fungiWordmark } from "./art/ascii-fungi.js";
import { vishnuWordmark } from "./art/vishnu.js";

export { fungiWordmark, vishnuWordmark };

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
 * Per-brand presentation: the wide art, the plain-text label for
 * pipes and `NO_COLOR`, and whether that label still follows a narrow terminal
 * (a `fungi-local-auth` CLI names itself at every width).
 */
const brandArt = {
  fungi: {
    wide: fungiWordmark,
    label: "fungi",
    narrowLabel: true,
  },
  vishnu: {
    wide: vishnuWordmark,
    label: "vishnu",
    narrowLabel: true,
  },
  "fungi-local-auth": {
    wide: fungiWordmark,
    label: "fungi-local-auth",
    narrowLabel: true,
  },
  /** The Computer welcome shows its own name below the wide wordmark. */
  computer: {
    wide: fungiWordmark,
    label: "Fungi Computer",
    narrowLabel: false,
  },
} as const satisfies Record<
  CliBrand,
  {
    wide: string;
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
  const { label, narrowLabel, wide } = brandArt[options.brand];
  let banner: string;
  if (!options.interactive || options.noColor) banner = `${label}\n`;
  else {
    banner = options.columns < 60 ? "" : colorizeBanner(wide, options.brand);
    if (
      (options.columns < 60 && narrowLabel) ||
      options.brand === "fungi-local-auth"
    )
      banner += `${label}\n`;
  }
  return options.rawPty ? banner.replace(/\r?\n/gu, "\r\n") : banner;
}
