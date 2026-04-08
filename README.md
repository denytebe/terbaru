# Radar Tren Indonesia

Aplikasi statis untuk memantau:
- Google Trends Indonesia
- Google News Indonesia

Aplikasi ini didesain agar bisa langsung dipublish di GitHub Pages. Data diambil otomatis oleh GitHub Actions setiap 30 menit dan disimpan ke file JSON lokal (`data/*.json`).

## Jalankan Lokal

1. Install dependencies:

```bash
npm install
```

2. Ambil data terbaru:

```bash
npm run fetch-data
```

3. Jalankan server lokal:

```bash
npm run start
```

## Deploy ke GitHub Pages

1. Push repository ini ke GitHub.
2. Buka Settings > Pages.
3. Pada Build and deployment:
   - Source: `Deploy from a branch`
   - Branch: `main` (atau branch default kamu), folder `/ (root)`
4. Simpan.

Setelah aktif, URL GitHub Pages akan menampilkan dashboard `Radar Tren Indonesia`.

## Catatan Teknis

- Sumber Google Trends: browser scraping `https://trends.google.com/trending?geo=ID&hours=24`.
- Sumber Google News: browser scraping dari halaman home + topik Indonesia, dunia, lokal, bisnis, teknologi, hiburan, olahraga, sains, dan kesehatan.
- Jika scraping Google News gagal, aplikasi menampilkan status error pada section News.
- Karena GitHub Pages bersifat statis, proses pengambilan data dilakukan di GitHub Actions, bukan dari browser user (menghindari kendala CORS).
