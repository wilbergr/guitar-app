# Guitar App

An interactive guitar learning app: explore chords on an SVG fretboard, hear them with Tone.js plucked-string synthesis, and test yourself with chord challenges.

**Live**: https://guitar.gwilber.com

## Features

- **Three instruments** — guitar (6-string), bass (4-string), ukulele (4-string)
- **Interactive fretboard** — 12 frets, clickable/keyboard-accessible fret cells, chord fingering dots and barres, Edit/Play modes
- **Chord library** — 42 chords (major/minor guitar chords, bass power chords, ukulele chords) with traditional chord box diagrams
- **Chord Challenge** — diagram recognition and fretboard placement quizzes, in practice or timed mode
- **Sound** — per-string Tone.js `PluckSynth`
- **Accessible** — WCAG AA light/dark themes, keyboard navigation, colorblind-safe cues, reduced-motion support

## Development

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

```bash
npm run build      # production build to dist/
npm run preview    # preview the production build
npm run lint       # eslint
```

## Deployment

This repo deploys automatically to **guitar.gwilber.com** via Cloudflare Pages Git integration — every push to `main` triggers a build.

- Build command: `npm run build`
- Output directory: `dist`

No manual deploy step is needed.

## Architecture notes

See [CLAUDE.md](./CLAUDE.md) / [AGENTS.md](./AGENTS.md) for component structure, data layer, design-token system, and accessibility conventions.
