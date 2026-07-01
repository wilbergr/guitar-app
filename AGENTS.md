# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Play-mode fret resolution (App.jsx)

When resolving which fret to sound for a single string, an **absent** marker/chord entry means the **open string (fret 0)**, while `-1` means an **explicitly muted** string (stays silent). This convention is shared across `handlePlayString` (Play-mode pluck), `handleStrumPressedFrets` (`pressedFrets.get(si) ?? 0`), and `handleStrumChord`. Never treat `undefined` as "silent" — only `-1` mutes. The Strum button in the learn-view center panel is always visible (no chord + no markers strums the open strings).
