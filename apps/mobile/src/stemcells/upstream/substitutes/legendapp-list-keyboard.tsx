// Replaces `@legendapp/list/keyboard` for upstream's importers (`substitutes.cjs`): a chat starts
// at its top. Upstream holds a short chat at its end, above the composer, unless its first message
// was sent from the open screen; a short chat opened again sat at the bottom. Once it fills the
// screen it follows its end as before (`stemcells/docs/motion.md`).
import { KeyboardAwareLegendList as PackageList } from "@legendapp/list/keyboard";

export * from "@legendapp/list/keyboard";

export const KeyboardAwareLegendList: typeof PackageList = (props) => (
  <PackageList {...props} alignItemsAtEnd={false} />
);
