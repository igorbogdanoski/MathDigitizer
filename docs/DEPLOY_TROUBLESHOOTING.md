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

## Open mystery — NOT resolved, needs Hostinger support

After fixing all three bugs above, a deploy run completed successfully end-to-end: `lftp`
reported success, and an `ls -la index.html` executed **inside that same authenticated FTP
session, immediately after the upload**, showed a fresh timestamp and the correct file size.

However:
- The live site at `https://math.mismath.net/` (checked with cache-busting query params, against
  both resolved origin IPs individually, over a 10-minute polling window) kept serving the old
  content the whole time.
- Hostinger's own web File Manager (`srv495-files.hstgr.io`), even after a hard refresh, showed
  `index.html`'s "Last modified" as ~2 hours old — not matching the fresh FTP-session timestamp.

This is a genuine contradiction between what the FTP protocol confirms was written and what both
HTTP and the web File Manager show. The most likely explanation is that the FTP account's
apparent document root and the domain's actually-served document root are two different
locations on Hostinger's backend (the account's home directory listing does contain a
`public_html -> /home/u731170910/domains/mismath.net/public_html` symlink, suggesting a possibly
more complex multi-domain layout than a single flat docroot) — but this can't be diagnosed further
from outside; it needs someone with backend visibility into the account's actual filesystem/DNS/
proxy configuration.

**Evidence to hand to Hostinger support:**
- FTP `ls -la index.html` inside the upload session → fresh timestamp, correct size, right after upload.
- `curl` against both origin IPs (`92.113.16.8`, `92.113.23.251`) with cache-busting, 10 minutes
  after the confirmed-successful upload → still serving old content.
- Question for them: does the `u731170910` FTP account's session root definitively map 1:1 to the
  document root actually served for `math.mismath.net`, or is there a separate sync/cache/staging
  layer in between?

## Reliable fallback until the mystery is resolved

Manual deploy works immediately and has been used successfully:
1. `npm run build` locally (make sure `.env.local` has the needed `VITE_*` vars).
2. Upload the contents of `dist/` (not the `.vite/` subfolder — that's build metadata only) via
   Hostinger's web File Manager or an FTP client, replacing the existing files in
   `public_html/math`.
3. Verify: `curl -sI https://math.mismath.net/` and check the `last-modified` header updates.
