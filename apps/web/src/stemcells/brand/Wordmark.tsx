import { APP_NAME } from "./name";

// The app's name set in type, where upstream draws the T3 logo beside
// "Code", in the size and weight upstream gives that pair. No logo: the mark,
// SC█, is the app's icon and the chat's small glyph. The colour is the
// place's own.

/** The sidebar's top-left. */
export function SidebarWordmark() {
  return (
    <span className="inline-flex min-w-0 items-baseline text-sm font-medium tracking-tight">
      <span className="truncate [text-box:trim-both_cap_alphabetic] supports-[text-box:trim-both_cap_alphabetic]:py-1">
        {APP_NAME}
      </span>
    </span>
  );
}

/** The welcome wizard's heading. */
export function WizardWordmark() {
  return <span className="text-2xl font-medium tracking-tight">{APP_NAME}</span>;
}
