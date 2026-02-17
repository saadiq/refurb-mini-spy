import {
  MINI_URL, fetchApplePage, extractMacMiniProducts,
  formatPrice, parseSpecsString, type Product,
} from "./lib/scrape";

function buildSlackMessage(minis: Product[]): { text: string } {
  const lines = minis.map((p) => {
    const specs = parseSpecsString(p.description);
    const specLine = specs ? `\n    ${specs}` : "";
    return `• *${formatPrice(p)}* — ${p.name}${specLine}`;
  });
  const text = [
    `🖥️ *${minis.length} Mac Mini${minis.length > 1 ? "s" : ""} spotted on Apple Refurbished!*`,
    "",
    ...lines,
    "",
    `👉 ${MINI_URL}`,
  ].join("\n");

  return { text };
}

async function notifySlack(message: { text: string }): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("SLACK_WEBHOOK_URL not set — skipping Slack notification");
    console.log("Message that would be sent:", JSON.stringify(message, null, 2));
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }

  console.log("Slack notification sent successfully");
}

async function main() {
  console.log("Fetching Apple refurbished Mac Mini page...");
  const html = await fetchApplePage(MINI_URL);

  const minis = extractMacMiniProducts(html);
  console.log(`Found ${minis.length} Mac Mini(s)`);

  if (minis.length === 0) {
    console.log("No Mac Minis found. Exiting.");
    return;
  }

  for (const mini of minis) {
    console.log(`  → ${mini.name} — ${formatPrice(mini)}`);
  }

  const message = buildSlackMessage(minis);
  await notifySlack(message);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
