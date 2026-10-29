# Contributing to Stemcells

Stemcells is built in the open, mostly by coding agents its maintainer runs
inside Stemcells itself. That shapes how outside help works best.

## Welcome, any time

- **Bug reports.** Open an issue: what you did, what you expected, what
  happened, your macOS version and the Stemcells version (Settings › About).
  Leave out secrets and home folder paths.
- **Ideas.** Open an issue that starts with the problem, not the solution.
- **Security issues.** Privately, never in an issue: see
  [SECURITY.md](SECURITY.md).

## Pull requests are read, not run

Stemcells' checks run on the maintainer's own Mac, and that Mac never runs
code from outside the project. So a pull request from a fork is read as a
proposal: if its idea fits, it's rebuilt on a branch of our own, and the
change credits you. Don't be discouraged when your branch itself doesn't
merge; the idea is what counts.

What makes one land: one problem, explained in a sentence or two, and the
smallest change that fixes it.

A fix to T3 Code's engine that every T3 Code user would want belongs
upstream, under [T3 Code's contributing guide](../CONTRIBUTING.md).

## How a change lands here

Every change is a pull request from a branch of this repository. It merges
only when its exact head carries the status `local-check` = success, which
`stemcells/scripts/check-local` records after running the checks. Agents and
people alike start with [stemcells/AGENTS.md](../stemcells/AGENTS.md).

## License

By contributing, you agree that your contribution is licensed under the
[MIT license](../LICENSE) the project ships under.
