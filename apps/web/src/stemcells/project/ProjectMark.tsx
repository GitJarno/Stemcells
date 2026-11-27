import { FolderCodeIcon, HardDriveIcon, MessageSquareDashedIcon } from "lucide-react";
import { type CSSProperties, Suspense } from "react";

import {
  MARK_GLYPH,
  OWN_INK,
  OWN_TILE,
  type ProjectMarkLook,
} from "../../../../../stemcells/brand/projectMark.ts";
import {
  LucideIconNamed,
  ProjectFavicon,
  type ProjectFaviconProject,
  useProjectMarkLook,
} from "../upstream/projectMark";
import "./project-mark.css";

const WHITE = "#FFFFFF";

/**
 * A project's mark (`stemcells/brand/projectMark.ts`): one squircle tile, `size` px square,
 * ringed in a hairline of ink. A project's own image fills it; a made mark is its colour under
 * white letters or icon; Stemcells' own projects wear the app icon's night and ink.
 */
export function ProjectMark(props: {
  readonly project: ProjectFaviconProject;
  readonly size: number;
  readonly className?: string;
}) {
  const look = useProjectMarkLook(props.project);
  const tile = tileOf(look);
  const style = {
    "--project-mark-size": `${props.size}px`,
    ...(tile && { background: tile.fill, color: tile.ink }),
  } as CSSProperties;
  return (
    <span aria-hidden data-project-mark={look.kind} className={props.className} style={style}>
      <Face look={look} project={props.project} />
    </span>
  );
}

function tileOf(look: ProjectMarkLook): { fill: string; ink: string } | null {
  if (look.kind === "own") return { fill: OWN_TILE, ink: OWN_INK };
  if (look.kind === "made") return { fill: look.fill, ink: WHITE };
  return null;
}

function Face(props: { look: ProjectMarkLook; project: ProjectFaviconProject }) {
  const { look } = props;
  switch (look.kind) {
    case "own":
      return look.own === "disk" ? <HardDriveIcon /> : <MessageSquareDashedIcon />;
    case "made":
      return look.icon === null ? (
        <Letters text={look.letters} />
      ) : (
        <Suspense fallback={<Letters text={look.letters} />}>
          <LucideIconNamed name={look.icon} fallback={FolderCodeIcon} />
        </Suspense>
      );
    case "emoji":
      return <span data-project-mark-emoji="">{look.emoji}</span>;
    case "brand":
      return <ProjectFavicon project={props.project} className="size-full rounded-none" />;
    case "plain":
      return <FolderCodeIcon />;
  }
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Letters on a 16-unit tile: one at the glyph's size, two a little smaller to sit side by side. */
function Letters(props: { text: string }) {
  const one = Array.from(graphemes.segment(props.text)).length <= 1;
  const size = 16 * MARK_GLYPH * (one ? 1 : 0.86);
  return (
    <svg viewBox="0 0 16 16" data-project-mark-letters="">
      {/* Centred on the capitals: a cap is about 0.7 of the type's size. */}
      <text x="8" y={8 + size * 0.35} textAnchor="middle" fontSize={size} fill="currentColor">
        {props.text}
      </text>
    </svg>
  );
}
