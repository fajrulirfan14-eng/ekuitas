window.initKeamananView = async function() {
  const user = window.currentUser;
  const authUser = window.auth.currentUser;
  if (!user || !authUser) return;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  // UID
  setText("keamananUID", authUser.uid);

  // Email
  setText("keamananEmail", authUser.email || "-");

  // Verifikasi email
  setText("keamananVerifikasi", authUser.emailVerified ? "✓ Email Terverifikasi" : "Terverifikasi");

  // Last login
  const lastSignIn = authUser.metadata?.lastSignInTime;
  if (lastSignIn) {
    const d = new Date(lastSignIn);
    setText("keamananLastLogin", d.toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }));
  } else {
    setText("keamananLastLogin", "Tidak diketahui");
  }

  // Device info
  const ua = navigator.userAgent;
  let device = "Perangkat Mobile";
  if (ua.includes("Android")) device = "Android · " + (ua.match(/Android ([0-9.]+)/)?.[1] || "");
  else if (ua.includes("iPhone")) device = "iPhone · iOS";
  setText("keamananDevice", device);

  // Sync status
  setText("keamananSyncStatus", navigator.onLine ? "Online" : "Offline");

  // Data lokal — hitung record
  try {
    const db = await window.openAppDB();
    const storeNames = ["customerHarianDB","usersDB","kantorDB","customerBaruDB","dataHarianDB","laporanMarketingDB"];
    let total = 0;
    for (const name of storeNames) {
      const count = await new Promise(resolve => {
        try {
          const tx = db.transaction(name, "readonly");
          const req = tx.objectStore(name).count();
          req.onsuccess = () => resolve(req.result || 0);
          req.onerror  = () => resolve(0);
        } catch { resolve(0); }
      });
      total += count;
    }
    setText("keamananDataLokal", `${total} record`);
  } catch(e) {
    setText("keamananDataLokal", "-");
  }

  // Copy UID
  const btnCopy = document.getElementById("btnCopyUID");
  if (btnCopy && !btnCopy.dataset.listener) {
    btnCopy.dataset.listener = "true";
    btnCopy.addEventListener("click", () => {
      navigator.clipboard?.writeText(authUser.uid).then(() => {
        btnCopy.innerHTML = `<i class="fa-solid fa-check"></i>`;
        btnCopy.style.background = "#f0fdf4";
        btnCopy.style.color = "#16a34a";
        setTimeout(() => {
          btnCopy.innerHTML = `<i class="fa-regular fa-copy"></i>`;
          btnCopy.style.background = "";
          btnCopy.style.color = "";
        }, 1500);
      });
    });
  }

  // Refresh token
  const btnRefresh = document.getElementById("btnKeamananRefreshToken");
  if (btnRefresh && !btnRefresh.dataset.listener) {
    btnRefresh.dataset.listener = "true";
    btnRefresh.addEventListener("click", async () => {
      try {
        await authUser.getIdToken(true);
        const icon = btnRefresh.querySelector(".keamanan-card-icon");
        if (icon) {
          icon.style.background = "#f0fdf4";
          icon.style.color = "#16a34a";
          setTimeout(() => {
            icon.style.background = "";
            icon.style.color = "";
          }, 1500);
        }
      } catch(e) {
        console.log("Refresh token gagal:", e);
      }
    });
  }

  // Logout paksa
  const btnLogoutAll = document.getElementById("btnKeamananLogoutAll");

  if (btnLogoutAll && !btnLogoutAll.dataset.listener) {
    btnLogoutAll.dataset.listener = "true";

    btnLogoutAll.addEventListener("click", () => {
      window.openLogoutConfirm();
    });
  }
};