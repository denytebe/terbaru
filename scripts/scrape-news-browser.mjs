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
  const labels = [
    "Got it", "I agree", "Setuju", "Saya setuju",
    "Accept all", "Terima semua", "Agree", "Continue", "Lanjutkan",
    "OK", "Accept"
  ];

  const clicked = await page.evaluate((buttonLabels) => {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    const labelsLower = buttonLabels.map((l) => l.toLowerCase());
    const target = buttons.find((button) =>
      labelsLower.includes((button.textContent || "").trim().toLowerCase())
    );

    if (!target) {
      return false;
    }

    target.click();
    return true;
  }, labels);

  if (clicked) {
    await delay(800);
  }
}

async function scrapeTopicPage(page, category, url, maxPerCategory) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Deteksi blokir / CAPTCHA dari Google
  const pageTitle = await page.title();
  if (/before you continue|unusual traffic|captcha|sorry|verif|blocked/i.test(pageTitle)) {
    throw new Error(`BLOCKED: Google menampilkan halaman blokir — "${pageTitle}". IP server kemungkinan kena rate-limit.`);
  }

  await dismissCookieBanner(page);

  // Tunggu konten JS-rendered muncul — lebih andal dari networkidle2 di server Linux
  await Promise.race([
    page.waitForSelector(".PO9Zff", { timeout: 20000 }).catch(() => null),
    page.waitForSelector('a[href*="/read/"]', { timeout: 20000 }).catch(() => null)
  ]);
  await delay(1200);

  const scraped = await page.evaluate((maxItems) => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

    // Parse aria-label: "Judul - Sumber - X jam lalu" atau "Judul - Sumber - X jam lalu - Oleh Author"
    const parseAriaLabel = (ariaLabel) => {
      const parts = String(ariaLabel || "").split(" - ").map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) return null;

      const title = parts[0];
      // Waktu selalu di parts[1+], dimulai langsung dengan angka (bukan bagian dari judul)
      const timePattern = /^\d+\s*(menit|jam|hari|minggu|bulan|tahun|minute|hour|day|week)/i;
      const pubDateText = parts.slice(1).find((p) => timePattern.test(p)) || "";

      return title.length >= 12 ? { title, pubDateText } : null;
    };

    const result = [];
    const seenTitles = new Set();

    // Tiap .PO9Zff.Ccj79.kUVvS = satu topic cluster (spesifik)
    let clusters = Array.from(document.querySelectorAll(".PO9Zff.Ccj79.kUVvS"));
    const specificCount = clusters.length;

    // Fallback: pakai selector lebih longgar jika selector spesifik gagal
    if (clusters.length === 0) {
      clusters = Array.from(document.querySelectorAll(".PO9Zff"));
    }
    const broadCount = clusters.length;

    // Hitung total a[href*='/read/'] di halaman untuk diagnostik
    const totalReadLinks = document.querySelectorAll("a[href*='/read/']").length;
    let ariaLabelHits = 0;

    for (const cluster of clusters) {
      if (result.length >= maxItems) break;

      // Cari a[href*='/read/'] pertama yang punya aria-label berisi judul
      const allReadLinks = Array.from(cluster.querySelectorAll("a[href*='/read/']"));
      let matched = null;

      for (const a of allReadLinks) {
        const label = a.getAttribute("aria-label") || "";
        if (label) ariaLabelHits++;
        const parsed = parseAriaLabel(label);
        if (parsed && !seenTitles.has(parsed.title)) {
          matched = { anchor: a, ...parsed };
          break;
        }
      }

      if (!matched) continue;

      seenTitles.add(matched.title);
      result.push({
        title: matched.title,
        href: clean(matched.anchor.getAttribute("href") || ""),
        pubDate: "",
        pubDateText: matched.pubDateText
      });
    }

    return {
      items: result,
      _debug: { specificCount, broadCount, totalReadLinks, ariaLabelHits }
    };
  }, maxPerCategory);

  const { items, _debug } = scraped;

  if (items.length === 0) {
    console.warn(
      `[scraper] "${category}" — 0 artikel. clusters_spesifik=${_debug.specificCount}, clusters_fallback=${_debug.broadCount}, read_links=${_debug.totalReadLinks}, aria_hits=${_debug.ariaLabelHits}`
    );
  }

  return {
    items: items.map((item) => ({
      title: item.title,
      link: normalizeUrl(item.href),
      pubDate: item.pubDate,
      pubDateText: item.pubDateText,
      category
    })),
    debug: { category, ..._debug }
  };
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
    const debugInfo = [];

    const headlineResult = await scrapeTopicPage(page, "headline", HOME_URL, headlineLimit);
    allItems.push(...headlineResult.items);
    debugInfo.push(headlineResult.debug);

    for (const category of categories) {
      const result = await scrapeTopicPage(page, category, TOPIC_URLS[category], maxPerCategory);
      allItems.push(...result.items);
      debugInfo.push(result.debug);
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

    // Deteksi kalau semua kategori tidak menghasilkan apapun
    if (unique.length === 0) {
      const debugSamples = debugInfo
        .slice(0, 4)
        .map((d) => `${d.category}(c=${d.specificCount}/${d.broadCount} lnk=${d.totalReadLinks} aria=${d.ariaLabelHits})`)
        .join(", ");

      throw new Error(
        `EMPTY: Semua kategori menghasilkan 0 artikel. Kemungkinan struktur halaman Google News berubah atau selector CSS tidak cocok lagi. [${debugSamples}]`
      );
    }

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
