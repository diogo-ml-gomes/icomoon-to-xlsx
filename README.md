# IcoMoon JSON -> CSV / XLSX

Offline web app to parse IcoMoon JSON files and export icon names to `CSV` or `XLSX`.

## What this app does

- Accepts IcoMoon JSON files by drag-and-drop or file picker.
- Supports:
  - IcoMoon V1 (`selection.json`)
  - IcoMoon V2 (`font_name.icomoon.json` / `glyphs`)
- Extracts icon names and shows a live preview table.
- Lets you:
  - Search by icon name
  - Toggle `Unique + A->Z`
  - Set preview row limit
  - Copy preview names to clipboard
  - Download as `CSV` or `XLSX`
- Includes a JSON preview panel, light/dark theme switch, and responsive layout.

## Local-first / offline

- No CDN dependencies are used in runtime output.
- Build output is a single self-contained HTML file:
  - `dist/index.html`
- Compressed artifacts are also generated:
  - `dist/index.html.gz`
  - `dist/index.html.br`

## Requirements

- Node.js 18+ (recommended)
- npm

## Run locally

```bash
npm install
npm start
```

Then open:

- `http://localhost:3000`

## Scripts

- `npm start`: starts dev server (alias to `dev`)
- `npm run dev`: starts local dev server
- `npm run build`: builds minified single-file app into `dist/`
- `npm run build:watch`: rebuilds on source changes
- `npm run test`: runs unit tests

## Project structure

- `src/`: app source (modularized by feature)
- `server/`: local development server
- `scripts/build.mjs`: single-file build pipeline (HTML + CSS + JS inline)
- `dist/`: production artifacts
- `tests/`: unit tests
