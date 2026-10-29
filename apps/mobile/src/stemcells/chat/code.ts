// A chat's header holds one button where upstream's held three (git, files, terminal): each is a
// way into the working copy the Cell changes, so `</>` names them all. Its menu grows from the
// glass into a row for each, git's and the terminal's own menus open from their rows, and the
// header keeps its room for the Cell's name.

/** A header item as upstream builds it (`features/threads/ThreadGitControls.tsx`). */
type HeaderItem = Readonly<Record<string, unknown>>;

/** Upstream's three, in the order the menu lists them. */
export const CODE_ITEM_IDS = [
  "thread-right-git",
  "thread-right-files",
  "thread-right-terminal",
] as const;

/** A row of the Code menu: upstream's menu opens as a submenu, its button as an action. */
function rowOf(item: HeaderItem) {
  const menu = item.menu as { readonly items?: ReadonlyArray<unknown> } | undefined;
  const shared = { label: item.label, icon: item.icon };
  if (item.type === "menu" && menu?.items !== undefined && item.disabled !== true)
    return { ...shared, type: "submenu", items: menu.items };
  return {
    ...shared,
    type: "action",
    disabled: item.disabled === true,
    onPress: typeof item.onPress === "function" ? item.onPress : () => {},
  };
}

/** `items` with upstream's git, files and terminal folded into one Code menu where the first stood. */
export function foldIntoCode(items: ReadonlyArray<HeaderItem>): HeaderItem[] {
  const ours = CODE_ITEM_IDS.flatMap((id) => items.filter((item) => item.identifier === id));
  if (ours.length === 0) return [...items];
  const code = {
    accessibilityLabel: "Code",
    icon: { name: "chevron.left.forwardslash.chevron.right", type: "sfSymbol" },
    identifier: "thread-right-code",
    label: "Code",
    menu: { items: ours.map(rowOf) },
    sharesBackground: true,
    type: "menu",
    variant: "plain",
  };
  const first = items.findIndex((item) => ours.includes(item));
  return items.flatMap((item, index) =>
    index === first ? [code] : ours.includes(item) ? [] : [item],
  );
}
