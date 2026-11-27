/**
 * A project's mark, the same on the Mac and the phone (each client's `stemcells/project/`): one
 * squircle tile for every project, so favicons, wordmarks, glyphs and letters line up as one row
 * of app icons. What a project brings decides only what is on the tile (`projectMarkOf`).
 */
import { diskProjectFolder } from "../disk/project.ts";

/** The tile's corner, as a share of its side: continuous on the phone, a superellipse on the web. */
export const MARK_CORNER = 0.28;

/** A glyph or letters on a made tile, as a share of its side. */
export const MARK_GLYPH = 0.6;

/** Stemcells' own projects wear the app icon: ink on night (`book.md`, Night and ink). */
export const OWN_TILE = "#0B0B0C";
export const OWN_INK = "#EDE9E0";

/**
 * A made tile's fill for each of upstream's project icon colours: Tailwind's 600, which carries a
 * white glyph on every hue, yellow and lime too. A colour upstream adds draws gray until it has
 * a row here (`projectMark.contract.test.ts` on the web fails first).
 */
export const MADE_FILL: Readonly<Record<string, string>> = {
  gray: "#4B5563",
  red: "#DC2626",
  orange: "#EA580C",
  amber: "#D97706",
  yellow: "#CA8A04",
  lime: "#65A30D",
  green: "#16A34A",
  emerald: "#059669",
  teal: "#0D9488",
  cyan: "#0891B2",
  sky: "#0284C7",
  blue: "#2563EB",
  indigo: "#4F46E5",
  violet: "#7C3AED",
  purple: "#9333EA",
  fuchsia: "#C026D3",
  pink: "#DB2777",
  rose: "#E11D48",
};

/** Stemcells' own projects: the Disk project the cleanup Cells open in, and the scratch one. */
export type OwnProject = "disk" | "scratch";

/**
 * Which of Stemcells' own projects a folder is, by the folders its machine names for them;
 * `sameFolder` is the client's own comparison of two paths.
 */
export function ownProjectOf(
  workspaceRoot: string,
  config:
    | {
        readonly scratchWorkspaceRoot?: string | null | undefined;
        readonly newProjectsRoot?: string | null | undefined;
      }
    | null
    | undefined,
  sameFolder: (a: string, b: string) => boolean,
): OwnProject | null {
  const scratch = config?.scratchWorkspaceRoot;
  if (scratch && sameFolder(workspaceRoot, scratch)) return "scratch";
  const projects = config?.newProjectsRoot;
  if (projects && sameFolder(workspaceRoot, diskProjectFolder(projects))) return "disk";
  return null;
}

/** Upstream's project icon (`ProjectIconOverride` in `@t3tools/contracts`), as the mark reads it. */
export type ProjectIconLike =
  | { readonly kind: "monogram"; readonly text: string; readonly color: string }
  | { readonly kind: "lucide"; readonly name: string; readonly color: string }
  | { readonly kind: "emoji"; readonly emoji: string };

/** What a project's tile shows. */
export type ProjectMarkLook =
  /** Stemcells' own tile and its glyph. */
  | { readonly kind: "own"; readonly own: OwnProject }
  /** A tile in the project's colour, its letters or the icon named for it in white. */
  | {
      readonly kind: "made";
      readonly fill: string;
      readonly letters: string;
      /** Upstream's icon name (lucide's), drawn where a client has it, else the letters. */
      readonly icon: string | null;
    }
  /** A neutral tile, the emoji on it. */
  | { readonly kind: "emoji"; readonly emoji: string }
  /** A neutral tile under the project's own image, which upstream finds and loads. */
  | { readonly kind: "brand" }
  /** A neutral tile under upstream's folder glyph: a project with no name to make letters of. */
  | { readonly kind: "plain" };

const fillOf = (color: string) => MADE_FILL[color] ?? MADE_FILL.gray!;

export function projectMarkOf(input: {
  readonly own: OwnProject | null;
  readonly icon: ProjectIconLike | null | undefined;
  /** Whether upstream has an image for the project. */
  readonly image: boolean;
  /** Upstream's letters and colour for the project's name; null when its name is empty. */
  readonly named: { readonly letters: string; readonly color: string } | null;
}): ProjectMarkLook {
  const { icon, named } = input;
  if (input.own !== null) return { kind: "own", own: input.own };
  switch (icon?.kind) {
    case "monogram":
      return { kind: "made", fill: fillOf(icon.color), letters: icon.text, icon: null };
    case "lucide":
      return {
        kind: "made",
        fill: fillOf(icon.color),
        letters: named?.letters ?? "",
        icon: icon.name,
      };
    case "emoji":
      return { kind: "emoji", emoji: icon.emoji };
  }
  if (input.image) return { kind: "brand" };
  if (named === null) return { kind: "plain" };
  return { kind: "made", fill: fillOf(named.color), letters: named.letters, icon: null };
}
