import express from "express";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const app = express();
const PORT = Number(process.env.PORT || 4173);

const ROOT_DIR = process.cwd();
const DATA_TRENDS = resolve(ROOT_DIR, "data/trends-id.json");
const DATA_NEWS = resolve(ROOT_DIR, "data/news-id.json");
const FETCH_SCRIPT = resolve(ROOT_DIR, "scripts/fetch-data.mjs");
const execFileAsync = promisify(execFile);

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "ciskek123";
const FETCH_COOLDOWN_MS = 60 * 1000;

let lastFetchAt = 0;
let fetchInProgress = false;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.static(ROOT_DIR, {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".json")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    }
  }
}));

function withTimestamp(payload) {
  return {
    ...payload,
    serverTime: new Date().toISOString()
  };
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function runFetcher() {
  await execFileAsync(process.execPath, [FETCH_SCRIPT], {
    cwd: ROOT_DIR,
    windowsHide: true,
    timeout: 180000
  });
}

app.get("/api/data", async (req, res) => {
  try {
    const [trends, news] = await Promise.all([
      readJson(DATA_TRENDS),
      readJson(DATA_NEWS)
    ]);

    res.json(withTimestamp({
      trends,
      news,
      fetchInProgress,
      lastFetchAt: lastFetchAt ? new Date(lastFetchAt).toISOString() : ""
    }));
  } catch (error) {
    res.status(500).json({ error: `Gagal membaca data: ${error.message}` });
  }
});

app.post("/api/refresh", async (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const token = String(req.body?.token || bearer || "");

  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = Date.now();
  if (fetchInProgress) {
    return res.status(409).json({ error: "Refresh sedang berjalan" });
  }

  if (lastFetchAt && now - lastFetchAt < FETCH_COOLDOWN_MS) {
    const waitMs = FETCH_COOLDOWN_MS - (now - lastFetchAt);
    return res.status(429).json({
      error: "Refresh terlalu sering",
      retryAfterSeconds: Math.ceil(waitMs / 1000)
    });
  }

  fetchInProgress = true;
  lastFetchAt = now;

  try {
    await runFetcher();
    const [trends, news] = await Promise.all([
      readJson(DATA_TRENDS),
      readJson(DATA_NEWS)
    ]);

    return res.json(withTimestamp({
      ok: true,
      message: "Data berhasil diperbarui",
      trendsUpdatedAt: trends.lastUpdated || "",
      newsUpdatedAt: news.lastUpdated || ""
    }));
  } catch (error) {
    return res.status(500).json({ error: `Refresh gagal: ${error.message}` });
  } finally {
    fetchInProgress = false;
  }
});

app.get("/api/health", (_req, res) => {
  res.json(withTimestamp({ ok: true }));
});

app.listen(PORT, () => {
  console.log(`Radar Tren server aktif di http://localhost:${PORT}`);
  console.log("Mode self-hosted aktif. Data diambil lewat endpoint /api/data.");
});
