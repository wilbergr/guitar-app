# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Play-mode fret resolution (App.jsx)

When resolving which fret to sound for a single string, an **absent** marker/chord entry means the **open string (fret 0)**, while `-1` means an **explicitly muted** string (stays silent). This convention is shared across `handlePlayString` (Play-mode pluck), `handleStrumPressedFrets` (`pressedFrets.get(si) ?? 0`), and `handleStrumChord`. Never treat `undefined` as "silent" — only `-1` mutes. The Strum button in the learn-view center panel is always visible (no chord + no markers strums the open strings).

## Audio gating & transient UI (App.jsx)

Audio needs a first user gesture. State is a tri-state `audioStatus` ('idle' → 'pending' → 'ready'); `audioReady` is derived (`=== 'ready'`). `ensureAudioReady()` early-returns while `'pending'` so concurrent taps don't spawn a second `Tone.start()`/sampler build. The learn-view banner renders an explicit **Enable sound** primary button (disabled + spinner while pending); it also still initializes on first chord/string tap. Two transient cues use the shared `components/Toast` (purely visual, `aria-hidden`): a "Sound enabled" success toast on ready, and a "board cleared" toast on instrument switch. Both are paired with `sr-only` `aria-live` regions in App.jsx for assistive-tech parity — the toasts themselves must stay `aria-hidden` to avoid double announcements. Toast auto-dismiss timers live in effects keyed on the toast state (timeout-only setState) — don't call setState synchronously in those effects (the `react-hooks` lint rule flags cascading renders).
