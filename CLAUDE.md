# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris. No dependencies, no build step, no package.json. Three files: `index.html` (DOM/canvas structure), `style.css` (dark/retro theme), `game.js` (~300 lines, all game logic).

## Running

No build/install step. Open directly or serve statically:

```bash
open index.html          # or just open in a browser
python3 -m http.server 8000   # then visit http://localhost:8000
```

There is no test suite, linter, or bundler configured — verify changes by playing the game in a browser.

## Architecture (`game.js`)

Single-file, global-state game loop — no modules, no classes.

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying the piece that occupies it.
- **Pieces**: the 7 tetrominoes are hardcoded square matrices in `PIECES`. Rotation (`rotateCW`) is a transpose + row reversal, not a lookup table of rotation states.
- **Collision** (`collide`): checks board bounds and overlap with locked cells; used for movement, rotation, and drop checks alike.
- **Wall kicks** (`tryRotate`): on rotation collision, retries at x offsets `[0, -1, 1, -2, 2]` before giving up on the rotation.
- **Game loop** (`loop`): driven by `requestAnimationFrame`, accumulates elapsed time in `dropAccum` and advances the piece one row once `dropInterval` is exceeded.
- **Line clearing** (`clearLines`): scans bottom-up, splices full rows and unshifts empty ones at the top; re-checks the same row index after a splice.
- **Scoring/leveling**: `LINE_SCORES` table (`[0,100,300,500,800]`) multiplied by `level`; hard drop = 2 pts/row, soft drop = 1 pt/row. Level increases every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Ghost piece** (`ghostY`): projects the current piece straight down until collision, drawn via `drawBlock(..., alpha=0.2)`.
- All game state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, timing vars) lives in module-level `let` bindings reset by `init()` — there is no encapsulation, so new features typically mean adding another global and wiring it into `init`, `loop`, `draw`, and the `keydown` handler.

## Tunable constants

`COLS`, `ROWS`, `BLOCK` (px per cell), `COLORS`, `LINE_SCORES`, `dropInterval` are all defined at the top of `game.js`. If `COLS`/`ROWS`/`BLOCK` change, the `<canvas id="board">` width/height in `index.html` must be updated to match (`COLS×BLOCK` × `ROWS×BLOCK`).
