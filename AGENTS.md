# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Play-mode fret resolution (App.jsx)

When resolving which fret to sound for a single string, an **absent** marker/chord entry means the **open string (fret 0)**, while `-1` means an **explicitly muted** string (stays silent). This convention is shared across `handlePlayString` (Play-mode pluck), `handleStrumPressedFrets` (`pressedFrets.get(si) ?? 0`), and `handleStrumChord`. Never treat `undefined` as "silent" — only `-1` mutes. The Strum button in the learn-view center panel is always visible (no chord + no markers strums the open strings).

## SVG fret-cell click hit-testing (GuitarString.jsx)

SVG has no z-index — paint order determines hit-testing. The transparent `.fret-cell`
hit rect must be the **last** child painted in each fret `<g>` so it sits on top of the
marker dots (chord/pressed/ripple circles + labels); otherwise a click landing on a dot
hits the dot (which has no handler) instead of the cell, and the note never plays. As a
belt-and-suspenders, all decorative markers carry `pointer-events: none` (`.fret-dot`,
`.fret-cell-label`, `.fret-ripple` in Fretboard.css) so they never intercept a click even
if paint order changes. Any new dot/label added inside a fret cell must either be painted
before the hit rect or get `pointer-events: none`.

## User dead/muted strings — a layer on top of chords (App.jsx)

`mutedStrings` (a `Set` of string indices) is the user's Edit-mode dead-string layer, kept
**separate** from `pressedFrets` so a mute survives independently of fret markers. It is the
top-priority gate: `handlePlayString` early-returns on a muted string, and both strum
handlers (`handleStrumPressedFrets`, `handleStrumChord`) `continue` past muted indices.
`handleStrumChord` falls back to the per-string loop whenever `pressedFrets.size > 0` **or**
`mutedStrings.size > 0` (so `audioService.playChord`, which ignores user mutes, isn't used
when a mute is active). Fretting a string in Edit mode clears its mute (mutually exclusive
states). `mutedStrings` is reset on instrument change and chord select, alongside
`pressedFrets`. The nut glyph in the interactive modes (Edit + the placement challenge,
gated by `diagramNut = placementMode || editMode` in `Fretboard.jsx`) uses the **chord-diagram
vocabulary** so both notations match: a fretted string shows **no** glyph, and every other
string shows a red `X` (muted) or a green open `Circle` (the default resting state, which is
itself the tap target). "Muted" here means the user mute layer OR, in edit mode, a selected
chord's own `-1` string; there is no ticked-checkbox or empty-square affordance anymore.
`diagramNut` deliberately stays true on the placement reveal (`onToggleMute` cleared) so the
glyphs persist for feedback; the separate `muteInteractive` (`diagramNut && !!onToggleMute`)
gates only the tap/keyboard hit zone. Play mode (neither flag) stays static and renders only
the selected chord's open/mute glyphs. The mute toggle is a keyboard-operable SVG
`role="button"` (`.mute-toggle`, with a hover/focus fill cue in `Fretboard.css`) carrying
`aria-pressed`/`aria-label`, mirroring the fret-cell a11y pattern.

## Placement challenge wrong-answer reveal (GuitarString.jsx + Fretboard.jsx)

After a wrong Fretboard-Placement submit, `ChordChallenge` passes `correctFingers`
(a full `si → fret` map, `0`=open / `-1`=muted / `N`=fretted) only on a wrong answer;
its presence is the reveal signal. The reveal encodes right-vs-wrong with **shape/weight,
not colour alone** (survives colour-blindness and dim screens):
- **Hit** (player placed the correct fret): solid green disc + white `✓` (`isHitMarker`).
- **Missed correct fret**: bold hollow green ring, thick stroke (`isAnswerMarker`) — dominant.
- **Player's wrong fret**: dim, dashed, translucent orange "ghost" (`isGhostMarker`) — recessive.
A correct placement becomes the hit marker (no orange dot, no ghost), so a right guess is
visibly distinct from a missed answer. At the **nut**, `Fretboard` computes `placementReveal`
(`placementMode && !!correctFingers`) and shows the **correct** open/muted glyph boldly
(green ○ / red ✕; a should-be-fretted string shows no bold nut glyph — its green ring is on
the board), with the player's differing open/muted choice drawn as a dim ghost glyph stacked
above (`ghostY`). A fully-correct submit passes `correctFingers={null}`, so none of this
renders. All markers keep `.fret-dot`/`.fret-cell-label` (`pointer-events:none`) and are
painted before the hit rect (see the SVG hit-testing note); the reveal works unchanged in
portrait (CSS-rotated SVG). Feedback copy lives in `ChordChallenge.jsx` `.placement-feedback`.

## Audio gating & transient UI (App.jsx)

Audio needs a first user gesture. State is a tri-state `audioStatus` ('idle' → 'pending' → 'ready'); `audioReady` is derived (`=== 'ready'`). `ensureAudioReady()` early-returns while `'pending'` so concurrent taps don't spawn a second `Tone.start()`/sampler build. The learn-view banner renders an explicit **Enable sound** primary button (disabled + spinner while pending); it also still initializes on first chord/string tap. Two transient cues use the shared `components/Toast` (purely visual, `aria-hidden`): a "Sound enabled" success toast on ready, and a "board cleared" toast on instrument switch. Both are paired with `sr-only` `aria-live` regions in App.jsx for assistive-tech parity — the toasts themselves must stay `aria-hidden` to avoid double announcements. Toast auto-dismiss timers live in effects keyed on the toast state (timeout-only setState) — don't call setState synchronously in those effects (the `react-hooks` lint rule flags cascading renders).

## Chord Challenge reward config (`public/challenge-config.json`)

The ≥90% reward code lives in `challenge-config.json` (fetched at runtime, relative to the document — resolves under the `/guitar-app/` base). The **committed** copy has `chordChallengeCode: ""` (empty); the real code is injected at deploy time. Because the code is empty locally, `hasCodeReward` (`!!challengeConfig?.chordChallengeCode`) is false, so the reward teaser/locked-hint/unlock-code UI in `ChordChallenge.jsx` will **not** render in dev/preview unless you temporarily set a non-empty code in the served copy (edit the gitignored `dist/challenge-config.json`, not `public/`, to avoid committing a code).

## `useCallback` dependency arrays are evaluated during render (TDZ gotcha)

In `ChordChallenge.jsx` the callbacks form a chain where later ones are referenced by earlier ones (e.g. `advanceRound` is defined after `handleTimeout`/`handleSkip`). It is safe to *call* a later-declared `const` from inside a `useCallback` body (closure, runs later), but listing it in the dependency array throws `ReferenceError: Cannot access '<x>' before initialization` at render because the array is evaluated immediately. Follow the existing pattern: omit the forward reference from the deps and add `// eslint-disable-line react-hooks/exhaustive-deps` (as `handleTimeout` and `handleSkip` do).

## Chord diagrams are transparent — reveal tints camouflage same-hue glyphs

`ChordDiagram`'s SVG has no background, so whatever card sits behind it shows through.
In `ChordChallenge` the answered option cards get a green (`.correct`) / red (`.wrong`)
reveal tint, which **camouflages markers of the same hue** — green open-string circles
(`var(--success)`) vanish on the green card, red muted-string X's (`var(--danger)`) vanish
on the red card, and the low-alpha `--diagram-line`/`--diagram-string` grid loses contrast.
This reads as "positions/mutes intermittently don't render" (only the answered cards, only
the matching hue, only chords with those glyphs). Fix in `ChordChallenge.css`: seat the
diagram on an opaque `--surface` panel (`.option-card.correct/.wrong .chord-diagram-wrapper`).
The chord data itself is clean — every chord satisfies `1 ≤ fret ≤ FRET_ROWS(5)`,
so the hardcoded `FRET_ROWS` window is not a rendering risk for the current data.
`ChordDiagram` sizes are `small | medium | large`; only `large` renders the name/meta/description text blocks.

## Chord diagrams & fretboard render at ABSOLUTE fret positions

Both `ChordDiagram.jsx` and the interactive `Fretboard`/`GuitarString` place every dot,
barre, and open/muted glyph at its **absolute** fret: fret N renders on row/cell index
`N-1` (the diagram is always nut-anchored, with fret-row numbers 1..5 down the left edge).
There is no `startFret` field anymore — do not reintroduce a relative window. Because
`ChordDiagram` has a fixed `FRET_ROWS = 5`, **every voicing in `src/data/chords.js` must
keep all fretted notes within frets 1–5** (a chord above fret 5 would silently clip). The
audio path (`audioService.playNote/playChord`, `App.jsx` handlers) already treats
`strings[]` values as absolute frets, so display and playback stay in sync. Authoritative
chord charts the data was transcribed from live at `firstmate/data/chords/*.png` (note the
`major_7th_chords.png` file actually holds **dominant** 7ths). Chord `type` values in use:
`major | minor | dominant7 | major7 | minor7 | power`; everything is data-driven (group
labels in `ChordList.jsx` `TYPE_LABELS`, meta labels in `ChordDiagram.jsx` `TYPE_DISPLAY`,
challenge decoys filtered by `type` in `chordUtils.getDecoyChords`) — no hardcoded type enum.
All three seventh families exist for **all three** instruments (guitar/bass/ukulele).
Bass sevenths are two-note **root+7th dyads** (like the existing root+5th power chords):
`dominant7` and `minor7` are the *same two notes* (root + b7) and render identically — a
deliberate, captain-accepted choice, since the 3rd that distinguishes them is absent from a
dyad. Do not "fix" this by adding a note or dropping a family; each dyad's `description`
says the shape serves both. They never collide in Diagram Recognition because
`getDecoyChords` filters by `type` (7 chords per type ≥ the 4 shown, so no cross-type
fallback). Ukulele sevenths are standard 4-note GCEA voicings; the re-entrant G4 string
means "spells the chord" is about pitch classes present, not stacked order.

## Chord Challenge difficulty & riddle gating (ChordChallenge.jsx + chordUtils.js)

The challenge has three difficulty tiers keyed on chord `type`, defined once in
`chordUtils.DIFFICULTY_TYPES` (`easy`=major, `medium`=+minor, `hard`=all five types).
`getChordsForDifficulty(instrument, difficulty)` is the sole target-chord pool; `buildQuestion`
passes the tier's allowed types to `getDecoyChords` as its `allowedTypes` fallback so a wrong
answer can never leak a type outside the active tier. There is **no `power` type** in
`chords.js` anymore — bass "power chord" shapes are typed `major`/`minor` (so bass has real
minor chords and medium ≠ easy); the `power` strings surviving in `ChordList/ChordDiagram`
label maps are dead entries. Per-instrument pool sizes are uniform: easy=7, medium=14, hard=35
on all three instruments, so every tier builds a full 4-option round.

Difficulty is component state (default `medium`), selected on the `SELECT_MODE` setup screen;
it must stay in the dep arrays of `loadQuestion`/`startChallenge`. The easter-egg riddle on the
results screen is gated by `riddleUnlocked = difficulty !== 'easy' && accuracy >= 0.9` and
applies to **both** challenge types; when locked it renders a `.challenge-riddle.locked`
message telling the player how to unlock, revealing **no** riddle text. This is deliberately
stricter than the separate `challengeConfig.chordChallengeCode` reward (still `accuracy >= 0.9`
at any difficulty) — the two gates are intentionally not aligned; don't "fix" one to match the
other without a captain decision.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
