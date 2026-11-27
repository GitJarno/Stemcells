// A project's mark (`stemcells/brand/projectMark.ts`): one squircle tile, `size` pt square, ringed
// in a hairline of ink. A project's own image fills it; a made mark is its colour under white
// letters or symbol; Stemcells' own projects wear the app icon's night and ink. The web's
// `ProjectMark.tsx` draws the same.

import { memo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import {
  MARK_CORNER,
  MARK_GLYPH,
  OWN_INK,
  OWN_TILE,
  type ProjectMarkLook,
} from "../../../../../stemcells/brand/projectMark.ts";
import { CODE_FONT } from "../tokens";
import { AppText, SymbolView } from "../upstream/cells";
import {
  countGlyphs,
  type MarkedProject,
  ProjectFavicon,
  symbolForIcon,
  useProjectMarkLook,
} from "../upstream/projectMark";

const WHITE = "#FFFFFF";

export const ProjectMark = memo(function ProjectMark(props: {
  readonly project: MarkedProject;
  readonly size: number;
}) {
  const { project, size } = props;
  const look = useProjectMarkLook(project);
  const corner: ViewStyle = { borderRadius: size * MARK_CORNER, borderCurve: "continuous" };
  const fill = look.kind === "own" ? OWN_TILE : look.kind === "made" ? look.fill : null;
  return (
    <View
      className={fill === null ? "bg-foreground/10" : undefined}
      style={[
        corner,
        {
          width: size,
          height: size,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        fill === null ? null : { backgroundColor: fill },
      ]}
    >
      <Face look={look} project={project} size={size} />
      <View
        pointerEvents="none"
        className="border-foreground/20"
        style={[StyleSheet.absoluteFill, corner, { borderWidth: StyleSheet.hairlineWidth }]}
      />
    </View>
  );
});

function Face(props: {
  readonly look: ProjectMarkLook;
  readonly project: MarkedProject;
  readonly size: number;
}) {
  const { look, project, size } = props;
  const glyph = size * MARK_GLYPH;
  switch (look.kind) {
    case "own":
      return (
        <SymbolView
          name={look.own === "disk" ? "internaldrive" : "text.bubble"}
          size={glyph}
          tintColor={OWN_INK}
          type="monochrome"
        />
      );
    case "made": {
      const symbol = look.icon === null ? null : symbolForIcon(look.icon);
      return symbol === null ? (
        <Letters text={look.letters} size={size} />
      ) : (
        <SymbolView name={symbol} size={glyph} tintColor={WHITE} type="monochrome" />
      );
    }
    case "emoji":
      return (
        <AppText
          allowFontScaling={false}
          style={{ fontSize: size * 0.66, lineHeight: size, includeFontPadding: false }}
        >
          {look.emoji}
        </AppText>
      );
    case "brand":
      return (
        <ProjectFavicon
          environmentId={project.environmentId}
          faviconPath={project.faviconPath}
          projectTitle={project.title}
          workspaceRoot={project.workspaceRoot}
          size={size}
        />
      );
    case "plain":
      return (
        <SymbolView
          name={{ ios: "folder.fill", android: "folder" }}
          size={glyph}
          tintColorClassName="accent-icon-subtle"
          type="monochrome"
        />
      );
  }
}

/** One letter at the glyph's size, two a little smaller to sit side by side. */
function Letters(props: { readonly text: string; readonly size: number }) {
  const one = countGlyphs(props.text) <= 1;
  return (
    <AppText
      allowFontScaling={false}
      numberOfLines={1}
      style={{
        color: WHITE,
        fontFamily: CODE_FONT,
        fontWeight: "700",
        fontSize: props.size * MARK_GLYPH * (one ? 1 : 0.86),
        lineHeight: props.size,
        textAlign: "center",
        includeFontPadding: false,
      }}
    >
      {props.text}
    </AppText>
  );
}
