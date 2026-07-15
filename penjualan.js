const bulanList = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

let penjualanSelectedBulan = new Date().getMonth();
let penjualanSelectedTahun = new Date().getFullYear();
let penjualanTempBulan = penjualanSelectedBulan;
let penjualanTempTahun = penjualanSelectedTahun;
let penjualanSheetInitialized = false;
let penjualanLoading = false;
let penjualanLastError = null;

const penjualanCache = new Map(); // key: "2026-07" → array data

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

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const tanggal = data.tanggal;
    if (!tanggal) return;
    totals[tanggal] = (totals[tanggal] || 0) + penjualanSumDoc(data);
  });

  const result = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const tgl = `${tahun}-${bulanStr}-${String(d).padStart(2, "0")}`;
    result.push({ tanggal: tgl, penjualan: totals[tgl] || 0 });
  }
  return result;
}

function penjualanFormatAngka(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

function penjualanRenderList(data) {
  const listEl = document.getElementById("penjualanList");
  listEl.innerHTML = data.map(item => `
    <div class="investor-penjualan-row">
      <span class="investor-penjualan-tanggal">${item.tanggal}</span>
      <span class="investor-penjualan-value">${penjualanFormatAngka(item.penjualan)}</span>
    </div>
  `).join("");

  const total = data.reduce((sum, item) => sum + item.penjualan, 0);
  document.getElementById("penjualanTotal").textContent = penjualanFormatAngka(total);
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
    penjualanRenderList(penjualanCache.get(cacheKey));
    return;
  }

  penjualanLoading = true;
  penjualanRenderLoading();
  try {
    const data = await penjualanFetchData(bulan, tahun);
    penjualanCache.set(cacheKey, data);
    penjualanRenderList(data);
  } catch (err) {
    console.error(err);
    penjualanLastError = err;
    penjualanRenderError();
  } finally {
    penjualanLoading = false;
  }
}

function penjualanUpdateFilterLabel() {
  document.getElementById("penjualanFilterLabel").textContent =
    `${bulanList[penjualanSelectedBulan]} ${penjualanSelectedTahun}`;
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