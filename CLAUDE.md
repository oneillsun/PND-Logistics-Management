# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-file React application (`PNDLogisticsManagement.jsx`) for managing FedEx driver road tests and uniform orders across multiple logistics terminals. Vite is used as the dev server and bundler.

## Commands

```bash
npm run dev      # start dev server at http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview production build locally
```

There is no test suite or linter configured.

## Architecture

### Entry Point

`src/main.jsx` mounts the app. No shim required — persistence goes through Supabase.

### Supabase

Credentials are read from `.env`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

- `src/lib/supabase.js` — creates and exports the Supabase client
- `src/lib/db.js` — exports `dbLoad(key)` and `dbSave(key, records)` used throughout the app
- `supabase/schema.sql` — run this once in the Supabase SQL Editor to create all tables and RLS policies

Each table (`road_tests`, `uniform_orders`, `trucks`, `injury_reports`) has two columns: `id text` and `data jsonb`. The full record object is stored in `data`; the top-level `id` is also stored as the primary key for efficient upsert/delete.

**Note:** Injury report attachments are stored as base64 inside the `data` jsonb column. Large files (videos, multiple images) may cause performance issues — consider migrating to Supabase Storage if this becomes a problem.

### Single Component Pattern

The entire app is one default-exported `App()` component (~900 lines) in `PNDLogisticsManagement.jsx`. All state, logic, and UI live in this one file.

### Data Layer

- **Storage keys**: `fedex_rt_v3` (road tests), `fedex_uni_v3` (uniform orders) — stored in `localStorage`
- **Auto-sync**: data reloads every 15 seconds via `setInterval`
- **Static data**: `TERMINAL_DATA` (6 FedEx terminals with addresses/contacts) and `UNIFORM_TYPES` (10 item types) are top-level constants

### Two Core Modules

1. **Road Tests** — Schedule and track driver road tests. Supports SMS notification to candidates (native, WhatsApp, or clipboard), pass/fail recording with feedback, and a timed alert when test duration elapses with no outcome recorded.

2. **Uniform Orders** — Create and track equipment/uniform orders per terminal. Status lifecycle: Pending → Completed.

### UI Conventions

- **Dark theme**: background `#080812`, primary accent `#ff6200` (FedEx orange)
- **Fonts**: "Barlow Condensed" (headers), "DM Mono" (body) — loaded via Google Fonts in `index.html`
- **Icons**: Inline SVG only, no icon library
- **Modal system**: Single `{ type, data }` state object drives all create/edit/preview dialogs
- **Toast notifications**: Temporary feedback via a `toasts` state array
- **Status badges**: Color-coded per status string (Scheduled, In Progress, Passed, Failed, Pending, Completed)

### Key Conventions

- State managed entirely with `useState` and `useEffect` — no external state library
- All data mutations go through helper functions (`addRoadTest`, `updateRoadTest`, `addUniformOrder`, `updateUniformOrder`) that call `window.storage.set` after updating local state
- `activeTab` state (`'roadtests'` | `'uniforms'`) controls which module renders
- Pants/shorts use waist sizes (W24–W48); all tops/outerwear use XS–4XL — `getSizes(type)` returns the correct array
- The JSX source must use straight ASCII quotes (`"` `'`), not Unicode curly quotes — the file was originally authored with curly quotes and was fixed; avoid reintroducing them
