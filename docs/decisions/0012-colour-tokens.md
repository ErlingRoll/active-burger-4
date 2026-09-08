# Colour tokens

## Context

The stylesheets carried 1,280 hex literals across 196 distinct colours, against
seven custom properties, none of which were colours. The only written definition
of the palette was a markdown table in `GRAPHICS_GUIDELINES.md`, so changing a
shade meant a project-wide find and replace, and nothing could check that a
surface stayed within the documented palette.

## Decision

`src/styles/tokens.css` is the single definition of every repeated colour, and
is imported before any other sheet.

121 of the distinct colours were exact values from the palette the design was
built on, and are named by family and step (`--color-slate-900`). Seven more
recur across sheets without belonging to it, the worn-arena gradient, the cool
panel fills, and pure white, and are named for what they are
(`--arena-gradient-start`, `--panel-cool`). Everything that matched is replaced
by a `var()` reference.

A small semantic layer names the roles that are settled and used:
`--surface-page`, `--text-primary`, `--text-muted`, `--accent-danger`, and the
three Abyss surfaces from the graphics guidelines. It is deliberately small.
Naming a role speculatively produces indirection that later turns out to be
wrong; an earlier draft declared twenty-two semantic tokens of which seventeen
were never referenced.

The 77 literals that remain are used once or twice each, a single gradient stop
or one decorative accent, and stay at their point of use, because naming a value
used once adds indirection without adding a decision.

## Enforcement

`tests/styleTokens.test.ts` fails on an unused token, a duplicate declaration, a
semantic token that restates a value instead of referencing one, and any colour
used more than twice outside the token file.

## Consequences

The palette can be changed in one place, and the graphics guidelines can name
tokens instead of restating hex values. The cost is roughly 2 kB gzipped, since
`var(--color-slate-50)` is longer than `#f8fafc`.
