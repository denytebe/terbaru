// ── Password Gate ────────────────────────────────────────────
(function () {
  const GATE_KEY = "radar-tren-auth";
  const gate = document.getElementById("passwordGate");
  if (!gate) return;

  if (sessionStorage.getItem(GATE_KEY) === "1") {
    gate.classList.add("hidden");
    return;
  }

  document.getElementById("gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const val = document.getElementById("gateInput").value;
    if (val === atob("Y2lza2VrMTIz")) {
      sessionStorage.setItem(GATE_KEY, "1");
      gate.classList.add("hidden");
    } else {
      const err = document.getElementById("gateError");
      err.hidden = false;
      document.getElementById("gateInput").value = "";
      document.getElementById("gateInput").focus();
    }
  });
})();

const API_ENDPOINTS = {
  data: "/api/data",
  refresh: "/api/refresh"
};

const ADMIN_TOKEN_SESSION_KEY = "radar-tren-admin-token";

const trendsFormat = document.getElementById("trendsFormat");
const newsFormat = document.getElementById("newsFormat");
const lastUpdatedEl = document.getElementById("lastUpdated");
const refreshButton = document.getElementById("refreshButton");
const emptyStateTemplate = document.getElementById("emptyStateTemplate");
const rawExportOutput = document.getElementById("rawExportOutput");
const copyAllButton = document.getElementById("copyAllButton");
const copyTrendsButton = document.getElementById("copyTrendsButton");
const copyNewsButton = document.getElementById("copyNewsButton");
const copyStatus = document.getElementById("copyStatus");

const NEWS_SECTIONS = [
  "headline",
  "indonesia",
  "dunia",
  "bisnis",
  "teknologi",
  "hiburan",
  "olahraga",
  "sains",
  "kesehatan"
];

const NEWS_HEADLINE_LIMIT = 10;
const NEWS_SECTION_LIMIT = 5;
const NEWS_SECTION_LIMITS = {
  teknologi: 10
};

const NEWS_CATEGORY_SCORING = {
  indonesia: {
    titleKeywords: [
      "indonesia",
      "jakarta",
      "jaktim",
      "jaki",
      "dpr",
      "prabowo",
      "menteri",
      "warga",
      "pemprov",
      "samsat",
      "span",
      "um-ptkin",
      "bgn",
      "ppsu",
      "kepala",
      "tanah abang"
    ],
    sourceKeywords: ["cnn indonesia", "kompas", "detiknews", "tempo", "tribun", "antara"],
    bonus: 0
  },
  dunia: {
    titleKeywords: [
      "iran",
      "israel",
      "amerika",
      "as ",
      "as sepakat",
      "trump",
      "china",
      "rusia",
      "pbb",
      "selat hormuz",
      "arab",
      "teheran",
      "nuklir",
      "timur tengah"
    ],
    sourceKeywords: ["bbc", "reuters", "bloomberg", "metrotvnews"],
    bonus: 0
  },
  bisnis: {
    titleKeywords: [
      "harga",
      "rupiah",
      "ihsg",
      "emiten",
      "utang",
      "fiskal",
      "ekonomi",
      "maskapai",
      "penerbangan",
      "bbm",
      "dolar",
      "insentif",
      "plastik",
      "minyak",
      "saham",
      "garuda",
      "pajak"
    ],
    sourceKeywords: ["detikfinance", "market", "investor", "bisnis", "technoz", "kontan"],
    bonus: 0
  },
  teknologi: {
    titleKeywords: [
      "microsoft",
      "windows",
      "ai",
      "smartphone",
      "iphone",
      "playstation",
      "xbox",
      "game pass",
      "bio-ai",
      "realme",
      "pc",
      "update",
      "ilmuwan kembangkan"
    ],
    sourceKeywords: ["detikinet", "tekno", "gadget", "tech"],
    bonus: 0
  },
  hiburan: {
    titleKeywords: [
      "aktris",
      "album",
      "bts",
      "netizen",
      "sheila",
      "aldi taher",
      "warisan",
      "outfit",
      "chart",
      "artis",
      "ressa",
      "miho"
    ],
    sourceKeywords: ["hot", "showbiz", "seleb", "entertainment"],
    bonus: 0
  },
  olahraga: {
    titleKeywords: [
      "piala",
      "timnas",
      "liga",
      "voli",
      "squad",
      "balapan",
      "susunan pemain",
      "megawati hangestri",
      "erick thohir",
      "bezzecchi",
      "red sparks",
      "aff",
      "olahraga"
    ],
    sourceKeywords: ["sport", "bola", "sports"],
    bonus: 0
  },
  sains: {
    titleKeywords: [
      "astronom",
      "meteor",
      "planet",
      "galaksi",
      "astronaut",
      "bulan",
      "fenomena langit",
      "artemis",
      "langit",
      "kemarau",
      "el nino",
      "iklim"
    ],
    sourceKeywords: ["sains", "science"],
    bonus: 0
  },
  kesehatan: {
    titleKeywords: [
      "imunisasi",
      "campak",
      "vaksin",
      "kanker",
      "papdi",
      "lemak",
      "beef tallow",
      "mmr",
      "glutathione",
      "kesehatan"
    ],
    sourceKeywords: ["health", "sehat"],
    bonus: 0
  }
};

const NEWS_CATEGORY_PRIORITY = [
  "dunia",
  "bisnis",
  "teknologi",
  "olahraga",
  "hiburan",
  "sains",
  "kesehatan",
  "indonesia"
];

const state = {
  trendsItems: [],
  newsItems: [],
  newsLastUpdated: "",
  newsErrorMessage: ""
};

// ── Refresh progress steps ──────────────────────────────────
const REFRESH_STEPS = [
  { afterSeconds: 0,  label: "Memulai scraping..." },
  { afterSeconds: 5,  label: "Mengambil Google Trends..." },
  { afterSeconds: 35, label: "Mengambil Google News..." },
  { afterSeconds: 90, label: "Menyelesaikan proses..." }
];

function getRefreshStepLabel(elapsedSeconds) {
  let label = REFRESH_STEPS[0].label;
  for (const step of REFRESH_STEPS) {
    if (elapsedSeconds >= step.afterSeconds) {
      label = step.label;
    }
  }
  return label;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseTrafficNumber(rawValue) {
  const value = String(rawValue || "").trim().replace(/\+/g, "");
  const match = value.match(/([\d.,]+)\s*([kKmM]?)/);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) {
    return 0;
  }

  const unit = match[2].toUpperCase();
  if (unit === "M") {
    return amount * 1000000;
  }

  if (unit === "K") {
    return amount * 1000;
  }

  return amount;
}

function toTrafficBucket(rawValue) {
  const numeric = parseTrafficNumber(rawValue);
  if (numeric >= 200000) {
    return "200K";
  }
  if (numeric >= 100000) {
    return "100K";
  }
  if (numeric >= 50000) {
    return "50K";
  }
  if (numeric >= 20000) {
    return "20K";
  }
  if (numeric >= 10000) {
    return "10K";
  }
  if (numeric >= 5000) {
    return "5K";
  }
  if (numeric >= 2000) {
    return "2K";
  }
  return "1K";
}

function normalizeTrafficLabel(rawValue) {
  const compact = String(rawValue || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (!compact) {
    return "1K+";
  }

  return compact.endsWith("+") ? compact : `${compact}+`;
}

function toListHtml(items) {
  if (!items.length) {
    return "<ol class=\"format-list\"><li>-</li></ol>";
  }

  return `<ol class="format-list">${items
    .map((item) => `<li>${escapeXml(item.displayTitle || item.title || item.query || "Tanpa judul")}</li>`)
    .join("")}</ol>`;
}

function toNumberedLines(items) {
  if (!items.length) {
    return ["1. -"];
  }

  return items.map(
    (item, index) => `${index + 1}. ${item.displayTitle || item.title || item.query || "Tanpa judul"}`
  );
}

function groupTrendsByBucket(items) {
  const grouped = {};

  items.forEach((item) => {
    const bucket = normalizeTrafficLabel(item.approxTraffic || toTrafficBucket(item.approxTraffic));
    if (!grouped[bucket]) {
      grouped[bucket] = [];
    }
    grouped[bucket].push(item);
  });

  return grouped;
}

function getOrderedTrendVolumes(grouped) {
  return Object.keys(grouped)
    .filter((bucket) => grouped[bucket].length)
    .sort((left, right) => {
      const numericDiff = parseTrafficNumber(right) - parseTrafficNumber(left);
      if (numericDiff !== 0) {
        return numericDiff;
      }

      return left.localeCompare(right);
    });
}

function groupNewsSections(items) {
  const sections = NEWS_SECTIONS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

  const normalizedItems = sortNewsByRecency(items.map(normalizeNewsItem));

  const pools = NEWS_SECTIONS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

  normalizedItems.forEach((item) => {
    const category = detectNewsCategoryFromItem(item);
    if (!pools[category]) {
      pools[category] = [];
    }
    pools[category].push(item);
  });

  sections.headline = (pools.headline || []).slice(0, NEWS_HEADLINE_LIMIT);

  if (sections.headline.length < NEWS_HEADLINE_LIMIT) {
    for (const item of normalizedItems) {
      if (sections.headline.length >= NEWS_HEADLINE_LIMIT) {
        break;
      }

      const key = `${item.displayTitle}|${item.link || ""}`;
      const exists = sections.headline.some((entry) => `${entry.displayTitle}|${entry.link || ""}` === key);
      if (!exists) {
        sections.headline.push(item);
      }
    }
  }

  const usedKeys = new Set(sections.headline.map((item) => `${item.displayTitle}|${item.link || ""}`));

  NEWS_SECTIONS.forEach((section) => {
    if (section === "headline") {
      return;
    }

    const sectionLimit = NEWS_SECTION_LIMITS[section] || NEWS_SECTION_LIMIT;
    const primaryPool = pools[section] || [];

    for (const item of primaryPool) {
      if (sections[section].length >= sectionLimit) {
        break;
      }

      const key = `${item.displayTitle}|${item.link || ""}`;
      if (usedKeys.has(key)) {
        continue;
      }

      usedKeys.add(key);
      sections[section].push(item);
    }

    if (sections[section].length < sectionLimit) {
      for (const item of normalizedItems) {
        if (sections[section].length >= sectionLimit) {
          break;
        }

        const key = `${item.displayTitle}|${item.link || ""}`;
        if (usedKeys.has(key)) {
          continue;
        }

        usedKeys.add(key);
        sections[section].push(item);
      }
    }
  });

  return sections;
}

function buildTrendsText(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "*google trending*\n\n1. -";
  }

  const grouped = groupTrendsByBucket(items);
  const lines = ["*google trending*", ""];

  getOrderedTrendVolumes(grouped).forEach((bucket) => {
    lines.push(`*${bucket}*`, "", ...toNumberedLines(grouped[bucket]), "");
  });

  return lines.join("\n").trim();
}

function buildNewsText(items) {
  if ((!Array.isArray(items) || items.length === 0) && state.newsErrorMessage) {
    return `*googlenews*\n*${formatDateForNewsHeader(state.newsLastUpdated)}*\n\n*status*\n\n1. ${state.newsErrorMessage}`;
  }

  if (!Array.isArray(items) || items.length === 0) {
    return "*googlenews*\n*data kosong*\n\n*headline*\n\n1. -";
  }

  const sections = groupNewsSections(items);
  const lines = ["*googlenews*", `*${formatDateForNewsHeader(state.newsLastUpdated)}*`, ""];

  NEWS_SECTIONS.forEach((section) => {
    lines.push(`*${section}*`, "", ...toNumberedLines(sections[section]), "");
  });

  return lines.join("\n").trim();
}

function setCopyStatus(message, isError = false) {
  if (!copyStatus) {
    return;
  }

  copyStatus.textContent = message;
  copyStatus.style.color = isError ? "#9b2f2f" : "#2f6a4f";
}

async function copyToClipboard(text, successLabel) {
  try {
    await navigator.clipboard.writeText(text);
    setCopyStatus(`Berhasil copy: ${successLabel}`);
  } catch {
    setCopyStatus("Gagal copy otomatis. Silakan copy manual dari kotak teks.", true);
  }
}

function updateRawExportOutput(trendsItems, newsItems) {
  if (!rawExportOutput) {
    return;
  }

  const trendsText = buildTrendsText(trendsItems);
  const newsText = buildNewsText(newsItems);
  rawExportOutput.value = `${trendsText}\n\n${newsText}`;
}

function applyEmptyState(target) {
  target.innerHTML = "";
  target.appendChild(emptyStateTemplate.content.cloneNode(true));
}

function renderTrends(items) {
  trendsFormat.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    applyEmptyState(trendsFormat);
    return;
  }

  const grouped = groupTrendsByBucket(items);

  const groupHtml = getOrderedTrendVolumes(grouped)
    .map(
      (bucket) => `
      <section class="format-group">
        <p class="format-volume">*${bucket}*</p>
        ${toListHtml(grouped[bucket])}
      </section>
    `
    )
    .join("");

  trendsFormat.innerHTML = `
    <p class="format-emph">*google trending*</p>
    ${groupHtml || '<div class="empty-state">Data volume keyword belum tersedia.</div>'}
  `;
}

function formatDateForNewsHeader(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return "tanggal tidak valid";
  }

  return date
    .toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })
    .toLowerCase();
}

function extractNewsSource(title) {
  const parts = String(title || "")
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function cleanNewsTitle(title) {
  const parts = String(title || "")
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return String(title || "").trim();
  }

  return parts[0];
}

function normalizeNewsItem(item) {
  const rawCategory = String(item.category || "").trim().toLowerCase();
  const normalizedCategory = rawCategory === "lokal" ? "indonesia" : rawCategory;
  const parsedTime = new Date(item.pubDate || "");
  const newsTimestamp = Number.isNaN(parsedTime.getTime()) ? 0 : parsedTime.getTime();

  return {
    ...item,
    displayTitle: cleanNewsTitle(item.title),
    sourceName: extractNewsSource(item.title),
    normalizedCategory,
    newsTimestamp
  };
}

function normalizeTime(value) {
  if (!value) {
    return "Belum ada timestamp";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("id-ID", {
        dateStyle: "full",
        timeStyle: "short"
      });
}

function sortNewsByRecency(items) {
  return [...items].sort((left, right) => {
    const timeDiff = (right.newsTimestamp || 0) - (left.newsTimestamp || 0);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return String(left.displayTitle || left.title || "").localeCompare(
      String(right.displayTitle || right.title || "")
    );
  });
}

function pickRoundRobinFromPools(categoryPools, maxItems) {
  const categories = NEWS_SECTIONS.filter((section) => section !== "headline");
  const picked = [];
  const used = new Set();

  while (picked.length < maxItems) {
    let pickedInRound = false;

    categories.forEach((category) => {
      if (picked.length >= maxItems) {
        return;
      }

      const pool = categoryPools[category] || [];
      while (pool.length) {
        const candidate = pool.shift();
        const key = `${candidate.displayTitle}|${candidate.link || ""}`;
        if (used.has(key)) {
          continue;
        }

        used.add(key);
        picked.push(candidate);
        pickedInRound = true;
        break;
      }
    });

    if (!pickedInRound) {
      break;
    }
  }

  return picked;
}

function detectNewsCategoryFromItem(item) {
  if (item.normalizedCategory && NEWS_SECTIONS.includes(item.normalizedCategory)) {
    return item.normalizedCategory;
  }

  const title = String(item.displayTitle || item.title || "").toLowerCase();
  const sourceName = String(item.sourceName || "").toLowerCase();

  const scores = NEWS_CATEGORY_PRIORITY.map((key) => {
    const config = NEWS_CATEGORY_SCORING[key];
    let score = config.bonus;

    config.titleKeywords.forEach((keyword) => {
      if (title.includes(keyword)) {
        score += 3;
      }
    });

    config.sourceKeywords.forEach((keyword) => {
      if (sourceName.includes(keyword)) {
        score += 4;
      }
    });

    if (key === "indonesia" && /(jakarta|prabowo|dpr|warga|pemerintah|indonesia)/.test(title)) {
      score += 2;
    }

    if (key === "dunia" && /(iran|israel|trump|china|rusia|pbb|teheran|hormuz)/.test(title)) {
      score += 2;
    }

    if (key === "bisnis" && /(rupiah|ihsg|minyak|harga|dolar|ekonomi|emiten)/.test(title)) {
      score += 2;
    }

    return { key, score };
  });

  scores.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return NEWS_CATEGORY_PRIORITY.indexOf(left.key) - NEWS_CATEGORY_PRIORITY.indexOf(right.key);
  });

  return scores[0].score > 0 ? scores[0].key : "indonesia";
}

function renderNews(items) {
  newsFormat.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const msg = state.newsErrorMessage;
    let icon = "⚠️";
    if (msg.startsWith("Diblokir")) icon = "🚫";
    else if (msg.startsWith("Timeout")) icon = "⏱️";
    else if (msg.startsWith("Error koneksi")) icon = "🔌";
    else if (msg.startsWith("Tidak ada berita")) icon = "🔍";

    const detail = msg
      ? `<div class="news-error-box"><span class="news-error-icon">${icon}</span><span>${escapeXml(msg)}</span></div>`
      : `<div class="news-error-box"><span class="news-error-icon">ℹ️</span><span>Data belum tersedia. Coba tekan Refresh.</span></div>`;

    newsFormat.innerHTML = `
      <p class="format-emph">*googlenews*</p>
      <p class="format-emph">*${formatDateForNewsHeader(state.newsLastUpdated)}*</p>
      ${detail}
    `;
    return;
  }

  const sections = groupNewsSections(items);

  const body = NEWS_SECTIONS.map((section) => {
    return `
      <section class="format-group">
        <p class="format-emph">*${section}*</p>
        ${toListHtml(sections[section])}
      </section>
    `;
  }).join("");

  newsFormat.innerHTML = `
    <p class="format-emph">*googlenews*</p>
    <p class="format-emph">*${formatDateForNewsHeader(state.newsLastUpdated)}*</p>
    ${body}
  `;
}

function renderFromState() {
  renderTrends(state.trendsItems);
  renderNews(state.newsItems);
  updateRawExportOutput(state.trendsItems, state.newsItems);
}

function setupEvents() {
  if (copyAllButton) {
    copyAllButton.addEventListener("click", () => {
      copyToClipboard(rawExportOutput.value || "", "Semua format");
    });
  }

  if (copyTrendsButton) {
    copyTrendsButton.addEventListener("click", () => {
      copyToClipboard(buildTrendsText(state.trendsItems), "Google Trending");
    });
  }

  if (copyNewsButton) {
    copyNewsButton.addEventListener("click", () => {
      copyToClipboard(buildNewsText(state.newsItems), "Google News");
    });
  }
}

async function fetchJson(path) {
  const url = `${path}${path.includes("?") ? "&" : "?"}_ts=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Gagal mengambil ${path}: ${response.status}`);
  }

  return response.json();
}

async function loadData() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Loading...";

  try {
    const payload = await fetchJson(API_ENDPOINTS.data);
    const trends = payload.trends || {};
    const news = payload.news || {};

    state.trendsItems = Array.isArray(trends.items) ? trends.items : [];
    state.newsItems = Array.isArray(news.items) ? news.items : [];
    state.newsLastUpdated = news.lastUpdated || trends.lastUpdated || "";
    state.newsErrorMessage = typeof news.errorMessage === "string" ? news.errorMessage : "";
    renderFromState();

    const latest = trends.lastUpdated || news.lastUpdated;
    lastUpdatedEl.textContent = `Update terakhir: ${normalizeTime(latest)}`;
  } catch (error) {
    lastUpdatedEl.textContent = `Error: ${error.message}`;
    applyEmptyState(trendsFormat);
    applyEmptyState(newsFormat);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
}

async function requestRefreshFromServer() {
  let token = sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || "";
  if (!token) {
    token = window.prompt("Masukkan ADMIN_TOKEN untuk refresh data terbaru:", "") || "";
    token = token.trim();
    if (!token) {
      throw new Error("Refresh dibatalkan (token kosong)");
    }
    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token);
  }

  const response = await fetch(API_ENDPOINTS.refresh, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
    }
    const retryMsg = payload.retryAfterSeconds ? ` Coba lagi dalam ${payload.retryAfterSeconds} detik.` : "";
    throw new Error((payload.error || `Refresh gagal (${response.status})`) + retryMsg);
  }
}

async function waitForRefreshComplete() {
  const startTime = Date.now();
  const TIMEOUT_MS = 210000;
  const POLL_MS = 2500;

  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const stepLabel = getRefreshStepLabel(elapsed);

      refreshButton.textContent = `${stepLabel} (${elapsed}s)`;
      lastUpdatedEl.textContent = `Refresh berjalan — ${stepLabel} (${elapsed}s)`;

      if (elapsed * 1000 >= TIMEOUT_MS) {
        clearInterval(timer);
        reject(new Error("Refresh timeout (>3 menit)"));
        return;
      }

      try {
        const payload = await fetchJson(API_ENDPOINTS.data);
        if (!payload.fetchInProgress) {
          clearInterval(timer);
          resolve();
        }
      } catch {
        // Abaikan error poll sementara.
      }
    }, POLL_MS);
  });
}

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  refreshButton.textContent = "Memulai...";
  lastUpdatedEl.textContent = "Memulai proses refresh...";

  try {
    await requestRefreshFromServer();
    await waitForRefreshComplete();
    await loadData();
  } catch (error) {
    lastUpdatedEl.textContent = `Error: ${error.message}`;
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
});

setupEvents();
loadData();
