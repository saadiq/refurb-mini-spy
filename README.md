# Refurb Mini Spy

Monitors Apple's refurbished Mac store for Mac Mini availability and sends Slack notifications when qualifying models appear.

## How It Works

A GitHub Action runs every 15 minutes, scrapes product data from Apple's refurbished Mac page via JSON-LD extraction, and posts to Slack when Mac Minis meeting the alert criteria are found.

### Alert Criteria

Only models matching **all** of the following are included in notifications:

- **Chip:** M4 or newer
- **RAM:** 16GB or more
- **Storage:** 512GB or more

## Setup

1. Push this repo to GitHub
2. [Create a Slack webhook](https://api.slack.com/messaging/webhooks)
3. Add `SLACK_WEBHOOK_URL` as a repository secret in **Settings → Secrets → Actions**
4. The workflow runs automatically every 15 minutes, or trigger it manually from the **Actions** tab

## Local Testing

```sh
# Dry run (logs output, no Slack post)
bun run check.ts

# With Slack notification
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... bun run check.ts
```

## Slack Message

```
🖥️ Mac Minis spotted on Apple Refurbished!

• Refurbished Mac mini Apple M4 chip, 16GB, 256GB — $419
• Refurbished Mac mini Apple M4 Pro chip, 24GB, 512GB — $1,189

👉 https://www.apple.com/shop/refurbished/mac/mac-mini
```
