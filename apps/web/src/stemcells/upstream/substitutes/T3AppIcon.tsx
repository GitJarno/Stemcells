// Replaces `components/T3AppIcon.tsx` (`plugin.ts`): upstream's icon for T3's GitHub app, which
// would bundle T3's app icon. Stemcells sets no client id for that app, so no view shows it.
export function T3AppIcon(_props: { readonly className?: string }) {
  return null;
}
