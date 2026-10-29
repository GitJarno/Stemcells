# Going public

The repository opens to everyone, history and pull requests included, and
the person keeps working on it in the open with their Cells.

- [x] Front page (`.github/README.md`) says what Stemcells is about: words
      become things; talk to one, run many; grow your agents; only what
      needs you; bring your own agents.
- [x] Our own security policy, contributing guide and issue contact link,
      where upstream's sent people to T3.
- [x] `check-local` runs only the person's own pull requests from this
      repository, and commits on origin's branches.
- [x] `stemcells/scripts/publishable`: a private-word list outside the repo,
      checked on every push and in `check-local`.
- [x] Names of other projects and people out of the tree.
- [x] Startup recovery's Reinstall and Releases point at our repository.
- [ ] Settings: Actions off, private vulnerability reporting on, `main`
      protected, merged branches deleted (and deleted on merge), wiki off.
- [ ] Old pull request text that names something private.
- [ ] Visibility: public, once the person decides how the history goes.
- [ ] stemcells.sh live.

## Later

- Prebuilt, signed releases that update through upstream's own updater,
  once there's an Apple Developer ID; until then Stemcells installs from
  source and updates itself from this repository.
- The phone app's update URL and project still name T3's; they stay off
  unless a build turns them on.
