window.initSuratPerjanjianView = async function() {
  const user = window.currentUser;
  if (!user) return;

  const setImg = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.src = val || "LogoTTN.png";
  };
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val || "-";
  };

  try {
    const q = window.query(
      window.collection(window.db, "suratPerjanjianInvestasi"),
      window.where("idCabang", "==", user.idCabang)
    );
    const snap = await window.getDocs(q);
    if (snap.empty) return;

    const data = snap.docs[0].data();
    const info = data.infoPerusahaan || {};

    setImg("kopSuratLogo", info.foto);
    setText("kopSuratNama", info.nama);
    setText("kopSuratSekretariat", info.sekretariat);
    setText("kopSuratTelepon", info.noTelepon);
    setText("kopSuratWeb", info.web);
    setText("kopSuratEmail", info.email);

    // BODY SURAT — Pihak Pertama (user)
    setText("suratTanggalInves", user.tanggalInvest);
    setText("suratNamaUser", user.nama);
    setText("suratNikUser", user.nik);
    setText("suratPekerjaanUser", user.pekerjaan);
    setText("suratAlamatUser", user.alamat);

    // BODY SURAT — Pihak Kedua (perusahaan)
    setText("suratNamaPerusahaan", info.nama);
    setText("suratNibPerusahaan", info.nib);
    setText("suratNpwpPerusahaan", info.npwp);
    setText("suratSkPerusahaan", info.sk);

    // BODY SURAT — Klausul modal investasi
    const ekuitas = Number(user.ekuitas) || 0;
    setText("suratEkuitasNominal", "Rp " + ekuitas.toLocaleString("id-ID"));
    setText("suratEkuitasTerbilang", terbilang(ekuitas) + " Rupiah");
    setText("suratCabangEkuitas1", user.cabangEkuitas);
    setText("suratCabangEkuitas2", user.cabangEkuitas);

    // BODY SURAT — Pasal-pasal
    const ekuitasFormatted = "Rp " + ekuitas.toLocaleString("id-ID") + ",-";

    const tanggalInvestFormatted = user.tanggalInvest
      ? new Date(user.tanggalInvest).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
      : (user.tanggalInvest || "-");
    const cabangEkuitasFormatted = user.cabangEkuitas || "-";

    const pasalArr = (data.pasal || [])
      .map(p => p.pasal)
      .filter(Boolean)
      .sort((a, b) => (a.no || 0) - (b.no || 0));

    const pasalListEl = document.getElementById("suratPasalList");
    if (pasalListEl) {
      pasalListEl.innerHTML = pasalArr.map(p => {
        const isiFinal = (p.isi || "")
          .replace(/"ekuitas"/g, `<strong>${ekuitasFormatted}</strong>`)
          .replace(/"cabangEkuitas"/g, `<strong>${cabangEkuitasFormatted}</strong>`)
          .replace(/"tanggalInvest"/g, `<strong>${tanggalInvestFormatted}</strong>`);
        return `
          <div class="surat-pasal">
            <div class="surat-pasal-no">PASAL ${p.no || "-"}</div>
            <div class="surat-pasal-judul">${p.judul || "-"}</div>
            <div class="surat-pasal-isi">${isiFinal}</div>
          </div>
        `;
      }).join("");
    }

    // TTD
    const setTtd = (imgId, placeholderId, url) => {
      const imgEl = document.getElementById(imgId);
      const phEl  = document.getElementById(placeholderId);
      if (!imgEl || !phEl) return;
      if (!url) {
        phEl.classList.remove("hide");
        imgEl.classList.remove("show");
        return;
      }
      imgEl.onload = () => {
        imgEl.classList.add("show");
        phEl.classList.add("hide");
      };
      imgEl.onerror = () => {
        imgEl.classList.remove("show");
        phEl.classList.remove("hide");
      };
      imgEl.src = url;
    };

    setTtd("suratTtdUser", "suratTtdUserPlaceholder", user.ttd);
    setTtd("suratTtdPerusahaan", "suratTtdPerusahaanPlaceholder", info.ttd);

    setText("suratTtdNamaUser", user.nama);
    setText("suratTtdCabang", user.cabangEkuitas);
  } catch (e) {
    console.log("Gagal load kop surat:", e);
  }
};

function terbilang(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

  function convert(num) {
    if (num < 12) return satuan[num];
    if (num < 20) return convert(num - 10) + " Belas";
    if (num < 100) return convert(Math.floor(num / 10)) + " Puluh" + (num % 10 !== 0 ? " " + convert(num % 10) : "");
    if (num < 200) return "Seratus" + (num % 100 !== 0 ? " " + convert(num % 100) : "");
    if (num < 1000) return convert(Math.floor(num / 100)) + " Ratus" + (num % 100 !== 0 ? " " + convert(num % 100) : "");
    if (num < 2000) return "Seribu" + (num % 1000 !== 0 ? " " + convert(num % 1000) : "");
    if (num < 1000000) return convert(Math.floor(num / 1000)) + " Ribu" + (num % 1000 !== 0 ? " " + convert(num % 1000) : "");
    if (num < 1000000000) return convert(Math.floor(num / 1000000)) + " Juta" + (num % 1000000 !== 0 ? " " + convert(num % 1000000) : "");
    if (num < 1000000000000) return convert(Math.floor(num / 1000000000)) + " Miliar" + (num % 1000000000 !== 0 ? " " + convert(num % 1000000000) : "");
    return convert(Math.floor(num / 1000000000000)) + " Triliun" + (num % 1000000000000 !== 0 ? " " + convert(num % 1000000000000) : "");
  }

  if (n === 0) return "Nol";
  return convert(n);
}
