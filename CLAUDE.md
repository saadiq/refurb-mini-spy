# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Monitors Apple's refurbished Mac store for Mac Mini availability. A GitHub Action runs every 15 minutes, scrapes product data from the refurbished page via JSON-LD extraction, and sends Slack notifications when Mac Minis are found.

## Commands

- `bun run check.ts` — Run the monitor locally (omit `SLACK_WEBHOOK_URL` to dry-run without posting to Slack)

## Architecture

Single-file Bun script (`check.ts`) with zero dependencies. The pipeline:

1. Fetches `apple.com/shop/refurbished/mac` HTML with browser-like headers
2. Extracts `<script type="application/ld+json">` blocks via regex
3. Parses JSON-LD, filters for `@type: "Product"` where name matches "mac mini"
4. POSTs matching products to Slack via `SLACK_WEBHOOK_URL` env var

GitHub Action (`.github/workflows/check-refurb.yml`) runs this on a 15-min cron schedule. No deduplication — notifies every run while Mac Minis are in stock.

## Environment

- **Runtime:** Bun (no Node, no npm)
- **`SLACK_WEBHOOK_URL`:** GitHub Actions secret; when unset locally, the script logs the message instead of posting
