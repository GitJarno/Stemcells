// A place in Settings a reply names, as a link that opens it (stemcells/tasks/settings-in-chat.md):
// a row scrolls into view and pulses as a search jump does, a provider opens on its own card.
// It reads as Settings titles its steps, and copies as the reply's own words.
import { Link } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import {
  crumbsFor,
  placeKey,
  placeOf,
  type SettingsPlace,
} from "../../../../../stemcells/settings/places.ts";
import {
  providerCardSearch,
  revealSettingsSearchTarget,
  type SettingsPath,
} from "../upstream/settings";

import "./placeLink.css";

/** The context link's kind for a place: `t3-context://v1/stemcells-place/<key>`. */
export const PLACE_LINK_KIND = "stemcells-place";

export const placeHref = (place: SettingsPlace) =>
  `t3-context://v1/${PLACE_LINK_KIND}/${placeKey(place)}`;

export function PlaceLink(props: {
  readonly placeKey: string;
  readonly label: string;
  readonly environmentId?: string | undefined;
}) {
  const place = placeOf(props.placeKey);
  if (place === null) return <span>{props.label}</span>;
  const crumbs = crumbsFor(place);
  // A line breaks only after a step's "›": the icon keeps to the first, the "›" to its step.
  const words: ReactNode = crumbs.map((crumb, index) => {
    const last = index === crumbs.length - 1;
    return (
      // oxlint-disable-next-line react/no-array-index-key -- A path's steps, in order.
      <Fragment key={index}>
        {index === 0 ? null : " "}
        <span data-place-crumb={last ? "last" : ""}>
          {index === 0 ? <SettingsIcon aria-hidden="true" data-place-icon="" /> : null}
          {crumb}
          {last ? null : (
            <span aria-hidden="true" data-place-separator="">
              ›
            </span>
          )}
        </span>
      </Fragment>
    );
  });
  const shared = { "data-stemcells-place": "", "data-markdown-copy": props.label };
  if (place.kind === "provider") {
    return (
      <Link
        {...shared}
        to="/settings/providers"
        search={providerCardSearch(place.driver, props.environmentId)}
      >
        {words}
      </Link>
    );
  }
  if (place.kind === "row") {
    const { anchor } = place;
    return (
      <Link
        {...shared}
        to={place.page as SettingsPath}
        hash={anchor}
        hashScrollIntoView={false}
        onClick={() => revealSettingsSearchTarget(anchor)}
      >
        {words}
      </Link>
    );
  }
  return (
    <Link {...shared} to={place.page as SettingsPath}>
      {words}
    </Link>
  );
}
