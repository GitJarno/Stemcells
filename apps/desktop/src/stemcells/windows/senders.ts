/**
 * Stemcells: who may speak on the windows' channels. Only an app window's
 * own page, from its top frame. A browser preview's `<webview>` guest is
 * refused: its preload holds `ipcRenderer` without context isolation, so
 * the page it shows can reach it. So is a frame inside a page.
 */

/** What the check reads of an IPC event. */
export interface IpcSender {
  readonly sender: { getType(): string; readonly mainFrame: unknown };
  readonly senderFrame: unknown;
}

/** True for a message from a window's own page, sent from its top frame. */
export function fromWindowPage(event: IpcSender): boolean {
  return (
    event.sender.getType() === "window" &&
    event.senderFrame !== null &&
    event.senderFrame === event.sender.mainFrame
  );
}
