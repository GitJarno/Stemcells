# Input: the stage word for a Cell that waits on the person

The person, 2026-10-30, chose "Input" over "Needs you" for the stage, to be
more concise. The stages a person reads are Input, Flying, Landed, Settled,
in that order.

## The rule

A word becomes Input where it names the stage: a label, a segment, a
token's peek, and the accessible name those carry.

| Where                                 | Was       | Now   |
| ------------------------------------- | --------- | ----- |
| Web column, stage row (and its count) | Needs you | Input |
| Phone line's segment                  | Needs you | Input |
| A Cell's token, its peek's stage      | Needs you | Input |
| The site's act, the word over a Cell  | Needs you | Input |
| The phone's home in the install guide | Needs you | Input |

## Kept, and why

- **Code, wire values and fixtures** (`needs`, `needs-you`, `needsYou`):
  nobody reads them, and the wire crosses server, web and phone.
- **Text only models read**: Aski's standing report ("Needs you (N)",
  beside "At work (N)", as `flying.md` keeps it).
- **Sentences where "needs you" is the verb, not the stage's name**: the
  empty states ("Nothing needs you."), counts said as a sentence ("3 need
  you", "1 needs you · 2 flying"), Aski's greeting and persona lines, the
  phone's "When a Cell needs you" setting, a sign-in ask's "Needs you to
  sign in again" (card and push), "needs your click", and the site's
  "only what needs you".
- **Upstream's strings in upstream's views**: "Needs your input",
  "Needs your key", the sidebar's ", needs you".
- **Plans that record what was decided then**: they keep their words.

## Plan

- [x] The words above, and the tests that pin them
- [x] The rule in `stemcells/AGENTS.md`; the column's, the phone line's and
      the tokens' decisions say Input

## Review

Pending the pull request.
