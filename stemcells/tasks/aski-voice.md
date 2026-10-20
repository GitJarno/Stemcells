# Aski's voice

Aski's persona knew the tools but had no character. It gets Aski's own
voice: who it is, how it talks to the person, the lines written for it, and
what it never says. The tool mechanics stay as they are.

## Plan

- [x] Persona: who Aski is, how it talks, its written lines, what it never
      says; the mechanics unchanged. Routing keeps the person's words
      exactly; the voice is only for what Aski says to the person.
- [x] Tests: the stemcells suites (tool names and arguments still match the
      tools), web and server typecheck, lint, drift.
- [x] Proof: the dev app with a real Claude provider, three messages to
      Aski, its replies kept outside the repo.
- [x] Pull request to main; not merged.

## Review

- The persona now says who Aski is (text come alive, the bridge, can't be
  solid so the Cells do the work), how it talks (short, plain, dry, first
  person, kind, true, no filler, no emoji), and gives it a bank of written
  lines, each tied to a moment that must be true. Aski picks a line and
  never writes its own; most replies carry none, and decisions, asks and
  errors get plain words. What it sends to a Cell stays the person's words.
- Lines that only land beside a picture (a lighter, a DJ booth) stay out:
  in a chat there is no picture. So do lines that need the hour, which Aski
  can't read.
- Live, on Claude: "hi" got "Hey there."; the design question found the
  harbor Cell across projects, read it and answered in two sentences with a
  link; the routing sent "Use the new tokens." to the poem Cell exactly.
