# react-csharp-record-manager

A small full-stack record manager: a React front end (Vite) over a C# .NET 8
Minimal API. Records are held in an in-memory list on the server — there is no
database, no data file and no external API. The list is seeded with hard-coded
starting data, and edits made through the UI persist for as long as the API
process is running.

Built under a deliberate constraint: **no packages beyond the two project
templates.** The client uses `fetch`, `useState` and `useMemo`; the server uses
only what ships in the ASP.NET Core shared framework (CORS included).

## Prerequisites

| Tool | Version |
|---|---|
| .NET SDK | 8.0 or later |
| Node.js | 18 or later (developed on 24) |

## Running it

Two terminals, from the repository root.

**Terminal 1 — API (http://localhost:5080)**

```bash
cd server
dotnet run
```

**Terminal 2 — client (http://localhost:5173)**

```bash
cd client
npm install
npm run dev
```

Then open http://localhost:5173.

The API port is fixed in `server/Properties/launchSettings.json`. If 5080 is
taken, change it there and update `API_BASE` at the top of `client/src/api.js`
to match. If the client port moves off 5173, add the new origin to the CORS
policy in `server/Program.cs`.

## API

Base URL: `http://localhost:5080`

| Method | Route | Behaviour |
|---|---|---|
| `GET` | `/api/records` | Returns all records |
| `GET` | `/api/records/{id}` | Returns one record, `404` if it does not exist |
| `PUT` | `/api/records/{id}` | Updates the editable fields and returns the updated record. `404` if missing, `400` if `name` is blank |

`PUT` accepts `{ name, category, status, description }`. The id comes from the
route, not the body, so a mismatched payload cannot re-key a record.

## Project layout

```
├── server/                       # .NET 8 Minimal API
│   ├── Program.cs                # endpoints, CORS policy, in-memory seed data
│   ├── Models/RecordItem.cs      # stored record
│   ├── Models/RecordUpdate.cs    # PUT payload
│   └── server.csproj
├── client/                       # Vite + React
│   └── src/
│       ├── App.jsx               # owns state, fetches, derives the counts
│       ├── api.js                # thin fetch wrapper
│       ├── lib/records.js        # pure helpers, unit-tested
│       └── components/
│           ├── RecordList.jsx    # scrollable three-column list, row select
│           ├── RecordDetail.jsx  # controlled inputs over a local draft
│           └── SummaryBar.jsx    # derived output
├── tests/                        # node:test suite, zero dependencies
│   ├── records.test.mjs          # immutability + derived counts
│   ├── api-client.test.mjs       # fetch wrapper, stubbed
│   └── api-contract.test.mjs     # live API, boots the server
└── VERIFICATION.md               # the verification pass, criterion by criterion
```

## Tests

The suite uses Node's built-in `node:test` runner. **No test framework and no
packages were installed** - it runs on a bare Node install.

```bash
npm test
```

| Script | Covers | Needs the API running? |
|---|---|---|
| `npm run test:unit` | Record helpers and the fetch wrapper | No |
| `npm run test:contract` | Every API endpoint, end to end | No - starts its own on 5081 |
| `npm test` | Everything | No |

You can run the suite with `dotnet run` and `npm run dev` still going.

`tests/records.test.mjs` pins the rules that are easy to break by accident:
`replaceRecord` returns a new array and leaves both the input array and every
untouched record referentially intact, `groupByStatus` matches the seed
distribution and follows an edit, and `canSave` refuses an unchanged draft, a
blank name, or a save already in flight.

`tests/api-client.test.mjs` stubs `fetch` to check the URL, method, headers and
body - including that `id` is left out of the payload - and that a non-2xx
response throws with the method, path and status.

`tests/api-contract.test.mjs` starts its own `dotnet run` in `server/` and
exercises every endpoint against the real API: camelCase keys, the seed
distribution, 404s, whitespace trimming, the blank-name 400, that a body `id`
cannot re-key a record, that an edit survives a re-read, and that the CORS header
names the Vite origin.

It runs on port **5081**, not the dev port, and refuses to reuse an API it did
not start. The assertions are against the seed data, and the store is in memory,
so a dev server you have been clicking around in would fail them for the wrong
reason. It also builds into its own `.test-artifacts/` directory, so it does not
collide with a running dev server holding `bin/` open.

If the .NET SDK is missing, that file fails immediately with the reason rather
than timing out - it is the test that reproduces
`Failed to fetch. Is the API running on http://localhost:5080?`.

The server is spawned without a shell and torn down with a process-tree kill, so
the runner never leaves an API listening on 5080 after the suite finishes.

## Design notes

**State lives in `App.jsx`.** The list, the detail panel and the summary all
read from one `records` array, so they cannot disagree with each other.

**The detail panel edits a local `draft` copy.** Typing never touches the
canonical record, which is what makes "unsaved changes" detectable and keeps the
summary counts still until a save actually succeeds. The draft is re-seeded
during render whenever the incoming record changes identity — a different row
was selected, or a save returned a fresh object — rather than in an effect, so
there is no second render pass and no window where a stale record is on screen.

**Counts are derived, never stored.** `total`, `selectedCount` and the
`byStatus` grouping are computed from `records` on every render (`byStatus`
memoised on `records`). Nothing calls `setState` with a count, so the numbers
cannot drift out of sync with the data.

**Pure logic lives in `lib/records.js`.** `replaceRecord`, `groupByStatus`,
`findSelected`, `isDirty` and `canSave` are plain functions with no React in
them, so the behaviour the reviewer cares about is unit-tested directly rather
than inferred from the UI.

**Updates are immutable.** Saving replaces one element via
`records.map(r => r.id === saved.id ? saved : r)` — a new array with a new object
for the changed row. No `push`, no `splice`, no writing into an existing object.

**Keys are stable ids.** Rows use `key={record.id}`, never the array index, so
React keeps row identity correct when values change.

**Accessibility.** The list is a `role="grid"`; rows are focusable, expose
`aria-selected`, and respond to Enter and Space as well as click.

**Persistence caveat.** The server mutates its `List<RecordItem>` in place, so
edits survive a browser refresh but reset to the seed data when the API process
restarts. That is intentional given the no-database constraint.

## Dependencies

No packages were added beyond the two templates.

- `client/package.json` is the unmodified `npm create vite@latest -- --template react` dependency set (react, react-dom, vite, @vitejs/plugin-react, oxlint, types).
- `server/server.csproj` has no `<PackageReference>` at all.
- The root `package.json` holds test scripts only and has no dependencies.
