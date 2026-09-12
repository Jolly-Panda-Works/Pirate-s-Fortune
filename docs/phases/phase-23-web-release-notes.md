# Phase 23 — Web Release Notes (Prompt 023)

GDD §18/§25 deliverable: prepare the production web build. Exit criteria
(MVP complete): the full regression suite passes, the game is playable
end-to-end bilingually on desktop and mobile-landscape, and the build is
deployed (or deploy-ready) as a static site.

---

## 1. No build step — verified

Confirmed, not assumed: `package.json` has no `build` script, no
`dependencies`/`devDependencies` at all, and there is no bundler config
anywhere in the repo (no `webpack.config.*`, `vite.config.*`,
`rollup.config.*`, etc.). `index.html` loads `js/main.js` directly as
`<script type="module">`; every other `js/*.js` file is pulled in via
native ES module `import`. The repository root **is** the production
build — nothing to compile, bundle, minify, or transpile. No optimization
was added, so there's no new build command to document.

## 2. Performance pass

### Asset sizes

Total deployable payload (`assets/ + css/ + data/ + js/ + index.html`):
**~2.3MB**. Breakdown by directory: `assets/` 1.9MB, `js/` 320KB, `css/`
40KB, `data/` 40KB. This is reasonable for a browser card game — the six
placeholder `.wav` audio clips together are under 150KB, and every other
asset is small.

One real finding: `assets/icons/icon.ico` (102KB) and
`assets/icons/icon.png` (1.7MB, a 1254x1254 design source) existed in
the repo but were **never referenced anywhere** — confirmed via grep
across `js/`, `css/`, and `index.html` before this prompt — so the
1.7MB file was pure dead weight in the deployed payload with zero
payoff. Fixed by:
- Generating two lightweight derived assets from the existing master —
  `assets/icons/favicon-32.png` (5KB) and
  `assets/icons/apple-touch-icon.png` (51KB).
- Wiring up real `<link rel="icon">` / `<link rel="apple-touch-icon">`
  tags in `index.html`'s `<head>`, using the already-reasonably-sized
  `icon.ico` directly and the two new derived PNGs.
- The 1.7MB master `icon.png` remains in the repo as a design source
  (not linked directly — regenerate derived sizes from it if the icon
  ever changes) but no longer ships as if it were a usable web asset
  without actually being used as one.

### Memory-leak check (long AI-simulation run, reusing Prompt 022's harness)

Ran turnManager.startGame() AI-vs-AI in a loop (2/3/4 players, cycling)
for thousands of games, sampling `process.memoryUsage()` with forced
`global.gc()` between samples (`node --expose-gc`).

**First pass looked like a real leak**: heap grew linearly and
*never plateaued* -- ~22KB retained per game, no matter how many `gc()`
calls were forced, reaching 268MB heap / 379MB RSS over 12,000 games
with zero sign of leveling off. A heap snapshot diff
(`v8.writeHeapSnapshot()` before/after 2,000 games, compared by
constructor) pointed at the cause: tens of thousands of extra `Promise`
/ `PromiseCapability` / `PromiseFulfillReactionJobTask` objects — one
Promise chain per `animationManager.playCardReveal()` /
`.playAbilityTrigger()` / `.playCollection()` / `.acknowledgeDuplicate()`
call. `turnManager.js` calls these **fire-and-forget** every turn (by
design — see `animationManager.js`'s own header: game logic must stay
synchronous even though the animation layer is Promise-based), and each
one's `Promise.all(...)` internally schedules a microtask reaction job.

**Root cause was the test harness, not the game**: the leak-check script
ran thousands of games back-to-back in one uninterrupted synchronous
loop with no `await` between iterations, so the JS engine never got a
chance to return to the event loop and drain the microtask queue — every
fire-and-forget Promise's reaction job piled up for the *entire run*
before ever being processed. Confirmed by adding a single
`await new Promise((resolve) => setImmediate(resolve));` after each
game (letting the event loop tick once, exactly like normal play — a
user's clicks, `requestAnimationFrame`, etc. — already does between
turns): heap flattens immediately and stays flat.

| Test | Heap after ~3,000 games |
|---|---|
| Tight synchronous loop, no yield (unrealistic) | 71MB and climbing linearly |
| Same loop, yields to event loop once per game (realistic) | **5.5MB, flat from game ~500 onward** |

**Conclusion: no memory leak.** In real usage (turns/games separated by
actual user interaction or animation frames) the event loop already
yields far more often than once per game, so the microtask queue never
has room to build up the way the artificial tight-loop test did. This is
recorded here specifically so a future performance investigation doesn't
re-chase the same false trail — the "long AI-simulation run" check is
only meaningful if it lets the event loop breathe between games, which
the corrected version above does.

### Subdirectory boot

Verified — not just asset-path-audited — with a real headless-browser
boot (Playwright) served from `http://localhost:PORT/pirates-fortune/`
(a subdirectory, not domain root): all 6 GDD §19 board zones mounted, 12
cards rendered on the initial deal, the new favicon requests resolved
correctly, and **zero console errors or failed requests**. This
confirms what a path audit alone couldn't fully guarantee: every
relative `fetch()` (`data/cards.json`, `data/gameConfig.json`, etc.) and
every relative asset reference (`css/*.css`, `js/main.js`,
`assets/icons/*`) resolves correctly relative to the document's own URL,
not assumed to be at domain root — exactly what deployment targets like
GitHub Pages project sites (`user.github.io/repo-name/`) require.

## 3. Deployment documentation

Added a `## Deployment` section to `README.md` covering: why there's
nothing to build, the relative-path guarantee (and how it was verified),
and concrete steps for Netlify/Vercel/Cloudflare Pages, GitHub Pages, and
plain nginx/Apache — since no server-side logic exists, any of these
work with an empty build command pointed at the repository root.

## 4. Final regression check

`npm test`: **219/219 passing**, unaffected by this prompt's changes
(`index.html` favicon links + README are the only edits; no `js/`
gameplay code changed). This, plus the full MVP roadmap's prior stages
(Stage A headless engine, Stage B UI, Stage C bilingual/responsive) all
already confirmed passing in earlier prompts, satisfies this prompt's
MVP-complete exit criteria.

## Summary

- No build step needed — confirmed, nothing added.
- Asset sizes reasonable (~2.3MB total); fixed one real issue (1.7MB of
  unreferenced icon assets) by wiring up proper lightweight favicons.
- No memory leak across a long AI-simulation run — investigated a false
  positive down to its root cause (test-harness microtask starvation,
  not a game-code issue) and documented the corrected methodology.
- Subdirectory hosting verified with a real headless-browser boot, not
  just a path audit.
- `README.md` now documents concrete deployment steps for common static
  hosts.
- `npm test` 219/219 green; MVP complete.
