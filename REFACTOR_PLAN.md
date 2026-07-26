# tcb-rpc refactor plan

A targeted refactor of the existing site. Goal: keep what works (markdown files + front matter, XML-RPC for MarsEdit, REST for the web/automation, static output), and fix the parts that are fragile, slow, or hard to maintain.

Ordered as a sequence of small PRs that each leave the site working. Nothing here is a rewrite; every step can be paused after and shipped independently.

---

## PR 1 — Housekeeping, no behavior change

Prepares the ground so later PRs can move without breaking anything.

**Changes**
- Move the 800-line mobile posting page out of `index.js` into `views/post.html` (a plain HTML file, no template engine needed). Add a small `renderPost(req)` helper that loads it once at startup.
- Split `index.js` into:
  - `server.js` — process bootstrap (env, servers, start)
  - `routes/api.js` — REST endpoints
  - `routes/xmlrpc.js` — the xmlrpc registrations (still using the `xmlrpc` package on port 9090 for now)
  - `lib/build.js` — the `buildSite()` helper
- Add a couple of Jest tests around `post.js` (`save`, `loadById`, slug generation) and `posts_meta_builder.js` (front-matter parsing) so the rest of the refactor has a safety net.
- Delete unused artifacts: `img-old/`, `posts-old/`, `posts_backup_1746916063048/`, `post_conversion_map.json`, `post_migration_script.js`, `marsEditTemplate.html` if it's dead. (Verify each before deleting.)

**Files touched:** `index.js`, new `views/post.html`, new `server.js`, new `routes/*`, new `lib/*`, new `__tests__/*`.

**Verification:** `npm start` still builds and serves. `npm test` passes. MarsEdit still works locally.

---

## PR 2 — Skip the image copy, add incremental build

Right now every save deletes `build/` and re-copies all 76MB of images. That gets worse forever.

**Changes**
- Serve `img/` directly from Express instead of copying it into `build/img/`. All existing `/img/*` URLs keep working.
- Rewrite `website.js`'s `orchestrate()` into two modes:
  - `fullBuild()` — what it does today, kept as a fallback and for CLI use.
  - `incrementalUpdate(postId, op)` — only rewrites the affected permalink + the collection pages that contain it (page 0 of the type, page 0 of `all`, and the archive if it's a titled non-short post) + regenerates feeds. No `img/` copy.
- On post save/delete/edit, call `incrementalUpdate`. On startup, call `fullBuild`.
- Split feed generation similarly — cheap to re-run for one post's changes.

**Files touched:** `website.js`, `rssGenerator.js`, `server.js`, and the call sites in `routes/api.js` + `routes/xmlrpc.js`.

**Verification:** A photo post that used to trigger a ~2-3s rebuild should complete in well under 500ms. Diff `build/` output against a full rebuild to confirm nothing drifts.

---

## PR 3 — Consolidate onto one process/port

Two ports and HAProxy path-routing exists mostly because the `xmlrpc` package spins up its own HTTP server. That's a solvable constraint.

**Changes**
- Replace the `xmlrpc` package's server with a manual XML-RPC endpoint mounted on Express: `POST /xmlrpc` that parses the request body, dispatches to the existing handler functions, and serializes the response. Keep using the `xmlrpc` package's `serializeMethodResponse`/`deserializeMethodCall` helpers (that part is fine).
- Remove the second `xmlrpcServer.on(...)` registration; register handlers in a plain lookup table instead.
- Keep the `metaWeblog.*` and `blogger.*` method names identical so MarsEdit doesn't notice.
- Drop `RPC_PORT` from `.env`; everything is on `WEB_PORT`.

**Files touched:** `routes/xmlrpc.js`, `server.js`, `package.json` (may be able to drop `xmlrpc` and hand-write ~40 lines instead — decide during implementation).

**Verification:** MarsEdit configured against `https://thomascbullock.com/xmlrpc` on port 443 continues to work. All XML-RPC methods return byte-identical responses to before (there's a small test suite for this).

---

## PR 4 — Auth revamp

The current model is fine for "nobody is targeting me" but breaks trivially under credential stuffing. Upgrade to something appropriate for a personal site with public API surface.

**Changes**
- **Password storage:** move from plaintext `BLOG_PW` to `BLOG_PW_HASH` (argon2id). Add a one-shot script `scripts/hash-password.js` for generating the hash.
- **Session cookies for the web UI:** use `cookie-session` or `iron-session` with a signed key (`SESSION_SECRET` in `.env`).
- **Login page:** `GET /login` renders a form, `POST /login` validates against the hash, sets the session cookie, redirects to `/post`. Session lifetime: 30 days, sliding.
- **CSRF:** double-submit cookie token on every POST/PUT/DELETE from the web UI.
- **Rate limiting:** `express-rate-limit` on `/login` (5/min per IP) and on all `/api/*` (60/min per IP).
- **XML-RPC:** stays on HTTP Basic (MarsEdit's constraint), but:
  - Move the endpoint to a hard-to-guess path from `.env`: e.g. `/xmlrpc-<random>`. Not real security but shrinks the attack surface for opportunistic scanners.
  - Compare the presented password against the argon2 hash (same code path as web login).
  - Rate limit the XML-RPC endpoint too.
- **CORS:** replace `cors()` (open to the world) with an allow-list. For most cases, no CORS is needed at all — remove it.

**Migration:** print a one-line instruction on first startup if `BLOG_PW` is set but `BLOG_PW_HASH` isn't ("run `node scripts/hash-password.js` to migrate"), then error out. No silent fallback.

**Files touched:** new `lib/auth.js` (replaces `auth.js` and `authMiddleware.js`), `routes/api.js`, `routes/xmlrpc.js`, `server.js`, `package.json` (+argon2, +cookie-session, +express-rate-limit, -express-basic-auth for the REST side).

**Verification:** curl a wrong password 6 times → 429. MarsEdit still works. Web posting page still works after login.

---

## PR 5 — Footnotes with the HTML `popover` attribute

**Approach**
- Add `markdown-it-footnote` to render standard `[^1]` markdown footnotes to `<sup><a>` refs + a `<section class="footnotes">` at the bottom.
- Post-process the rendered HTML in `posts_meta_builder.js` (or a `lib/renderMarkdown.js` module) to:
  - Give each `<sup><a>` a `popovertarget="fn-<id>"` and add `role="button"`.
  - Wrap each footnote body in `<div id="fn-<id>" popover>...</div>`.
- Add CSS for `[popover]`: centered box, `::backdrop` dim, close-on-click-outside is built in.
- Fallback: the anchors still have `href="#fn-<id>"` so old browsers jump-scroll like normal footnotes.

**Files touched:** `posts_meta_builder.js` (or new `lib/renderMarkdown.js`), `website.js`, `style.css`, `package.json`.

**Verification:** Write a test post with a footnote. Confirm popover behavior in Safari/Chrome/Firefox; confirm fallback in an old browser via devtools.

---

## PR 6 — CSS/layout cleanup

Layout stays visually similar. Fixes the small-screen font collapse and the fixed 800px width.

**Changes**
- Replace `width: 800px` + three media queries with `max-width: min(75ch, 100% - 2rem); margin-inline: auto;`.
- Replace stepped `font-size: 0.75em` / `0.5em` reductions with `font-size: clamp(1rem, 0.95rem + 0.3vw, 1.15rem)`.
- Nav: `display: flex; flex-wrap: wrap; gap: 0.5rem;` so pills wrap instead of shrinking below tap-target size.
- Header logo: `width: clamp(60px, 10vw, 120px)` (matches current behavior but doesn't shrink to absurd sizes).
- Add `srcset` to photo posts: at upload time, Sharp already resizes to `maxWidth`. Also generate a `-800.jpg` and `-1600.jpg` variant, emit `<img srcset="… 800w, … 1600w" sizes="(max-width: 800px) 100vw, 800px">`.
- Add `prefers-color-scheme: dark` support (optional; low effort).
- Remove the never-used post-type-indicator classes.

**Files touched:** `style.css`, `mediaObject.js` (multi-size output), `page_template_new.js` (srcset emission), possibly `posts_meta_builder.js` (rewrite `<img>` tags in rendered markdown to include srcset for existing images — or leave existing posts single-src, only new uploads get srcset).

**Verification:** Test on iPhone, iPad, desktop widths. Compare Lighthouse before/after.

---

## PR 7 — Deployment: Caddy + hardened systemd

**Changes**
- Add a `Caddyfile` to the repo (documented, checked in):
  ```
  thomascbullock.com {
      reverse_proxy 127.0.0.1:3000
      encode gzip zstd
      header /img/* Cache-Control "public, max-age=31536000, immutable"
      header /css/* Cache-Control "public, max-age=86400"
  }
  ```
  Caddy issues + renews Let's Encrypt certs automatically.
- Add a `deploy/tcb-rpc.service` systemd unit with hardening:
  - `DynamicUser=yes` (or a dedicated user)
  - `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`, `NoNewPrivileges=yes`
  - `ReadWritePaths=/var/lib/tcb-rpc` (posts + img live here, not in the git repo on the server)
  - `Restart=on-failure`, `RestartSec=5s`
- Move `posts/` and `img/` out of the git checkout on the server, into `/var/lib/tcb-rpc/`. The Node process reads/writes there; a nightly cron `git push`es a mirror repo for backup (removes the in-request `git push` risk).
- Write a short `DEPLOY.md` covering the migration from HAProxy to Caddy.

**Files touched:** new `Caddyfile`, new `deploy/tcb-rpc.service`, new `DEPLOY.md`, `post.js` (remove in-request `gitAutoCommit`, replace with an fs-write only; move git commit to a cron script).

**Verification:** Stand up Caddy alongside HAProxy on a different port first. Confirm cert issuance. Cut over DNS/HAProxy binding when ready. Old HAProxy config removed only after a week of clean operation.

---

## PR 8 — Background work hardening (small, optional)

**Changes**
- Replace fire-and-forget `(async () => { ... })()` in the upload handlers with a bounded in-memory queue (`p-queue`, concurrency 1). Ensures `buildSite()` runs after a rapid burst of posts don't race.
- Log Mastodon cross-post failures somewhere findable (`/var/log/tcb-rpc/mastodon.log`).
- Move git-commit-on-write to a periodic script instead of a per-request shell-out.

**Files touched:** `routes/api.js`, `post.js`, new `lib/queue.js`, new `scripts/backup-posts.sh`.

---

## Order and estimated size

| PR | Risk | Rough size |
|----|------|-----------|
| 1  | very low | medium (mechanical) |
| 2  | low | medium |
| 3  | medium (touches MarsEdit protocol) | medium |
| 4  | medium (auth changes always are) | large |
| 5  | low | small |
| 6  | low | small-medium |
| 7  | medium (deployment) | medium |
| 8  | low | small |

Suggest tackling 1 + 2 first as one session (both are risk-free wins), then 5 (fun and self-contained) or 4 (biggest security win) depending on what you want.

## Explicitly not doing

- Not switching languages/frameworks. Node/Express is fine.
- Not introducing TypeScript. Not worth the churn for this size of codebase.
- Not adding a database. Files-on-disk is the right choice.
- Not changing URL structure. All existing permalinks stay identical.
- Not touching the post file format. Existing markdown + JSON front matter continues to work.
