# Disk: the cleanup Cells sit in a Disk project, under a hard drive

"Free space" opened its Cell in No project, which shows no icon, so the
cleanup Cells were scattered among every other chat without a project. The
person chose a project of its own named Disk, wearing a crafted hard-drive
icon, shown like any project in the column, the headers and the project
lists.

## Plan

- [x] `stemcells/disk/project.ts`, shared by the web and the phone: the
      Disk project's title, folder (`disk` in the machine's
      `newProjectsRoot`) and icon, and `openDiskProject`: find the project
      by its folder, else make it with upstream's `project.create`
      (`createWorkspaceRootIfMissing`), write the icon with
      `projects.writeFile` and name it with `project.update`'s
      `faviconPath`.
- [x] The icon: a hard drive in Stemcells' ink on a graphite tile, a green
      activity light, fixed colours, legible at 14 px.
- [x] Web (Settings › Disk for this and other machines, the disk-full
      row) and phone (DiskScreen) open the Cell there (`useOpenDiskCell`).
- [x] A new chat with no project on screen passes over the Disk project,
      as over the scratch project (`upstream/firstProject.ts`).
- [x] Tests: the opener, the Disk folder in `firstProject`, upstream's
      folder lookup; a server contract test for the folder and the icon.
- [x] `seams.md`: Disk on every machine, and the web's tsconfig row.

## Review

Client-side through upstream's RPCs, not a server service of ours: the
same three commands reach any connected machine, from the web or the
phone, with no route of ours. The icon is named on the project because the
server caches a miss for the empty folder the moment the project appears,
and a file can only be written once the project exists. A plain folder,
not a checkout: the old reason for No project (a worktree copying a
checkout on a full disk) doesn't arise. Cells already in No project stay
there. Checked end to end on upstream's server in a throwaway test
(create in a missing folder, icon, rename, delete, make again in the same
folder; a second create while one exists fails), not in a real client.
