# UI restyle scope: tokens-only, hand-authored SVG at empty states

Split's next UI pass aims for a lighter, more elegant look — light/airy, muted soft gradients,
generous whitespace, rounded cards — inspired by a Dribbble "Improving Splitwise" concept, with
illustration touches at empty/zero-data states. Scoped this as a **targeted restyle**: color,
type, and spacing tokens plus component markup only, not a structural overhaul, so the
CLAUDE.md-locked test-suite structural facts (`<li>` expense/member rows, the "Settle up" `<h2>`
inside a `<section>`, `BalanceBar` staying a non-list `aria-hidden` sibling, etc.) stay intact
across all four screens (group list, group detail, add-expense form, settle-up) in one pass.

Illustrations are scoped to **hand-authored inline SVG**, used sparingly — only at empty group
list, empty expense list, and all-settled-up — rather than an illustration library. This avoids
a new asset dependency and keeps illustrations themeable through the existing CSS-var
`prefers-color-scheme` approach, at the cost of a simpler illustration style than a dedicated
library would give.

## Considered Options

- **Full visual/structural overhaul**: rejected — risks the locked structural test facts and is
  more scope than "more elegant, still simplistic" calls for.
- **Illustration library** (e.g. unDraw-style): rejected — adds a dependency and less control
  over matching the reference's light/soft palette; inline SVG keeps it dependency-free and
  themeable.

## Outcome

A `mattpocock-skills:prototype` UI spike (sub-shape A, `?variant=` switcher on the real
`GroupsPage`/`GroupDetailPage` routes) offered three structural variants: **A** (today's
stacked-section layout, tokens softened only), **B** (settle-up promoted to a hero panel above
the fold, Members/Expenses side-by-side below, teal/violet gradient accent), and **C** (linear,
divider-based, member chips instead of a list). **Variant B won.** Folding it in as the
permanent default: settle-up moves above members/expenses on the group detail page, and the
group list becomes a card grid instead of a stacked list. The losing variants (A, C) and the
switcher scaffolding are preserved on the throwaway prototype branch, not main.
