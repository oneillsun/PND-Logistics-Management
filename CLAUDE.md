# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-file React application (`PNDLogisticsManagement.jsx`) for managing FedEx driver logistics operations across multiple terminals: road tests, uniform orders, fleet, injury reports, accidents, hiring requests, and insurance enrollment.

## Commands

```bash
npm run dev      # start dev server at http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview production build locally
```

No test suite or linter configured.

## Architecture

### Entry Point

`src/main.jsx` mounts the app. All persistence goes through Supabase.

### Supabase

Credentials in `.env`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SUPABASE_STORAGE_BUCKET=terminal-pdfs   # optional, defaults to 'terminal-pdfs'
```

**Data layer** (`src/lib/db.js`):
- `dbLoad(key)` / `dbSave(key, records)` — all modules use these
- Every table has `id text` (PK) + `data jsonb` columns; full record stored in `data`
- Storage key → table mapping:

| SK constant | Key | Table |
|-------------|-----|-------|
| `SK.rt` | `pnd_rt_v5` | `road_tests` |
| `SK.uni` | `pnd_uni_v5` | `uniform_orders` |
| `SK.tr` | `pnd_tr_v5` | `trucks` |
| `SK.inj` | `pnd_inj_v5` | `injury_reports` |
| `SK.acc` | `pnd_acc_v2` | `accidents` |
| `SK.hir` | `pnd_hir_v1` | `hiring_requests` |
| `SK.ins` | `pnd_ins_v1` | `insurance_requests` |

**Other lib modules:**
- `src/lib/supabase.js` — exports the Supabase client
- `src/lib/auth.js` — `login`, `logout`, `getSession`, `fetchUsers`, `createUser`, `updateUser`; sessions stored in localStorage as `pnd_auth_v1`
- `src/lib/terminals.js` — `fetchTerminals`, `createTerminal`, `updateTerminal`, `uploadTerminalPdf`; terminals stored in their own `terminals` table (not via dbLoad/dbSave)
- `src/lib/email.js` — `sendModuleEmail` via Supabase Edge Function; `buildOutcomeHtml` for road test emails
- `src/lib/settings.js` — `fetchEmailSettings`, `saveEmailSettings`; persisted in `app_settings` table
- `src/lib/pdfRecord.js` — `generateRoadTestPDF(test, terminalData, adminUser, terminalPdfUrl)` fills the road test PDF template using pdf-lib; `terminalPdfUrl` overrides the default `/docs/OP104PDrev111320.pdf`
- `supabase/schema.sql` — run once in the SQL Editor to create all tables, RLS policies, and seed data

**Supabase Storage:** Terminal-specific road test PDF templates are uploaded to the `terminal-pdfs` bucket. The URL is stored as `pdf_url` on the terminal record and passed to `generateRoadTestPDF` at download time.

### Single-File Pattern

`PNDLogisticsManagement.jsx` (~1,700 lines) contains all constants, helper functions, UI components, and the single exported `App()` component. No component files — everything is in this one file.

### Seven Modules (Tabs)

| Tab key | Label | Description |
|---------|-------|-------------|
| `rt` | Road Tests | Schedule tests, SMS candidates, record pass/fail, generate PDF |
| `uni` | Uniforms | Uniform/equipment orders per terminal (Pending → Completed) |
| `fleet` | Fleet | Truck registry with registration/inspection expiry tracking |
| `inj` | Injuries | Injury reports with file attachments (Supabase Storage bucket `injury-files`) |
| `acc` | Accidents | Accident reports with victim/vehicle info and media |
| `hir` | Hiring | Hiring start/pause requests with HR SMS/WhatsApp notification |
| `ins` | Insurance | Health insurance enrollment requests with email generation |

Data auto-reloads every 15 seconds via `setInterval`.

### Color & Theme System

Light theme with per-module accent colors. Key constants at the top of the file:

- `FC` — feature colors per module (`rt`, `uni`, `fleet`, `inj`, `acc`, `hir`, `ins`), each with `h` (primary), `bg`, `bd`, `tx`, `ring`, `soft`
- `STC` — status badge colors (`Scheduled`, `Passed`, `Failed`, `Pending`, `Completed`, `Active`, `Paused`)
- `EXP` — expiry state colors (`expired`, `warning`, `ok`, `none`)
- `URGENCY` — 4-level urgency scale for hiring requests
- `activeCC = FC[tab]` — current tab's color set; used for focus rings in the global `<style>` tag injected in the App render

### UI Conventions

- **Icons**: Inline SVG only via `Ico({n, s})` — no icon library
- **Buttons**: `Btn(variant, color)` — variants: `"primary"`, `"outline"`, `"ghost"`, `"danger"`, `"success"`; `B()` is a legacy shim
- **Inputs**: `INP` style object (white bg, light border); `IS` is an alias
- **Fields**: `Field({label, children, span})` / alias `Fld` — renders label + input with uppercase 11px label
- **Cards**: white bg, `1.5px solid cc.bd`, `4px solid cc.h` left accent border, 14px radius
- **Modals**: single `{ type, data }` state object; `Modal` component with blur backdrop
- **Toasts**: `toast(msg, type)` helper adds to `toasts` state array; types: `"success"`, `"warn"`, default is info
- **Badges**: `Badge({status})` / `Bdg` uses `STC` for colors
- **Expiry pills**: `ExpPill({label, dateStr})` uses `EXP` colors

### Notification Patterns

- **Road Test**: SMS to candidate via native/WhatsApp/clipboard; outcome email via Supabase Edge Function
- **Hiring**: After save, `_notify:true` flag on the record triggers `HRNotifyModal` for SMS/WhatsApp to HR
- **Insurance**: After save, `_email:true` flag triggers `InsuranceEmailModal` showing a pre-built email to copy/send

### Key Conventions

- JSX must use straight ASCII quotes (`"` `'`) — Unicode curly quotes break the build
- `getSizes(type)` returns waist sizes (W24–W48) for pants/shorts, XS–4XL for everything else
- Terminal lookup for PDF: `terminals.find(t => \`${t.name} - ${t.code}\` === test.terminal)`
- Injury attachments stored in Supabase Storage bucket `injury-files`; only metadata (name, type, size, url, path) is kept in jsonb
