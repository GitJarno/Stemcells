# What to say next

When a Cell finishes, its empty composer shows what the person would most
likely say next. Tab or → fills it in, and so does a tap on its key; Esc
hides it until the next reply.

## Decisions

1. **One suggestion, one reply, never stored.** It's the thread's last
   settled reply's, held in memory on the server and in the page, and gone
   when anything follows it. No event, projection or migration: upstream
   closed its own attempt (#8524) for storing them as activities.
2. **The provider's own when it makes one.** Claude Code predicts the next
   prompt itself, on a fork of the turn that reads the turn's prompt cache
   (`promptSuggestions`, Agent SDK), so it costs almost nothing and sees the
   whole turn. No other provider has one: Codex has an experimental
   `thread/sample` our app-server schema lacks, ACP and OpenCode nothing.
3. **Everyone else's comes from one short call** on the text generation
   model (the one that names threads), through `runLean`, in a private
   temporary folder: the last reply and the person's last few messages, a
   short answer. Every provider gets it with no code of its own, a new one
   included. That is the parity contract: a provider adds nothing to have
   suggestions, and a provider with its own prediction hands it over in one
   call (`offerPromptSuggestion`).
4. **Spend only on a reply someone opens.** The page asks for the reply it
   shows, once; the server answers each reply once, however many windows
   ask, and only for a reply that settled in the last hour (completed, not
   failed or stopped). A Claude Cell's own suggestion is waited for briefly,
   and the short call stands in only when Claude made none.
5. **One upstream file changes, a cold one.** A wrapper around the Claude
   query runner turns the option on and takes the message before the
   adapter sees it, so the hot `ClaudeAdapterV2.ts` stays untouched (rule
   7). The composer's and the editor's substitutes do the rest; no line of
   `ChatComposer.tsx` changes.
6. **A switch on this device**, Settings › Aski. Off, no page asks, so no
   short call is made; Claude still predicts its own, as Claude Code does.

## Plan

- [x] Server: the native store, the prompt and its filters, the route
      (`/api/stemcells/prompt-suggestion`), the upstream adapter
- [x] Seam: a wrapper around the Claude query runner, in the cold
      `ProviderOrchestrationAdapterInfrastructure.ts`, so `ClaudeAdapterV2.ts`
      and its budget stay as they were; `seams.md` row
- [x] Web: which reply qualifies, the ask, the hook, the substitutes, the key
- [x] Settings › Aski switch
- [x] Tests: filters, route (native, fallback, stale, coalesced), the
      qualifying reply, the editor's keys; contract test for the seam
- [x] Checks, drift, PR, check-local, merge

Not here: the phone's composer (the route is ready for it), Codex's
`thread/sample`.

## Review

Shipped in one pull request, #247. Upstream changed in one cold file (two
lines); `ClaudeAdapterV2.ts` and `ChatComposer.tsx` are untouched. An
independent review found that a later turn's Claude suggestion could be
kept for an earlier reply when the person moved on during the wait. Now a
new prompt ends any wait, and the route reads the runs again before it
answers (a test that failed before the fix pins it). The switch only stops
this device asking; Claude's own prediction is Claude Code's default, and
its `promptSuggestionEnabled` setting turns it off. Not checked live: a
real Claude session sending `prompt_suggestion` (the SDK documents it and
the types pin it), or the ghost in the running app beyond a browser
render.
