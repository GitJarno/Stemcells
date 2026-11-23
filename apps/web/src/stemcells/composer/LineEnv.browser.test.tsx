import { useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { render } from "../upstream/testRender";
import { Menu, MenuCheckboxItem, MenuPopup, MenuTrigger } from "../upstream/ui";
import { LineEnv } from "./LineEnv";

// The ledge's menu holds upstream's toolbar, whose repositories checklist is a menu portaled
// outside ours that stays open on a pick. Ours closed on that press, and the checklist was left
// anchored to nothing, in the window's corner.
function Ledge(props: { onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  const [host, setHost] = useState<HTMLElement | null>(null);
  return (
    <>
      <LineEnv
        label="All repositories"
        repositories
        offered
        open={open}
        onOpenChange={(next) => {
          props.onOpenChange(next);
          setOpen(next);
        }}
        host={setHost}
      />
      {host === null
        ? null
        : createPortal(
            <Menu>
              <MenuTrigger>Repositories</MenuTrigger>
              <MenuPopup>
                <MenuCheckboxItem checked closeOnClick={false}>
                  web
                </MenuCheckboxItem>
              </MenuPopup>
            </Menu>,
            host,
          )}
      <button type="button">Elsewhere</button>
    </>
  );
}

describe("where a Cell runs, in its ledge's menu", () => {
  it("stays open for a pick in a menu its toolbar opened, and closes for a press elsewhere", async () => {
    const onOpenChange = vi.fn();
    await using screen = await render(<Ledge onOpenChange={onOpenChange} />);
    await userEvent.click(page.getByRole("button", { name: "Repositories" }));
    await userEvent.click(page.getByRole("menuitemcheckbox", { name: "web" }));
    await expect.element(page.getByRole("menuitemcheckbox", { name: "web" })).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // The checklist's backdrop takes a press elsewhere, which closes both.
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }), { force: true });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
