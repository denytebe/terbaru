import puppeteer from "puppeteer";
import { pathToFileURL } from "node:url";

const TARGET_URL = "https://trends.google.com/trending?geo=ID&hours=24";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function dismissCookieBanner(page) {
  const candidates = ["Got it", "I agree", "Saya setuju"];

  for (const label of candidates) {
    const button = await page.$(`button[aria-label=\"${label}\"]`);
    if (button) {
      await button.click();
      return;
    }
  }

  const textMatched = await page.evaluate((labels) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const match = buttons.find((button) => labels.includes(button.textContent?.trim() || ""));
    if (match) {
      match.click();
      return true;
    }
    return false;
  }, candidates);

  if (textMatched) {
    await delay(500);
  }
}

async function scrapeTable(page) {
  await page.waitForSelector("table, [role='table']", { timeout: 30000 });

  return page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

    const rows = Array.from(document.querySelectorAll("tbody tr"));
    if (!rows.length) {
      return [];
    }

    return rows.map((row) => {
      return {
        title: clean(row.querySelector(".mZ3RIc")?.textContent),
        searchVolume: clean(row.querySelector(".qNpYPd")?.textContent).replace(/ searches$/i, ""),
        started:
          clean(row.querySelector(".vdw3Ld")?.textContent) || clean(row.querySelector(".A7jE4")?.textContent)
      };
    });
  });
}

export async function scrapeTrendingFromBrowser(limit = 15) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1400 });
    await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 60000 });

    await dismissCookieBanner(page);
    await delay(1500);

    const scraped = await scrapeTable(page);
    return scraped
      .filter((item) => item.title && item.searchVolume)
      .slice(0, limit);
  } finally {
    await browser.close();
  }
}

async function run() {
  const compact = await scrapeTrendingFromBrowser();
  console.log(JSON.stringify(compact, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}