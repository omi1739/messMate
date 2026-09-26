# MessMate

Run a shared mess without the spreadsheet. MessMate tracks bazar spending, seat
rent, utility bills and daily meals, then works out exactly who owes what at the
end of every month.

The settlement is not a summary you have to trust — it is built from the records
you entered, and every figure on the printed report traces back to a specific
meal, bill or payment.

## Stack

- **Next.js 16** (App Router, JavaScript) with Tailwind v4
- **MongoDB** via Prisma 6
- **Auth.js v5** with two separate credentials providers
- **Zod** for validation, **bcryptjs** for password hashing

## Getting started

```bash
npm install
cp .env.example .env     # then fill in the values
npm run db:push          # create the indexes and collections
npm run dev
```

Open <http://localhost:3000>.

### Environment

| Variable               | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`         | MongoDB connection string                                   |
| `AUTH_SECRET`          | Session/JWT signing key — see `.env.example` for a one-liner that generates it |
| `AUTH_TRUST_HOST`      | Set to `true` when deploying behind a proxy                |
| `SUPER_ADMIN_EMAIL`    | The single platform administrator                          |
| `SUPER_ADMIN_PASSWORD` | Their password. Never stored in the database               |

The super-admin credentials are read from the environment on every sign-in, so
rotating the password takes effect immediately and leaves no copy in the data.

### Accessing the super-admin dashboard

The platform admin is a **separate sign-in page**, deliberately not reachable from
the normal login form:

1. Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in `.env`.
2. Restart the dev server — the values are read per request, not cached.
3. Go to **`/admin-login`** (not `/login`) and sign in with those credentials.

Notes:

- It is a different Auth.js provider from the owner login, so an owner's
  credentials are rejected there and a super-admin's credentials are rejected at
  `/login`. `npm run test:auth` asserts both directions.
- `isAdmin` is stamped onto the session by whichever provider handled the
  sign-in, so it cannot be escalated by editing a request or a cookie.
- If either variable is missing, `/admin-login` refuses the attempt and logs
  `[auth] SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD are not set` to the server
  console rather than failing open.
- A super-admin has no mess, so they land on `/admin` and are redirected away
  from every owner page. The admin UI also lives in its own shell without the
  owner navigation.
- In development the credentials also come from `.env` for `test:auth` and
  `test:routing`, so a single `.env` is enough to run everything.
  `shoot:demo` does **not** need them: it signs in with its own throwaway
  `@test.local` fixtures, which are wiped again afterwards.

> If you deploy this, put `/admin-login` behind an IP allowlist or a second
> factor. It is a single shared password in front of every account on the
> platform.

### What the admin panel shows

Four sections, all from live data:

- **Platform totals** — accounts, how many signed in this week, messes, members,
  and the share of each roster that is still active.
- **Traffic** — page views and distinct visitors per day, the most visited
  pages, where visits came from, and a coarse device split.
- **Accounts and growth** — signups per day, plus a health read on the two
  failure modes worth knowing about: accounts that signed up and never returned,
  and messes that were created but never used.
- **Messes** — record volume per mess, busiest first, so abandoned signups sink
  to the bottom.

Charts are hand-rolled SVG rendered on the server (`src/app/admin/charts.js`).
There is no charting dependency and nothing is shipped to the browser for them;
each one also emits a visually hidden data table so the numbers are available to
a screen reader.

### Traffic tracking, and what it does not collect

Counting happens in `src/proxy.js`, which in Next 16 runs in the Node runtime, so
it can write to MongoDB directly. There is **no tracking script, no cookie and
no third party** — the counters come from requests the server was already
handling, and the write happens after the response is sent.

Deliberately not stored: the IP address, the user agent, query strings, and full
referrer URLs.

- The IP and user agent are combined into a hash salted with a value that
  **changes every day**. The hash exists only to answer "have I already counted
  this person today?", and because the salt rotates, the same visitor cannot be
  recognised on another day.
- Those hashes are deleted after **35 days** (`npm run db:prune:visits`, and
  automatically every 15 minutes of recorded traffic).
- Visitors sending `Do Not Track: 1` are **not counted at all**.
- Crawlers and known bots are filtered out, as are `POST`s, prefetches, API
  calls and asset requests.
- Referrers are reduced to a bucket: `direct`, `internal`, a known source such as
  `google`, or a bare hostname. Long URLs are collapsed — `/join/65f1c0…` and
  `/join/65f2a9…` both become `/join/:id`.

Counters are aggregated into one row per day per dimension rather than one row
per request, so the collection stays small no matter how much traffic the site
gets. `visit_daily` keeps roughly a year; `visit_visitors` keeps 35 days.

The unique-visitor figure is only ever recorded against the `TOTAL` row. Summing
per-page uniques would count anyone who opened two screens twice, so the panel
does not do that.

Run `npm run db:seed:visits` to fill the panel with 30 days of sample traffic so
it can be reviewed before the site has any visitors. It **replaces** the counters,
so do not run it against traffic you care about; `npm run db:reset:visits` clears
them again.

## How a month is calculated

This is the part worth reading before trusting a number.

| Cost                    | Who is charged                                    |
| ----------------------- | ------------------------------------------------- |
| Bazar spending          | Everyone who ate, in proportion to meals, **including inactive members** |
| Seat rent               | That member only                                  |
| Utilities (water, power, gas, internet) | Split evenly across **active** members |
| Extra charges (cook salary, cleaning, …) | Split evenly across **active** members |
| Other expenses (non-bazar) | Split evenly across **active** members         |

- The meal rate is total `BAZAR` spending divided by total meals logged. Meals
  are held in halves, so `0.5` means someone ate one meal that day.
- Inactive and archived members still owe for meals they actually ate; they are
  simply not billed rent, utilities or extra charges.
- Each row is rounded independently, and a `roundingAdjustment` reconciles the
  rounded rows against the headline total so the columns always add up.
- `balance = totalBill − paid`, where `paid` is only what has actually been
  recorded as received. Outstanding and change are derived from that, never from
  the cost total.

`src/lib/settlement.js` is a pure function with no database access, which is
what makes it directly testable.

## Routes

**Public** — `/` landing page
**Auth** — `/signup`, `/login`, `/admin-login`
**Mess owner** — `/dashboard`, `/members`, `/meals`, `/expenses`, `/bills`, `/reports`, `/settings`
**Platform** — `/admin`

The two roles cannot reach each other. `src/proxy.js` redirects optimistically
so an admin never sees the tenant app, but the real boundary is in the data
layer: every query and mutation is scoped by the session's `messId`.

## Multi-tenancy

One signup creates one `User` and one owned `Mess`. Mess members are *records*,
not accounts — the people you cook for never need to sign up, and cannot see
anything.

Every read and write goes through `src/lib/dal.js` and the Server Actions in
`src/app/actions/`, which require a session and filter by `messId`. There is no
code path that reads a mess by an id taken from the request body without also
proving the session owns it.

## Scripts

| Command                | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Development server                                      |
| `npm run build`        | Production build                                        |
| `npm run lint`         | ESLint, including an unused-symbol check for plain JS   |
| `npm test`             | Unit tests (settlement engine) — no server or database needed |
| `npm run test:auth`    | Sign-in matrix over HTTP, all six cases                 |
| `npm run test:routing` | Who can reach which route, per role                     |
| `npm run test:isolation` | Two tenants, proving one cannot see the other          |
| `npm run test:integration` | Seeds the fixtures, then runs all three HTTP suites |
| `npm run db:push`      | Sync the Prisma schema to MongoDB                       |
| `npm run db:studio`    | Browse the data                                         |
| `npm run db:seed:e2e`  | Create the throwaway accounts the HTTP tests sign in as |
| `npm run db:seed:demo` | Fill the probe mess with a realistic month of data     |
| `npm run db:check`     | Report row counts per mess and fail on orphaned rows  |
| `npm run db:clean:e2e` | Remove those accounts and all of their mess data        |
| `npm run check:contrast` | WCAG audit of every theme token pairing, both themes  |
| `npm run check:dark`  | Render every route in both themes and audit real contrast |
| `npm run shoot:demo`   | Re-capture the marketing screenshots in `public/demo`   |
| `npm run check:shots`  | Verify those PNGs are real renders, not blank frames     |
| `npm run db:seed:visits` | Generate 30 days of sample traffic to review the panel |
| `npm run db:reset:visits` | Delete every traffic counter                         |
| `npm run db:prune:visits` | Delete expired visitor hashes and very old counters    |

The three `test:*` integration scripts need the dev server running. Each one
also assumes the `db:seed:e2e` fixtures exist, so prefer
`npm run test:integration`, which seeds first and then runs all three. The
fixtures are disposable: `npm run db:clean:e2e` returns the database to a state
holding only real accounts. `npm test` needs no server, database or fixtures.

No fixture data is committed. Every fake member, meal, expense and payment
exists only after you run a `db:seed:*` script, and the marketing pages contain
no invented sample records at all — the settlement method is described as
formulas rather than as a fabricated month.

### Screenshots

`public/demo/` holds real captures of the built pages, taken from the fixtures
while they existed. They are the only place sample figures appear as pixels.
`shoot:demo` drives your installed Chrome over the DevTools Protocol using
Node's built-in WebSocket, so it needs no Playwright or Puppeteer; it will pick
up Chrome or Edge automatically, or set `CHROME_PATH`. Regenerate them with:

```
npm run db:seed:e2e && npm run db:seed:demo   # fixtures must exist
npm run shoot:demo                             # needs the dev server on :3000
npm run db:clean:e2e                           # then put the database back
```

`check:shots` decodes the PNGs and fails if any frame is blank or rendered in
the wrong colour scheme, so a broken capture cannot quietly ship.

#### Light and dark

Light is the default, not the OS preference. Someone whose laptop is in dark mode
gets the light theme until they ask for the other one, so the first thing they
see is the theme the app was designed in. The toggle still offers **System** as
an explicit third stop, and a stored choice always wins over the default.

The choice is applied by a small script in `<head>` before first paint, so there
is no white flash for a dark-mode user on any navigation. `npm test` covers the
default so the script, the button and the server snapshot cannot drift apart.

`check:contrast` proves the *tokens* are well chosen. `check:dark` proves the
pages actually use them, which is the part that goes wrong in practice. It signs
in, visits all thirteen routes in both themes, and for every element with visible
text composites the colour through any translucent ancestors down to the first
opaque one before applying the WCAG formula. It also asserts things that no
contrast number would reveal:

- The stored preference really reached `<html>`, so a dark pass that silently
  rendered light fails instead of measuring the same page twice.
- `surface-muted` really is *recessed* and `surface-raised` really is *raised*,
  in both themes. These are the names components reach for, and a dark theme
  that inverts them makes every card look like a hole.
- A card's colour is distinguishable from the page behind it.
- Each dark capture is measurably darker than its light twin.
- No element carries a border colour with no border width, which Tailwind
  renders as nothing at all.

It also flags any element carrying a border *colour* with no border *width*,
which Tailwind renders as nothing at all.

Because the app now defaults to light, the audit writes the stored preference
itself before each load rather than relying on `prefers-color-scheme`, so it
exercises the same path a real visitor takes.

```
npm run db:seed:e2e && npm run db:seed:demo   # fixtures must exist
npm run check:dark                             # needs the dev server on :3000
npm run db:clean:e2e
```

> Dev-server CSS is cached aggressively by Turbopack. If you change a token and
> the page still shows the old colour, delete `.next` and restart the dev server
> before believing what you are looking at.

> On Windows, run these through `npm.cmd` / `npx.cmd` — the bare `npm` shim is
> blocked by the default execution policy.

### Test data

`db:seed:e2e` creates two throwaway messes: a populated one and an empty one
that exists purely to prove isolation. Both are addressed at `@test.local`, and
`db:clean:e2e` only ever deletes accounts on that domain, so it cannot remove a
real signup. Run it before sharing a database.

## Secrets

`.env` holds the real `DATABASE_URL`, `AUTH_SECRET` and super-admin credentials,
and is git-ignored along with every other common secret shape — keys,
certificates, keystores, `credentials.json`, cloud service-account files,
`.npmrc`/`.netrc`, and Terraform state. `.env.example` is the committed template
and carries placeholders only.

A credential that reaches git stays in the history after you delete it from the
working tree, so if you ever add a secret file by accident, rotating the
credential is the fix — removing the file is not enough. Check with:

```bash
git log --all -p -- .env          # was it ever committed?
git ls-files -i -c --exclude-standard   # is anything tracked that is now ignored?
```

## Notes for whoever deploys this

- **MongoDB does not enforce referential integrity.** Prisma's `onDelete`
  cascade is not honoured, so anything that removes a mess has to clear the
  child rows explicitly. `src/lib/cascade.js` is the single place that does it,
  and `npm run db:clean:e2e` uses the same helper. Do not add a second
  implementation.
- **Rotate the database credentials** if `.env` has ever been shared or
  committed.
- `npm audit` reports six high-severity advisories, all in the Prisma and
  bundler toolchain rather than application code. None is critical.
- Add a real error reporter before going live. `src/app/error.js` currently only
  logs to the console and shows the error digest.
- Unmatched URLs currently return HTTP 200 in Next 16 rather than 404. This is
  framework behaviour, not something the app does — worth confirming against the
  version you deploy.
