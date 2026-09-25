# Document Verification Portal

React + TanStack Start app that verifies official ERPNext documents by scanning
their QR code. The QR encodes a URL like `https://<portal>/verify/<hash>`; the
portal resolves the HMAC-SHA-256 hash back to the ERPNext document using only
ERPNext's **built-in REST API** — no app install, no custom Python method.

## Architecture

```
Browser ──► Cloudflare Worker (this app)
              ├─ Pages            / , /verify/:hash
              └─ Server fn        verifyProxy (→ ERPNext built-in REST API)
                                    ├─ GET /api/resource/Custom Field   (auto-discover doctypes)
                                    └─ GET /api/resource/<doctype>?filters=... (match hash)
```

1. The QR code encodes `https://<portal>/verify/<hash>` where `<hash>` is the
   64-char HMAC-SHA-256 of `"{Doctype}.{document_name}"` — the same value that
   is stored in the `verification_data` **Custom Field** on the document.
2. A TanStack Start **server function** running inside the Worker calls ERPNext
   with the built-in REST API, authenticated via a standard **API Key/Secret**
   of a restricted user (a core ERPNext feature — nothing is installed).
3. It auto-discovers the doctypes that carry `verification_data` (querying the
   `Custom Field` doctype, with a `VERIFICATION_DOCTYPES` fallback) and finds
   the document whose field equals the hash.
4. Only a whitelist of fields is returned. The browser never sees the API
   credentials and never shows the full hash.

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
4. **Fill `verification_data`** on each document with the HMAC hash and print a
   QR code for `https://<portal>/verify/<hash>`.

Hash + QR generator (runs anywhere, e.g. on your machine — never on ERPNext):

```js
// node gen.mjs  (uses the HMAC secret you keep private)
import { createHmac } from 'node:crypto';
const secret = 'CHANGE_ME';            // keep secret, used to generate hashes
const doc = { doctype: 'Sales Invoice', name: 'ACC-SINV-2026-00042' };
const hash = createHmac('sha256', secret).update(`${doc.doctype}.${doc.name}`).digest('hex');
console.log(`https://<portal>/verify/${hash}`);
```

Then encode that URL into a QR code (any QR tool / `qrcode` npm package) and
store `hash` in the document's `verification_data` field.

## Development

```sh
copy .env.example .env       # (Windows) or: cp .env.example .env
npm i
npm run dev
```

For quick UI work the bundled mock needs no backend at all:

```sh
# .env: VITE_USE_MOCK_VERIFICATION=true  (already the default in .env.example)
npm run dev
```

With the mock enabled there is no network: the client returns a fixed
"verified" document for any code not starting with `notfound`.

To try the real flow locally, export the runtime variables in the shell before
`npm run dev` (they are read via `process.env`):

```sh
$env:ERP_NEXT_BASE_URL="https://erp.example.com"      # PowerShell
$env:ERP_NEXT_API_KEY="abc123"; $env:ERP_NEXT_API_SECRET="xyz789"
$env:VERIFICATION_DOCTYPES="Sales Invoice"            # optional fallback
npm run dev
```

## Environment

### Client (`VITE_` — bundled, never secret)

| Variable | Meaning |
| --- | --- |
| `VITE_USE_MOCK_VERIFICATION` | `true` → isolated dev mock; always `false` in production. |

### Runtime (read via `process.env` on the Worker / dev server — never in the client bundle)

| Variable | Meaning |
| --- | --- |
| `ERP_NEXT_BASE_URL` | ERPNext site, e.g. `https://erp.example.com`. |
| `ERP_NEXT_API_KEY` | API Key of the restricted service user (secret). |
| `ERP_NEXT_API_SECRET` | API Secret of the service user (secret). |
| `VERIFICATION_DOCTYPES` | Optional comma-separated doctype fallback, e.g. `Sales Invoice, Purchase Invoice`. |

Secrets must never be placed in `VITE_*` variables or committed to the repo.

## Verify / error contract

The server function maps ERPNext responses onto the portal's error kinds.

| Result | Meaning |
| --- | --- |
| `verified` | Document found; `document` or `documents[]` returned |
| `invalid_hash` | Invalid hash format |
| `not_found` | No document matches the hash |
| `network` | Upstream unreachable |
| `failed` | Misconfiguration (missing URL/credentials, no doctypes, bad permissions) |

## Deploy to Cloudflare Workers

This project's build already targets Cloudflare (nitro preset).

1. Build and deploy:

   ```sh
   npm run build
   npx wrangler deploy
   ```

2. On the Worker create the bindings (Workers > Settings > Variables and
   Secrets):

   - **Variable**: `ERP_NEXT_BASE_URL=https://your-erpnext.example.com`
   - **Secret**: `ERP_NEXT_API_KEY` (Encrypted)
   - **Secret**: `ERP_NEXT_API_SECRET` (Encrypted)
   - **Variable** (optional): `VERIFICATION_DOCTYPES=Sales Invoice, Purchase Invoice`
   - **Variable**: `VITE_USE_MOCK_VERIFICATION=false`

   Secrets must be set as **Secret (Encrypted)** bindings so they never appear
   in the Worker code or logs.

3. Make sure the service user exists, has the needed read permissions, and that
   ERPNext is reachable from Cloudflare's network.

> Camera permission requires HTTPS — the default `*.workers.dev` domain is HTTPS,
> which is why scanning works in production.

## Project layout

- `src/routes/` — filenames are routes: `/`, `/verify/:hash`
- `src/services/verificationService.ts` — client-side orchestration + error mapping
- `src/services/verifyProxy.ts` — server function that talks to ERPNext's built-in REST API
- `src/lib/verification-hash.ts` — QR → hash extraction
- `src/lib/scan-history.ts` — localStorage scan history