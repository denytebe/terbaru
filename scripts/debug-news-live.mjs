/**
 * Script diagnostik untuk dijalankan di server live ketika Google News scraping gagal.
 * Jalankan: node scripts/debug-news-live.mjs
 * Output: info DOM, jumlah cluster, link, aria-label, dan isi <title>
 */
import puppeteer from "puppeteer";
import { writeFile } from "node:fs/promises";

const HOME_URL = "https://news.google.com/home?hl=id&gl=ID&ceid=ID%3Aid";

async function diagnose() {
  console.log("Membuka browser...");

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

    console.log(`Navigasi ke ${HOME_URL} (domcontentloaded)...`);
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    const titleDom = await page.title();
    console.log(`[title] "${titleDom}"`);

    // Tunggu konten
    console.log("Menunggu .PO9Zff atau a[href*='/read/'] (max 20s)...");
    await Promise.race([
      page.waitForSelector(".PO9Zff", { timeout: 20000 }).catch(() => { console.log("  .PO9Zff timeout"); }),
      page.waitForSelector("a[href*='/read/']", { timeout: 20000 }).catch(() => { console.log("  a[href*='/read/'] timeout"); })
    ]);

    const info = await page.evaluate(() => {
      const clustersSpecific = document.querySelectorAll(".PO9Zff.Ccj79.kUVvS").length;
      const clustersBroad = document.querySelectorAll(".PO9Zff").length;
      const readLinks = document.querySelectorAll("a[href*='/read/']").length;
      const ariaLinks = Array.from(document.querySelectorAll("a[href*='/read/']"))
        .filter((a) => (a.getAttribute("aria-label") || "").length > 5).length;

      // Buttons visible (untuk diagnosa cookie consent)
      const buttons = Array.from(document.querySelectorAll("button, [role='button']"))
        .map((b) => (b.textContent || "").trim())
        .filter((t) => t.length > 0 && t.length < 60)
        .slice(0, 15);

      // Sample aria-labels
      const sampleLabels = Array.from(document.querySelectorAll("a[href*='/read/']"))
        .slice(0, 5)
        .map((a) => a.getAttribute("aria-label") || "(empty)");

      // Sample cluster HTML (pertama)
      const firstCluster = document.querySelector(".PO9Zff.Ccj79.kUVvS");
      const firstClusterHtml = firstCluster
        ? firstCluster.innerHTML.slice(0, 400)
        : "(tidak ada)";

      return {
        clustersSpecific,
        clustersBroad,
        readLinks,
        ariaLinks,
        buttons,
        sampleLabels,
        firstClusterHtml,
        bodySnippet: document.body.innerHTML.slice(0, 300)
      };
    });

    console.log("\n=== HASIL DIAGNOSTIK ===");
    console.log(`clusters spesifik (.PO9Zff.Ccj79.kUVvS): ${info.clustersSpecific}`);
    console.log(`clusters luas    (.PO9Zff):                ${info.clustersBroad}`);
    console.log(`a[href*='/read/'] total:                    ${info.readLinks}`);
    console.log(`a[href*='/read/'] dengan aria-label:        ${info.ariaLinks}`);
    console.log(`\nButtons yang terlihat: ${JSON.stringify(info.buttons)}`);
    console.log(`\nSample aria-labels (5 pertama):`);
    info.sampleLabels.forEach((l, i) => console.log(`  [${i}] ${l}`));
    console.log(`\nHTML cluster pertama (400 char):\n${info.firstClusterHtml}`);
    console.log(`\nBody snippet (300 char):\n${info.bodySnippet}`);

    // Simpan screenshot untuk visual check
    await page.screenshot({ path: "debug-news-screenshot.png", fullPage: false });
    console.log("\nScreenshot disimpan: debug-news-screenshot.png");

    // Simpan HTML lengkap jika perlu
    const html = await page.content();
    await writeFile("debug-news-page.html", html, "utf8");
    console.log("HTML penuh disimpan: debug-news-page.html");

  } finally {
    await browser.close();
  }
}

diagnose().catch((error) => {
  console.error("GAGAL:", error.message);
  process.exitCode = 1;
});
