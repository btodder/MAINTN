# MAINTN

A lightweight maintenance-reminder tracker. Add recurring tasks — replacing a filter, watering a plant, running a checkup — and MAINTN tells you how much time is left (or how overdue you are), sorted by what needs attention soonest.

## Features

- Add items with a name, category, and recurring interval (days/weeks/months/years)
- Countdown view in days, weeks, or months
- Mark an item done to reset its countdown to today
- Edit or delete existing items
- Light/dark mode, with an editable page title
- All data is stored locally in the browser (`localStorage`) — no backend or database

## Tech stack

- React 18 + TypeScript
- Vite
- Vercel Speed Insights

## Getting started

### GitHub Codespaces (recommended)

This repo includes a devcontainer, so no local setup is required:

1. On GitHub, click **Code → Codespaces → Create codespace on main**.
2. The container installs dependencies and starts the dev server automatically.
3. Open the forwarded port 5173 preview when prompted.

### Local development

Requires [Node.js](https://nodejs.org/) 20 and [Yarn](https://yarnpkg.com/).

```sh
yarn install
yarn dev
```

Then open the local URL Vite prints (defaults to http://localhost:5173).

## Scripts

| Command | Description |
| --- | --- |
| `yarn dev` | Start the Vite dev server |
| `yarn build` | Build for production |
| `yarn preview` | Preview the production build locally |
