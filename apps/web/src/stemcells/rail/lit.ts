/**
 * The rail's item for where you are: Usage, Settings, or Settings › Disk,
 * which the disk gauge opens and lights for rather than the cog.
 */
export function litFor(pathname: string): "usage" | "settings" | "disk" | null {
  if (pathname === "/usage") return "usage";
  if (pathname === "/settings/disk") return "disk";
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "settings";
  return null;
}
