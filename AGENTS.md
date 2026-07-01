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
`pressedFrets`. The nut glyph priority per string is: user-mute X > chord open/mute glyph >
a faint "tap to mute" affordance circle (edit mode only). The mute toggle is a keyboard-
operable SVG `role="button"` (`.mute-toggle`) with `aria-pressed`/`aria-label`, mirroring
the fret-cell a11y pattern.

## Audio gating & transient UI (App.jsx)

Audio needs a first user gesture. State is a tri-state `audioStatus` ('idle' → 'pending' → 'ready'); `audioReady` is derived (`=== 'ready'`). `ensureAudioReady()` early-returns while `'pending'` so concurrent taps don't spawn a second `Tone.start()`/sampler build. The learn-view banner renders an explicit **Enable sound** primary button (disabled + spinner while pending); it also still initializes on first chord/string tap. Two transient cues use the shared `components/Toast` (purely visual, `aria-hidden`): a "Sound enabled" success toast on ready, and a "board cleared" toast on instrument switch. Both are paired with `sr-only` `aria-live` regions in App.jsx for assistive-tech parity — the toasts themselves must stay `aria-hidden` to avoid double announcements. Toast auto-dismiss timers live in effects keyed on the toast state (timeout-only setState) — don't call setState synchronously in those effects (the `react-hooks` lint rule flags cascading renders).

## Chord Challenge reward config (`public/challenge-config.json`)

The ≥90% reward code lives in `challenge-config.json` (fetched at runtime, relative to the document — resolves under the `/guitar-app/` base). The **committed** copy has `chordChallengeCode: ""` (empty); the real code is injected at deploy time. Because the code is empty locally, `hasCodeReward` (`!!challengeConfig?.chordChallengeCode`) is false, so the reward teaser/locked-hint/unlock-code UI in `ChordChallenge.jsx` will **not** render in dev/preview unless you temporarily set a non-empty code in the served copy (edit the gitignored `dist/challenge-config.json`, not `public/`, to avoid committing a code).

## `useCallback` dependency arrays are evaluated during render (TDZ gotcha)

In `ChordChallenge.jsx` the callbacks form a chain where later ones are referenced by earlier ones (e.g. `advanceRound` is defined after `handleTimeout`/`handleSkip`). It is safe to *call* a later-declared `const` from inside a `useCallback` body (closure, runs later), but listing it in the dependency array throws `ReferenceError: Cannot access '<x>' before initialization` at render because the array is evaluated immediately. Follow the existing pattern: omit the forward reference from the deps and add `// eslint-disable-line react-hooks/exhaustive-deps` (as `handleTimeout` and `handleSkip` do).
