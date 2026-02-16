const REFURB_URL = "https://www.apple.com/shop/refurbished/mac";
const MINI_URL = "https://www.apple.com/shop/refurbished/mac/mac-mini";

async function fetchRefurbishedPage(): Promise<string> {
  const res = await fetch(REFURB_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Apple refurbished page: ${res.status}`);
  }

  return res.text();
}

interface Product {
  name: string;
  offers?: { price?: string | number; priceCurrency?: string };
}

function extractProducts(html: string): Product[] {
  const pattern = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  const products: Product[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "Product" && item.name) {
          products.push(item);
        }
      }
    } catch {
      // skip malformed JSON-LD blocks
    }
  }

  return products;
}

function filterMacMinis(products: Product[]): Product[] {
  return products.filter((p) => /mac\s*mini/i.test(p.name));
}

function formatPrice(product: Product): string {
  const price = product.offers?.price;
  if (price == null) return "price unknown";
  const currency = product.offers?.priceCurrency ?? "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(price),
  );
}

function buildSlackMessage(minis: Product[]): object {
  const lines = minis.map((p) => `• ${p.name} — ${formatPrice(p)}`);
  const text = [
    `🖥️ *${minis.length} Mac Mini${minis.length > 1 ? "s" : ""} spotted on Apple Refurbished!*`,
    "",
    ...lines,
    "",
    `👉 ${MINI_URL}`,
  ].join("\n");

  return { text };
}

async function notifySlack(message: object): Promise<void> {
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
  console.log("Fetching Apple refurbished Mac page...");
  const html = await fetchRefurbishedPage();

  const products = extractProducts(html);
  console.log(`Found ${products.length} total refurbished products`);

  const minis = filterMacMinis(products);
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
