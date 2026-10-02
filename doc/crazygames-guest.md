# Edge Brake — Crazy Games guest build

The AlterU / Aigram host build is unchanged. `npm run build` still writes `dist/` from `index.html` and `vite.config.ts`. The desktop guest is a separate Vite entry.

## Run locally

```bash
npm ci
npm run dev:guest
```

Open the dev server root. Guest mode redirects `/` to `index.guest.html`.

Production bundle:

```bash
npm run build:guest
npm run preview:guest
```

Output is `dist-guest/`. `index.html` is a copy of `index.guest.html` with relative asset URLs (`base: './'`), so the folder can be served from any subpath.

## GitHub Pages

`.github/workflows/deploy.yml` publishes the host `dist/` directory from `master`. This guest work does not change that workflow, so the AlterU site stays on the host build.

To publish the guest later without replacing the host site, copy `dist-guest/` into a `crazygames/` directory inside the Pages artifact (or deploy that folder on its own). Relative URLs already work under `/crazygames/`.

## Keyboard

| Input | Action |
| --- | --- |
| Hold Space or Enter | Charge. Release launches. |
| Hold the mouse or touch on the ice | Same as Space. |
| Space or Enter on a result | Next crew, or retry the level. |
| Space, Enter, or R on the incident report | New expedition. |
| R on a result | Same as the result button. |
| C | Open or close the expedition crew. Esc closes it. |
| M | Mute music and sound effects. |
| Esc | Skip the tutorial. |
| Space or Enter during the tutorial | Next tutorial card. |

Buttons, the crew list, and the workshop do not start a charge.

## What the guest adds

- 16:9 desktop frame (1280×720) scaled to the iframe. The ice view stays the authored 390×700 stage, letterboxed in the center, with contracts on the left and the workshop on the right.
- English UI. No leaderboard, champion entry, friend avatars, AlterU watermark, guest shell, or Chinese copy.
- Skippable three-card tutorial on the first launch. It can be reopened with How to play.
- Camp rank, three live contracts, and four workshop tracks (launch springs, ice studs, cliff sense, expedition fund). Gear is bought between rounds with coins. Camp rank gates the next rank of each track. Progress is stored in `localStorage` under `cg_edge_brake_*`.
- Looping music: Black Diamond by Joth, CC0. See `src/guest/audio/LICENSE.txt`. Playback starts after the first key or click. Mute pauses it.

## Host hash check

Build the host twice from a clean `dist/` and compare file hashes:

```bash
rm -rf dist && npm run build
find dist -type f -print0 | sort -z | xargs -0 sha256sum > /tmp/host-a.txt
rm -rf dist && npm run build
find dist -type f -print0 | sort -z | xargs -0 sha256sum > /tmp/host-b.txt
diff -q /tmp/host-a.txt /tmp/host-b.txt
```

Guest-only files are not on the host module graph. A matching diff means `dist/` is byte-identical.
