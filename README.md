# Mileage Tracker

A mobile-first mileage log for a work vehicle. Start a trip with the odometer reading, end it when you arrive, and the app saves the distance and estimated reimbursement.

**Live:** https://spencergoergen.github.io/mileage-tracker/

## Features

- One-tap start/end trips from odometer readings; the next trip's start is prefilled from the last reading
- Business / Commute / Personal categories, with purpose, destination and notes
- Add or edit past trips; searchable log grouped by month
- Reports for any date range: miles by category, business-use %, reimbursement at your rate
- CSV export for expense reports, plus JSON backup/restore
- Configurable rate (defaults to the 2026 IRS business rate, $0.725/mi) and miles/km
- Data stays on the device in `localStorage`, and the app can be added to the home screen

## Local development

```sh
npm install
npm run dev      # start dev server
npm run build    # production build to dist/
npm run preview  # serve the build
```

No environment variables or API keys are required.

Deploys to GitHub Pages via `.github/workflows/deploy.yml` on every push to the default branch.
