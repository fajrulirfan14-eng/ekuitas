
// idb
const ROI_IDB_NAME = "roiCacheDB";
const ROI_IDB_STORE = "cache";
function roiOpenIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ROI_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(ROI_IDB_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function roiIdbSet(key, value) {
  try {
    const db = await roiOpenIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(ROI_IDB_STORE, "readwrite");
      tx.objectStore(ROI_IDB_STORE).put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
async function roiIdbGet(key) {
  try {
    const db = await roiOpenIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(ROI_IDB_STORE, "readonly");
      const req = tx.objectStore(ROI_IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function portoFormatRupiah(angka) {
  return "Rp " + Math.round(angka || 0).toLocaleString("id-ID");
}
const bulanNamaList = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
function formatPeriode(periode) {
  if (!periode) return "-";
  const [tahun, bulan] = periode.split("-");
  const idx = parseInt(bulan, 10) - 1;
  return `${bulanNamaList[idx] || bulan} ${tahun}`;
}
const portoTabLabels = {
  neraca: "Neraca Saldo",
  roi: "ROI"
};

let portoActiveTab = "roi";
let portoHidden = false;
let neracaSelectedPeriode = null;
let neracaTempBulan = new Date().getMonth();
let neracaTempTahun = new Date().getFullYear();
let neracaSheetInitialized = false;
let neracaCache = new Map();
let neracaLoading = false;

function sumArray(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((sum, item) => sum + (Number(item?.nilai) || 0), 0);
}

async function neracaFetchLatest() {
  const idCabang = window.currentUser?.idCabang;
  if (!idCabang) return null;

  const q = window.query(
    window.collectionGroup(window.db, "neracaSaldo"),
    window.where("idCabang", "==", idCabang),
    window.orderBy("periode", "desc"),
    window.limit(1)
  );

  const snap = await window.getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}
async function neracaFetchByPeriode(periode) {
  const idCabang = window.currentUser?.idCabang;
  if (!idCabang) return null;

  const q = window.query(
    window.collectionGroup(window.db, "neracaSaldo"),
    window.where("idCabang", "==", idCabang),
    window.where("periode", "==", periode),
    window.limit(1)
  );

  const snap = await window.getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}
function renderNeracaSection(title, items) {
  if (!items || items.length === 0) return "";
  const rows = items.map(item => `
    <div class="investor-neraca-row">
      <span class="investor-neraca-nama">${item.nama || "-"}</span>
      <span class="investor-neraca-nilai">${portoFormatRupiah(item.nilai)}</span>
    </div>
  `).join("");

  return `
    <div class="investor-neraca-section">
      <div class="investor-neraca-section-title">${title}</div>
      ${rows}
      <div class="investor-neraca-subtotal">
        <span>Subtotal</span>
        <span>${portoFormatRupiah(sumArray(items))}</span>
      </div>
    </div>
  `;
}
function renderNeracaSaldo(data) {
  const card = document.getElementById("portoDetailCard");

  if (!data) {
    card.innerHTML = `<p class="investor-porto-placeholder">Data Neraca Saldo belum tersedia untuk periode ini</p>`;
    return;
  }

  const totalAsetLancar = sumArray(data.asetLancar);
  const totalAsetTetap  = sumArray(data.asetTetap);
  const totalAset       = totalAsetLancar + totalAsetTetap;

  const totalLiabilitas = sumArray(data.liabilitas);
  const totalEkuitasArr = sumArray(data.ekuitas);
  const labaBerjalan    = Number(data.labaBerjalan) || 0;
  const totalEkuitas    = totalEkuitasArr + labaBerjalan;

  const totalPasiva = totalLiabilitas + totalEkuitas;
  const labaIsNegative = labaBerjalan < 0;

  card.innerHTML = `
    <button class="investor-neraca-periode-btn" id="neracaPeriodeBtn">
      <span>Periode: ${formatPeriode(data.periode)}</span>
      <i class="fa-solid fa-chevron-down"></i>
    </button>

    ${renderNeracaSection("Aset Lancar", data.asetLancar)}
    ${renderNeracaSection("Aset Tetap", data.asetTetap)}

    <div class="investor-neraca-grandtotal">
      <span>Total Aset</span>
      <span>${portoFormatRupiah(totalAset)}</span>
    </div>

    ${renderNeracaSection("Ekuitas", data.ekuitas)}
    ${renderNeracaSection("Liabilitas", data.liabilitas)}

    <div class="investor-neraca-grandtotal">
      <span>Total Liabilitas + Ekuitas</span>
      <span>${portoFormatRupiah(totalPasiva)}</span>
    </div>

    <div class="investor-neraca-laba-box ${labaIsNegative ? "investor-neraca-laba-negatif-bg" : "investor-neraca-laba-positif-bg"}">
      <span class="${labaIsNegative ? "investor-neraca-laba-negatif" : "investor-neraca-laba-positif"}">Laba Berjalan</span>
      <span class="${labaIsNegative ? "investor-neraca-laba-negatif" : "investor-neraca-laba-positif"}">${portoFormatRupiah(labaBerjalan)}</span>
    </div>
  `;

  document.getElementById("neracaPeriodeBtn").onclick = neracaOpenSheet;
}

function renderLoading() {
  document.getElementById("portoDetailCard").innerHTML =
    `<p class="investor-porto-placeholder">Memuat data...</p>`;
}
function renderError() {
  document.getElementById("portoDetailCard").innerHTML =
    `<p class="investor-porto-placeholder">Gagal memuat data</p>`;
}

async function neracaLoadAndRender() {
  if (neracaLoading) return;

  const cacheKey = neracaSelectedPeriode || "__latest__";
  if (neracaCache.has(cacheKey)) {
    renderNeracaSaldo(neracaCache.get(cacheKey));
    return;
  }

  neracaLoading = true;
  renderLoading();
  try {
    const data = neracaSelectedPeriode
      ? await neracaFetchByPeriode(neracaSelectedPeriode)
      : await neracaFetchLatest();
    neracaCache.set(cacheKey, data);
    renderNeracaSaldo(data);
  } catch (err) {
    console.error(err);
    renderError();
  } finally {
    neracaLoading = false;
  }
}
function neracaOpenSheet() {
  document.getElementById("neracaSheetOverlay").classList.add("active");
  document.getElementById("neracaSheet").classList.add("active");
}
function neracaCloseSheet() {
  document.getElementById("neracaSheetOverlay").classList.remove("active");
  document.getElementById("neracaSheet").classList.remove("active");
}
function neracaCloseAllDropdowns(except) {
  document.querySelectorAll(".investor-custom-select.open").forEach(el => {
    if (el !== except) el.classList.remove("open");
  });
}
function neracaInitCustomDropdown({ wrapperId, triggerId, optionsId, labelId, values, getSelected, onSelect }) {
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
    neracaCloseAllDropdowns(wrapper);
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
function neracaInitSheetInteraction() {
  const overlay = document.getElementById("neracaSheetOverlay");
  const sheet   = document.getElementById("neracaSheet");
  window.attachSwipeToClose(sheet, overlay, neracaCloseSheet);
}
function neracaInitSheet() {
  if (neracaSheetInitialized) return;

  const bulanValues = bulanNamaList.map((b, i) => ({ value: i, label: b }));

  const tahunSekarang = new Date().getFullYear();
  const tahunValues = [];
  for (let y = tahunSekarang - 3; y <= tahunSekarang + 1; y++) {
    tahunValues.push({ value: y, label: String(y) });
  }

  neracaInitCustomDropdown({
    wrapperId: "neracaBulanDropdown",
    triggerId: "neracaBulanTrigger",
    optionsId: "neracaBulanOptions",
    labelId: "neracaBulanLabel",
    values: bulanValues,
    getSelected: () => neracaTempBulan,
    onSelect: (v) => { neracaTempBulan = v; }
  });

  neracaInitCustomDropdown({
    wrapperId: "neracaTahunDropdown",
    triggerId: "neracaTahunTrigger",
    optionsId: "neracaTahunOptions",
    labelId: "neracaTahunLabel",
    values: tahunValues,
    getSelected: () => neracaTempTahun,
    onSelect: (v) => { neracaTempTahun = v; }
  });

  document.addEventListener("click", () => neracaCloseAllDropdowns());

  neracaInitSheetInteraction();

  document.getElementById("neracaTerapkanBtn").onclick = () => {
    const bulanStr = String(neracaTempBulan + 1).padStart(2, "0");
    neracaSelectedPeriode = `${neracaTempTahun}-${bulanStr}`;
    neracaCloseSheet();
    neracaCloseAllDropdowns();
    neracaLoadAndRender();
  };

  neracaSheetInitialized = true;
}

let roiCache = null;
let roiLoading = false;
let roiFilterTahun = null;

function roiGetAvailableYears(data) {
  const years = [...new Set(data.map(item => Number(item.periode.split("-")[0])))];
  return years.sort((a, b) => b - a); // terbaru dulu
}
function roiCloseAllDropdowns(except) {
  document.querySelectorAll(".investor-roi-year-dropdown.open").forEach(el => {
    if (el !== except) el.classList.remove("open");
  });
}
async function roiFetchAll() {
  const idCabang = window.currentUser?.idCabang;
  const uid = window.currentUser?.uid;
  if (!idCabang || !uid) return [];

  const q = window.query(
    window.collectionGroup(window.db, "roi"),
    window.where("idCabang", "==", idCabang),
    window.orderBy("periode", "desc")
  );

  const snap = await window.getDocs(q);
  const result = [];

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const myEntry = data[uid];
    if (myEntry && typeof myEntry === "object") {
      result.push({
        periode: data.periode,
        return: Number(myEntry.return) || 0
      });
    }
  });

  return result;
}
function renderRoiList(data) {
  const card = document.getElementById("portoDetailCard");

  if (!data || data.length === 0) {
    card.innerHTML = `<p class="investor-porto-placeholder">Data ROI belum tersedia</p>`;
    return;
  }

  const availableYears = roiGetAvailableYears(data);
  if (roiFilterTahun === null) {
    roiFilterTahun = availableYears[0];
  }

  const filteredData = data.filter(item => Number(item.periode.split("-")[0]) === roiFilterTahun);

  const ekuitas = window.currentUser?.ekuitas || 0;

  const rows = filteredData.length ? filteredData.map(item => {
    const isNegative = item.return < 0;
    const percent = ekuitas > 0 ? (item.return / ekuitas) * 100 : 0;
    const colorClass = isNegative ? "investor-neraca-laba-negatif" : "investor-neraca-laba-positif";

    return `
      <div class="investor-neraca-row">
        <span class="investor-neraca-nama">${formatPeriode(item.periode)}</span>
        <span class="investor-roi-value">
          <span class="${colorClass}">${portoFormatRupiah(item.return)}</span>
          <span class="${colorClass} investor-roi-percent">${isNegative ? "" : "+"}${percent.toFixed(1)}%</span>
        </span>
      </div>
    `;
  }).join("") : `<p class="investor-porto-placeholder">Belum ada data return di tahun ${roiFilterTahun}</p>`;

  card.innerHTML = `
    <div class="investor-porto-chart-card">
      <div class="investor-porto-chart-title">Grafik Return ${roiFilterTahun}</div>
      <div class="investor-home-chart-wrapper">
        <canvas id="portoReturnChart" class="investor-home-chart-canvas"></canvas>
        <div class="investor-home-chart-tooltip" id="portoReturnChartTooltip"></div>
      </div>
      <p class="investor-porto-placeholder" id="portoReturnChartEmpty" style="display:none;">Belum ada data</p>
    </div>

    <div class="investor-neraca-section investor-porto-riwayat-section">
      <div class="investor-neraca-section-header">
        <div class="investor-neraca-section-title">Riwayat Return</div>
        <div class="investor-roi-year-dropdown" id="roiYearDropdown">
          <button class="investor-roi-year-btn" id="roiYearBtn">
            <span>${roiFilterTahun}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="investor-roi-year-options" id="roiYearOptions">
            ${availableYears.map(y => `
              <div class="investor-roi-year-option ${y === roiFilterTahun ? "selected" : ""}" data-year="${y}">${y}</div>
            `).join("")}
          </div>
        </div>
      </div>
      ${rows}
    </div>
  `;

  initRoiYearDropdown(data);
  const chartHistory = [...filteredData].sort((a, b) => a.periode.localeCompare(b.periode)).reverse();
  window.drawReturnChart("portoReturnChart", "portoReturnChartTooltip", "portoReturnChartEmpty", chartHistory, null);
}
function initRoiYearDropdown(data) {
  const wrapper = document.getElementById("roiYearDropdown");
  const trigger = document.getElementById("roiYearBtn");
  const optsEl  = document.getElementById("roiYearOptions");
  if (!wrapper || !trigger || !optsEl) return;

  trigger.onclick = (e) => {
    e.stopPropagation();
    const willOpen = !wrapper.classList.contains("open");
    roiCloseAllDropdowns(wrapper);
    wrapper.classList.toggle("open", willOpen);
  };

  optsEl.onclick = (e) => {
    const opt = e.target.closest(".investor-roi-year-option");
    if (!opt) return;
    roiFilterTahun = Number(opt.dataset.year);
    wrapper.classList.remove("open");
    renderRoiList(data);
  };

  document.addEventListener("click", () => roiCloseAllDropdowns());
}
async function roiLoadAndRender() {
  if (roiLoading) return;

  if (roiCache) {
    renderRoiList(roiCache);
    return;
  }

  roiLoading = true;
  renderLoading();
  try {
    const data = await roiFetchAll();
    roiCache = data;
    renderRoiList(data);

    // simpan ke IDB khusus buat dibaca home.js
    const idCabang = window.currentUser?.idCabang || "unknown";
    roiIdbSet(`roiHistory_${idCabang}`, data);
  } catch (err) {
    console.error(err);
    renderError();
  } finally {
    roiLoading = false;
  }
}
async function portoRenderTabContent(tab) {
  if (tab === "neraca") {
    neracaInitSheet();
    neracaLoadAndRender();
    return;
  }

  if (tab === "roi") {
    roiLoadAndRender();
    return;
  }

  const card = document.getElementById("portoDetailCard");
  card.innerHTML = `<p class="investor-porto-placeholder">Data ${portoTabLabels[tab]} belum tersedia</p>`;
}
function portoSwitchTab(tab) {
  portoActiveTab = tab;
  document.querySelectorAll(".investor-porto-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  portoRenderTabContent(tab);
}

window.initPortoView = function () {
  const user = window.currentUser || {};
  const ekuitas = user.ekuitas || 0;
  const returnVal = user.return || 0;
  const percent = ekuitas > 0 ? (returnVal / ekuitas) * 100 : 0;
  const isNegative = returnVal < 0;

  const ekuitasEl = document.getElementById("portoEkuitas");
  ekuitasEl.textContent = portoFormatRupiah(ekuitas);
  ekuitasEl.dataset.value = portoFormatRupiah(ekuitas);

  document.getElementById("portoReturnValue").textContent =
    (isNegative ? "-" : "+") + portoFormatRupiah(Math.abs(returnVal));

  const percentEl = document.getElementById("portoReturnPercent");
  percentEl.textContent = (isNegative ? "" : "+") + percent.toFixed(1) + "%";
  percentEl.classList.toggle("negative", isNegative);

  const eyeBtn = document.getElementById("portoEyeToggle");
  eyeBtn.onclick = () => {
    portoHidden = !portoHidden;
    ekuitasEl.textContent = portoHidden ? "Rp ••••••••" : ekuitasEl.dataset.value;
    eyeBtn.classList.toggle("fa-eye", !portoHidden);
    eyeBtn.classList.toggle("fa-eye-slash", portoHidden);
  };

  document.querySelectorAll(".investor-porto-tab").forEach(btn => {
    btn.onclick = () => portoSwitchTab(btn.dataset.tab);
  });

  portoSwitchTab(portoActiveTab);
};
