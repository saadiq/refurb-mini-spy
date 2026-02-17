# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Monitors Apple's refurbished Mac store for Mac Mini availability. A GitHub Action runs every 15 minutes, scrapes product data via JSON-LD extraction, sends Slack notifications when Mac Minis are found, and updates a historical pricing database. A dashboard hosted on GitHub Pages visualizes the data.

## Commands

- `bun run check.ts` — Run the Slack monitor locally (omit `SLACK_WEBHOOK_URL` to dry-run)
- `bun run update-data.ts` — Scrape current listings and merge into `data/refurb-history.json`

## Architecture

**Shared scraping library** (`lib/scrape.ts`): Fetches Apple's refurbished Mac Mini page, extracts JSON-LD products, and provides parsing utilities. Both scripts import from this module.

**Slack monitor** (`check.ts`): Imports shared scraping, formats matching products into a Slack message, and posts via webhook.

**Data updater** (`update-data.ts`): Imports shared scraping, parses chip/RAM/storage/price from product listings, and merges into the historical JSON. Each product tracks a `sightings` array of `{date, price}` entries (deduped per day) plus `firstSeen`/`lastSeen` fields.

**Dashboard** (GitHub Pages): `index.html` loads `data/refurb-history.json` at runtime. JS split into `chart-helpers.js` (shared utilities), `charts.js` (temporal insight charts via Chart.js + chartjs-adapter-date-fns), and `app.js` (table, timeline, price history). Styled by `styles.css`.

**Workflows**:
- `.github/workflows/check-refurb.yml` — 15-min cron: runs check.ts, then update-data.ts, auto-commits data changes
- `.github/workflows/deploy-pages.yml` — Deploys dashboard files to GitHub Pages on push to main (ignores data-only changes)

## Environment

- **Runtime:** Bun (no Node, no npm)
- **`SLACK_WEBHOOK_URL`:** GitHub Actions secret; when unset locally, the script logs the message instead of posting
