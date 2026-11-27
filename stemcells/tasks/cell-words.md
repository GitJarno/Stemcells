# Cell words, by rule (2026-11-27)

The person: "thread = cell, remember". Upstream's views say thread in about
330 of the phone's messages and 520 of the web's, and add more each sync.
The word table swapped one line per entry, so it reached a handful. A
message literal (`gt("…")`, `msg("…")`, `<T>…</T>`) is words a person
reads by construction, so the builds can rename thread there by rule.

## Plan

- [x] `stemcells/brand/cellWords.ts`: whole-word thread(s) → Cell(s) in a
      message's text, ICU-aware (never an argument name or a select key),
      and a short keep-list with why
- [x] The builds' transform hook applies it to every message literal it
      finds (oxc, from vite-plus), after the word table, which still wins
      where it says something else
- [x] Other locales: each catalog also files every rewritten message's
      translation under the rewritten text's GT hash
- [x] The guard (ours gate): no English message in the phone's or the web's
      sources still says thread after the transform, and every catalog
      message that says thread is one the transform sees
- [x] Hard-coded words outside i18n on both clients and the desktop shell;
      our own layer
- [x] Word table entries the rule covers removed; fork.md and seams.md say
      what's true now
- [x] Proof: transform tests, a German lookup of a rewritten message, a web
      production build and a phone bundle with "Select a Cell", a capture
- [ ] Land: drift, check:changed, web and phone stemcells suites, PR,
      check-local, merge

## Review

The rule renames 528 of the web's catalog messages and 328 of the phone's
(the desktop shell has none). Run over every client source, the transform
leaves no message that says thread; the guard fails when the scanner misses
a way of writing a message (checked by dropping `msg` from it) or the
transform misses a word (checked by disabling it).

Other languages: GT keys a catalog by the hash of the English source and
its context, and en.json keeps neither, so the build finds each message's
by the hash it reproduces. GT's own extractor (`gt generate`) run over the
transformed sources found every rewritten message upstream translates in
the re-keyed catalogs (web 652, phone 363). The same fixes "T3 Code" ones,
which had lost their translations since the name transform. T3's patched
`hashMessage` caches a JSX message by its text as a string, so every `<T>`
of one shape shares a hash at runtime; the build hashes with GT's
uncached `hashSource`, and the runtime bug is upstream's.

Our code that matched upstream's English now matches it as built
(`asBuilt`): the palette's Copy thread, the untitled title, the phone's
alert words. The shared settings catalog says Cells. Left: other
languages' own word for a thread; a word-table swap still falls back to
English in other languages, as before.
