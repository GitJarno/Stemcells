import {
  faviconUrlForOrigin as upstreamFaviconUrlForOrigin,
  toolActivityFaviconUrl as upstreamToolActivityFaviconUrl,
} from "@t3tools/shared/favicon";

// Upstream's favicons, with nothing fetched: upstream asks Google for a link's icon and loads a
// page's icon from its site, so every link's and read page's hostname left the machine. Each
// caller shows its own glyph instead (a globe for a link, the tool's icon for a page); an icon
// the provider sent inline is still shown, as it is already here.

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
