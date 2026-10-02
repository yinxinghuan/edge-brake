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

`.github/workflows/deploy.yml` still publishes `dist/` from `master`. The host build runs first and stays at the site root. The workflow then runs `npm run build:guest` and copies that folder to `dist/crazygames/` before the Pages upload. Host `dist/index.html` is not replaced.

After this branch merges to `master`, the guest is expected at:

https://yinxinghuan.github.io/edge-brake/crazygames/

Relative asset URLs (`base: './'`) resolve under that path. The URL is live only after the Pages workflow finishes on `master`.

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

- 16:9 desktop frame (1280×720) scaled to the iframe. The ice is the full frame. The guest scene widens the rink and looks across it from the side, so the runway runs left to right and the sheet covers the playfield. Camp, contracts, and the workshop are overlays on the ice, not columns that shrink it. Contracts sit bottom-left and the workshop bottom-right between rounds. They hide while a slide is in motion and while the crew list is open.
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
