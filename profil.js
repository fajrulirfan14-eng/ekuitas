
function profilLoadData() {
  const user = window.currentUser || {};
  const avatar = document.getElementById("profilAvatar");

  avatar.src = user.foto && user.foto.trim() !== ""
    ? user.foto
    : "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(user.nama || "U");

  document.getElementById("profilNama").textContent = user.nama || "-";
  document.getElementById("profilEmail").textContent = user.email || "-";

  document.getElementById("profilInfoEmail").textContent = user.email || "-";
  document.getElementById("profilInfoTelepon").textContent = user.noTelepon || "-";
  document.getElementById("profilInfoAlamat").textContent = user.alamat || "-";
  document.getElementById("profilInfoTtl").textContent = user.tempatTanggalLahir || "-";
  document.getElementById("profilInfoCabang").textContent = user.cabangEkuitas || "-";
}

/* ===== DROPDOWN ===== */
function toggleProfilDropdown(forceClose) {
  const dropdown = document.getElementById("profilDropdown");
  if (forceClose) {
    dropdown.classList.remove("open");
    return;
  }
  dropdown.classList.toggle("open");
}

/* ===== CROP STATE ===== */
let cropState = { img: null, scale: 1, minScale: 1, offsetX: 0, offsetY: 0, dragging: false, startX: 0, startY: 0 };

function openCropModal(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const imgEl = document.getElementById("cropImage");
    imgEl.onload = () => {
      // Tampilkan overlay dulu biar viewport punya ukuran (clientWidth ngga 0)
      document.getElementById("cropOverlay").classList.add("active");

      const viewport = document.getElementById("cropViewport");
      const vpSize = viewport.clientWidth;
      const minScale = Math.max(vpSize / imgEl.naturalWidth, vpSize / imgEl.naturalHeight);

      cropState = {
        img: imgEl,
        scale: minScale,
        minScale,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        startX: 0,
        startY: 0
      };

      document.getElementById("cropZoom").min = minScale;
      document.getElementById("cropZoom").max = minScale * 3;
      document.getElementById("cropZoom").value = minScale;

      applyCropTransform();
    };
    imgEl.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function applyCropTransform() {
  const { img, scale, offsetX, offsetY } = cropState;
  if (!img) return;
  img.style.width = `${img.naturalWidth * scale}px`;
  img.style.height = `${img.naturalHeight * scale}px`;
  img.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}
function initCropDrag() {
  const viewport = document.getElementById("cropViewport");

  function getPos(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
  }

  function onStart(e) {
    cropState.dragging = true;
    const pos = getPos(e);
    cropState.startX = pos.x - cropState.offsetX;
    cropState.startY = pos.y - cropState.offsetY;
  }

  function onMove(e) {
    if (!cropState.dragging) return;
    e.preventDefault();
    const pos = getPos(e);
    cropState.offsetX = pos.x - cropState.startX;
    cropState.offsetY = pos.y - cropState.startY;
    applyCropTransform();
  }

  function onEnd() {
    cropState.dragging = false;
  }

  viewport.addEventListener("mousedown", onStart);
  viewport.addEventListener("touchstart", onStart, { passive: true });
  window.addEventListener("mousemove", onMove);
  viewport.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("mouseup", onEnd);
  viewport.addEventListener("touchend", onEnd);

  document.getElementById("cropZoom").addEventListener("input", (e) => {
    cropState.scale = parseFloat(e.target.value);
    applyCropTransform();
  });
}
function closeCropModal() {
  document.getElementById("cropOverlay").classList.remove("active");
  document.getElementById("profilFotoInput").value = "";
}
function exportCroppedImage() {
  return new Promise((resolve) => {
    const { img, scale, offsetX, offsetY } = cropState;
    const viewport = document.getElementById("cropViewport");
    const vpSize = viewport.clientWidth;
    const outputSize = 400;

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");

    const ratio = outputSize / vpSize;
    const drawW = img.naturalWidth * scale * ratio;
    const drawH = img.naturalHeight * scale * ratio;
    const drawX = outputSize / 2 - drawW / 2 + offsetX * ratio;
    const drawY = outputSize / 2 - drawH / 2 + offsetY * ratio;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
  });
}

/* ===== UPLOAD / DELETE ===== */
async function profilUploadBlob(blob) {
  const uid = window.currentUser?.uid;
  if (!uid) return;

  const saveBtn = document.getElementById("cropSaveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Menyimpan...";

  try {
    const sRef = window.storageRef(window.storage, `fotoUsers/${uid}`);
    await window.uploadBytes(sRef, blob);
    const url = await window.getDownloadURL(sRef);

    await window.updateDoc(window.doc(window.db, "users", uid), { foto: url });

    window.currentUser.foto = url;
    document.getElementById("profilAvatar").src = url;
    closeCropModal();
  } catch (err) {
    console.error(err);
    alert("Gagal upload foto, coba lagi.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Simpan";
  }
}
async function profilHapusFoto() {
  const uid = window.currentUser?.uid;
  if (!uid) return;

  const deleteBtn = document.getElementById("confirmDeleteBtn");
  deleteBtn.disabled = true;
  deleteBtn.textContent = "Menghapus...";

  try {
    const sRef = window.storageRef(window.storage, `fotoUsers/${uid}`);
    try {
      await window.deleteObject(sRef);
    } catch (err) {
      // ignore kalau file memang sudah tidak ada di storage
    }

    await window.updateDoc(window.doc(window.db, "users", uid), { foto: "" });

    window.currentUser.foto = "";
    document.getElementById("profilAvatar").src =
      "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(window.currentUser.nama || "U");

    document.getElementById("confirmOverlay").classList.remove("active");
  } catch (err) {
    console.error(err);
    alert("Gagal hapus foto, coba lagi.");
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = "Hapus";
  }
}

/* ===== INIT ===== */
let profilCropInitialized = false;
let aksesInitialized = false;
function aksesApplyDarkMode(enabled) {
  document.documentElement.classList.toggle("dark-mode", enabled);
  localStorage.setItem("pref_darkmode", enabled ? "1" : "0");
}
function aksesApplyFontScale(step) {
  const scale = 1 + step * 0.05;
  document.documentElement.style.setProperty("--user-font-scale", scale);
  localStorage.setItem("pref_fontscale", step);
  document.getElementById("aksesFontValue").textContent = step.toFixed(1);
  document.getElementById("aksesFontSlider").value = step;
}
function openAksesPanel() {
  document.getElementById("aksesOverlay").classList.add("active");
  document.getElementById("aksesPanel").classList.add("active");
}
function closeAksesPanel() {
  document.getElementById("aksesOverlay").classList.remove("active");
  document.getElementById("aksesPanel").classList.remove("active");
}
function initAksesPanel() {
  if (aksesInitialized) return;
  aksesInitialized = true;

  const overlay = document.getElementById("aksesOverlay");
  const panel = document.getElementById("aksesPanel");
  window.attachSwipeToCloseHorizontal(panel, overlay, closeAksesPanel);

  document.getElementById("aksesCloseBtn").onclick = closeAksesPanel;

  const darkToggle = document.getElementById("aksesDarkModeToggle");
  darkToggle.checked = localStorage.getItem("pref_darkmode") === "1";
  darkToggle.onchange = () => aksesApplyDarkMode(darkToggle.checked);

  const savedStep = parseFloat(localStorage.getItem("pref_fontscale") || "0");
  aksesApplyFontScale(savedStep);

  const slider = document.getElementById("aksesFontSlider");
  slider.oninput = () => aksesApplyFontScale(parseFloat(slider.value));

  document.getElementById("aksesFontMinus").onclick = () => {
    const val = Math.max(-5, parseFloat(slider.value) - 1);
    aksesApplyFontScale(val);
  };
  document.getElementById("aksesFontPlus").onclick = () => {
    const val = Math.min(5, parseFloat(slider.value) + 1);
    aksesApplyFontScale(val);
  };
}

window.initProfilView = function () {
  profilLoadData();
  const editBtn = document.getElementById("profilEditBtn");
  const fotoInput = document.getElementById("profilFotoInput");
  editBtn.onclick = (e) => {
    e.stopPropagation();
    toggleProfilDropdown();
  };

  document.addEventListener("click", () => toggleProfilDropdown(true));
  document.getElementById("profilUbahFotoBtn").onclick = () => {
    toggleProfilDropdown(true);
    fotoInput.click();
  };
  document.getElementById("profilHapusFotoBtn").onclick = () => {
    toggleProfilDropdown(true);
    document.getElementById("confirmOverlay").classList.add("active");
  };

  fotoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) openCropModal(file);
  };
  if (!profilCropInitialized) {
    initCropDrag();
    profilCropInitialized = true;
  }

  document.getElementById("cropCancelBtn").onclick = closeCropModal;
  document.getElementById("cropSaveBtn").onclick = async () => {
    const blob = await exportCroppedImage();
    if (blob) await profilUploadBlob(blob);
  };
  document.getElementById("confirmCancelBtn").onclick = () => {
    document.getElementById("confirmOverlay").classList.remove("active");
  };
  document.getElementById("confirmDeleteBtn").onclick = profilHapusFoto;
  document.getElementById("profilLogoutBtn").onclick = () => {
    window.openLogoutConfirm();
  };
  document.getElementById("profilAksesBtn").onclick = () => {
    initAksesPanel();
    openAksesPanel();
  };

  document.getElementById("profilSuratPerjanjianBtn").onclick = () => {
    window.showView("suratPerjanjian");
  };
  document.getElementById("profilKeamananBtn").onclick = () => {
    window.showView("keamanan");
  };
  document.getElementById("profilTentangBtn").onclick = () => {
    window.showView("tentang");
  };
};
