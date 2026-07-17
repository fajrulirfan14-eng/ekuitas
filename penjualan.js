// idb
const PENJUALAN_IDB_NAME = "penjualanCacheDB";
const PENJUALAN_IDB_STORE = "cache";
function penjualanOpenIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PENJUALAN_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PENJUALAN_IDB_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function penjualanIdbSet(key, value) {
  try {
    const db = await penjualanOpenIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(PENJUALAN_IDB_STORE, "readwrite");
      tx.objectStore(PENJUALAN_IDB_STORE).put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
async function penjualanIdbGet(key) {
  try {
    const db = await penjualanOpenIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(PENJUALAN_IDB_STORE, "readonly");
      const req = tx.objectStore(PENJUALAN_IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

const bulanList = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const hariList = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
];

function penjualanFormatTanggal(tanggalStr) {
  const [tahun, bulan, tgl] = tanggalStr.split("-").map(Number);
  const dateObj = new Date(tahun, bulan - 1, tgl);
  const namaHari  = hariList[dateObj.getDay()];
  const namaBulan = bulanList[bulan - 1];
  return `${namaHari}, ${tgl} ${namaBulan}`;
}

let penjualanSelectedBulan = new Date().getMonth();
let penjualanSelectedTahun = new Date().getFullYear();
let penjualanTempBulan = penjualanSelectedBulan;
let penjualanTempTahun = penjualanSelectedTahun;
let penjualanSheetInitialized = false;
let penjualanLoading = false;
let penjualanLastError = null;

const penjualanCache = new Map();
const dualChartPointsMap = {};
const dualChartListenerAttached = {};
const PENJUALAN_INSIGHT_POOL = {
  naik: [
    "Penjualan lagi naik {pct}% dibanding minggu lalu 📈",
    "Terpantau penjualan meningkat {pct}% dari minggu sebelumnya",
    "Kabar baik, penjualan naik {pct}% minggu ini",
    "Penjualan menunjukkan tren positif, naik {pct}% dibanding pekan lalu",
    "Grafik penjualan lagi hijau, naik {pct}% dari minggu kemarin"
  ],
  turun: [
    "Penjualan turun {pct}% dibanding minggu lalu",
    "Terpantau penjualan melambat {pct}% dari minggu sebelumnya",
    "Penjualan sedikit menurun, turun {pct}% minggu ini",
    "Grafik penjualan melandai, turun {pct}% dibanding pekan lalu"
  ],
  stabil: [
    "Penjualan relatif stabil dibanding minggu lalu",
    "Tidak ada perubahan signifikan pada penjualan minggu ini",
    "Penjualan cenderung stabil dibanding pekan sebelumnya"
  ]
};
const NONJUAL_INSIGHT_POOL = {
  naik: [
    "tapi kerugian dari barang tidak terjual naik {pct}%, perlu diwaspadai",
    "sayangnya Non Jual (barang kebuang) ikut naik {pct}%",
    "namun kerugian Non Jual meningkat {pct}% dari minggu lalu",
    "di sisi lain, barang tidak terjual naik {pct}%, ini perlu perhatian"
  ],
  turun: [
    "dan kerugian dari barang tidak terjual berkurang {pct}%, kabar baik",
    "Non Jual (barang kebuang) juga menurun {pct}%, makin efisien",
    "kerugian Non Jual berhasil ditekan {pct}% dari minggu lalu",
    "barang tidak terjual pun berkurang {pct}%, kinerja makin baik"
  ],
  stabil: [
    "kerugian dari Non Jual masih di level yang sama",
    "barang tidak terjual relatif tidak berubah",
    "Non Jual masih stabil, belum ada perbaikan berarti"
  ]
};
const RASIO_NONJUAL_POOL = {
  aman: [
    "Rasio Non Jual masih di bawah 3%, sangat sehat.",
    "Non Jual cuma sekitar {pct}% dari penjualan, kinerja bagus.",
    "Rasio kerugian terkendali baik, hanya {pct}% dari total penjualan.",
    "Barang tidak terjual cuma {pct}%, aman terkendali."
  ],
  cukup: [
    "Rasio Non Jual sekitar {pct}% dari penjualan, masih dalam batas wajar.",
    "Non Jual berada di {pct}% dari penjualan, cukup terkendali.",
    "Rasio kerugian {pct}%, masih bisa dikelola dengan baik."
  ],
  waspada: [
    "Rasio Non Jual mencapai {pct}% dari penjualan, perlu diperhatikan.",
    "Non Jual sudah {pct}% dari penjualan, mulai perlu diwaspadai.",
    "Rasio kerugian {pct}% cukup tinggi, sebaiknya dievaluasi.",
    "Waspada, barang tidak terjual sudah {pct}% dari total penjualan."
  ],
  kritis: [
    "Rasio Non Jual sudah {pct}% dari penjualan, ini kerugian besar!",
    "Perhatian, {pct}% penjualan hilang jadi Non Jual, perlu tindakan segera.",
    "Rasio kerugian {pct}% tergolong tinggi, butuh evaluasi serius.",
    "Non Jual menyentuh {pct}% dari penjualan, dampaknya signifikan ke keuntungan."
  ]
};

function penjualanKlasifikasiRasio(pct) {
  if (pct >= 10) return "kritis";
  if (pct >= 5) return "waspada";
  if (pct >= 3) return "cukup";
  return "aman";
}
function penjualanPickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function penjualanKlasifikasiTrend(pct) {
  if (pct > 5) return "naik";
  if (pct < -5) return "turun";
  return "stabil";
}
function penjualanHitungPct(recent, prev) {
  if (prev === 0) return recent > 0 ? 100 : 0;
  return ((recent - prev) / prev) * 100;
}
function generatePenjualanInsight(data) {
  if (!data || data.length < 4) {
    return penjualanPickRandom([
      "Belum cukup data untuk melihat tren minggu ini.",
      "Data masih sedikit, tren belum bisa dianalisis.",
      "Menunggu lebih banyak data buat lihat tren penjualan."
    ]);
  }

  let recentSet, prevSet;
  if (data.length >= 14) {
    recentSet = data.slice(-7);
    prevSet   = data.slice(-14, -7);
  } else {
    const half = Math.floor(data.length / 2);
    recentSet = data.slice(half);
    prevSet   = data.slice(0, half);
  }

  const sum = (arr, key) => arr.reduce((s, d) => s + (Number(d[key]) || 0), 0);

  const recentPenjualan = sum(recentSet, "penjualan");
  const prevPenjualan   = sum(prevSet, "penjualan");
  const recentNonJual   = sum(recentSet, "nonJual");
  const prevNonJual     = sum(prevSet, "nonJual");

  const pctPenjualan = penjualanHitungPct(recentPenjualan, prevPenjualan);
  const pctNonJual   = penjualanHitungPct(recentNonJual, prevNonJual);

  const trendPenjualan = penjualanKlasifikasiTrend(pctPenjualan);
  const trendNonJual   = penjualanKlasifikasiTrend(pctNonJual);

  const klausaPenjualan = penjualanPickRandom(PENJUALAN_INSIGHT_POOL[trendPenjualan])
    .replace("{pct}", Math.abs(pctPenjualan).toFixed(0));
  const klausaNonJual = penjualanPickRandom(NONJUAL_INSIGHT_POOL[trendNonJual])
    .replace("{pct}", Math.abs(pctNonJual).toFixed(0));
  const klausaNonJualLower = klausaNonJual.charAt(0).toLowerCase() + klausaNonJual.slice(1);

  const rasioPct = recentPenjualan > 0 ? (recentNonJual / recentPenjualan) * 100 : 0;
  const rasioTier = penjualanKlasifikasiRasio(rasioPct);
  const klausaRasio = penjualanPickRandom(RASIO_NONJUAL_POOL[rasioTier])
    .replace("{pct}", rasioPct.toFixed(1));

  return `${klausaPenjualan}, ${klausaNonJualLower}. ${klausaRasio}`;
}
function renderPenjualanInsight(elId, data) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = generatePenjualanInsight(data);
}
function drawPenjualanNonJualChart(canvasId, tooltipId, emptyElId, data) {
  const canvas  = document.getElementById(canvasId);
  const emptyEl = document.getElementById(emptyElId);
  if (!canvas) return;

  if (!data || data.length === 0) {
    canvas.style.display = "none";
    if (emptyEl) emptyEl.style.display = "block";
    return;
  }
  canvas.style.display = "block";
  if (emptyEl) emptyEl.style.display = "none";

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const W = rect.width, H = rect.height, padding = 24;
  const baseY = H - padding;

  const penjualanVals = data.map(d => d.penjualan || 0);
  const nonJualVals   = data.map(d => d.nonJual || 0);
  const allVals = [...penjualanVals, ...nonJualVals, 0];
  const maxVal = Math.max(...allVals);
  const minVal = Math.min(...allVals);
  const range  = (maxVal - minVal) || 1;

  const stepX = (W - padding * 2) / (data.length - 1 || 1);

  const style = getComputedStyle(document.documentElement);
  const colorPenjualan = style.getPropertyValue("--accent").trim() || "#b3874f";
  const colorNonJual   = "#c2410c";

  function buildPoints(vals) {
    return vals.map((v, i) => {
      const x = padding + i * stepX;
      const y = H - padding - ((v - minVal) / range) * (H - padding * 2);
      return { x, y, value: v };
    });
  }

  const penjualanPoints = buildPoints(penjualanVals);
  const nonJualPoints   = buildPoints(nonJualVals);

  // path smooth pakai quadratic curve lewat titik tengah tiap 2 titik
  function tracePath(points) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    if (points.length > 1) {
      const last = points.length - 1;
      ctx.quadraticCurveTo(points[last - 1].x, points[last - 1].y, points[last].x, points[last].y);
    }
  }

  function drawFilledArea(points, color) {
    ctx.beginPath();
    tracePath(points);
    ctx.lineTo(points[points.length - 1].x, baseY);
    ctx.lineTo(points[0].x, baseY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padding, 0, baseY);
    grad.addColorStop(0, color + "40"); // ~25% alpha
    grad.addColorStop(1, color + "00"); // transparan
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function drawSmoothLine(points, color) {
    ctx.beginPath();
    tracePath(points);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawLabels() {
    ctx.fillStyle = style.getPropertyValue("--text-muted").trim() || "#999";
    ctx.font = "9px Poppins, sans-serif";
    ctx.textAlign = "center";
    const labelStep = Math.max(1, Math.ceil(data.length / 8));
    data.forEach((d, i) => {
      if (i % labelStep !== 0) return;
      const tglNum = d.tanggal.split("-")[2];
      ctx.fillText(String(Number(tglNum)), penjualanPoints[i].x, H - 6);
    });
  }

  function renderFrame(progress) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    const clipX = padding + (W - padding * 2) * progress;
    ctx.beginPath();
    ctx.rect(0, 0, clipX, H);
    ctx.clip();

    drawFilledArea(nonJualPoints, colorNonJual);
    drawFilledArea(penjualanPoints, colorPenjualan);
    drawSmoothLine(nonJualPoints, colorNonJual);
    drawSmoothLine(penjualanPoints, colorPenjualan);
    ctx.restore();

    drawLabels();
  }

  // animasi "muncul" dari kiri ke kanan, ~600ms
  let start = null;
  const duration = 600;
  function step(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(1, elapsed / duration);
    renderFrame(progress);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  dualChartPointsMap[canvasId] = { penjualanPoints, nonJualPoints, data };

  if (!dualChartListenerAttached[canvasId]) {
    canvas.addEventListener("click", (e) => handleDualChartClick(e, canvasId, tooltipId));
    dualChartListenerAttached[canvasId] = true;
  }
}
function handleDualChartClick(e, canvasId, tooltipId) {
  const canvas  = document.getElementById(canvasId);
  const tooltip = document.getElementById(tooltipId);
  const stored  = dualChartPointsMap[canvasId];
  if (!canvas || !tooltip || !stored) return;

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  let nearestIdx = null;
  let minDist = Infinity;
  stored.penjualanPoints.forEach((p, i) => {
    const dist = Math.hypot(p.x - clickX, p.y - clickY);
    if (dist < minDist) { minDist = dist; nearestIdx = i; }
  });
  stored.nonJualPoints.forEach((p, i) => {
    const dist = Math.hypot(p.x - clickX, p.y - clickY);
    if (dist < minDist) { minDist = dist; nearestIdx = i; }
  });

  if (nearestIdx === null || minDist > 30) {
    tooltip.classList.remove("visible");
    return;
  }

  const d = stored.data[nearestIdx];
  const p = stored.penjualanPoints[nearestIdx];

  tooltip.innerHTML = `
    <span class="investor-penjualan-chart-tooltip-periode">${penjualanFormatTanggal(d.tanggal)}</span>
    <span class="investor-penjualan-chart-tooltip-value">Penjualan: ${penjualanFormatAngka(d.penjualan)}</span>
    <span class="investor-penjualan-chart-tooltip-value">Non Jual: ${penjualanFormatAngka(d.nonJual)}</span>
  `;
  tooltip.style.left = `${p.x}px`;
  tooltip.style.top  = `${p.y}px`;
  tooltip.classList.add("visible");
}
window.drawPenjualanNonJualChart = drawPenjualanNonJualChart;
window.renderPenjualanInsight = renderPenjualanInsight;
window.drawReturnChart = drawReturnChart;

function penjualanTrimSampaiHariIni(data, bulan, tahun) {
  const now = new Date();
  if (bulan !== now.getMonth() || tahun !== now.getFullYear()) return data;

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return data.filter(d => d.tanggal <= todayStr);
}
function penjualanUpdateFilterLabel() {
  document.getElementById("penjualanFilterLabel").textContent =
    `${bulanList[penjualanSelectedBulan]} ${penjualanSelectedTahun}`;
}
function penjualanFormatAngka(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

function penjualanSumDoc(data) {
  let total = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key === "tanggal" || key === "idCabang" || key === "createdBy") continue;
    if (
      value &&
      typeof value === "object" &&
      typeof value.pembayaran === "object" &&
      typeof value.pembayaran.closing === "object"
    ) {
      const closing = value.pembayaran.closing;
      for (const v of Object.values(closing)) {
        const num = Number(v);
        if (!isNaN(num)) total += num;
      }
    }
  }
  return total;
}
function penjualanSumNonJual(data) {
  let total = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key === "tanggal" || key === "idCabang" || key === "createdBy") continue;
    if (!value || typeof value !== "object") continue;

    if (value.fee && typeof value.fee === "object") {
      for (const v of Object.values(value.fee)) {
        const num = Number(v);
        if (!isNaN(num)) total += num;
      }
    }

    if (value.offFlavor && typeof value.offFlavor === "object") {
      for (const v of Object.values(value.offFlavor)) {
        const num = Number(v);
        if (!isNaN(num)) total += num;
      }
    }

    if (value.distribusi && typeof value.distribusi === "object" && value.distribusi.expired && typeof value.distribusi.expired === "object") {
      for (const [expiredKey, v] of Object.entries(value.distribusi.expired)) {
        if (expiredKey === "margin") continue;
        const num = Number(v);
        if (!isNaN(num)) total += num;
      }
    }
  }
  return total;
}

async function penjualanGetAdminUid() {
  const idCabang = window.currentUser?.idCabang;
  if (!idCabang) return null;

  const cacheKey = `adminUid_${idCabang}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  const q = window.query(
    window.collection(window.db, "users"),
    window.where("role", "==", "adminCabang"),
    window.where("idCabang", "==", idCabang)
  );

  const snap = await window.getDocs(q);
  if (snap.empty) return null;

  if (snap.size > 1) {
    console.warn(`Ditemukan ${snap.size} akun adminCabang untuk idCabang ${idCabang}. Memakai yang pertama.`);
  }

  const uid = snap.docs[0].id;
  localStorage.setItem(cacheKey, uid);
  return uid;
}
async function penjualanFetchData(bulan, tahun) {
  const adminUid = await penjualanGetAdminUid();
  if (!adminUid) return [];

  const bulanStr = String(bulan + 1).padStart(2, "0");
  const daysInMonth = new Date(tahun, bulan + 1, 0).getDate();
  const startDate = `${tahun}-${bulanStr}-01`;
  const endDate = `${tahun}-${bulanStr}-${String(daysInMonth).padStart(2, "0")}`;

  const q = window.query(
    window.collection(window.db, "users", adminUid, "laporanAdmin"),
    window.where("tanggal", ">=", startDate),
    window.where("tanggal", "<=", endDate)
  );

  const snap = await window.getDocs(q);
  const totals = {};
  const nonJualTotals = {};

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const tanggal = data.tanggal;
    if (!tanggal) return;
    totals[tanggal] = (totals[tanggal] || 0) + penjualanSumDoc(data);
    nonJualTotals[tanggal] = (nonJualTotals[tanggal] || 0) + penjualanSumNonJual(data);
  });

  const result = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const tgl = `${tahun}-${bulanStr}-${String(d).padStart(2, "0")}`;
    result.push({
      tanggal: tgl,
      penjualan: totals[tgl] || 0,
      nonJual: nonJualTotals[tgl] || 0
    });
  }
  return result;
}

function penjualanRenderList(data) {
  const listEl = document.getElementById("penjualanList");
  listEl.innerHTML = data.map(item => `
    <div class="investor-penjualan-row">
      <span class="investor-penjualan-tanggal">${penjualanFormatTanggal(item.tanggal)}</span>
      <span class="investor-penjualan-nonjual">${penjualanFormatAngka(item.nonJual || 0)}</span>
      <span class="investor-penjualan-value">${penjualanFormatAngka(item.penjualan)}</span>
    </div>
  `).join("");

  const totalPenjualan = data.reduce((sum, item) => sum + item.penjualan, 0);
  const totalNonJual   = data.reduce((sum, item) => sum + (item.nonJual || 0), 0);
  document.getElementById("penjualanTotal").textContent = penjualanFormatAngka(totalPenjualan);
  document.getElementById("penjualanNonJualTotal").textContent = penjualanFormatAngka(totalNonJual);
}
function penjualanRenderLoading() {
  document.getElementById("penjualanList").innerHTML =
    `<div class="investor-penjualan-row"><span class="investor-penjualan-tanggal">Memuat data...</span></div>`;
  document.getElementById("penjualanTotal").textContent = "-";
}
function penjualanRenderError() {
  document.getElementById("penjualanList").innerHTML = `
    <div class="investor-penjualan-error">
      <span>Gagal memuat data</span>
      <button class="investor-penjualan-retry-btn" id="penjualanRetryBtn">Coba Lagi</button>
    </div>
  `;
  document.getElementById("penjualanTotal").textContent = "-";

  document.getElementById("penjualanRetryBtn").onclick = () => {
    penjualanLoadAndRender(penjualanSelectedBulan, penjualanSelectedTahun, true);
  };
}
async function penjualanLoadAndRender(bulan, tahun, forceRefresh = false) {
  if (penjualanLoading) return;

  const cacheKey = `${tahun}-${String(bulan + 1).padStart(2, "0")}`;

  if (!forceRefresh && penjualanCache.has(cacheKey)) {
    const cachedData = penjualanCache.get(cacheKey);
    penjualanRenderList(cachedData);
    const chartDataCached = penjualanTrimSampaiHariIni(cachedData, bulan, tahun);
    drawPenjualanNonJualChart("penjualanChart", "penjualanChartTooltip", "penjualanChartEmpty", chartDataCached);
    renderPenjualanInsight("penjualanInsightText", chartDataCached);
    return;
  }

  penjualanLoading = true;
  penjualanRenderLoading();
  try {
    const data = await penjualanFetchData(bulan, tahun);
    penjualanCache.set(cacheKey, data);
    penjualanRenderList(data);

    const chartData = penjualanTrimSampaiHariIni(data, bulan, tahun);
    drawPenjualanNonJualChart("penjualanChart", "penjualanChartTooltip", "penjualanChartEmpty", chartData);
    renderPenjualanInsight("penjualanInsightText", chartData);
    const now = new Date();
    if (bulan === now.getMonth() && tahun === now.getFullYear()) {
      const idCabang = window.currentUser?.idCabang || "unknown";
      const total = data.reduce((sum, item) => sum + item.penjualan, 0);
      penjualanIdbSet(`penjualanBulanIni_${idCabang}`, total);
      penjualanIdbSet(`penjualanDataBulanIni_${idCabang}`, chartData); // sudah dipotong sampai hari ini, buat chart di Home
    }
  } catch (err) {
    console.error(err);
    penjualanLastError = err;
    penjualanRenderError();
  } finally {
    penjualanLoading = false;
  }
}

function penjualanOpenSheet() {
  document.getElementById("penjualanSheetOverlay").classList.add("active");
  document.getElementById("penjualanSheet").classList.add("active");
}
function penjualanCloseSheet() {
  document.getElementById("penjualanSheetOverlay").classList.remove("active");
  document.getElementById("penjualanSheet").classList.remove("active");
}
function penjualanCloseAllDropdowns(except) {
  document.querySelectorAll(".investor-custom-select.open").forEach(el => {
    if (el !== except) el.classList.remove("open");
  });
}
function penjualanInitCustomDropdown({ wrapperId, triggerId, optionsId, labelId, values, getSelected, onSelect }) {
  const wrapper = document.getElementById(wrapperId);
  const trigger = document.getElementById(triggerId);
  const optsEl  = document.getElementById(optionsId);
  const labelEl = document.getElementById(labelId);

  function renderOptions() {
    optsEl.innerHTML = values.map(v => `
      <div class="investor-custom-select-option ${v.value === getSelected() ? "selected" : ""}" data-value="${v.value}">
        ${v.label}
      </div>
    `).join("");
  }

  trigger.onclick = (e) => {
    e.stopPropagation();
    const willOpen = !wrapper.classList.contains("open");
    penjualanCloseAllDropdowns(wrapper);
    renderOptions();
    wrapper.classList.toggle("open", willOpen);
  };

  optsEl.onclick = (e) => {
    const opt = e.target.closest(".investor-custom-select-option");
    if (!opt) return;
    const value = parseInt(opt.dataset.value, 10);
    onSelect(value);
    labelEl.textContent = values.find(v => v.value === value).label;
    wrapper.classList.remove("open");
  };

  labelEl.textContent = values.find(v => v.value === getSelected())?.label || "-";
}
function penjualanInitSheetInteraction() {
  const overlay = document.getElementById("penjualanSheetOverlay");
  const sheet   = document.getElementById("penjualanSheet");
  window.attachSwipeToClose(sheet, overlay, penjualanCloseSheet);
}

window.initPenjualanView = function () {
  const filterBtn   = document.getElementById("penjualanFilterBtn");
  const terapkanBtn = document.getElementById("penjualanTerapkanBtn");

  if (!penjualanSheetInitialized) {
    const bulanValues = bulanList.map((b, i) => ({ value: i, label: b }));

    const tahunSekarang = new Date().getFullYear();
    const tahunValues = [];
    for (let y = tahunSekarang - 3; y <= tahunSekarang + 1; y++) {
      tahunValues.push({ value: y, label: String(y) });
    }

    penjualanInitCustomDropdown({
      wrapperId: "penjualanBulanDropdown",
      triggerId: "penjualanBulanTrigger",
      optionsId: "penjualanBulanOptions",
      labelId: "penjualanBulanLabel",
      values: bulanValues,
      getSelected: () => penjualanTempBulan,
      onSelect: (v) => { penjualanTempBulan = v; }
    });

    penjualanInitCustomDropdown({
      wrapperId: "penjualanTahunDropdown",
      triggerId: "penjualanTahunTrigger",
      optionsId: "penjualanTahunOptions",
      labelId: "penjualanTahunLabel",
      values: tahunValues,
      getSelected: () => penjualanTempTahun,
      onSelect: (v) => { penjualanTempTahun = v; }
    });

    document.addEventListener("click", () => penjualanCloseAllDropdowns());

    penjualanInitSheetInteraction();
    penjualanSheetInitialized = true;
  }

  filterBtn.onclick = () => {
    penjualanTempBulan = penjualanSelectedBulan;
    penjualanTempTahun = penjualanSelectedTahun;
    document.getElementById("penjualanBulanLabel").textContent = bulanList[penjualanTempBulan];
    document.getElementById("penjualanTahunLabel").textContent = penjualanTempTahun;
    penjualanOpenSheet();
  };

  terapkanBtn.onclick = () => {
    penjualanSelectedBulan = penjualanTempBulan;
    penjualanSelectedTahun = penjualanTempTahun;
    penjualanUpdateFilterLabel();
    penjualanCloseSheet();
    penjualanCloseAllDropdowns();
    penjualanLoadAndRender(penjualanSelectedBulan, penjualanSelectedTahun);
  };

  penjualanUpdateFilterLabel();
  penjualanLoadAndRender(penjualanSelectedBulan, penjualanSelectedTahun);
};
