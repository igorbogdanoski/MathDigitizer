# Deploy Troubleshooting — math.mismath.net via GitHub Actions → Hostinger FTP

_Last updated: 2026-07-13_

## How production actually deploys

`math.mismath.net` is **not** served by the Vercel project connected to this repo. Vercel only
runs PR preview builds/comments (`Vercel`, `Vercel Preview Comments` checks) — it has no bearing
on the live site. The real deploy path is `.github/workflows/deploy.yml` ("Build & Deploy to
cPanel"), triggered on every push to `main`:

1. `npm install` + `npm run build` (needs `VITE_GEMINI_API_KEY` and `VITE_ADMIN_EMAIL` as GitHub
   Actions **repository secrets** — these are separate from any Vercel env vars and separate from
   `.env.local`, which never leaves your machine).
2. `lftp` uploads `dist/` to Hostinger over plain FTP (port 21, host `141.136.43.2`), using the
   `FTP_USERNAME` / `FTP_PASSWORD` / `FTP_SERVER` / `FTP_SERVER_DIR` secrets.
3. A verification step polls `https://math.mismath.net/` for up to ~60s checking that the
   just-built JS bundle hash is live.

## Confirmed-fixed bugs (real, now resolved)

These were genuine bugs in `deploy.yml`, found and fixed on 2026-07-13:

1. **`VITE_ADMIN_EMAIL` was never passed to the build.** The admin-override logic in
   `src/lib/saas.ts` (`hasProAccess`) existed since 2026-05-16, but the build step only ever
   forwarded `VITE_GEMINI_API_KEY` — so production never saw the admin email regardless of what
   was set anywhere else (including Vercel, which doesn't matter here anyway). Fixed by adding
   `VITE_ADMIN_EMAIL: ${{ secrets.VITE_ADMIN_EMAIL }}` to the Build step's `env:`.
2. **Wrong `FTP_SERVER_DIR`.** The `u731170910` FTP account's session lands directly in the
   site's document root on login — it does **not** need (and cannot) `cd` into `public_html` or
   `public_html/math`. Any non-empty `FTP_SERVER_DIR` caused `cd: Access failed: 550 ... No such
   file or directory`. Fixed by making the `cd` conditional on `FTP_DIR` being non-empty, and the
   secret should be left as `.` (GitHub won't accept a truly empty secret value).
3. **`bash -e` killed the step on harmless `mkdir`/`rm` "failures".** GitHub Actions runs `run:`
   blocks with `bash -e`. Even without `set cmd:fail-exit yes`, `lftp` returns a non-zero process
   exit code whenever *any* queued command failed during the session (e.g. `mkdir` on a directory
   that already exists from a prior deploy) — `bash -e` then aborted the whole step immediately,
   before any `put` ever ran. Fixed by splitting the lftp work into two separate invocations:
   phase 1 (rm/mkdir, best-effort, suffixed with `|| true`) and phase 2 (the actual `put`s, with
   `set cmd:fail-exit yes` and no `|| true`, so a real upload/login failure still aborts loudly).

## Root cause found (2026-07-13): `FTP_SERVER_DIR` pointed at the wrong location

The "FTP write confirmed, HTTP still stale" mystery below turned out to have a mundane cause:
the FTP account's login-landing directory (`FTP_SERVER_DIR = "."`) is **not** the document root
Hostinger actually serves for `math.mismath.net`. Confirmed by directly listing the FTP tree:

- FTP login root (`/`) contains a built `dist/`-style output directly, **plus** a `domains/`
  subfolder.
- `domains/mismath.net/public_html/` is a WordPress install (`wp-content`, `wp-login.php`, ...)
  with a `math/` subfolder and a `moodle/` subfolder alongside it — this account hosts multiple
  sites/subdomains under one FTP login, each in its own `domains/<domain>/public_html[/<sub>]`
  folder.
- `domains/mismath.net/public_html/math/` is the actual docroot for the `math.mismath.net`
  subdomain. Verified by comparing `index.html`'s `Last-Modified`/`Content-Length` in that folder
  against the live `https://math.mismath.net/` response headers — **exact match** (both showed
  `Last-Modified: ... 03:29:59 GMT`, `Content-Length: 8201`), while the FTP-root `index.html` was
  a different, newer file (different deploy, different size) that was never actually being served.

The earlier attempt to fix this (see bug #2 above) tried `FTP_SERVER_DIR = public_html` or
`public_html/math`, which don't exist directly under the FTP login root (hence the `550 No such
file or directory`) — the missing piece was the `domains/mismath.net/` prefix.

**Fix:** set the `FTP_SERVER_DIR` GitHub Actions secret to:

```text
domains/mismath.net/public_html/math
```

(relative to the FTP login root, no leading slash). This makes `deploy.yml`'s `CD_CMD` actually
`cd` into the real docroot before uploading, instead of writing to the unused FTP-root location.

## Reliable fallback if this regresses

Manual deploy works immediately:
1. `npm run build` locally (make sure `.env.local` has the needed `VITE_*` vars).
2. Upload the contents of `dist/` (not the `.vite/` subfolder — that's build metadata only) via
   Hostinger's web File Manager or an FTP client, into
   `domains/mismath.net/public_html/math/` (relative to the FTP account root).
3. Verify: `curl -sI https://math.mismath.net/` and check the `last-modified` header updates.
