import { useNavigate } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SettingsSidebarNav, useSettingsSections } from "../upstream/settings";
import {
  Button,
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../upstream/ui";
import "./settings.css";

/**
 * Settings on the slate: upstream's section list at its left edge, the panel beside it. On a
 * narrow slate the list folds into a menu row at the top. `actions` (General's restore button)
 * stand at the right of that row, which shows for them alone when the list has room.
 */
export function SettingsOnSlab(props: {
  pathname: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-stemcells-settings="">
      <aside data-stemcells-settings-list="" aria-label="Settings sections">
        <SettingsSidebarNav pathname={props.pathname} />
      </aside>
      <div data-stemcells-settings-panel="">
        <div data-stemcells-settings-row="" data-actions={props.actions ? "" : undefined}>
          <SectionMenu pathname={props.pathname} />
          {props.actions ? <div data-stemcells-settings-actions="">{props.actions}</div> : null}
        </div>
        {props.children}
      </div>
    </div>
  );
}

/** The list, folded: the section you are in, and the others to go to. */
function SectionMenu(props: { pathname: string }) {
  const sections = useSettingsSections();
  const navigate = useNavigate();
  // The licenses are a page of General's, as upstream's list lights them.
  const pathname =
    props.pathname === "/settings/open-source-licenses" ? "/settings/general" : props.pathname;
  const current = sections.find(
    (section) => pathname === section.to || pathname.startsWith(`${section.to}/`),
  );
  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" size="sm" data-stemcells-settings-menu="" />}>
        {current?.label ?? "Settings"}
        <ChevronDownIcon aria-hidden />
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuRadioGroup
          value={current?.to ?? null}
          onValueChange={(to: (typeof sections)[number]["to"]) =>
            void navigate({ to, hash: "", replace: true, hashScrollIntoView: false })
          }
        >
          {sections.map((section) => (
            <MenuRadioItem key={section.to} value={section.to}>
              {section.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
