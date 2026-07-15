import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCp32H2WeN3A4ZwwWeUWe3Qcjqh0mz_vvQ",
  authDomain: "teh-tarik-nusantara-26371.firebaseapp.com",
  projectId: "teh-tarik-nusantara-26371",
  storageBucket: "teh-tarik-nusantara-26371.firebasestorage.app",
  messagingSenderId: "354760960352",
  appId: "1:354760960352:web:7d6a6c07dace937a74d605",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
const db = getFirestore(app);
const storage = getStorage(app);

window.auth = auth;
window.db = db;
window.storage = storage;
window.storageRef = storageRef;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;
window.deleteObject = deleteObject;
window.doc = doc;
window.getDoc = getDoc;
window.collection = collection;
window.collectionGroup = collectionGroup;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.limit = limit;
window.getDocs = getDocs;
window.updateDoc = updateDoc;
window.onSnapshot = onSnapshot;
window.currentUser = null;
window.currentView = "home";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  try {
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      const userData = docSnap.data();
      if (userData.status === false) {
        showPopupNonaktif();
        return;
      }
      window.currentUser = { uid: user.uid, email: user.email, ...userData };
    }
  } catch (err) {
    window.location.href = "login.html";
    return;
  }
  initNavbar();
  showView("home");
});

function showPopupNonaktif() {
  const overlay = document.createElement("div");
  overlay.className = "nonaktif-overlay";
  overlay.innerHTML = `
    <div class="nonaktif-card">
      <div class="nonaktif-icon">🚫</div>
      <div class="nonaktif-title">Akun Dinonaktifkan</div>
      <div class="nonaktif-desc">Akun kamu telah dinonaktifkan oleh admin.</div>
      <button class="nonaktif-btn" id="btnNonaktifOk">OK</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("btnNonaktifOk").onclick = async () => {
    await signOut(auth);
    window.location.href = "login.html";
  };
}

window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};
window.openLogoutConfirm = function () {
  document.getElementById("logoutOverlay")?.classList.add("active");
};
window.closeLogoutConfirm = function () {
  document.getElementById("logoutOverlay")?.classList.remove("active");
};
document.addEventListener("DOMContentLoaded", () => {
  const cancelBtn = document.getElementById("logoutCancelBtn");
  const confirmBtn = document.getElementById("logoutConfirmBtn");

  if (cancelBtn) cancelBtn.onclick = window.closeLogoutConfirm;
  if (confirmBtn) confirmBtn.onclick = window.logout;
});

/* ===== ROUTER ===== */
const NAVBAR_VISIBLE_VIEWS = ["home", "profil", "penjualan"];

window.showView = function (viewName, trigger = "push") {
  const prevViewEl = document.querySelector(".investor-view.active");
  document.querySelectorAll(".investor-view").forEach(v => {
    v.classList.remove("active", "view-anim-navbar", "view-anim-push", "view-anim-pop");
  });

  const nextViewEl = document.getElementById(`investor-${viewName}-view`);
  nextViewEl.classList.add("active");

  if (prevViewEl) {
    const animClass =
      trigger === "navbar" ? "view-anim-navbar" :
      trigger === "pop" ? "view-anim-pop" : "view-anim-push";
    nextViewEl.classList.add(animClass);
    nextViewEl.addEventListener("animationend", () => {
      nextViewEl.classList.remove(animClass);
    }, { once: true });
  }

  window.currentView = viewName;

  const appEl = document.getElementById("app");
  if (appEl) appEl.scrollTop = 0;
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  if (location.hash !== "#" + viewName) {
    history.replaceState(null, "", "#" + viewName);
  }

  const navbar = document.getElementById("navbarBottom");
  if (navbar) {
    navbar.classList.toggle("hide", !NAVBAR_VISIBLE_VIEWS.includes(viewName));
  }

  const initFnName = `init${viewName.charAt(0).toUpperCase() + viewName.slice(1)}View`;
  if (typeof window[initFnName] === "function") {
    window[initFnName]();
  }
};
function syncNavToView(viewName) {
  const items = document.querySelectorAll(".nav-item");
  items.forEach(i => {
    if (i.dataset.label) {
      i.innerHTML =
        `<i class="${i.dataset.icon} nav-icon"></i>` +
        `<span>${i.dataset.label}</span>`;
    }
    i.classList.remove("active");
  });
  const targetNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (targetNav) {
    targetNav.innerHTML =
      `<span class="nav-placeholder"></span>` +
      `<span>${targetNav.dataset.label}</span>`;
    targetNav.classList.add("active");
    window._moveFab?.(targetNav);
  }
}

/* ===== BACK ANDROID → selalu ke home, abaikan histori ===== */
history.pushState({ app: true }, "");
history.pushState({ app: true }, "");
history.pushState({ app: true }, "");
location.hash = "home";

let _backLocked = false;
const BACK_TARGET_OVERRIDE = {
  keamanan: "profil",
  tentang: "profil",
  suratPerjanjian: "profil"
};

function _handleBack() {
  if (_backLocked) return;
  _backLocked = true;

  const target = BACK_TARGET_OVERRIDE[window.currentView] || "home";

  if (window.currentView !== target) {
    window.showView(target, "pop");
    syncNavToView(target);
  }

  // Isi ulang history entry biar tombol back ngga pernah kehabisan "tabungan"
  history.pushState({ app: true }, "", "#" + window.currentView);

  setTimeout(() => {
    _backLocked = false;
  }, 300);
}

window.addEventListener("hashchange", () => {
  if (location.hash !== "#" + window.currentView) {
    _handleBack();
  }
});

/* ===== NAVBAR (curve + fab) ===== */
function buildNavPath(cx, W, H) {
  const style = getComputedStyle(document.documentElement);
  const R   = parseFloat(style.getPropertyValue("--nav-radius")) || 16;
  const r   = parseFloat(style.getPropertyValue("--nav-curve-r")) || 52;
  const dip = parseFloat(style.getPropertyValue("--nav-curve-dip")) || 32;
  const cp  = parseFloat(style.getPropertyValue("--nav-curve-cp")) || 0.55;

  const left  = cx - r;
  const right = cx + r;

  return `
    M${R} 0
    H${left}
    C${left + r * cp} 0 ${cx - r * cp} ${dip} ${cx} ${dip}
    C${cx + r * cp} ${dip} ${right - r * cp} 0 ${right} 0
    H${W - R}
    Q${W} 0 ${W} ${R}
    V${H - R}
    Q${W} ${H} ${W - R} ${H}
    H${R}
    Q0 ${H} 0 ${H - R}
    V${R}
    Q0 0 ${R} 0
    Z
  `.replace(/\s+/g, " ").trim();
}

function initNavbar() {
  const fab     = document.getElementById("navFab");
  const fabIcon = document.getElementById("navFabIcon");
  const svgPath = document.getElementById("navSvgPath");

  function getFabLeftPercent(item) {
    const navbar   = document.getElementById("navbarBottom");
    const navRect  = navbar.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const centerX  = itemRect.left + itemRect.width / 2 - navRect.left;
    return (centerX / navRect.width) * 100;
  }

  function buildPath(leftPercent) {
    const css = getComputedStyle(document.documentElement);
    const W   = 400;
    const cx  = (leftPercent / 100) * W;
    const r   = parseFloat(css.getPropertyValue("--nav-curve-r"))   || 52;
    const dip = parseFloat(css.getPropertyValue("--nav-curve-dip")) || 32;
    const cp  = parseFloat(css.getPropertyValue("--nav-curve-cp"))  || 0.55;
    const top = 16;
    const x0  = cx - r;
    const x1  = cx + r;

    return [
      `M16 ${top}`,
      `H${x0}`,
      `C${x0 + r * cp} ${top}  ${cx - r * cp} ${top + dip}  ${cx} ${top + dip}`,
      `C${cx + r * cp} ${top + dip}  ${x1 - r * cp} ${top}  ${x1} ${top}`,
      `H400 V64 Q400 80 384 80`,
      `H16 Q0 80 0 64 V${top} Z`
    ].join(" ");
  }

  function moveFab(item, animate = true) {
    const leftPct = getFabLeftPercent(item);

    if (animate) {
      fab.classList.remove("is-moving");
      void fab.offsetWidth;
      fab.classList.add("is-moving");
    }

    fab.style.left = `${leftPct}%`;

    fabIcon.className = item.dataset.icon;
    if (animate) {
      fabIcon.classList.remove("icon-anim");
      void fabIcon.offsetWidth;
      fabIcon.classList.add("icon-anim");
    }

    svgPath.setAttribute("d", buildPath(leftPct));

    const css = getComputedStyle(document.documentElement);
    fab.style.borderColor = css.getPropertyValue("--nav-fab-border").trim() || "#F7F3EE";
  }

  window._moveFab = moveFab;

  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    const labelEl = item.querySelector("span:last-child");
    if (labelEl && !item.dataset.label) {
      item.dataset.label = labelEl.textContent.trim();
    }
  });

  navItems.forEach(item => {
    // role-based hide
    const allowedRoles = item.dataset.roles;
    if (allowedRoles) {
      const roles = allowedRoles.split(",").map(r => r.trim());
      if (!roles.includes(window.currentUser?.role)) {
        item.style.display = "none";
        return;
      }
    }

    item.addEventListener("click", () => {
      const prevActive = document.querySelector(".nav-item.active");
      if (prevActive && prevActive !== item) {
        prevActive.innerHTML =
          `<i class="${prevActive.dataset.icon} nav-icon"></i>` +
          `<span>${prevActive.dataset.label}</span>`;
        prevActive.classList.remove("active");
      }

      item.innerHTML =
        `<span class="nav-placeholder"></span>` +
        `<span>${item.dataset.label}</span>`;
      item.classList.add("active");

      moveFab(item);
      window.showView(item.dataset.view, "navbar");
    });
  });

  const firstActive = document.querySelector(".nav-item.active");
  if (firstActive) {
    svgPath.style.transition = "none";
    fab.style.transition     = "none";

    setTimeout(() => {
      moveFab(firstActive, false);
      setTimeout(() => {
        svgPath.style.transition = "";
        fab.style.transition     = "left .4s cubic-bezier(.34,1.3,.64,1)";
      }, 50);
    }, 80);
  }
}

/* ===== SWIPE TO CLOSE HORIZONTAL (panel dari kanan, swipe kanan nutup) ===== */
window.attachSwipeToCloseHorizontal = function (panel, overlay, closeFn) {
  if (overlay) overlay.addEventListener("click", closeFn);

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
    if (delta > 80) closeFn();
  }

  panel.addEventListener("touchstart", onStart, { passive: true });
  panel.addEventListener("touchmove", onMove, { passive: false });
  panel.addEventListener("touchend", onEnd, { passive: true });
};

/* ===== SWIPE TO CLOSE (shared, dipakai semua sheet) ===== */
window.attachSwipeToClose = function (sheet, overlay, closeFn, scrollableEl) {
  if (overlay) overlay.addEventListener("click", closeFn);

  let startY = 0;
  let currentY = 0;
  let dragging = false;

  function isInsideDropdown(target) {
    return !!target.closest(".investor-custom-select-options, .investor-custom-select-trigger");
  }

  function onStart(e) {
    if (isInsideDropdown(e.target)) return;
    if (scrollableEl && scrollableEl.scrollTop > 0) return;
    dragging = true;
    startY = e.touches[0].clientY;
    currentY = startY;
    sheet.style.transition = "none";
  }

  function onMove(e) {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const delta = Math.max(0, currentY - startY);
    if (delta > 0) {
      e.preventDefault();
      e.stopPropagation();
      sheet.style.transform = `translateY(${delta}px)`;
    }
  }

  function onEnd(e) {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "";
    const delta = currentY - startY;
    sheet.style.transform = "";
    if (delta > 90) {
      e.stopPropagation();
      closeFn();
    }
  }

  sheet.addEventListener("touchstart", onStart, { passive: true });
  sheet.addEventListener("touchmove", onMove, { passive: false });
  sheet.addEventListener("touchend", onEnd, { passive: true });
};

/* ===== BADGE NOTIF ===== */
window.setNavBadge = function (viewName, count) {
  const item = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (!item) return;
  let badge = item.querySelector(".nav-badge");
  if (!count || count <= 0) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "nav-badge";
    item.appendChild(badge);
  }
  badge.textContent = count > 99 ? "99+" : count;
};
