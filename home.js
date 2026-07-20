
// idb 
const ARTIKEL_IDB_NAME = "artikelCacheDB";
const ARTIKEL_IDB_STORE = "cache";
function artikelOpenIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ARTIKEL_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(ARTIKEL_IDB_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function artikelIdbSet(key, value) {
  try {
    const db = await artikelOpenIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(ARTIKEL_IDB_STORE, "readwrite");
      tx.objectStore(ARTIKEL_IDB_STORE).put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
async function artikelIdbGet(key) {
  try {
    const db = await artikelOpenIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(ARTIKEL_IDB_STORE, "readonly");
      const req = tx.objectStore(ARTIKEL_IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function formatRupiah(angka) {
  return "Rp " + Math.round(angka || 0).toLocaleString("id-ID");
}

let notifSwipeInitialized = false;
let notifCache = null;
function formatNotifWaktu(createdAt) {
  if (!createdAt || !createdAt.toDate) return "";
  const date = createdAt.toDate();
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
async function notifFetchAll() {
  const idCabang = window.currentUser?.idCabang;
  if (!idCabang) return [];

  const q = window.query(
    window.collection(window.db, "notifikasiInvestor"),
    window.where("idCabang", "==", idCabang)
  );

  const snap = await window.getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return list;
}
function renderNotifRow(item) {
  return `
    <div class="investor-notif-row" data-notif-id="${item.id}">
      <div class="investor-notif-row-judul">${item.judul || "-"}</div>
      <div class="investor-notif-row-pesan">${item.pesan || ""}</div>
      <div class="investor-notif-row-waktu">${formatNotifWaktu(item.createdAt)}</div>
    </div>
  `;
}
function renderNotifLists(list) {
  const uid = window.currentUser?.uid;
  const unreadList = document.getElementById("notifUnreadList");
  const readList = document.getElementById("notifReadList");

  const unread = list.filter(item => !item.dibaca?.[uid]);
  const read = list.filter(item => item.dibaca?.[uid]);

  unreadList.innerHTML = unread.length
    ? unread.map(renderNotifRow).join("")
    : `<p class="investor-porto-placeholder">Tidak ada notifikasi baru</p>`;

  readList.innerHTML = read.length
    ? read.map(renderNotifRow).join("")
    : `<p class="investor-porto-placeholder">Belum ada riwayat</p>`;

  document.querySelectorAll(".investor-notif-row").forEach(row => {
    row.onclick = () => markNotifAsRead(row.dataset.notifId, list);
  });
}
async function markNotifAsRead(notifId, list) {
  const uid = window.currentUser?.uid;
  const item = list.find(n => n.id === notifId);
  if (!item || item.dibaca?.[uid]) return;

  try {
    await window.updateDoc(
      window.doc(window.db, "notifikasiInvestor", notifId),
      { [`dibaca.${uid}`]: true }
    );
    item.dibaca = { ...item.dibaca, [uid]: true };
    renderNotifLists(list);
    updateNotifBadge(list);
  } catch (err) {
    console.error(err);
  }
}
function updateNotifBadge(list) {
  const uid = window.currentUser?.uid;
  const badge = document.getElementById("homeNotifBadge");
  const unreadCount = list.filter(item => !item.dibaca?.[uid]).length;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}
async function notifLoadAndRender() {
  if (notifCache) {
    renderNotifLists(notifCache);
    updateNotifBadge(notifCache);
    return;
  }
  try {
    const list = await notifFetchAll();
    notifCache = list;
    renderNotifLists(list);
    updateNotifBadge(list);
  } catch (err) {
    console.error(err);
  }
}
function openNotifPanel() {
  document.getElementById("notifOverlay").classList.add("active");
  document.getElementById("notifPanel").classList.add("active");
  initNotifSwipe();
  notifLoadAndRender();
}
function closeNotifPanel() {
  document.getElementById("notifOverlay").classList.remove("active");
  document.getElementById("notifPanel").classList.remove("active");
}
function initNotifSwipe() {
  if (notifSwipeInitialized) return;
  notifSwipeInitialized = true;

  const overlay = document.getElementById("notifOverlay");
  const panel = document.getElementById("notifPanel");

  overlay.addEventListener("click", closeNotifPanel);

  let startX = 0;
  let currentX = 0;
  let dragging = false;

  function onStart(e) {
    dragging = true;
    startX = e.touches[0].clientX;
    currentX = startX;
    panel.style.transition = "none";
  }

  function onMove(e) {
    if (!dragging) return;
    currentX = e.touches[0].clientX;
    const delta = Math.max(0, currentX - startX);
    if (delta > 0) {
      e.preventDefault();
      panel.style.transform = `translateX(${delta}px)`;
    }
  }

  function onEnd() {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = "";
    const delta = currentX - startX;
    panel.style.transform = "";
    if (delta > 80) {
      closeNotifPanel();
    }
  }

  panel.addEventListener("touchstart", onStart, { passive: true });
  panel.addEventListener("touchmove", onMove, { passive: false });
  panel.addEventListener("touchend", onEnd, { passive: true });
}
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return "Selamat pagi,";
  if (hour >= 11 && hour < 15) return "Selamat siang,";
  if (hour >= 15 && hour < 18) return "Selamat sore,";
  return "Selamat malam,";
}
function formatUpdatedAt() {
  const now = new Date();
  const tanggal = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `Update: ${tanggal}, ${jam}`;
}

async function homeFetchPenjualanBulanIni() {
  try {
    const idCabang = window.currentUser?.idCabang || "unknown";
    const cached = await penjualanIdbGet(`penjualanBulanIni_${idCabang}`);
    return cached ?? 0;
  } catch (err) {
    console.error(err);
    return 0;
  }
}
async function homeFetchReturnBulanIni() {
  try {
    const idCabang = window.currentUser?.idCabang || "unknown";
    const data = await roiIdbGet(`roiHistory_${idCabang}`);
    const list = data || [];
    return { latest: list[0] || null, history: list };
  } catch (err) {
    console.error(err);
    return { latest: null, history: [] };
  }
}

let returnChartPointsMap = {};
function drawReturnChart(canvasId, tooltipId, emptyElId, history, limitBulan = 6) {
  const canvas = document.getElementById(canvasId);
  const emptyEl = document.getElementById(emptyElId);
  if (!canvas) return;

  const data = limitBulan ? [...history].reverse().slice(-limitBulan) : [...history].reverse();

  if (data.length === 0) {
    canvas.style.display = "none";
    if (emptyEl) emptyEl.style.display = "block";
    return;
  }
  canvas.style.display = "block";
  if (emptyEl) emptyEl.style.display = "none";

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const padding = 24;

  const values = data.map(d => d.return);
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const stepX = (W - padding * 2) / (data.length - 1 || 1);
  const style = getComputedStyle(document.documentElement);
  const accentColor = style.getPropertyValue("--accent").trim() || "#b3874f";

  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = H - padding - ((d.return - minVal) / range) * (H - padding * 2);
    return { x, y, value: d.return, periode: d.periode };
  });

  function drawLabels() {
    ctx.fillStyle = style.getPropertyValue("--text-muted").trim() || "#999";
    ctx.font = "10px Poppins, sans-serif";
    ctx.textAlign = "center";
    points.forEach(p => {
      const [, bulan] = p.periode.split("-");
      ctx.fillText(bulan, p.x, H - 6);
    });
  }

  function renderFrame(progress) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    const clipX = padding + (W - padding * 2) * progress;
    ctx.beginPath();
    ctx.rect(0, 0, clipX, H);
    ctx.clip();

    ctx.beginPath();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    points.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = accentColor;
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
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

  returnChartPointsMap[canvasId] = points;

  // pasang listener klik di elemen canvas ITU SENDIRI (bukan flag global by id),
  // supaya tetap kepasang walau canvas-nya baru (habis di-render ulang lewat innerHTML)
  if (!canvas.dataset.chartClickBound) {
    canvas.dataset.chartClickBound = "true";
    canvas.addEventListener("click", (e) => handleChartClick(e, canvas.id, tooltipId));
  }
}
function handleChartClick(e, canvasId, tooltipId) {
  const canvas = e.currentTarget;
  const tooltip = document.getElementById(tooltipId);
  const points = returnChartPointsMap[canvasId] || [];
  if (!tooltip) return;
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  let nearest = null;
  let minDist = Infinity;
  points.forEach(p => {
    const dist = Math.hypot(p.x - clickX, p.y - clickY);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  });

  if (!nearest || minDist > 30) {
    tooltip.classList.remove("visible");
    return;
  }

  const [tahun, bulan] = nearest.periode.split("-");
  const idx = parseInt(bulan, 10) - 1;
  const namaBulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][idx] || bulan;

  tooltip.innerHTML = `
    <span class="investor-home-chart-tooltip-periode">${namaBulan} ${tahun}</span>
    <span class="investor-home-chart-tooltip-value">${formatRupiah(nearest.value)}</span>
  `;
  tooltip.style.left = `${nearest.x}px`;
  tooltip.style.top = `${nearest.y}px`;
  tooltip.classList.add("visible");
}

async function homeFetchPenjualanChartData() {
  try {
    const idCabang = window.currentUser?.idCabang || "unknown";
    const data = await penjualanIdbGet(`penjualanDataBulanIni_${idCabang}`);
    if (!data || !data.length) return [];

    // defensif: potong sampai hari ini, jaga-jaga kalau IDB masih nyimpen array lama (sebelum ada fix trim)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return data.filter(d => d.tanggal <= todayStr);
  } catch (err) {
    console.error(err);
    return [];
  }
}
async function homeLoadSummary() {
  const [penjualan, returnData, penjualanChartData] = await Promise.all([
    homeFetchPenjualanBulanIni(),
    homeFetchReturnBulanIni(),
    homeFetchPenjualanChartData()
  ]);

  document.getElementById("homeSummaryPenjualan").textContent =
    penjualan === null ? "Gagal memuat" : penjualan.toLocaleString("id-ID");

  document.getElementById("homeSummaryReturn").textContent =
    returnData.latest ? formatRupiah(returnData.latest.return) : "Rp 0";

  document.getElementById("homeSkeletonSummary").style.display = "none";
  document.getElementById("homeSummaryGrid").style.display = "grid";

  document.getElementById("homeSkeletonChart").style.display = "none";
  document.getElementById("homeChartCard").style.display = "block";
  drawReturnChart("homeReturnChart", "homeChartTooltip", "homeChartEmpty", returnData.history, 6);

  document.getElementById("homeSkeletonChartPenjualan").style.display = "none";
  document.getElementById("homeChartPenjualanCard").style.display = "block";
  window.drawPenjualanNonJualChart("homeChartPenjualan", "homeChartPenjualanTooltip", "homeChartPenjualanEmpty", penjualanChartData);
  window.renderPenjualanInsight("homeChartPenjualanInsightText", penjualanChartData);
}

window.initHomeView = function () {
  const user     = window.currentUser || {};
  document.getElementById("homeChartPenjualanCard")?.addEventListener("click", (e) => {
    if (e.target.id === "homeChartPenjualan") return;
    window.showView("penjualan", "navbar");
    window.syncNavToView?.("penjualan");
  });
  const avatar   = document.getElementById("homeAvatar");
  const avatarSk = document.getElementById("homeAvatarSkeleton");
  const nama     = document.getElementById("homeNama");

  const showAvatar = () => {
    avatarSk.style.display = "none";
    avatar.style.display = "block";
  };
  avatar.onload = showAvatar;
  avatar.onerror = showAvatar;
  avatar.src = user.foto && user.foto.trim() !== ""
    ? user.foto
    : "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(user.nama || "U");
  nama.textContent = user.nama || "-";

  document.getElementById("homeGreeting").textContent = getGreeting();
  document.getElementById("homeNotifBtn").onclick = () => {
    openNotifPanel();
  };

  avatar.style.cursor = "pointer";
  avatar.onclick = () => window.showView("profil");
  document.querySelectorAll(".investor-home-action-btn[data-goto]").forEach(btn => {
    btn.onclick = () => window.showView(btn.dataset.goto);
  });

  const ekuitas = user.ekuitas || 0;
  const returnVal = user.return || 0;
  const percent = ekuitas > 0 ? (returnVal / ekuitas) * 100 : 0;
  const isNegative = returnVal < 0;

  const ekuitasEl = document.getElementById("homeEkuitas");
  ekuitasEl.textContent = formatRupiah(ekuitas);
  ekuitasEl.dataset.value = formatRupiah(ekuitas);

  document.getElementById("homeReturnValue").textContent =
    (isNegative ? "-" : "+") + formatRupiah(Math.abs(returnVal));

  const percentEl = document.getElementById("homeReturnPercent");
  percentEl.textContent = (isNegative ? "" : "+") + percent.toFixed(1) + "%";
  percentEl.classList.toggle("negative", isNegative);

  let hidden = false;
  const eyeBtn = document.getElementById("homeEyeToggle");
  eyeBtn.onclick = () => {
    hidden = !hidden;
    ekuitasEl.textContent = hidden ? "Rp ••••••••" : ekuitasEl.dataset.value;
    eyeBtn.classList.toggle("fa-eye", !hidden);
    eyeBtn.classList.toggle("fa-eye-slash", hidden);
  };
  homeLoadSummary();
  homeLoadArtikel();
  notifLoadAndRender();
};

let artikelCache = null;
let artikelSheetInitialized = false;

async function homeFetchArtikel() {
  const q = window.query(
    window.collection(window.db, "artikel"),
    window.where("status", "==", "published")
  );
  const snap = await window.getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
  return list;
}
function renderArtikelList(list) {
  const skeletonEl = document.getElementById("homeSkeletonArtikel");
  const container = document.getElementById("homeArtikelList");

  if (skeletonEl) skeletonEl.style.display = "none";
  container.style.display = "flex";

  if (!list || list.length === 0) {
    container.innerHTML = `<p class="investor-porto-placeholder">Belum ada artikel</p>`;
    return;
  }

  container.innerHTML = list.map(item => `
    <div class="investor-home-article-card" data-artikel-id="${item.id}">
      <img src="${item.thumbnail || ""}" alt="" class="investor-home-article-thumb">
      <div class="investor-home-article-body">
        <div class="investor-home-article-heading">${item.judul || "-"}</div>
        <div class="investor-home-article-excerpt">${item.excerpt || ""}</div>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".investor-home-article-card").forEach(card => {
    card.onclick = () => {
      const artikel = list.find(a => a.id === card.dataset.artikelId);
      if (artikel) openArtikelDetail(artikel);
    };
  });
}
async function homeLoadArtikel() {
  // 1. render in-memory cache dulu kalau ada (paling instant, sesi masih sama)
  if (artikelCache) {
    renderArtikelList(artikelCache);
    fetchFreshArtikel();
    return;
  }

  // 2. render dari IDB kalau ada (instant walau baru buka sesi)
  const cachedIdb = await artikelIdbGet("artikelList");
  if (cachedIdb) {
    artikelCache = cachedIdb;
    renderArtikelList(cachedIdb);
    fetchFreshArtikel();
    return;
  }

  // 3. belum ada cache sama sekali → baru tunjukin loading & tunggu fetch
  try {
    const list = await homeFetchArtikel();
    artikelCache = list;
    artikelIdbSet("artikelList", list);
    renderArtikelList(list);
  } catch (err) {
    console.error(err);
    document.getElementById("homeArtikelList").innerHTML =
      `<p class="investor-porto-placeholder">Gagal memuat artikel</p>`;
  }
}
async function fetchFreshArtikel() {
  try {
    const list = await homeFetchArtikel();
    artikelCache = list;
    artikelIdbSet("artikelList", list);
    renderArtikelList(list);
  } catch (err) {
    console.error(err);
    // gagal fetch fresh, biarkan yang di-render tetap cache lama
  }
}
function openArtikelDetail(artikel) {
  document.getElementById("artikelDetailThumb").src = artikel.thumbnail || "";
  document.getElementById("artikelDetailJudul").textContent = artikel.judul || "-";
  document.getElementById("artikelDetailKonten").textContent = artikel.konten || "";

  document.getElementById("artikelSheetOverlay").classList.add("active");
  document.getElementById("artikelSheet").classList.add("active");

  initArtikelSheetInteraction();
}
function initArtikelSheetInteraction() {
  if (artikelSheetInitialized) return;
  artikelSheetInitialized = true;

  const overlay = document.getElementById("artikelSheetOverlay");
  const sheet = document.getElementById("artikelSheet");

  function closeSheet() {
    overlay.classList.remove("active");
    sheet.classList.remove("active");
  }

  window.attachSwipeToClose(sheet, overlay, closeSheet, sheet);
}
