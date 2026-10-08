# Document Verification Portal

React + TanStack Start app that verifies official ERPNext documents by scanning
their QR code. The QR encodes a URL like `https://<portal>/verify/<hash>`; the
portal resolves the HMAC-SHA-256 hash back to the ERPNext document using only
ERPNext's **built-in REST API** — no app install, no custom Python method.

## Architecture

```
Browser ──► Cloudflare Worker (this app)
              ├─ Pages            / , /verify/:hash
              └─ Server fn        verifyProxy (→ every configured ERPNext site, in parallel)
                                    ├─ GET /api/resource/Custom Field   (auto-discover doctypes)
                                    └─ GET /api/resource/<doctype>?filters=... (match hash)
```

1. The QR code encodes `https://<portal>/verify/<hash>` where `<hash>` is the
   hex hash of `"{Doctype}.{document_name}"` — either the 32-char (truncated) or
   the 64-char HMAC-SHA-256 digest, and it is the same value that is stored in
   the `verification_data` **Custom Field** on the document. Sites may use
   different lengths; the portal accepts both.
2. A TanStack Start **server function** running inside the Worker calls ERPNext
   with the built-in REST API, authenticated via a standard **API Key/Secret**
   of a restricted user (a core ERPNext feature — nothing is installed).
3. It auto-discovers the doctypes that carry `verification_data` (querying the
   `Custom Field` doctype, with a `VERIFICATION_DOCTYPES` fallback) and finds
   the document whose field equals the hash.
4. Only a whitelist of fields is returned. The browser never sees the API
   credentials and never shows the full hash.
5. **Every configured site is searched, in parallel**, so a scan costs as much
   wall-clock time as its slowest site rather than the sum of all of them.

## ERPNext setup (no install, no code)

1. **Create the custom field** on each doctype you want to verify:
   `verification_data`, type **Data**, length 128. (Customize Field in the
   doctype form; it stores the hash).
2. **Create a service user** (e.g. "Verification Portal") and give it read
   access to the doctypes being verified. For auto-discovery it also needs read
   on the **Custom Field** doctype (System Manager has this) — otherwise set
   `VERIFICATION_DOCTYPES`.
3. **Generate an API Key/Secret** for that user (ERPNext → User → API Access).
   These are secrets; they live only as Worker bindings, never in the repo.
4. **Fill `verification_data`** on each document with the verification code and
   print a QR code for `https://<portal>/verify/<code>`. The printed code is
   `<PREFIX>-<hash>` — see [Prefixed codes](#prefixed-codes-the-printed-format).

Hash + QR generator (runs anywhere, e.g. on your machine — never on ERPNext):

```js
// node gen.mjs  (uses the HMAC secret you keep private)
import { createHmac } from "node:crypto";
const secret = "CHANGE_ME"; // keep secret, used to generate hashes
const doc = { doctype: "Sales Invoice", name: "ACC-SINV-2026-00042" };
// 64-char HMAC-SHA-256 hex (full digest) …
const hash = createHmac("sha256", secret).update(`${doc.doctype}.${doc.name}`).digest("hex");
// … or a 32-char code: keep the first 32 hex chars of the same digest.
const shortHash = hash.slice(0, 32);
console.log(`https://<portal>/verify/${shortHash}`);
```

Both lengths are accepted by the portal (see `CODE_PATTERN` in
`src/lib/verification-hash.ts`). Pick one per site and use it consistently —
different sites may legitimately use different lengths, since each has its own
hash secret.

### Prefixed codes (the printed format)

The printed QR carries a **doctype prefix** in front of the hash:

```
SIN-e006e6dc77ec0ca6ecaefd28b34982fe
^^^ prefix            ^^^^^^^^^^^^^^^^ hash
```

Store the **whole string** in `verification_data`, prefix included — that is
what ERPNext is filtered against, so a bare hash will not match a prefixed
record. Prefixes are defined in `src/config/doctypePrefixes.ts`:

| Doctype            | Prefix | Doctype           | Prefix |
| ------------------ | ------ | ----------------- | ------ |
| Sales Invoice      | `SIN`  | Purchase Order    | `PO`   |
| Sales Order        | `SO`   | Purchase Receipt  | `PR`   |
| Delivery Note      | `DN`   | Purchase Invoice  | `PIN`  |
|                    |        | Stock Entry       | `SE`   |

The prefix buys two things:

- **Routing.** A prefixed code names its own doctype, so only that one is
  searched instead of every doctype on every site. That is what keeps a scan
  inside the Worker's subrequest budget (see below).
- **Issue filing.** A query raised on a verified document is filed as
  `priority = High` under an `Issue Type` named after the doctype — `SIN` files
  under *Sales Invoice*.

Case is normalised for you: the portal upper-cases the prefix and lower-cases
the hash, so `sin-E006…` and `SIN-e006…` both resolve to the one string ERPNext
holds.

Legacy records with no prefix still verify and still get an Issue Type — the
prefix is skipped and the **verified document's own doctype** is used instead. An
unknown prefix (a doctype added in ERPNext but not to the table above) falls back
to searching all doctypes, so a new doctype never breaks a scan.

Then encode `https://<portal>/verify/<PREFIX>-<hash>` into a QR code (any QR
tool / `qrcode` npm package) and store that same `<PREFIX>-<hash>` string in the
document's `verification_data` field. The QR and the field must agree exactly —
that is the string the portal looks up.

### Raise a Query → ERPNext Issue

A query on a verified document becomes an Issue on the **issuing** site, filed
`High` priority under an Issue Type named after the doctype. Both fields are
Links, so the portal creates the lookup record the first time it needs one
(`Issue Type`, `Issue Priority`) and reuses it afterwards.

ERPNext prerequisites for the API user, beyond the read permissions above:

- **create** on `Issue` (Support module)
- **read + create** on `Issue Type` and `Issue Priority`

If a lookup record cannot be created, the Issue is **still filed** — only that
one field is left off. A missing priority must never cost the customer their
query.

### Which fields show on a verified document

The portal only ever shows the fields you configure (nothing else leaves the
Worker). Per doctype the display list comes from the `options` field of its
`verification_data` Custom Field — no code change or redeploy needed:

```
customer,posting_date,due_date,grand_total
items:item_name,qty
```

- Top-level fields: comma-separated, shown in that order.
- Child tables: `table_fieldname:sub1,sub2` (e.g. the `items` table).
- Empty `options` (or an unknown doctype) falls back to the built-in map in
  `src/config/displaySpecs.ts` (Sales/ Purchase / Quotation / Delivery Note +
  a generic fallback).

#### Item tables are hidden

A verified document shows its header fields only — the `items` table is **not**
rendered, and the item names never leave the Worker.

This is `SHOW_CHILD_TABLES = false` in `src/config/displaySpecs.ts`. The flag is
enforced inside `resolveDisplaySpec`, the one function every display spec passes
through, so the child-table syntax above is parsed but **ignored** — a doctype
whose `options` still lists `items:item_name,qty` will not bring the table back.
Flip the flag to `true` to restore it; no other change is needed.

## Development

```sh
copy .env.example .env       # (Windows) or: cp .env.example .env
npm i
npm run dev
```

Local development talks to the same server proxy the Worker uses — it reads
the ERPNext connection from the runtime variables in `.env` (via
`process.env` on the dev server).

`.env` lists every site in `ERP_NEXT_SITES` with one credential pair each. To
point at different sites without editing the file, set them in the shell before
`npm run dev`:

```sh
# PowerShell — note the single quotes, so the JSON keeps its double quotes.
$env:ERP_NEXT_SITES='[{"id":"dev16","baseUrl":"https://dev16.mmmc.pk"}]'
$env:ERP_NEXT_API_KEY_DEV16="abc123"; $env:ERP_NEXT_API_SECRET_DEV16="xyz789"
$env:VERIFICATION_DOCTYPES="Sales Invoice"            # optional fallback
npm run dev
```

## Environment

### Runtime (read via `process.env` on the Worker / dev server — never in the client bundle)

| Variable                      | Meaning                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `ERP_NEXT_SITES`              | JSON array of the sites to verify against: `[{"id":"dev16","baseUrl":"https://…"}]`.   |
| `ERP_NEXT_API_KEY_<ID>`       | API Key of the service user on that site, where `<ID>` is the site id uppercased.      |
| `ERP_NEXT_API_SECRET_<ID>`    | API Secret of the service user on that site (secret).                                  |
| `VERIFICATION_DOCTYPES`       | Optional comma-separated doctype fallback for every site.                              |
| `VERIFICATION_DOCTYPES_<ID>`  | Optional per-site override of the fallback list.                                        |
| `ERP_NEXT_BASE_URL`           | Legacy single-site URL. Honoured only when `ERP_NEXT_SITES` is unset.                  |
| `ERP_NEXT_API_KEY`            | Legacy single-site API Key. Same fallback rule.                                        |
| `ERP_NEXT_API_SECRET`         | Legacy single-site API Secret. Same fallback rule.                                      |

Secrets must never be placed in `VITE_*` variables or committed to the repo.

## Multiple sites

The portal verifies documents from more than one ERPNext site — usually a
different company each. `ERP_NEXT_SITES` lists them, and every site carries its
own API Key/Secret so one leaked credential never opens every company's records:

```
ERP_NEXT_SITES = [{"id":"dev16","baseUrl":"https://dev16.mmmc.pk"},
                  {"id":"test16","baseUrl":"https://test16.mmmc.pk"}]
```

- **Adding a site** is one entry plus two secrets. No code change. The id is
  uppercased for the binding names, so `dev16` becomes
  `ERP_NEXT_API_KEY_DEV16` / `ERP_NEXT_API_SECRET_DEV16`.
- **Order matters twice**: sites are searched in order, and the **first** site
  receives Report Query leads. Reorder the array to change where queries land.
- **Verification** searches every site in parallel and returns every match. If
  one hash exists on two sites, both are listed, each labelled with its issuer.
- **Branding follows the document, not the configuration.** The company name
  comes from whichever site matched, so a `Test` invoice is branded `Test`.
  Until a site answers — the home page, or a code that matches nothing — the
  portal stays brand-neutral rather than naming the first configured site.
- **Sites fail independently.** An unreachable, rate-limited or unauthorised
  site is logged and the rest still answer; only when *no* site can answer does
  the visitor see an error. A site that cannot answer never turns into a false
  "not verified".
- A site with a bad URL or missing credentials is skipped with a warning
  rather than taking the whole portal down.

### Subrequest budget (Cloudflare Workers)

A Worker gets **50 subrequests per request on the free plan** (1000 on paid).
One verification spends:

```
Σ over sites (1 doctype discovery + 2 per doctype searched) + 2 per matched site
```

The **2 per doctype** is not an oversight — it is the floor. Checked directly
against ERPNext: the list endpoint never returns child tables. `fields: ["*"]`
omits them, `["*", "items"]` is rejected outright (*Field not permitted in
query: \**), and naming a child field is dropped silently. Fetching the full
document is therefore always a second request.

**A prefixed code searches exactly one doctype**, so a scan costs 5 per site
rather than 1 + 2×N. That is what makes a third or fourth site affordable:

| Configuration                 | Subrequests            |
| ----------------------------- | ---------------------- |
| 3 sites, prefixed codes       | 15                     |
| 4 sites, prefixed codes       | 20                     |
| 8 sites, prefixed codes       | 40                     |
| 3 sites, **legacy bare hash** | 51 — **over the limit**|

Only codes with no prefix (or an unknown one) still pay 1 + 2×N and are the only
reason the budget is ever a concern.

If a bare-hash site has to go past the limit, do one of these:

1. **Re-issue the documents with a prefixed code** and update
   `verification_data`. That is the actual fix, and it costs nothing at runtime.
2. **Add a request budget** to `verifyProxy`, so the Worker degrades
   gracefully instead of dying with Cloudflare's `1101` "too many subrequests".
   This is not implemented yet.
3. **Use a registry doctype** mapping hash → document. That makes the cost
   constant (~3 subrequests) however many sites there are, at the price of one
   registry row per document.
4. **Upgrade to the paid plan.**

Dropping child tables from the display does **not** help here: it saves payload,
not subrequests, because the second request is the full-document fetch, which
`findDocumentByHash` makes regardless of what the spec asks for.

Related, and free: removing the `verification_data` Custom Field from a doctype
you do not verify also removes its cost, because doctype discovery is what finds
it. `Stock Entry` currently carries the field but holds no documents, so it
spends two requests per scan for nothing.

## Verify / error contract

The server function maps ERPNext responses onto the portal's error kinds.

| Result         | Meaning                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `verified`     | Document found; `document` or `documents[]` returned                     |
| `invalid_hash` | Invalid hash format                                                      |
| `not_found`    | No document matches the hash on any site that could answer               |
| `network`      | No site was reachable                                                    |
| `failed`       | Misconfiguration (no usable site, no doctypes, bad permissions)          |
| `rate_limited` | Every site was rate-limiting at once                                     |

With several sites configured, these are decided across all of them. A match on
any site wins over any site's failure, and `not_found` is only reported when at
least one site answered cleanly — a site outage is never presented to a visitor
as a failed document.

## Deploy to Cloudflare Workers

This project's build already targets Cloudflare (nitro preset).

1. Build and deploy:

   ```sh
   npm run build
   npx wrangler deploy
   ```

2. Set the site list as a **Variable** binding in `wrangler.jsonc`:

   ```jsonc
   "vars": {
     "ERP_NEXT_SITES": "[{\"id\":\"dev16\",\"baseUrl\":\"https://dev16.mmmc.pk\"},{\"id\":\"test16\",\"baseUrl\":\"https://test16.mmmc.pk\"}]",
   },
   ```

   Note the escaped double quotes: `ERP_NEXT_SITES` is a JSON array held in a
   single string.

3. Set one secret pair per site (Workers > Settings > Variables and Secrets, or
   from the CLI):

   ```sh
   npx wrangler secret put ERP_NEXT_API_KEY_DEV16
   npx wrangler secret put ERP_NEXT_API_SECRET_DEV16
   npx wrangler secret put ERP_NEXT_API_KEY_TEST16
   npx wrangler secret put ERP_NEXT_API_SECRET_TEST16
   ```

   The suffix is the site id from `ERP_NEXT_SITES`, uppercased. Secrets must be
   **Secret (Encrypted)** bindings so they never appear in the Worker code or
   logs. The CLI is the only way to set them — they must never be committed,
   and `.env` is gitignored.

4. Optional **Variable**: `VERIFICATION_DOCTYPES=Sales Invoice, Purchase Invoice`
   (global fallback), or `VERIFICATION_DOCTYPES_DEV16=…` for a single site.

5. Make sure the service user exists on **each** site, has the needed read
   permissions, and that every site is reachable from Cloudflare's network.

> Camera permission requires HTTPS — the default `*.workers.dev` domain is HTTPS,
> which is why scanning works in production.

## Project layout

- `src/routes/` — filenames are routes: `/`, `/verify/:hash`
- `src/services/verificationService.ts` — client-side orchestration + error mapping
- `src/services/erpSites.ts` — the configured sites, their credentials, URL normalisation
- `src/services/verifyProxy.ts` — server function that searches every site in parallel
- `src/services/companyProxy.ts` — per-site company lookup, used to brand a result
- `src/lib/verification-hash.ts` — QR → hash extraction
- `src/lib/scan-history.ts` — localStorage scan history
