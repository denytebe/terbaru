import puppeteer from "puppeteer";
import { pathToFileURL } from "node:url";

const HOME_URL = "https://news.google.com/home?hl=id&gl=ID&ceid=ID%3Aid";

const TOPIC_URLS = {
  indonesia:
    "https://news.google.com/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRE55ZVc0U0FtbGtLQUFQAQ?hl=id&gl=ID&ceid=ID%3Aid",
  dunia:
    "https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtbGtHZ0pKUkNnQVAB?hl=id&gl=ID&ceid=ID%3Aid",
  lokal:
    "https://news.google.com/topics/CAAqHAgKIhZDQklTQ2pvSWJHOWpZV3hmZGpJb0FBUAE?hl=id&gl=ID&ceid=ID%3Aid",
  bisnis:
    "https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtbGtHZ0pKUkNnQVAB?hl=id&gl=ID&ceid=ID%3Aid",
  teknologi:
    "https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtbGtHZ0pKUkNnQVAB?hl=id&gl=ID&ceid=ID%3Aid",
  hiburan:
    "https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtbGtHZ0pKUkNnQVAB?hl=id&gl=ID&ceid=ID%3Aid",
  olahraga:
    "https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtbGtHZ0pKUkNnQVAB?hl=id&gl=ID&ceid=ID%3Aid",
  sains:
    "https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtbGtHZ0pKUkNnQVAB?hl=id&gl=ID&ceid=ID%3Aid",
  kesehatan:
    "https://news.google.com/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtbGtLQUFQAQ?hl=id&gl=ID&ceid=ID%3Aid"
};

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("./")) {
    return `https://news.google.com${raw.slice(1)}`;
  }

  if (raw.startsWith("/")) {
    return `https://news.google.com${raw}`;
  }

  return raw;
}

async function dismissCookieBanner(page) {
  const labels = ["Got it", "I agree", "Setuju", "Saya setuju"];

  const clicked = await page.evaluate((buttonLabels) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((button) =>
      buttonLabels.includes((button.textContent || "").trim())
    );

    if (!target) {
      return false;
    }

    target.click();
    return true;
  }, labels);

  if (clicked) {
    await delay(700);
  }
}

async function scrapeTopicPage(page, category, url, maxPerCategory) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await dismissCookieBanner(page);
  await delay(1200);

  const rows = await page.evaluate((maxItems) => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const findRelativeTime = (node) => {
      const pattern =
        /(\d+\s*(menit|jam|hari|minggu|bulan|tahun)\s*lalu|\d+\s*(minute|hour|day|week|month|year)s?\s*ago|\d+\s*[mhdwy]\s*ago)/i;

      let current = node;
      for (let depth = 0; depth < 6 && current; depth += 1) {
        const text = clean(current.textContent || "");
        const match = text.match(pattern);
        if (match) {
          return clean(match[1]);
        }
        current = current.parentElement;
      }

      return "";
    };

    const readLinks = Array.from(document.querySelectorAll("a[href^='./read/'], a[href*='/read/']"));
    const result = [];
    const seen = new Set();

    for (const anchor of readLinks) {
      const title = clean(anchor.textContent || anchor.getAttribute("aria-label") || "");
      const href = clean(anchor.getAttribute("href"));
      const pubDate = "";
      const pubDateText = findRelativeTime(anchor);

      if (!title || title.length < 12) {
        continue;
      }

      const key = `${title}|${href}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push({ title, href, pubDate, pubDateText });

      if (result.length >= maxItems) {
        break;
      }
    }

    return result;
  }, maxPerCategory);

  return rows.map((item) => ({
    title: item.title,
    link: normalizeUrl(item.href),
    pubDate: item.pubDate,
    pubDateText: item.pubDateText,
    category
  }));
}

export async function scrapeNewsByTopics(options = {}) {
  const maxPerCategory = Number(options.maxPerCategory || 8);
  const headlineLimit = Number(options.headlineLimit || 12);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote"
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 2200 });

    const categories = Object.keys(TOPIC_URLS);
    const allItems = [];

    const headlineItems = await scrapeTopicPage(page, "headline", HOME_URL, headlineLimit);
    allItems.push(...headlineItems);

    for (const category of categories) {
      const scraped = await scrapeTopicPage(page, category, TOPIC_URLS[category], maxPerCategory);
      allItems.push(...scraped);
    }

    const unique = [];
    const seen = new Set();

    allItems.forEach((item) => {
      const key = `${item.title}|${item.link}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      unique.push(item);
    });

    return unique;
  } finally {
    await browser.close();
  }
}

async function run() {
  const items = await scrapeNewsByTopics({ maxPerCategory: 8, headlineLimit: 12 });
  console.log(JSON.stringify(items, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
