# Messages say Stemcells

The shared packages and the server wrote "T3 Code" into messages both apps
show: why a host didn't answer, provider states, database errors, the
restart notice, the Codex sign-in page. A person reads these, so they say
Stemcells, from the one name constant. Logs, identifiers, protocol names,
files on disk and what only the model reads stay.

- [x] Sort every "T3 Code" line outside tests into: a person reads it, or kept (command line, model, id, log, on disk)
- [x] The person-read lines say `APP_NAME` (48 files, one or two lines each); the Codex sign-in page's wordmark too
- [x] Typecheck every touched package and app
- [x] Upstream's tests that pinned the old words, updated (13 files)
- [x] `nameInMessages.contract.test.ts`: sweep for "T3 Code", with the kept lines listed and why; a check that the clients show the name
- [x] seams.md

## Review

Done. The sweep fails when a changed message goes back to "T3 Code", when a
client's message does (the sweep and the behavioural check both), and when a
kept rule goes. Every touched package's suite passes except two failures
unrelated to this: `shared`'s node:sqlite test (Node 25.7 locally) and the
server's `CodexInstallation` test that compares `codex.exe` with
`codex.EXE` on a case-insensitive disk.
