import {
  faviconUrlForOrigin as upstreamFaviconUrlForOrigin,
  toolActivityFaviconUrl as upstreamToolActivityFaviconUrl,
} from "@t3tools/shared/favicon";

// Upstream's favicons, with nothing fetched. Upstream asks Google's favicon
// service for a link's icon, and loads a page's icon from its own site, so
// the hostname of every link in a chat, and every page a Cell reads, left
// the machine. Stemcells draws its own mark instead: each caller shows its
// glyph when there is no icon (a globe for a link, the tool's icon for a
// page). An icon the provider sent inline is still shown: it is already here.

const inline = (url: string | null) => (url?.startsWith("data:") ? url : null);

/** No icon from a favicon service: the link shows the app's own mark. */
export function faviconUrlForOrigin(
  rawUrl: string | null | undefined,
  size?: number,
): string | null {
  return inline(upstreamFaviconUrlForOrigin(rawUrl, size));
}

/** Only an icon the provider sent inline; none is fetched from the page's site. */
export function toolActivityFaviconUrl(
  ...args: Parameters<typeof upstreamToolActivityFaviconUrl>
): string | null {
  return inline(upstreamToolActivityFaviconUrl(...args));
}
