# One pick for model and effort

The person asked (2026-11-27) for the model and effort choice to be simple on
the Mac and the phone, the iPhone Duo above all: no long list to scroll, no
menu inside a menu, no name said twice ("Claude Haiku 4.5" reads "Haiku").
T3's picker serves every provider's whole catalogue; ours serves a person
choosing what to run next.

## What was wrong

- **The phone** listed every model of every agent (Codex 6, Claude 4,
  Antigravity 9), then Options under them: changing effort meant scrolling
  past the models, tapping Reasoning, picking on a pushed page, coming back
  and tapping the check. A model tapped waited for Save.
- **Names** said the vendor beside its own logo ("Claude Opus 5.5") on the
  phone, and a version on every row on both.
- **Antigravity** lists effort as models: "Flash 3.8 (High)", "(Medium)",
  "(Low)", so a third of its rows are one model.
- **The Mac** has tabs per provider plus Favorites, a legacy fold per tab, an
  effort column with up to seven rows, and Permissions in a menu inside the
  popup.

## Decisions

1. **One surface, everything one tap.** Each agent is one line: its mark,
   then its models. Under them the model's effort as one row of levels, then
   its switches (Fast, Ultracode) and Access as one row of its modes. No
   tabs, no pushed pages, no menus.
2. **A model reads by its family alone**: Opus, Sonnet, Haiku, Sol, Flash.
   The line shows each family's newest current model. A version shows only
   on an older one: a model a Cell still runs, or one found by search.
3. **Legacy models leave the line.** Search finds every model, older ones
   with their version. Hidden models (Settings) stay hidden.
4. **Effort baked into a name folds into one model.** Flash 3.8 High, Medium
   and Low are one Flash; its levels are the effort row's.
5. **A tap applies.** The phone's sheet has no Save or Done and fits its
   content; a swipe down or a tap outside closes it. The Mac's popup stays
   open for effort after a model is picked, as T3's docked picker does.
6. **Levels read short**: Low, Medium, High, XHigh, Max. Ultrathink stays a
   word typed in the prompt; nothing else changes about it.
7. **Access is four words in a row**: Supervised, Edits, Auto, Full. On the
   Mac it was a menu in the popup's footer; on the phone a pushed page.
8. **Favourites leave the pick**: with one line per agent there is nothing to
   shortlist. They stay in Settings and keep their meaning elsewhere.

9. **Three sections on one grid** (2026-11-27, the person: "messy" on the
   Duo): Model, Effort and Access each under a quiet caption; agents' marks
   hang in a gutter, the agent a Cell isn't running a step back, and every
   choice is a segmented track starting at one edge, models included, so
   no row reads differently from another. Switches sit on Effort's caption
   line. A sheet at least 720 points wide sets Model beside the rest; the
   open Duo's sheet (about 650) is one column, where "Supervised" and
   "Medium" keep their whole words.

Same sections, order and words on both; drawn natively on each. The rule
that turns a catalogue into lines (`apps/web/src/stemcells/models/lineup.ts`)
is shared: the phone imports it as the kits are.

## Steps

- [x] 1. The lineup rule, pure, with a table test over the manifest's models
- [x] 2. Mac: the picker's list as the lineup (substitute of `ModelPickerContent`)
- [x] 3. Mac: effort row, switches and Access in the popup (substitute of
      `ComposerModelEffort`'s column and footer), stacked under the lineup
- [x] 4. Mac: the trigger and every name by family (`providerIconUtils`)
- [x] 5. Phone: concise names everywhere (`modelOptions` substitute)
- [x] 6. Phone: the pick in the sheet (seam in `ThreadSettingsSheet.tsx`),
      one tap applies, the sheet fits its content
- [x] 7. Upstream tests our substitutes change: skip list with reasons
- [x] 8. Seams and substitutes recorded; drift; docs where the user guide
      describes the picker
- [ ] 9. Real-client pass: web captures (done); iPhone and iPad simulators (done, after the
      blank-sheet fix below); the Duo itself (waits on disk)
- [ ] 10. Checks, pull request, check-local, merge

## Review

The Mac's pick replaces T3's list and column whole, so a review walked what
T3's picker did that ours had to keep: picks of several models at once (each
lit), the provider and jump shortcuts, the effort row taking focus after a
model, an agent's setup line beside its models, backends (fx's) as lines of
their own, and the runtime limits' refresh. Each is kept on the Mac; the phone
keeps backends, update notices and the default alias, and has no multi-pick or
shortcuts to keep. Not yet seen on a phone: no disk for a simulator build.

The first phone build opened a large, empty sheet on every iPhone and iPad.
A fit-to-contents sheet takes its content's height, but T3's stack draws each
presented route inside a nested stack that only fills its parent, so that
content measured 0: no detent was set and nothing showed. The pick now lays
itself out free of the sheet, measures itself and hands its route that height
(`useSheetFit` in `pickSheet.ts`); All models asks for the whole sheet.
