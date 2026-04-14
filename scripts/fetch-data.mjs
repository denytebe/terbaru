import { writeFile } from "node:fs/promises";
import { scrapeTrendingFromBrowser } from "./scrape-trending-browser.mjs";
import { scrapeNewsByTopics } from "./scrape-news-browser.mjs";

const MAX_ITEMS = 15;
const NEWS_PER_SECTION = 10;
const NEWS_HEADLINE_SCRAPE_LIMIT = 15;
const OUTPUT_TRENDS = "data/trends-id.json";
const OUTPUT_NEWS = "data/news-id.json";

const SOURCES = {
  trends: "https://trends.google.com/trending/rss?geo=ID"
};

function decodeHtml(value = "") {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function pickTag(content, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = content.match(regex);
  return match ? decodeHtml(match[1]) : "";
}

function parseItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;

  for (const match of xml.matchAll(itemRegex)) {
    const itemContent = match[1] || "";
    items.push({
      title: pickTag(itemContent, "title"),
      link: pickTag(itemContent, "link"),
      pubDate: pickTag(itemContent, "pubDate"),
      approxTraffic: pickTag(itemContent, "ht:approx_traffic") || pickTag(itemContent, "approx_traffic")
    });
  }

  return items;
}

function parseRelativeDateTextToIso(rawText, nowDate) {
  const source = String(rawText || "").trim().toLowerCase();
  if (!source) {
    return "";
  }

  const match = source.match(/(\d+)\s*(menit|jam|hari|minggu|bulan|tahun|minute|hour|day|week|month|year|m|h|d|w|y)/i);
  if (!match) {
    return "";
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  const unit = match[2].toLowerCase();
  const date = new Date(nowDate);

  if (unit === "menit" || unit === "minute" || unit === "m") {
    date.setMinutes(date.getMinutes() - amount);
  } else if (unit === "jam" || unit === "hour" || unit === "h") {
    date.setHours(date.getHours() - amount);
  } else if (unit === "hari" || unit === "day" || unit === "d") {
    date.setDate(date.getDate() - amount);
  } else if (unit === "minggu" || unit === "week" || unit === "w") {
    date.setDate(date.getDate() - amount * 7);
  } else if (unit === "bulan" || unit === "month") {
    date.setMonth(date.getMonth() - amount);
  } else if (unit === "tahun" || unit === "year" || unit === "y") {
    date.setFullYear(date.getFullYear() - amount);
  } else {
    return "";
  }

  return date.toISOString();
}

async function getFeed(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "radar-tren-id-bot/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch gagal (${response.status}) untuk ${url}`);
  }

  return response.text();
}

async function run() {
  const now = new Date().toISOString();

  let trendsItems;
  let newsItems;
  let newsScrapeOk = true;
  let newsErrorMessage = "";

  try {
    const browserItems = await scrapeTrendingFromBrowser(MAX_ITEMS);
    trendsItems = browserItems.map((item) => ({
      title: item.title,
      link: SOURCES.trends,
      pubDate: now,
      approxTraffic: item.searchVolume,
      started: item.started,
      source: "browser-scrape"
    }));
  } catch (error) {
    console.warn(`Browser scrape gagal, fallback ke RSS: ${error.message}`);

    const trendsXml = await getFeed(SOURCES.trends);
    trendsItems = parseItems(trendsXml)
      .slice(0, MAX_ITEMS)
      .map((item) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        approxTraffic: item.approxTraffic,
        source: "rss-fallback"
      }));
  }

  try {
    const browserNews = await scrapeNewsByTopics({
      maxPerCategory: NEWS_PER_SECTION,
      headlineLimit: NEWS_HEADLINE_SCRAPE_LIMIT
    });
    newsItems = browserNews.map((item) => {
      const derivedPubDate =
        item.pubDate || parseRelativeDateTextToIso(item.pubDateText, now) || now;

      return {
        title: item.title,
        link: item.link,
        pubDate: derivedPubDate,
        pubDateText: item.pubDateText || "",
        category: item.category,
        source: "browser-scrape"
      };
    });
  } catch (error) {
    newsScrapeOk = false;
    const msg = String(error.message || "");

    if (msg.startsWith("BLOCKED:")) {
      newsErrorMessage = `Diblokir Google — ${msg.replace("BLOCKED:", "").trim()} Coba lagi beberapa menit kemudian.`;
    } else if (msg.startsWith("EMPTY:")) {
      newsErrorMessage = `Tidak ada berita ditemukan — ${msg.replace("EMPTY:", "").trim()}`;
    } else if (/timeout/i.test(msg) || /TimeoutError/.test(error.name || "")) {
      newsErrorMessage = `Timeout — Google News terlalu lama merespons (>60 detik). Mungkin koneksi server lambat atau Google sedang membatasi akses.`;
    } else if (/net::|ECONNREFUSED|ENOTFOUND|ERR_NAME/i.test(msg)) {
      newsErrorMessage = `Error koneksi — Tidak bisa menjangkau Google News. Periksa koneksi internet server. (${msg})`;
    } else {
      newsErrorMessage = `Gagal mengambil Google News — ${msg}`;
    }

    console.warn("[news-error]", newsErrorMessage);
    newsItems = [];
  }

  await writeFile(
    OUTPUT_TRENDS,
    `${JSON.stringify({ source: "google-trends-id", lastUpdated: now, items: trendsItems }, null, 2)}\n`,
    "utf8"
  );

  await writeFile(
    OUTPUT_NEWS,
    `${JSON.stringify(
      {
        source: "google-news-id-browser",
        lastUpdated: now,
        scrapeOk: newsScrapeOk,
        errorMessage: newsErrorMessage,
        items: newsItems
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`Data updated: trends=${trendsItems.length}, news=${newsItems.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
