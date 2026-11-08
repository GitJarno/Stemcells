// A chat's header holds one button where upstream's holds three (files, git, terminal): each is a
// way into the working copy the Cell changes, so `</>` names them all. Its menu grows from the
// glass into a row for each, git's and the terminal's own menus open from their rows, and the
// header keeps its room for the Cell's name.

import type { AppBarAction, AppBarMenu, AppBarMenuItem } from "../upstream/threads";

function rowOfAction(action: AppBarAction): AppBarMenuItem {
  return {
    id: action.accessibilityLabel,
    title: action.accessibilityLabel,
    icon: typeof action.icon === "string" ? action.icon : action.icon.ios,
    disabled: action.disabled === true || action.loading === true,
    destructive: action.destructive,
    onPress: action.onPress,
  };
}

function rowOfMenu(menu: AppBarMenu): AppBarMenuItem {
  return {
    id: menu.title,
    title: menu.title,
    icon: typeof menu.icon === "string" ? menu.icon : menu.icon.ios,
    items: menu.items,
  };
}

/** The buttons and menus upstream's chat header hands its bar, as one Code menu in their order. */
export function codeMenu(
  actions: ReadonlyArray<AppBarAction>,
  menus: ReadonlyArray<AppBarMenu>,
): AppBarMenu | null {
  const items = [...actions.map(rowOfAction), ...menus.map(rowOfMenu)];
  if (items.length === 0) return null;
  return { title: "Code", icon: "chevron.left.forwardslash.chevron.right", items };
}
