# Verification pass

Run against the real stack — `dotnet run` on 5080, `npm run dev` on 5173 — with
the browser console open. Every row below was observed in the running app, not
inferred from the source.

## The seven criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | No direct state mutation | Save goes through `replaceRecord`, which returns a new array. Unit-tested: the input array, and every record object inside it, are referentially unchanged afterwards. Untouched rows keep their identity; only the saved row is a new object. |
| 2 | Controlled inputs | Every field is `value={draft.x}` + `onChange`. Driving the name field through React updated the panel and enabled Save; the Save button stays disabled until the draft actually differs. |
| 3 | Stable keys | `key={record.id}` in `RecordList`. Console shows no missing-key warning across load, select, edit, save and refresh. |
| 4 | Scrollable, multi-column list | Three column headers — Name, Category, Status. Measured `scrollHeight 297` against `clientHeight 220`, so the list genuinely scrolls rather than just having the CSS set. |
| 5 | Correct detail on select | Clicked rows 1, 4 and 6. Each time the panel showed that record's name, category and status, exactly one row was highlighted, and Selected read 1. |
| 6 | Edit and save through the API | Edited record 3, saved, then read `GET /api/records/3` directly: the server returned the new name and status. Survived a hard refresh. |
| 7 | Accurate derived counts | Changed record 3 from Active to Completed. The counts held at `Active 4 / Completed 1 / On Hold 1` for the whole time the edit was unsaved, then moved to `Active 3 / Completed 2 / On Hold 1` the moment the save returned. Total stayed 6 throughout. |

## Manual test script

| Step | Expected | Result |
|---|---|---|
| 1. Load | 6 records, total 6, selected 0, Active 3 / Completed 2 / On Hold 1 | pass |
| 2. Click a row | Detail matches, selected 1 | pass |
| 3. Edit name and status | Counts frozen, list row unchanged, "Unsaved changes" shown | pass |
| 4. Save | Row updates, counts move, Save disables again | pass |
| 5. Hard refresh | Values persist | pass |
| 6. Restart the API | Values reset to seed — intentional, no database | pass |
| 7. Scroll the list | Scrollbar present, headers readable | pass |
| 8. Console | No warnings, no errors, no missing-key warning | pass |

## Automated suite

`npm test` — 25 tests, all passing.

| File | Tests | Needs the API |
|---|---|---|
| `tests/records.test.mjs` | 12 | no |
| `tests/api-client.test.mjs` | 5 | no |
| `tests/api-contract.test.mjs` | 8 | starts it itself |

## Constraints

| Constraint | Check |
|---|---|
| No npm packages added | `client/package.json` is the unmodified Vite template dependency set |
| No NuGet packages added | `server/server.csproj` contains no `<PackageReference>` |
| No database, no data files | Records live in a `List<RecordItem>` in `Program.cs` |
| Hard-coded starting data | Six records seeded inline |
| Root `package.json` | Test scripts only, no dependencies |

## Known and intentional

- Restarting the API resets the data to the seed. That is the consequence of the
  no-database rule, not a bug.
- The detail panel re-seeds its draft during render rather than in a `useEffect`.
  Same behaviour, one less render pass, and no frame showing the previous record.
