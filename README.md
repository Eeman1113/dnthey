# dnthey

A solo Dungeons & Dragons campaign that runs itself. An AI Dungeon Master invents
the world, calls for the rolls and runs the monsters, and a party of AI players
make their own choices alongside you.

Everything thinks on your own machine: the model is Chrome's built in Gemini Nano
via the Prompt API, so there is no API key, no account and no server, and the game
keeps working offline.

## Status

Milestone 1 is built and playable:

- Rules engine for the 2024 ruleset, 78 tests, every mechanic hand verified
- Full character creation in the 2024 order: class, origin, abilities, details
- Live character sheet that recomputes as you choose
- Light, dark and system themes, all colour pairs measured at 4.5:1 or better

Combat, the agent layer and persistence are milestones 3 to 5. See BUILD_PROMPT.md
for the full specification.

## Requirements

Chrome 148 or newer on hardware that can run the built in model: 22 GB free
storage, more than 4 GB of VRAM, 16 GB RAM. The character builder and the
compendium work without it; only the Dungeon Master needs the model.

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # engine and data tests
npx tsc --noEmit     # types
```

## Building the static site

```bash
NEXT_PUBLIC_BASE_PATH=/dnthey npx next build   # output in out/
```

Deployment to GitHub Pages happens automatically on push to main, gated behind
the type check and the test suite.

## Art

Generated assets live in `public/assets`, catalogued in `assets/manifest.json`
with the prompt and style notes for each, so the library is reproducible.
`scripts/` holds the slicing and format conversion tools.

## Licence

This product includes material from the System Reference Document 5.2.1 by
Wizards of the Coast LLC, available under the Creative Commons Attribution 4.0
International License. Not affiliated with, endorsed, sponsored, or specifically
approved by Wizards of the Coast LLC.
