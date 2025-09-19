# FTC Attendance Tracker

This repository contains a Progressive Web App (PWA) and a companion Google Apps Script API for tracking FTC team
attendance across kiosk, student, and admin workflows.

## Features

- **Kiosk mode:** Touch-friendly grid of team members with online/offline queueing and live status updates.
- **Student portal:** Google sign-in ready form for logging offline work with category and notes, plus submission history.
- **Admin portal:** Roster management via CSV import, offline work approvals, attendance overview, and emergency
  clock-out.
- **Offline resilience:** Local queue for kiosk toggles and service worker caching for PWA support.

## Frontend (Vite + React + Tailwind CSS)

```bash
npm install
npm run dev
npm run build
```

Configuration lives in [`src/config.ts`](src/config.ts). Update `SEASON_ID`, `GAS_URL`, teams, categories, and allowlists
for your deployment.

Build output is generated in `dist/` and can be published to GitHub Pages.

### PWA icon assets

The manifest ships with a vector icon reference (`public/logo.svg`) so that the repository stays text-only. For a
production deployment you can drop season-specific PNG icons into `public/icons/` (192px and 512px squares) and update
[`public/manifest.webmanifest`](public/manifest.webmanifest) to point at them, or keep the SVG reference if that suits
your branding. When the icons directory is absent the build and service worker continue to work without additional
steps.

## Google Apps Script backend

The `gas/` directory includes a starter implementation for the Apps Script web app that powers the API endpoints
consumed by the frontend. Deploy it as a web app that runs as the sheet owner with access level **Anyone**. Restrict
origins and set the `ADMIN_EMAILS` and `ALLOWED_ORIGINS` script properties.

## Google Sheet schema

See [`attendancetrack.md`](attendancetrack.md) for the full sheet layout, API contract, behaviors, and deployment plan.
