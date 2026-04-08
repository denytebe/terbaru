// ── Password Gate ────────────────────────────────────────────
(function () {
  const GATE_KEY = "radar-tren-auth";
  const gate = document.getElementById("passwordGate");
  if (!gate) return;

  // Cek apakah sudah pernah login di sesi ini
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

const DATA_PATHS = {
  trends: "./data/trends-id.json",
  news: "./data/news-id.json"
};

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
const customFilterInput = document.getElementById("customFilter");
const savePresetButton = document.getElementById("savePresetButton");
const favoriteKeywords = document.getElementById("favoriteKeywords");
const chipButtons = Array.from(document.querySelectorAll(".chip"));
const dailyChart = document.getElementById("dailyChart");
const newsChart = document.getElementById("newsChart");
const combinedChart = document.getElementById("combinedChart");
const combinedChartCard = document.getElementById("combinedChartCard");
const overlayToggle = document.getElementById("overlayToggle");
const chartTooltip = document.getElementById("chartTooltip");
const rawExportOutput = document.getElementById("rawExportOutput");
const copyAllButton = document.getElementById("copyAllButton");
const copyTrendsButton = document.getElementById("copyTrendsButton");
const copyNewsButton = document.getElementById("copyNewsButton");
const copyStatus = document.getElementById("copyStatus");

const STORAGE_KEY = "radar-tren-filter-v1";

const PRESET_FILTERS = {
  all: [],
  politik: ["politik", "presiden", "dpr", "pemerintah", "pilkada", "menteri"],
  ekonomi: ["ekonomi", "inflasi", "pajak", "rupiah", "saham", "investasi", "garuda"],
  bola: ["bola", "liga", "sepak", "fifa", "piala", "timnas", "eredivisie"]
};

const state = {
  trendsItems: [],
  newsItems: [],
  newsLastUpdated: "",
  newsErrorMessage: "",
  activePreset: "all",
  customKeyword: "",
  favoriteKeywords: [],
  overlayEnabled: false
};

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

function applyEmptyState(target) {
  target.innerHTML = "";
  target.appendChild(emptyStateTemplate.content.cloneNode(true));
}

function saveFilterState() {
  try {
    const favorites = state.favoriteKeywords
      .map((keyword) => String(keyword || "").trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activePreset: state.activePreset,
        customKeyword: state.customKeyword,
        favoriteKeywords: favorites,
        overlayEnabled: state.overlayEnabled
      })
    );
  } catch {
    // Abaikan error storage agar UI tetap berjalan.
  }
}

function loadFilterState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    const presetExists = Object.prototype.hasOwnProperty.call(
      PRESET_FILTERS,
      parsed.activePreset
    );
    state.activePreset = presetExists ? parsed.activePreset : "all";
    state.customKeyword = String(parsed.customKeyword || "").trim().toLowerCase();
    state.favoriteKeywords = Array.isArray(parsed.favoriteKeywords)
      ? parsed.favoriteKeywords
          .map((keyword) => String(keyword || "").trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    state.overlayEnabled = Boolean(parsed.overlayEnabled);
  } catch {
    // Abaikan state invalid.
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getActiveKeywords() {
  const presetKeywords = PRESET_FILTERS[state.activePreset] || [];
  const custom = state.customKeyword.trim().toLowerCase();
  return custom ? [custom] : presetKeywords;
}

function includesKeyword(text, keywords) {
  if (!keywords.length) {
    return true;
  }

  const source = String(text || "").toLowerCase();
  return keywords.some((keyword) => source.includes(keyword));
}

function applyFilters(items) {
  const keywords = getActiveKeywords();
  return items.filter((item) => includesKeyword(item.title || item.query, keywords));
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

  if ((!Array.isArray(items) || items.length === 0) && state.newsErrorMessage) {
    newsFormat.innerHTML = `
      <p class="format-emph">*googlenews*</p>
      <p class="format-emph">*${formatDateForNewsHeader(state.newsLastUpdated)}*</p>
      <section class="format-group">
        <p class="format-emph">*status*</p>
        <ol class="format-list"><li>${escapeXml(state.newsErrorMessage)}</li></ol>
      </section>
    `;
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    applyEmptyState(newsFormat);
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

function getHourlyCounts(items) {
  const counts = Array(24).fill(0);
  const localToday = new Date().toLocaleDateString("id-ID");

  items.forEach((item) => {
    const date = new Date(item.pubDate || item.published || item.time || "");
    if (Number.isNaN(date.getTime())) {
      return;
    }

    if (date.toLocaleDateString("id-ID") !== localToday) {
      return;
    }

    counts[date.getHours()] += 1;
  });

  return counts;
}

function pointsFromCounts(counts, width, height, padding, maxCount) {
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const step = chartW / 23;

  return counts.map((count, hour) => {
    const x = padding.left + hour * step;
    const y = padding.top + chartH - (count / maxCount) * chartH;
    return { x, y, count, hour };
  });
}

function renderHourlyChart(svg, items, config) {
  if (!svg) {
    return;
  }

  const counts = getHourlyCounts(items);

  const maxCount = Math.max(...counts, 1);
  const width = 780;
  const height = 260;
  const padding = { top: 20, right: 16, bottom: 38, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const slotW = chartW / 24;
  const barW = Math.max(slotW - 4, 4);

  const bars = counts
    .map((count, hour) => {
      const x = padding.left + hour * slotW + (slotW - barW) / 2;
      const barHeight = (count / maxCount) * chartH;
      const y = padding.top + (chartH - barHeight);
      const labelNeeded = hour % 3 === 0;

      return `
        <rect class="tooltip-node bar" data-series="${config.series}" data-hour="${hour}" data-count="${count}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="3" fill="${config.color}"></rect>
        ${
          labelNeeded
            ? `<text x="${(x + barW / 2).toFixed(2)}" y="${height - 12}" text-anchor="middle" fill="#7a6a59" font-size="11">${hour.toString().padStart(2, "0")}</text>`
            : ""
        }
      `;
    })
    .join("");

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((scale) => {
      const y = padding.top + chartH * scale;
      return `<line x1="${padding.left}" y1="${y.toFixed(2)}" x2="${width - padding.right}" y2="${y.toFixed(2)}" stroke="#efdfcf" stroke-dasharray="4 4" />`;
    })
    .join("");

  const title = `${config.titlePrefix}: ${counts.reduce((acc, n) => acc + n, 0)} item`;

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${gridLines}
    ${bars}
    <text x="${padding.left}" y="14" fill="#5e4f41" font-size="12" font-weight="600">${escapeXml(title)}</text>
  `;
}

function renderCombinedOverlayChart(trendsItems, newsItems) {
  if (!combinedChart) {
    return;
  }

  const trendsCounts = getHourlyCounts(trendsItems);
  const newsCounts = getHourlyCounts(newsItems);

  const maxCount = Math.max(...trendsCounts, ...newsCounts, 1);
  const width = 780;
  const height = 260;
  const padding = { top: 20, right: 16, bottom: 38, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const trendsPoints = pointsFromCounts(trendsCounts, width, height, padding, maxCount);
  const newsPoints = pointsFromCounts(newsCounts, width, height, padding, maxCount);

  const toPolyline = (points) => points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

  const pointNodes = (points, series, color) =>
    points
      .map(
        (point) => `
      <circle class="tooltip-node point-node" data-series="${series}" data-hour="${point.hour}" data-count="${point.count}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.8" fill="${color}" />
    `
      )
      .join("");

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((scale) => {
      const y = padding.top + chartH * scale;
      return `<line x1="${padding.left}" y1="${y.toFixed(2)}" x2="${width - padding.right}" y2="${y.toFixed(2)}" stroke="#efdfcf" stroke-dasharray="4 4" />`;
    })
    .join("");

  const hourLabels = Array.from({ length: 24 }, (_, hour) => {
    if (hour % 3 !== 0) {
      return "";
    }

    const x = padding.left + (hour / 23) * chartW;
    return `<text x="${x.toFixed(2)}" y="${height - 12}" text-anchor="middle" fill="#7a6a59" font-size="11">${hour.toString().padStart(2, "0")}</text>`;
  }).join("");

  combinedChart.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${gridLines}
    <polyline class="line-series" points="${toPolyline(trendsPoints)}" stroke="#cf5e3c"></polyline>
    <polyline class="line-series" points="${toPolyline(newsPoints)}" stroke="#95622a"></polyline>
    ${pointNodes(trendsPoints, "trends", "#cf5e3c")}
    ${pointNodes(newsPoints, "news", "#95622a")}
    ${hourLabels}
    <text x="${padding.left}" y="14" fill="#5e4f41" font-size="12" font-weight="600">Overlay perbandingan per jam (hari ini)</text>
  `;
}

function hideTooltip() {
  if (!chartTooltip) {
    return;
  }

  chartTooltip.hidden = true;
}

function showTooltip(event, rect) {
  if (!chartTooltip || !rect) {
    return;
  }

  const series = rect.dataset.series === "news" ? "Google News" : "Google Trends";
  const hour = String(rect.dataset.hour || "0").padStart(2, "0");
  const count = rect.dataset.count || "0";

  chartTooltip.textContent = `${series} | ${hour}:00 = ${count} item`;
  chartTooltip.hidden = false;

  const margin = 10;
  const rectBox = chartTooltip.getBoundingClientRect();
  const desiredX = event.clientX + 12;
  const desiredY = event.clientY + 12;

  const maxX = window.innerWidth - rectBox.width - margin;
  const maxY = window.innerHeight - rectBox.height - margin;

  const left = Math.max(margin, Math.min(desiredX, maxX));
  const top = Math.max(margin, Math.min(desiredY, maxY));

  chartTooltip.style.left = `${left}px`;
  chartTooltip.style.top = `${top}px`;
}

function setupChartTooltip(svg) {
  if (!svg) {
    return;
  }

  svg.addEventListener("pointermove", (event) => {
    const target = event.target;
    if (!(target instanceof SVGElement) || !target.classList.contains("tooltip-node")) {
      hideTooltip();
      return;
    }

    showTooltip(event, target);
  });

  svg.addEventListener("pointerleave", hideTooltip);
}

function renderFavoriteKeywords() {
  if (!favoriteKeywords) {
    return;
  }

  favoriteKeywords.innerHTML = "";

  if (!state.favoriteKeywords.length) {
    const empty = document.createElement("span");
    empty.className = "favorite-empty";
    empty.textContent = "Belum ada preset favorit.";
    favoriteKeywords.appendChild(empty);
    return;
  }

  state.favoriteKeywords.forEach((keyword) => {
    const chip = document.createElement("div");
    chip.className = "favorite-chip";

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "mini-button";
    applyBtn.dataset.action = "apply";
    applyBtn.dataset.keyword = keyword;
    applyBtn.textContent = keyword;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.dataset.action = "remove";
    removeBtn.dataset.keyword = keyword;
    removeBtn.setAttribute("aria-label", `Hapus preset ${keyword}`);
    removeBtn.textContent = "x";

    chip.appendChild(applyBtn);
    chip.appendChild(removeBtn);
    favoriteKeywords.appendChild(chip);
  });
}

function addFavoriteKeyword(keyword) {
  const normalized = String(keyword || "").trim().toLowerCase();
  if (!normalized) {
    return;
  }

  if (state.favoriteKeywords.includes(normalized)) {
    return;
  }

  state.favoriteKeywords.unshift(normalized);
  state.favoriteKeywords = state.favoriteKeywords.slice(0, 8);
  saveFilterState();
  renderFavoriteKeywords();
}

function removeFavoriteKeyword(keyword) {
  state.favoriteKeywords = state.favoriteKeywords.filter((entry) => entry !== keyword);
  saveFilterState();
  renderFavoriteKeywords();
}

function setOverlayState(enabled) {
  state.overlayEnabled = Boolean(enabled);
  if (combinedChartCard) {
    combinedChartCard.hidden = !state.overlayEnabled;
  }
  if (overlayToggle) {
    overlayToggle.setAttribute("aria-pressed", String(state.overlayEnabled));
    overlayToggle.textContent = state.overlayEnabled ? "Matikan Overlay" : "Aktifkan Overlay";
  }
}

function renderFromState() {
  const filteredTrends = applyFilters(state.trendsItems);
  const filteredNews = applyFilters(state.newsItems);

  renderTrends(filteredTrends);
  renderNews(filteredNews);
  updateRawExportOutput(filteredTrends, filteredNews);
  renderHourlyChart(dailyChart, filteredTrends, {
    color: "#cf5e3c",
    series: "trends",
    titlePrefix: "Topik Trends hari ini"
  });
  renderHourlyChart(newsChart, filteredNews, {
    color: "#95622a",
    series: "news",
    titlePrefix: "Topik News hari ini"
  });
  renderCombinedOverlayChart(filteredTrends, filteredNews);
  setOverlayState(state.overlayEnabled);
}

function activateChip(chip) {
  chipButtons.forEach((button) => button.classList.remove("active"));
  chip.classList.add("active");
}

function setupFilterEvents() {
  chipButtons.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.activePreset = chip.dataset.filter || "all";
      state.customKeyword = "";
      customFilterInput.value = "";
      activateChip(chip);
      saveFilterState();
      renderFromState();
    });
  });

  customFilterInput.addEventListener("input", () => {
    state.customKeyword = customFilterInput.value.trim().toLowerCase();
    state.activePreset = "all";
    const allChip = chipButtons.find((button) => button.dataset.filter === "all");
    if (allChip) {
      activateChip(allChip);
    }
    saveFilterState();
    renderFromState();
  });

  if (savePresetButton) {
    savePresetButton.addEventListener("click", () => {
      addFavoriteKeyword(customFilterInput.value);
    });
  }

  if (favoriteKeywords) {
    favoriteKeywords.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const action = target.dataset.action;
      const keyword = String(target.dataset.keyword || "").trim().toLowerCase();
      if (!keyword) {
        return;
      }

      if (action === "remove") {
        removeFavoriteKeyword(keyword);
        return;
      }

      if (action === "apply") {
        state.customKeyword = keyword;
        state.activePreset = "all";
        customFilterInput.value = keyword;
        const allChip = chipButtons.find((button) => button.dataset.filter === "all");
        if (allChip) {
          activateChip(allChip);
        }
        saveFilterState();
        renderFromState();
      }
    });
  }

  if (overlayToggle) {
    overlayToggle.addEventListener("click", () => {
      setOverlayState(!state.overlayEnabled);
      saveFilterState();
    });
  }

  if (copyAllButton) {
    copyAllButton.addEventListener("click", () => {
      copyToClipboard(rawExportOutput.value || "", "Semua format");
    });
  }

  if (copyTrendsButton) {
    copyTrendsButton.addEventListener("click", () => {
      copyToClipboard(buildTrendsText(applyFilters(state.trendsItems)), "Google Trending");
    });
  }

  if (copyNewsButton) {
    copyNewsButton.addEventListener("click", () => {
      copyToClipboard(buildNewsText(applyFilters(state.newsItems)), "Google News");
    });
  }
}

function applyFilterStateToUI() {
  customFilterInput.value = state.customKeyword;
  const activeChip = chipButtons.find((button) => button.dataset.filter === state.activePreset);
  if (activeChip) {
    activateChip(activeChip);
  }
  setOverlayState(state.overlayEnabled);
  renderFavoriteKeywords();
}

async function fetchJson(path) {
  // Add a cache-busting query to avoid stale CDN/browser JSON responses.
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
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
    }
    throw new Error(payload.error || `Refresh gagal (${response.status})`);
  }
}

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing...";

  try {
    await requestRefreshFromServer();
    await loadData();
  } catch (error) {
    lastUpdatedEl.textContent = `Error: ${error.message}`;
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
});
loadFilterState();
applyFilterStateToUI();
setupFilterEvents();
setupChartTooltip(dailyChart);
setupChartTooltip(newsChart);
setupChartTooltip(combinedChart);
loadData();
