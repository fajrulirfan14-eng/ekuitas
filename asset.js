
// idb
const ASSET_IDB_NAME = "assetCacheDB";
const ASSET_IDB_STORE = "cache";
function assetOpenIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ASSET_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(ASSET_IDB_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function assetIdbSet(key, value) {
  try {
    const db = await assetOpenIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(ASSET_IDB_STORE, "readwrite");
      tx.objectStore(ASSET_IDB_STORE).put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
async function assetIdbGet(key) {
  try {
    const db = await assetOpenIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(ASSET_IDB_STORE, "readonly");
      const req = tx.objectStore(ASSET_IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function assetFormatRupiah(angka) {
  return "Rp " + Math.round(angka || 0).toLocaleString("id-ID");
}
let assetCache = null;
let assetLoading = false;

async function assetFetchData() {
  const idCabang = window.currentUser?.idCabang;
  if (!idCabang) return null;

  const q = window.query(
    window.collectionGroup(window.db, "assetProd"),
    window.where("idCabang", "==", idCabang),
    window.limit(1)
  );

  const snap = await window.getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}
function assetSumKategori(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (Number(item.harga) || 0) * (Number(item.qty) || 1), 0);
}
function renderAssetSection(title, items) {
  if (!items || items.length === 0) {
    return `
      <div class="investor-asset-card">
        <div class="investor-asset-section-title">${title}</div>
        <p class="investor-porto-placeholder">Belum ada data</p>
      </div>
    `;
  }

  const rows = items.map(item => {
    const total = (Number(item.harga) || 0) * (Number(item.qty) || 1);
    return `
      <div class="investor-asset-row">
        <div>
          <div class="investor-asset-nama">${item.nama || "-"}</div>
          <div class="investor-asset-detail">${item.qty || 1} unit &times; ${assetFormatRupiah(item.harga)}</div>
        </div>
        <span class="investor-asset-nilai">${assetFormatRupiah(total)}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="investor-asset-card">
      <div class="investor-asset-section-title">${title}</div>
      ${rows}
      <div class="investor-asset-subtotal">
        <span>Subtotal</span>
        <span>${assetFormatRupiah(assetSumKategori(items))}</span>
      </div>
    </div>
  `;
}
function renderAssetContent(data) {
  const content = document.getElementById("assetContent");

  if (!data) {
    content.innerHTML = `<p class="investor-porto-placeholder">Data Asset belum tersedia</p>`;
    return;
  }

  const penyusutanDistribusi = Number(data.penyusutanAset?.distribusi) || 0;
  const penyusutanProduksi   = Number(data.penyusutanAset?.produksi) || 0;
  const totalPenyusutan      = penyusutanDistribusi + penyusutanProduksi;

  const subtotalDistribusi = assetSumKategori(data.distribusi);
  const subtotalProduksi   = assetSumKategori(data.produksi);
  const totalAsetBersih    = subtotalProduksi + subtotalDistribusi - totalPenyusutan;

  content.innerHTML = `
    <div class="investor-asset-kpi">
      <span class="investor-asset-kpi-label">Total Asset</span>
      <span class="investor-asset-kpi-value">${assetFormatRupiah(totalAsetBersih)}</span>
    </div>

    ${renderAssetSection("Distribusi", data.distribusi)}
    ${renderAssetSection("Produksi", data.produksi)}

    <div class="investor-asset-card">
      <div class="investor-asset-section-title">Penyusutan Aset</div>
      <div class="investor-asset-penyusutan" style="margin-bottom: 8px;">
        <span class="investor-asset-penyusutan-label">Distribusi</span>
        <span class="investor-asset-penyusutan-nilai">${assetFormatRupiah(penyusutanDistribusi)}</span>
      </div>
      <div class="investor-asset-penyusutan">
        <span class="investor-asset-penyusutan-label">Produksi</span>
        <span class="investor-asset-penyusutan-nilai">${assetFormatRupiah(penyusutanProduksi)}</span>
      </div>
      <div class="investor-asset-subtotal">
        <span>Total Penyusutan</span>
        <span>${assetFormatRupiah(totalPenyusutan)}</span>
      </div>
    </div>
  `;
}
async function assetLoadAndRender() {
  if (assetLoading) return;

  if (assetCache) {
    renderAssetContent(assetCache);
    return;
  }

  assetLoading = true;
  document.getElementById("assetContent").innerHTML =
    `<p class="investor-porto-placeholder">Memuat data...</p>`;

  try {
    const data = await assetFetchData();
    assetCache = data;
    renderAssetContent(data);

    // simpan total asset bersih ke IDB khusus buat dibaca home.js
    if (data) {
      const penyusutanDistribusi = Number(data.penyusutanAset?.distribusi) || 0;
      const penyusutanProduksi   = Number(data.penyusutanAset?.produksi) || 0;
      const totalPenyusutan      = penyusutanDistribusi + penyusutanProduksi;
      const subtotalDistribusi   = assetSumKategori(data.distribusi);
      const subtotalProduksi     = assetSumKategori(data.produksi);
      const totalAsetBersih      = subtotalProduksi + subtotalDistribusi - totalPenyusutan;

      const idCabang = window.currentUser?.idCabang || "unknown";
      assetIdbSet(`totalAsset_${idCabang}`, totalAsetBersih);
    }
  } catch (err) {
    console.error(err);
    document.getElementById("assetContent").innerHTML =
      `<p class="investor-porto-placeholder">Gagal memuat data</p>`;
  } finally {
    assetLoading = false;
  }
}

window.initAssetView = function () {
  assetLoadAndRender();
};