// ─── KONFIGURASI ────────────────────────────────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbwBRo4fxw7qtrN4itNXFqsK_ZRrWxqhot6__qdFa68pg-emJ6gB_Fj9cBw6KXIyK3bm/exec";

// ─── STATE ──────────────────────────────────────────────────
let currentPage   = "dashboard";
let pendingDelete = { type: null, id: null };
let daftarAnggota = []; // cache daftar anggota untuk dropdown

// ─── INIT ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setTodayDates();
  updateTopbarDate();
  checkConnection();
  loadDashboard();
});

function setTodayDates() {
  const today = new Date().toISOString().split("T")[0];
  ["absT", "keuT"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
}

function updateTopbarDate() {
  const el = document.getElementById("topbarDate");
  if (!el) return;
  el.textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

// ─── NAVIGASI ────────────────────────────────────────────────
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll(".nav-item").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.page === page));
  document.querySelectorAll(".page").forEach(p =>
    p.classList.toggle("active", p.id === "page-" + page));

  const titles = { dashboard: "Dashboard", absensi: "Modul Absensi", keuangan: "Modul Keuangan", anggota: "Daftar Anggota", rekap: "Rekap Absensi", dokumen: "Dokumen", qr: "Absen via QR", event: "Event", wagroup: "Cek Grup WA" };
  document.getElementById("topbarTitle").textContent = titles[page] || page;

  if (page === "dashboard") loadDashboard();
  if (page === "keuangan")  loadRingkasanKeuangan();
  if (page === "anggota")   loadAnggota();
  if (page === "rekap")     initRekap();
  if (page === "dokumen")   loadDokumen();
  if (page === "qr")        loadDaftarSesiQR();
  if (page === "event")     { kembaliKeListEvent(); loadDaftarEvent(); }
  if (page === "wagroup")   loadDatabaseNomorWA();
  if (page === "kalender")  loadKalender();
  if (page === "galungan")  initGalungan();
  if (page === "ukuran")    initUkuranBaju();
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("show");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("show");
}

// ─── CONNECTION ──────────────────────────────────────────────
async function checkConnection() {
  const dot  = document.querySelector(".status-dot");
  const text = document.querySelector(".status-text");
  try {
    await fetchAPI("getRingkasan");
    dot.className = "status-dot online";
    text.textContent = "Terhubung ke Sheets";
  } catch {
    dot.className = "status-dot offline";
    text.textContent = "Koneksi gagal";
  }
}

// ─── API ─────────────────────────────────────────────────────
async function fetchAPI(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  if (!response.ok) throw new Error("HTTP error: " + response.status);
  const data = await response.json();
  if (data.status === "error") throw new Error(data.message);
  return data;
}

async function writeAPI(action, data) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("payload", JSON.stringify(data));
  const response = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  if (!response.ok) throw new Error("HTTP error: " + response.status);
  const result = await response.json();
  if (result.status === "error") throw new Error(result.message);
  return result;
}

// ─── FORMAT HELPERS ──────────────────────────────────────────
function formatRupiah(angka) {
  return "Rp " + Number(angka).toLocaleString("id-ID");
}

function formatTanggal(str) {
  if (!str) return "—";
  try {
    const s = String(str);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.substring(0, 10).split("-");
      const bln = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
      return `${parseInt(d)} ${bln[parseInt(m)-1]} ${y}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const bln = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
      return `${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`;
    }
    return s;
  } catch(e) { return String(str); }
}

function showAlert(elId, type, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = "alert " + type;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  const txt = btn.querySelector(".btn-text");
  const ldg = btn.querySelector(".btn-loading");
  if (txt) txt.classList.toggle("hidden", loading);
  if (ldg) ldg.classList.toggle("hidden", !loading);
}

// ═══ DASHBOARD ════════════════════════════════════════════
async function loadDashboard() {
  try {
    const [keu, trx, abs, ang] = await Promise.all([
      fetchAPI("getRingkasan"),
      fetchAPI("getKeuangan"),
      fetchAPI("getAbsensi"),
      fetchAPI("getAnggota")
    ]);

    if (keu.data) {
      document.getElementById("dashSaldo").textContent      = formatRupiah(keu.data.saldo);
      document.getElementById("dashPemasukan").textContent  = formatRupiah(keu.data.totalPemasukan);
      document.getElementById("dashPengeluaran").textContent = formatRupiah(keu.data.totalPengeluaran);
    }
    document.getElementById("dashAbsensiCount").textContent = (abs.data || []).length + " record";
    document.getElementById("dashAnggotaCount").textContent = (ang.data || []).length + " orang";

    renderDashRecentTable((trx.data || []).slice(0, 5));

    // Cache anggota untuk dropdown
    daftarAnggota = ang.data || [];
    updateDropdownAnggota();

  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

function renderDashRecentTable(rows) {
  const tbody = document.getElementById("dashRecentBody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Belum ada transaksi.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${formatTanggal(r.tanggal)}</td>
      <td><span class="jenis-badge ${r.jenis.toLowerCase()}">${r.jenis}</span></td>
      <td>${r.kategori}</td>
      <td class="currency ${r.jenis === "Pemasukan" ? "pos" : "neg"}">
        ${r.jenis === "Pemasukan" ? "+" : "−"}${formatRupiah(r.nominal)}
      </td>
      <td>${r.keterangan || "—"}</td>
    </tr>
  `).join("");
}

// ═══ MODUL ANGGOTA ════════════════════════════════════════
async function submitAnggota() {
  const editId              = document.getElementById("angEditId").value;
  const nama                = document.getElementById("angNama").value.trim();
  const jabatan             = document.getElementById("angJabatan").value;
  const kontak              = document.getElementById("angKontak").value.trim();
  const statusKeanggotaan   = document.getElementById("angStatusKeanggotaan").value;

  if (!nama) { showAlert("angAlert", "error", "Nama anggota wajib diisi."); return; }

  setLoading("angSubmitBtn", true);
  try {
    if (editId) {
      // Mode edit
      await writeAPI("editAnggota", { id: editId, nama, jabatan, kontak, statusKeanggotaan });
      showAlert("angAlert", "success", "✅ Data anggota berhasil diperbarui!");
      batalEditAnggota(); // reset form & kembali ke mode tambah
    } else {
      // Mode tambah baru
      await writeAPI("tambahAnggota", { nama, jabatan, kontak, statusKeanggotaan });
      showAlert("angAlert", "success", "✅ Anggota berhasil ditambahkan!");
      document.getElementById("angNama").value                  = "";
      document.getElementById("angKontak").value                = "";
      document.getElementById("angJabatan").value               = "Anggota";
      document.getElementById("angStatusKeanggotaan").value     = "Aktif";
    }
    loadAnggota();
  } catch (err) {
    showAlert("angAlert", "error", "❌ Gagal: " + err.message);
  } finally {
    setLoading("angSubmitBtn", false);
  }
}

async function loadAnggota() {
  const tbody = document.getElementById("angTableBody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="6">Memuat data...</td></tr>`;
  try {
    const result = await fetchAPI("getAnggota");
    daftarAnggota = result.data || [];
    updateDropdownAnggota();
    document.getElementById("angBadge").textContent = daftarAnggota.length + " anggota";
    filterTabelAnggota(); // render dengan filter aktif
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">❌ Error: ${err.message}</td></tr>`;
  }
}

// Urutan hierarki untuk Daftar Anggota: jabatan struktural dulu (Ketua → Kesinoman),
// baru anggota biasa dikelompokkan per status (Aktif → Nonaktif → Pengampel).
// Dipakai bersama oleh tabel di layar dan halaman cetak supaya urutannya konsisten.
const URUTAN_JABATAN = ["Ketua", "Wakil Ketua", "Sekretaris", "Bendahara", "Kesinoman"];
const URUTAN_STATUS_ANGGOTA = ["Aktif", "Nonaktif", "Pengampel"];

function urutkanHierarkiAnggota(rows) {
  return [...rows].sort((a, b) => {
    const idxA = peringkatHierarkiAnggota(a);
    const idxB = peringkatHierarkiAnggota(b);
    if (idxA !== idxB) return idxA - idxB;
    return a.nama.localeCompare(b.nama); // dalam kelompok yang sama, urut alfabetis
  });
}

function peringkatHierarkiAnggota(r) {
  const jabatan = r.jabatan || "Anggota";
  const idxJabatan = URUTAN_JABATAN.indexOf(jabatan);
  if (idxJabatan !== -1) return idxJabatan; // 0-4: jabatan struktural

  // Anggota biasa: dikelompokkan setelah semua jabatan struktural, per status
  const status = r.statusKeanggotaan || "Aktif";
  const idxStatus = URUTAN_STATUS_ANGGOTA.indexOf(status);
  return URUTAN_JABATAN.length + (idxStatus === -1 ? URUTAN_STATUS_ANGGOTA.length : idxStatus);
}

function filterTabelAnggota() {
  const cariNama   = (document.getElementById("angFilterNama")?.value || "").toLowerCase().trim();
  const cariStatus = (document.getElementById("angFilterStatus")?.value || "");

  let filtered = daftarAnggota;
  if (cariNama)   filtered = filtered.filter(r => r.nama.toLowerCase().includes(cariNama));
  if (cariStatus) filtered = filtered.filter(r => (r.statusKeanggotaan || "Aktif") === cariStatus);

  renderTabelAnggota(urutkanHierarkiAnggota(filtered));
}

function resetFilterAnggota() {
  document.getElementById("angFilterNama").value   = "";
  document.getElementById("angFilterStatus").value = "";
  filterTabelAnggota();
}

function renderTabelAnggota(rows) {
  const tbody = document.getElementById("angTableBody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Tidak ada anggota yang sesuai filter.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td><span class="nomor-urut">${i + 1}</span></td>
      <td><div class="anggota-nama">${r.nama}</div></td>
      <td><span class="jabatan-badge">${r.jabatan || "Anggota"}</span></td>
      <td><span class="status-keanggotaan-badge ${(r.statusKeanggotaan || 'aktif').toLowerCase()}">${r.statusKeanggotaan || "Aktif"}</span></td>
      <td>${r.kontak || "—"}</td>
      <td style="display:flex; gap:6px;">
        <button class="btn-export" onclick='mulaiEditAnggota(${JSON.stringify(r)})'>
          Edit
        </button>
        <button class="btn-hapus" onclick="konfirmasiHapus('anggota', '${r.id}', '${r.nama}')">
          Hapus
        </button>
      </td>
    </tr>
  `).join("");
}

function mulaiEditAnggota(data) {
  document.getElementById("angEditId").value             = data.id;
  document.getElementById("angNama").value                = data.nama || "";
  document.getElementById("angJabatan").value              = data.jabatan || "Anggota";
  document.getElementById("angStatusKeanggotaan").value    = data.statusKeanggotaan || "Aktif";
  document.getElementById("angKontak").value               = data.kontak || "";

  document.getElementById("angFormTitle").textContent = "Edit Anggota: " + data.nama;
  document.querySelector("#angSubmitBtn .btn-text").textContent = "Simpan Perubahan";
  document.getElementById("angBatalBtn").classList.remove("hidden");

  // Scroll ke form agar terlihat
  document.getElementById("angFormTitle").scrollIntoView({ behavior: "smooth", block: "center" });
}

function batalEditAnggota() {
  document.getElementById("angEditId").value = "";
  document.getElementById("angNama").value    = "";
  document.getElementById("angKontak").value  = "";
  document.getElementById("angJabatan").value = "Anggota";
  document.getElementById("angStatusKeanggotaan").value = "Aktif";

  document.getElementById("angFormTitle").textContent = "Tambah Anggota";
  document.querySelector("#angSubmitBtn .btn-text").textContent = "Tambah Anggota";
  document.getElementById("angBatalBtn").classList.add("hidden");
  document.getElementById("angAlert").classList.add("hidden");
}

/** Update dropdown nama di form Absensi */
function updateDropdownAnggota() {
  const datalist = document.getElementById("listAnggota");
  if (!datalist) return;
  datalist.innerHTML = daftarAnggota.map(a =>
    `<option value="${a.nama}">${a.jabatan ? a.nama + " ("+a.jabatan+")" : a.nama}</option>`
  ).join("");
}

// ═══ MODUL ABSENSI ════════════════════════════════════════
async function submitAbsensi() {
  const tanggal    = document.getElementById("absT").value;
  const nama       = document.getElementById("absNama").value.trim();
  const status     = document.getElementById("absStatus").value;
  const kategori   = document.getElementById("absKategori").value;
  const tempat     = document.getElementById("absTempat").value;
  const keterangan = document.getElementById("absKet").value.trim();

  if (!tanggal || !nama || !status || !kategori || !tempat) {
    showAlert("absAlert", "error", "Tanggal, nama, status, kategori, dan tempat wajib diisi.");
    return;
  }

  setLoading("absSubmitBtn", true);
  try {
    await writeAPI("tambahAbsensi", { tanggal, nama, status, kategori, tempat, keterangan });
    showAlert("absAlert", "success", "✅ Absensi berhasil disimpan!");
    document.getElementById("absNama").value      = "";
    document.getElementById("absStatus").value    = "";
    document.getElementById("absKategori").value  = "";
    document.getElementById("absTempat").value    = "";
    document.getElementById("absKet").value       = "";
    loadAbsensi();
  } catch (err) {
    showAlert("absAlert", "error", "❌ Gagal: " + err.message);
  } finally {
    setLoading("absSubmitBtn", false);
  }
}

async function loadAbsensi() {
  const nama    = document.getElementById("absFilterNama").value.trim();
  const tanggal = document.getElementById("absFilterTanggal").value;
  const tbody   = document.getElementById("absTableBody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="7">Memuat data...</td></tr>`;

  try {
    const params = {};
    if (nama)    params.nama    = nama;
    if (tanggal) params.tanggal = tanggal;

    const result = await fetchAPI("getAbsensi", params);
    const rows   = result.data || [];

    document.getElementById("absBadge").textContent = rows.length + " data";
    updateAbsensiRekap(rows);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Tidak ada data absensi.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${formatTanggal(r.tanggal)}</td>
        <td><strong>${r.nama}</strong></td>
        <td><span class="status-badge ${r.status.toLowerCase()}">${r.status}</span></td>
        <td>${r.kategori || "—"}</td>
        <td>${r.tempat || "—"}</td>
        <td>${r.keterangan || "—"}</td>
        <td><button class="btn-hapus" onclick="konfirmasiHapus('absensi', '${r.id}', '${r.nama}')">Hapus</button></td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">❌ Error: ${err.message}</td></tr>`;
  }
}

function updateAbsensiRekap(rows) {
  const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
  rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
  document.getElementById("rekHadir").textContent = counts.Hadir;
  document.getElementById("rekIzin").textContent  = counts.Izin;
  document.getElementById("rekSakit").textContent = counts.Sakit;
  document.getElementById("rekAlfa").textContent  = counts.Alfa;
}

function resetFilterAbsensi() {
  document.getElementById("absFilterNama").value    = "";
  document.getElementById("absFilterTanggal").value = "";
  loadAbsensi();
}

// ═══ MODUL KEUANGAN ═══════════════════════════════════════
function setJenis(jenis) {
  document.getElementById("keuJenis").value = jenis;
  document.getElementById("btnPemasukan").classList.toggle("active", jenis === "Pemasukan");
  document.getElementById("btnPengeluaran").classList.toggle("active", jenis === "Pengeluaran");
}

async function submitKeuangan() {
  const tanggal    = document.getElementById("keuT").value;
  const jenis      = document.getElementById("keuJenis").value;
  const kategori   = document.getElementById("keuKategori").value;
  const nominal    = document.getElementById("keuNominal").value;
  const keterangan = document.getElementById("keuKet").value.trim();

  if (!tanggal || !jenis || !kategori || !nominal) {
    showAlert("keuAlert", "error", "Semua field bertanda * wajib diisi.");
    return;
  }

  setLoading("keuSubmitBtn", true);
  try {
    await writeAPI("tambahKeuangan", { tanggal, jenis, kategori, nominal, keterangan });
    showAlert("keuAlert", "success", "✅ Transaksi berhasil disimpan!");
    document.getElementById("keuKategori").value = "";
    document.getElementById("keuNominal").value  = "";
    document.getElementById("keuKet").value      = "";
    loadRingkasanKeuangan();
    loadKeuangan();
  } catch (err) {
    showAlert("keuAlert", "error", "❌ Gagal: " + err.message);
  } finally {
    setLoading("keuSubmitBtn", false);
  }
}

async function loadRingkasanKeuangan() {
  try {
    const result = await fetchAPI("getRingkasan");
    if (result.data) {
      const { totalPemasukan, totalPengeluaran, saldo } = result.data;
      document.getElementById("keuSaldo").textContent       = formatRupiah(saldo);
      document.getElementById("keuPemasukan").textContent   = formatRupiah(totalPemasukan);
      document.getElementById("keuPengeluaran").textContent = formatRupiah(totalPengeluaran);
      const saldoEl = document.getElementById("keuSaldo");
      saldoEl.className = "saldo-value" + (saldo < 0 ? " red" : "");
    }
  } catch (err) { console.error(err); }
}

async function loadKeuangan() {
  const jenis    = document.getElementById("keuFilterJenis").value;
  const kategori = document.getElementById("keuFilterKat").value.trim();
  const tbody    = document.getElementById("keuTableBody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="6">Memuat data...</td></tr>`;

  try {
    const params = {};
    if (jenis)    params.jenis    = jenis;
    if (kategori) params.kategori = kategori;

    const result = await fetchAPI("getKeuangan", params);
    const rows   = result.data || [];
    document.getElementById("keuBadge").textContent = rows.length + " data";

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Tidak ada transaksi.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${formatTanggal(r.tanggal)}</td>
        <td><span class="jenis-badge ${r.jenis.toLowerCase()}">${r.jenis}</span></td>
        <td>${r.kategori}</td>
        <td class="currency ${r.jenis === "Pemasukan" ? "pos" : "neg"}">
          ${r.jenis === "Pemasukan" ? "+" : "−"}${formatRupiah(r.nominal)}
        </td>
        <td>${r.keterangan || "—"}</td>
        <td><button class="btn-hapus" onclick="konfirmasiHapus('keuangan', '${r.id}', 'transaksi ${formatRupiah(r.nominal)}')">Hapus</button></td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">❌ Error: ${err.message}</td></tr>`;
  }
}

function resetFilterKeuangan() {
  document.getElementById("keuFilterJenis").value = "";
  document.getElementById("keuFilterKat").value   = "";
  loadKeuangan();
}

// ═══ MODAL HAPUS ══════════════════════════════════════════
function konfirmasiHapus(type, id, label) {
  pendingDelete = { type, id };
  document.getElementById("modalBody").textContent =
    `Anda akan menghapus data "${label}". Tindakan ini tidak bisa dibatalkan.`;
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = () => eksekusiHapus();
}

function closeModal() {
  document.getElementById("modalBackdrop").classList.add("hidden");
  pendingDelete = { type: null, id: null };
}

async function eksekusiHapus() {
  const { type, id } = pendingDelete;
  if (!type || !id) return;
  closeModal();

  const actionMap = { absensi: "hapusAbsensi", keuangan: "hapusKeuangan", anggota: "hapusAnggota" };
  try {
    await writeAPI(actionMap[type], { id });
    if (type === "absensi")  loadAbsensi();
    if (type === "keuangan") { loadRingkasanKeuangan(); loadKeuangan(); }
    if (type === "anggota")  loadAnggota();
  } catch (err) {
    alert("Gagal menghapus: " + err.message);
  }
}

document.getElementById("modalBackdrop").addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});

document.getElementById("qrPanitiaBackdrop").addEventListener("click", function(e) {
  if (e.target === this) closeQRPanitiaModal();
});

// ═══ REKAP ABSENSI ════════════════════════════════════════
let rekapNamaTerakhir = "";

function initRekap() {
  // Isi datalist nama anggota
  const datalist = document.getElementById("listAnggotaRekap");
  if (datalist && daftarAnggota.length > 0) {
    datalist.innerHTML = daftarAnggota.map(a =>
      `<option value="${a.nama}">`
    ).join("");
  }
  // Reset tampilan
  document.getElementById("rekapHasil").classList.add("hidden");
  document.getElementById("rekapPlaceholder").classList.remove("hidden");
  loadDaftarKegiatan();
}

// Daftar semua tanggal+kegiatan yang pernah diadakan (referensi)
async function loadDaftarKegiatan() {
  const tbody = document.getElementById("kegiatanTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr class="loading-row"><td colspan="8">Memuat data...</td></tr>`;
  try {
    const result = await fetchAPI("getDaftarKegiatan");
    const rows   = result.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-row">Belum ada kegiatan tercatat.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${formatTanggal(r.tanggal)}</td>
        <td>${r.kategori || "—"}</td>
        <td>${r.tempat || "—"}</td>
        <td>${r.hadir}</td>
        <td>${r.izin}</td>
        <td>${r.sakit}</td>
        <td>${r.alfa}</td>
        <td><strong>${r.total}</strong></td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-row">❌ Error: ${err.message}</td></tr>`;
  }
}

function onRekapNamaInput() {
  // Jika nama sudah cocok dengan daftar, langsung tampilkan
  const nama = document.getElementById("rekapNama").value.trim();
  const cocok = daftarAnggota.find(a => a.nama.toLowerCase() === nama.toLowerCase());
  if (cocok) tampilkanRekap();
}

async function tampilkanRekap() {
  const nama    = document.getElementById("rekapNama").value.trim();
  const dari    = document.getElementById("rekapDari").value;
  const sampai  = document.getElementById("rekapSampai").value;

  if (!nama) { alert("Masukkan nama anggota terlebih dahulu."); return; }

  rekapNamaTerakhir = nama;

  // Cari data anggota untuk tahu statusnya
  const infoAnggota = daftarAnggota.find(a =>
    a.nama.toLowerCase() === nama.toLowerCase()
  );

  try {
    const params = { nama };
    const [result, statusBayarResult] = await Promise.all([
      fetchAPI("getAbsensi", params),
      fetchAPI("getStatusBayar", { nama })
    ]);
    // allRows = semua data absensi anggota ini, tanpa filter tanggal apapun
    // Dipakai untuk hitung dedosan (tertunggak & sudah bayar) agar akurat
    const allRows = result.data || [];

    // rows = data yang difilter sesuai rentang yang dipilih user (untuk tabel & statistik kartu)
    let rows = [...allRows];
    const lunasSampaiTanggal = statusBayarResult.data?.lunasSampaiTanggal || null;

    // Filter tanggal jika diisi (hanya berlaku untuk kartu statistik & tabel riwayat)
    if (dari)   rows = rows.filter(r => r.tanggal >= dari);
    if (sampai) rows = rows.filter(r => r.tanggal <= sampai);

    // Hitung statistik (untuk kartu Hadir/Izin/Sakit/Alfa, mengikuti rentang yang dicari)
    const stat = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
    rows.forEach(r => { if (stat[r.status] !== undefined) stat[r.status]++; });

    // Khusus dedosan: pakai allRows (BUKAN rows) agar tidak terpengaruh filter dari/sampai.
    // Kalau anggota sudah pernah bayar, hanya hitung record SETELAH tanggal lunas terakhir.
    const rowsDedosan = lunasSampaiTanggal
      ? allRows.filter(r => r.tanggal > lunasSampaiTanggal)
      : allRows;
    const statDedosan = { Hadir: 0, Alfa: 0 };
    rowsDedosan.forEach(r => { if (statDedosan[r.status] !== undefined) statDedosan[r.status]++; });

    const totalHadir      = statDedosan.Hadir;
    const totalTidakHadir = statDedosan.Alfa;
    const statusAnggota   = infoAnggota?.statusKeanggotaan || "Aktif";

    // Hitung dedosan berdasarkan status
    let dedosan = 0, rumus = "", ket = "";

    if (statusAnggota === "Aktif" || statusAnggota === "Pengurus") {
      dedosan = totalTidakHadir * 5000;
      rumus   = `${totalTidakHadir} alfa × Rp 5.000`;
      ket     = "Anggota Aktif: Rp 5.000 per ketidakhadiran (Alfa)";
    } else if (statusAnggota === "Nonaktif") {
      dedosan = Math.max(0, 50000 - (totalHadir * 2000));
      rumus   = `Rp 50.000 − (${totalHadir} hadir × Rp 2.000)`;
      ket     = "Nonaktif: Rp 50.000 dikurangi Rp 2.000 per kehadiran";
    } else if (statusAnggota === "Pengampel") {
      dedosan = Math.max(0, 80000 - (totalHadir * 2000));
      rumus   = `Rp 80.000 − (${totalHadir} hadir × Rp 2.000)`;
      ket     = "Pengampel: Rp 80.000 dikurangi Rp 2.000 per kehadiran";
    }

    if (lunasSampaiTanggal) {
      ket = dedosan > 0
        ? `✅ Sudah bayar sampai tanggal ${formatTanggal(lunasSampaiTanggal)}. Dedosan di bawah ini dihitung sejak tanggal tersebut. ${ket}`
        : `✅ Lunas — sudah bayar sampai tanggal ${formatTanggal(lunasSampaiTanggal)}. Belum ada dedosan baru sejak pembayaran terakhir.`;
    }

    // ── Hitung total dedosan yang sudah dibayar ──────────────────────────────
    // Ambil semua absensi SEBELUM lunasSampaiTanggal (yang sudah dilunasi)
    let dedosanSudahBayar = 0;
    let bulanMulaiDihitung = null;

    if (lunasSampaiTanggal) {
      const rowsSudahBayar = allRows.filter(r => r.tanggal <= lunasSampaiTanggal);
      const statSudahBayar = { Hadir: 0, Alfa: 0 };
      rowsSudahBayar.forEach(r => { if (statSudahBayar[r.status] !== undefined) statSudahBayar[r.status]++; });

      if (statusAnggota === "Aktif" || statusAnggota === "Pengurus") {
        dedosanSudahBayar = statSudahBayar.Alfa * 5000;
      } else if (statusAnggota === "Nonaktif") {
        dedosanSudahBayar = Math.max(0, 50000 - (statSudahBayar.Hadir * 2000));
      } else if (statusAnggota === "Pengampel") {
        dedosanSudahBayar = Math.max(0, 80000 - (statSudahBayar.Hadir * 2000));
      }
    }

    // Tentukan bulan mulai dihitung (bulan pertama absensi yang belum lunas)
    const rowsBelumLunas = lunasSampaiTanggal
      ? allRows.filter(r => r.tanggal > lunasSampaiTanggal)
      : allRows;
    if (rowsBelumLunas.length > 0) {
      const tanggalTerlama = rowsBelumLunas.map(r => r.tanggal).sort()[0];
      const [thn, bln] = tanggalTerlama.split("-");
      const namaBulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
      bulanMulaiDihitung = `${namaBulan[parseInt(bln,10) - 1]} ${thn}`;
    }

    // Tampilkan hasil
    document.getElementById("rekapPlaceholder").classList.add("hidden");
    document.getElementById("rekapHasil").classList.remove("hidden");

    document.getElementById("rekapNamaLabel").textContent  = nama;
    document.getElementById("rekapStatusBadge").textContent = statusAnggota;
    document.getElementById("rekapStatusBadge").className  =
      "badge status-keanggotaan-badge " + statusAnggota.toLowerCase();

    document.getElementById("rekapJmlHadir").textContent = stat.Hadir;
    document.getElementById("rekapJmlIzin").textContent  = stat.Izin;
    document.getElementById("rekapJmlSakit").textContent = stat.Sakit;
    document.getElementById("rekapJmlAlfa").textContent  = stat.Alfa;

    document.getElementById("rekapDedosanRumus").textContent   = rumus;
    document.getElementById("rekapDedosanNominal").textContent = formatRupiah(dedosan);
    document.getElementById("rekapDedosanKet").textContent     = ket;

    // Warna dedosan
    const nominalEl = document.getElementById("rekapDedosanNominal");
    nominalEl.className = "dedosan-nominal " + (dedosan > 0 ? "merah" : "hijau");

    // Tombol "Tandai Sudah Bayar" hanya muncul kalau masih ada dedosan tertunggak
    document.getElementById("rekapDedosanBtnWrap").classList.toggle("hidden", dedosan <= 0);

    // Tampilkan info dedosan sudah bayar & bulan mulai dihitung
    const sudahBayarBox = document.getElementById("rekapDedosanSudahBayarBox");
    const elSudahBayar  = document.getElementById("rekapDedosanSudahBayar");
    const elBulanMulai  = document.getElementById("rekapDedosanBulanMulai");
    const elBulanMulaiWrap = document.getElementById("rekapDedosanBulanMulaiWrap");

    if (lunasSampaiTanggal) {
      sudahBayarBox.classList.remove("hidden");
      elSudahBayar.textContent = formatRupiah(dedosanSudahBayar);
    } else {
      sudahBayarBox.classList.add("hidden");
    }

    if (bulanMulaiDihitung) {
      elBulanMulaiWrap.classList.remove("hidden");
      elBulanMulai.textContent = bulanMulaiDihitung;
    } else {
      elBulanMulaiWrap.classList.add("hidden");
    }

    document.getElementById("rekapTotalBadge").textContent = rows.length + " data";

    // Render tabel riwayat
    const tbody = document.getElementById("rekapTableBody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Tidak ada data absensi untuk anggota ini.</td></tr>`;
    } else {
      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>${formatTanggal(r.tanggal)}</td>
          <td>${r.kategori || "—"}</td>
          <td>${r.tempat || "—"}</td>
          <td><span class="status-badge ${r.status.toLowerCase()}">${r.status}</span></td>
          <td>${r.keterangan || "—"}</td>
        </tr>
      `).join("");
    }

  } catch (err) {
    alert("❌ Gagal memuat data: " + err.message);
  }
}

// Tandai anggota yang sedang ditampilkan rekapnya sebagai sudah bayar dedosan.
// Berlaku per anggota: setelah ditandai, semua dedosan sampai hari ini dianggap lunas.
function konfirmasiSudahBayar() {
  if (!rekapNamaTerakhir) return;
  document.getElementById("modalBody").textContent =
    `Tandai "${rekapNamaTerakhir}" sudah membayar dedosan? Semua dedosan sampai hari ini akan dianggap lunas.`;
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    try {
      const result = await writeAPI("tandaiSudahBayar", { nama: rekapNamaTerakhir });
      alert("✅ " + result.message);
      tampilkanRekap(); // refresh agar status lunas langsung terlihat
    } catch (err) {
      alert("❌ Gagal mencatat pembayaran: " + err.message);
    }
  };
}

// ═══ EXPORT EXCEL ═════════════════════════════════════════

async function exportAnggotaExcel() {
  try {
    const result = await fetchAPI("getAnggota");
    const data   = result.data || [];
    if (!data.length) { alert("Tidak ada data anggota."); return; }
    const rows = data.map((r, i) => ({
      "No"                : i + 1,
      "Nama"              : r.nama,
      "Jabatan"           : r.jabatan || "Anggota",
      "Status Keanggotaan": r.statusKeanggotaan || "Aktif",
      "Kontak"            : r.kontak || ""
    }));
    downloadExcel(rows, "Data_Anggota_STT_Panca_Kerti");
  } catch (e) { alert("Gagal mengambil data: " + e.message); }
}

function exportAbsensiExcel() {
  const rows = getAbsensiRows();
  if (!rows) return;
  downloadExcel(rows, "Data_Absensi_STT_Panca_Kerti");
}

async function exportAbsensiExcelAll() {
  try {
    const result = await fetchAPI("getAbsensi");
    const data   = (result.data || []).map((r, i) => ({
      "No"        : i + 1,
      "Tanggal"   : formatTanggal(r.tanggal),
      "Nama"      : r.nama,
      "Status"    : r.status,
      "Kategori"  : r.kategori || "",
      "Tempat"    : r.tempat || "",
      "Keterangan": r.keterangan || ""
    }));
    downloadExcel(data, "Semua_Absensi_STT_Panca_Kerti");
  } catch(e) { alert("Gagal mengambil data: " + e.message); }
}

async function exportKeuanganExcel() {
  try {
    const jenis    = document.getElementById("keuFilterJenis").value;
    const kategori = document.getElementById("keuFilterKat").value.trim();
    const params   = {};
    if (jenis)    params.jenis    = jenis;
    if (kategori) params.kategori = kategori;

    const result = await fetchAPI("getKeuangan", params);
    const data   = result.data || [];
    if (!data.length) { alert("Tidak ada data keuangan untuk diexport."); return; }

    let totalPemasukan = 0, totalPengeluaran = 0;
    const rows = data.map((r, i) => {
      if (r.jenis === "Pemasukan") totalPemasukan += r.nominal;
      else totalPengeluaran += r.nominal;
      return {
        "No"        : i + 1,
        "Tanggal"   : formatTanggal(r.tanggal),
        "Jenis"     : r.jenis,
        "Kategori"  : r.kategori,
        "Nominal"   : r.nominal,
        "Keterangan": r.keterangan || ""
      };
    });

    // Baris kosong pemisah + ringkasan total
    rows.push({ "No": "", "Tanggal": "", "Jenis": "", "Kategori": "", "Nominal": "", "Keterangan": "" });
    rows.push({ "No": "", "Tanggal": "", "Jenis": "", "Kategori": "TOTAL PEMASUKAN", "Nominal": totalPemasukan, "Keterangan": "" });
    rows.push({ "No": "", "Tanggal": "", "Jenis": "", "Kategori": "TOTAL PENGELUARAN", "Nominal": totalPengeluaran, "Keterangan": "" });
    rows.push({ "No": "", "Tanggal": "", "Jenis": "", "Kategori": "SALDO", "Nominal": totalPemasukan - totalPengeluaran, "Keterangan": "" });

    downloadExcel(rows, "Data_Keuangan_STT_Panca_Kerti");
  } catch (e) { alert("Gagal mengambil data: " + e.message); }
}

function getAbsensiRows() {
  const tbody = document.getElementById("absTableBody");
  const trs   = tbody.querySelectorAll("tr:not(.loading-row)");
  if (!trs.length || trs[0].querySelector(".empty-row")) {
    alert("Tampilkan data absensi terlebih dahulu."); return null;
  }
  const data = [];
  trs.forEach((tr, i) => {
    const td = tr.querySelectorAll("td");
    if (td.length >= 6) data.push({
      "No": i+1, "Tanggal": td[0].textContent, "Nama": td[1].textContent,
      "Status": td[2].textContent.trim(), "Kategori": td[3].textContent,
      "Tempat": td[4].textContent, "Keterangan": td[5].textContent
    });
  });
  return data;
}

function getKeuanganRows() {
  const tbody = document.getElementById("keuTableBody");
  const trs   = tbody.querySelectorAll("tr:not(.loading-row)");
  if (!trs.length || trs[0].querySelector(".empty-row")) {
    alert("Tampilkan data keuangan terlebih dahulu."); return null;
  }
  const data = [];
  trs.forEach((tr, i) => {
    const td = tr.querySelectorAll("td");
    if (td.length >= 5) data.push({
      "No": i+1, "Tanggal": td[0].textContent, "Jenis": td[1].textContent.trim(),
      "Kategori": td[2].textContent, "Nominal": td[3].textContent, "Keterangan": td[4].textContent
    });
  });
  return data;
}

function downloadExcel(data, filename) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename + ".xlsx");
}

// ═══ EXPORT PDF ═══════════════════════════════════════════

function getPDF(judul) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.setTextColor(30, 43, 74);
  doc.text("STT Panca Kerti — " + judul, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(113, 128, 150);
  doc.text("Dicetak: " + new Date().toLocaleDateString("id-ID", {weekday:"long",year:"numeric",month:"long",day:"numeric"}), 14, 22);
  return doc;
}

async function exportAnggotaPDF() {
  try {
    const result = await fetchAPI("getAnggota");
    const data   = result.data || [];
    if (!data.length) { alert("Tidak ada data anggota."); return; }
    const doc  = getPDF("Data Anggota");
    const rows = data.map((r, i) => [
      i+1, r.nama, r.jabatan || "Anggota", r.statusKeanggotaan || "Aktif", r.kontak || "—"
    ]);
    doc.autoTable({
      head: [["No","Nama","Jabatan","Status","Kontak"]],
      body: rows, startY: 28,
      headStyles: { fillColor: [30,43,74], textColor: 255 },
      alternateRowStyles: { fillColor: [245,247,250] }
    });
    doc.save("Data_Anggota_STT_Panca_Kerti.pdf");
  } catch (e) { alert("Gagal mengambil data: " + e.message); }
}

function exportAbsensiPDF() {
  const rows = getAbsensiRows();
  if (!rows) return;
  const doc = getPDF("Data Absensi");
  doc.autoTable({
    head: [["No","Tanggal","Nama","Status","Kategori","Tempat","Keterangan"]],
    body: rows.map(r => [r.No,r.Tanggal,r.Nama,r.Status,r.Kategori,r.Tempat,r.Keterangan]),
    startY: 28,
    headStyles: { fillColor: [30,43,74], textColor: 255 },
    alternateRowStyles: { fillColor: [245,247,250] }
  });
  doc.save("Data_Absensi_STT_Panca_Kerti.pdf");
}

async function exportAbsensiPDFAll() {
  try {
    const result = await fetchAPI("getAbsensi");
    const data   = result.data || [];
    const doc    = getPDF("Semua Data Absensi");
    doc.autoTable({
      head: [["No","Tanggal","Nama","Status","Kategori","Tempat","Keterangan"]],
      body: data.map((r,i) => [i+1,formatTanggal(r.tanggal),r.nama,r.status,r.kategori||"",r.tempat||"",r.keterangan||""]),
      startY: 28,
      headStyles: { fillColor: [30,43,74], textColor: 255 },
      alternateRowStyles: { fillColor: [245,247,250] }
    });
    doc.save("Semua_Absensi_STT_Panca_Kerti.pdf");
  } catch(e) { alert("Gagal: " + e.message); }
}

async function exportKeuanganPDF() {
  try {
    const jenis    = document.getElementById("keuFilterJenis").value;
    const kategori = document.getElementById("keuFilterKat").value.trim();
    const params   = {};
    if (jenis)    params.jenis    = jenis;
    if (kategori) params.kategori = kategori;

    const result = await fetchAPI("getKeuangan", params);
    const data   = result.data || [];
    if (!data.length) { alert("Tidak ada data keuangan untuk diexport."); return; }

    let totalPemasukan = 0, totalPengeluaran = 0;
    const body = data.map((r, i) => {
      if (r.jenis === "Pemasukan") totalPemasukan += r.nominal;
      else totalPengeluaran += r.nominal;
      const tanda = r.jenis === "Pemasukan" ? "+" : "-"; // hyphen biasa, aman untuk font PDF
      return [
        i + 1, formatTanggal(r.tanggal), r.jenis, r.kategori,
        tanda + formatRupiahPolos(r.nominal), r.keterangan || ""
      ];
    });

    const saldo = totalPemasukan - totalPengeluaran;

    const doc = getPDF("Data Keuangan");
    doc.autoTable({
      head: [["No","Tanggal","Jenis","Kategori","Nominal","Keterangan"]],
      body: body,
      startY: 28,
      headStyles: { fillColor: [30,43,74], textColor: 255 },
      alternateRowStyles: { fillColor: [245,247,250] },
      columnStyles: { 4: { halign: "right" } },
      foot: [
        ["", "", "", "Total Pemasukan", "+" + formatRupiahPolos(totalPemasukan), ""],
        ["", "", "", "Total Pengeluaran", "-" + formatRupiahPolos(totalPengeluaran), ""],
        ["", "", "", "SALDO", (saldo >= 0 ? "+" : "-") + formatRupiahPolos(Math.abs(saldo)), ""]
      ],
      footStyles: { fillColor: [232,201,122], textColor: [30,43,74], fontStyle: "bold" },
      didParseCell: function (hookData) {
        // Baris "SALDO" dibuat lebih menonjol
        if (hookData.section === "foot" && hookData.row.index === 2) {
          hookData.cell.styles.fillColor = [30,43,74];
          hookData.cell.styles.textColor = 255;
        }
      }
    });
    doc.save("Data_Keuangan_STT_Panca_Kerti.pdf");
  } catch (e) { alert("Gagal mengambil data: " + e.message); }
}

// Format Rupiah tanpa simbol "Rp" dan tanpa karakter unicode khusus, aman untuk PDF
function formatRupiahPolos(angka) {
  return "Rp " + Math.round(angka).toLocaleString("id-ID");
}

function exportRekapPDF() {
  const nama   = document.getElementById("rekapNamaLabel").textContent;
  const status = document.getElementById("rekapStatusBadge").textContent;
  if (nama === "—") { alert("Tampilkan rekap anggota terlebih dahulu."); return; }

  const hadir = document.getElementById("rekapJmlHadir").textContent;
  const izin  = document.getElementById("rekapJmlIzin").textContent;
  const sakit = document.getElementById("rekapJmlSakit").textContent;
  const alfa  = document.getElementById("rekapJmlAlfa").textContent;
  const dedosan = document.getElementById("rekapDedosanNominal").textContent;
  const rumus   = document.getElementById("rekapDedosanRumus").textContent;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(14); doc.setTextColor(30,43,74);
  doc.text("STT Panca Kerti — Rekap Absensi", 14, 15);
  doc.setFontSize(11);
  doc.text("Nama    : " + nama, 14, 28);
  doc.text("Status  : " + status, 14, 35);
  doc.setFontSize(10); doc.setTextColor(80,80,80);
  doc.text(`Hadir: ${hadir}   Izin: ${izin}   Sakit: ${sakit}   Alfa: ${alfa}`, 14, 45);
  doc.setFontSize(11); doc.setTextColor(197,48,48);
  doc.text("Dedosan : " + dedosan + "  (" + rumus + ")", 14, 55);

  const tbody = document.getElementById("rekapTableBody");
  const trs   = tbody.querySelectorAll("tr");
  const rows  = [];
  trs.forEach((tr, i) => {
    const td = tr.querySelectorAll("td");
    if (td.length >= 4) rows.push([i+1, td[0].textContent, td[1].textContent, td[2].textContent, td[3].textContent.trim(), td[4].textContent]);
  });
  doc.autoTable({
    head: [["No","Tanggal","Kategori","Tempat","Status","Keterangan"]],
    body: rows, startY: 65,
    headStyles: { fillColor: [30,43,74], textColor: 255 },
    alternateRowStyles: { fillColor: [245,247,250] }
  });
  doc.save("Rekap_" + nama.replace(/\s/g,"_") + ".pdf");
}

// ═══ CETAK ════════════════════════════════════════════════

function cetakHalaman(pageId) {
  const el = document.getElementById(pageId);
  if (!el) return;
  const w = window.open("", "_blank");
  w.document.write(`
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>STT Panca Kerti — Cetak</title>
    <style>
      body { font-family: Inter, sans-serif; color: #2D3748; padding: 20px; }
      h1 { color: #1E2B4A; font-size: 18px; margin-bottom: 4px; }
      p  { color: #718096; font-size: 13px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #1E2B4A; color: #fff; padding: 8px; text-align: left; }
      td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
      tr:nth-child(even) td { background: #F5F7FA; }
      .no-print { display: none; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>STT Panca Kerti</h1>
    <p>Dicetak: ${new Date().toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
    ${el.innerHTML}
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>
  `);
  w.document.close();
}

function cetakRekap() {
  const hasil = document.getElementById("rekapHasil");
  if (hasil.classList.contains("hidden")) { alert("Tampilkan rekap terlebih dahulu."); return; }
  cetakHalaman("page-rekap");
}

// Cetak khusus modul Keuangan: ambil data API langsung (bukan scraping HTML),
// tampilan rapi, dan otomatis menyertakan baris Total Pemasukan/Pengeluaran/Saldo.
async function cetakKeuangan() {
  try {
    const jenis    = document.getElementById("keuFilterJenis").value;
    const kategori = document.getElementById("keuFilterKat").value.trim();
    const params   = {};
    if (jenis)    params.jenis    = jenis;
    if (kategori) params.kategori = kategori;

    const result = await fetchAPI("getKeuangan", params);
    let data = result.data || [];
    if (!data.length) { alert("Tidak ada data keuangan untuk dicetak."); return; }

    // Urutkan kronologis (tanggal paling lama di atas, terbaru di bawah) khusus untuk cetakan,
    // berbeda dari tabel riwayat di aplikasi yang menampilkan terbaru lebih dulu.
    data = [...data].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    // Kelompokkan per bulan (kunci: "2026-06" dst), urut sesuai kemunculan kronologis
    const namaBulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const grup = {};
    const urutanGrup = [];
    data.forEach(r => {
      const d = new Date(r.tanggal);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (!grup[key]) {
        grup[key] = { label: namaBulan[d.getMonth()] + " " + d.getFullYear(), rows: [], pemasukan: 0, pengeluaran: 0 };
        urutanGrup.push(key);
      }
      grup[key].rows.push(r);
      if (r.jenis === "Pemasukan") grup[key].pemasukan += r.nominal;
      else grup[key].pengeluaran += r.nominal;
    });

    let totalPemasukan = 0, totalPengeluaran = 0, noUrut = 0;
    let bodyHtml = "";

    urutanGrup.forEach(key => {
      const g = grup[key];
      totalPemasukan   += g.pemasukan;
      totalPengeluaran += g.pengeluaran;
      const saldoBulan = g.pemasukan - g.pengeluaran;

      bodyHtml += `<tr class="grup-bulan"><td colspan="6">${g.label}</td></tr>`;
      bodyHtml += g.rows.map(r => {
        noUrut++;
        const isPos = r.jenis === "Pemasukan";
        return `
          <tr>
            <td>${noUrut}</td>
            <td>${formatTanggal(r.tanggal)}</td>
            <td><span class="badge-cetak ${isPos ? 'pos' : 'neg'}">${r.jenis}</span></td>
            <td>${r.kategori}</td>
            <td class="nominal ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : '-'}${formatRupiahPolos(r.nominal)}</td>
            <td>${r.keterangan || '—'}</td>
          </tr>`;
      }).join("");
      bodyHtml += `
        <tr class="subtotal-bulan">
          <td colspan="4">Subtotal ${g.label}</td>
          <td class="nominal" style="color:#1E2B4A;">${saldoBulan >= 0 ? '+' : '-'}${formatRupiahPolos(Math.abs(saldoBulan))}</td>
          <td></td>
        </tr>`;
    });

    const saldo = totalPemasukan - totalPengeluaran;

    const w = window.open("", "_blank");
    w.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>STT Panca Kerti — Laporan Keuangan</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #2D3748; padding: 30px 36px; }
        .header { display:flex; align-items:center; gap:14px; border-bottom: 3px solid #1E2B4A; padding-bottom:14px; margin-bottom:18px; }
        .header img { width:50px; height:50px; object-fit:contain; }
        .header h1 { color: #1E2B4A; font-size: 19px; margin:0; }
        .header p  { color: #718096; font-size: 12px; margin:2px 0 0; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
        th { background: #1E2B4A; color: #fff; padding: 9px 8px; text-align: left; font-size:11px; text-transform:uppercase; letter-spacing:.02em; }
        td { padding: 8px; border-bottom: 1px solid #E2E8F0; }
        tr:nth-child(even) td { background: #F7F9FC; }
        .nominal { text-align: right; font-weight:600; white-space:nowrap; }
        .nominal.pos { color: #2F855A; }
        .nominal.neg { color: #C53030; }
        .badge-cetak { padding:3px 9px; border-radius:12px; font-size:10.5px; font-weight:600; }
        .badge-cetak.pos { background:#F0FFF4; color:#2F855A; }
        .badge-cetak.neg { background:#FFF5F5; color:#C53030; }
        tr.grup-bulan td {
          background:#1E2B4A !important; color:#fff; font-weight:700; font-size:12.5px;
          padding:10px 8px; letter-spacing:.02em;
        }
        tr.subtotal-bulan td {
          background:#FBF3DD !important; color:#1E2B4A; font-weight:700;
          border-top:1.5px solid #E8C97A; border-bottom:1.5px solid #E8C97A;
        }
        tfoot td { font-weight:700; border-top: 2px solid #1E2B4A; background:#fff !important; }
        tfoot tr.saldo td { background:#1E2B4A !important; color:#fff; font-size:13px; }
        .no-print { display:none; }
        @media print { body { padding: 10px 18px; } tr.grup-bulan { break-inside: avoid; } }
      </style></head><body>
      <div class="header">
        <img src="logo.png" alt="logo" onerror="this.style.display='none'" />
        <div>
          <h1>STT Panca Kerti — Laporan Keuangan</h1>
          <p>Dicetak: ${new Date().toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>No</th><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th style="text-align:right;">Nominal</th><th>Keterangan</th></tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
        <tfoot>
          <tr><td colspan="4"></td><td class="nominal pos">+${formatRupiahPolos(totalPemasukan)}</td><td>Total Pemasukan</td></tr>
          <tr><td colspan="4"></td><td class="nominal neg">-${formatRupiahPolos(totalPengeluaran)}</td><td>Total Pengeluaran</td></tr>
          <tr class="saldo"><td colspan="4"></td><td class="nominal" style="color:#fff;">${saldo >= 0 ? '+' : '-'}${formatRupiahPolos(Math.abs(saldo))}</td><td>SALDO AKHIR</td></tr>
        </tfoot>
      </table>
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>
    `);
    w.document.close();
  } catch (e) { alert("Gagal memuat data: " + e.message); }
}

// ═══ UPLOAD DOKUMEN (Google Drive) ═══════════════════════

let daftarDokumen = [];

function previewFile(input) {
  const file    = input.files[0];
  const preview = document.getElementById("uploadPreview");
  const area    = document.getElementById("uploadArea");
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showAlert("docAlert", "error", "❌ File terlalu besar. Maksimal 5MB.");
    input.value = ""; return;
  }
  preview.textContent = "📎 " + file.name + " (" + (file.size/1024).toFixed(1) + " KB)";
  preview.classList.remove("hidden");
  area.classList.add("has-file");
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById("uploadArea").classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const input = document.getElementById("docFile");
  const dt    = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  previewFile(input);
}

async function uploadDokumen() {
  const nama     = document.getElementById("docNama").value.trim();
  const kategori = document.getElementById("docKategori").value;
  const fileInput= document.getElementById("docFile");
  const file     = fileInput.files[0];

  if (!nama)  { showAlert("docAlert","error","Nama dokumen wajib diisi."); return; }
  if (!file)  { showAlert("docAlert","error","Pilih file terlebih dahulu."); return; }

  setLoading("docSubmitBtn", true);
  try {
    const base64 = await fileToBase64(file);

    // Kirim ke Apps Script via POST agar file tersimpan ke Google Drive
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action  : "uploadDokumen",
        nama    : nama,
        kategori: kategori,
        namaFile: file.name,
        base64  : base64
      })
    });
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message || "Upload gagal.");

    showAlert("docAlert","success","✅ Dokumen berhasil diupload ke Google Drive!");
    document.getElementById("docNama").value = "";
    fileInput.value = "";
    document.getElementById("uploadPreview").classList.add("hidden");
    document.getElementById("uploadArea").classList.remove("has-file");
    loadDokumen();
  } catch(err) {
    showAlert("docAlert","error","❌ Gagal: " + err.message);
  } finally {
    setLoading("docSubmitBtn", false);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

async function loadDokumen() {
  const tbody = document.getElementById("docTableBody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="4">Memuat data...</td></tr>`;
  try {
    const result  = await fetchAPI("getDokumen");
    daftarDokumen = result.data || [];
    renderTabelDokumen();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">❌ Error: ${err.message}</td></tr>`;
  }
}

function renderTabelDokumen() {
  const tbody = document.getElementById("docTableBody");
  if (!daftarDokumen.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Belum ada dokumen tersimpan.</td></tr>`;
    return;
  }
  tbody.innerHTML = daftarDokumen.map(d => {
    const ukuranKB = d.ukuran ? (d.ukuran/1024).toFixed(1) + " KB" : "—";
    return `
    <tr>
      <td>
        <div style="font-weight:600;">
          <a href="${d.url}" target="_blank" style="color:var(--navy);text-decoration:none;">
            📄 ${d.nama}
          </a>
        </div>
        <div style="font-size:.78rem;color:var(--muted);">${d.namaFile} · ${ukuranKB}</div>
      </td>
      <td><span class="jabatan-badge">${d.kategori}</span></td>
      <td>${formatTanggal((d.timestamp || "").split("T")[0])}</td>
      <td>
        <a href="${d.url}" target="_blank" class="btn-export" style="text-decoration:none;display:inline-block;">Buka</a>
        <button class="btn-hapus" onclick="konfirmasiHapusDokumen('${d.id}', '${d.nama}')">Hapus</button>
      </td>
    </tr>
  `}).join("");
}

function konfirmasiHapusDokumen(id, nama) {
  document.getElementById("modalBody").textContent =
    `Dokumen "${nama}" akan dihapus permanen dari Google Drive.`;
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    try {
      await writeAPI("hapusDokumen", { id });
      loadDokumen();
    } catch (err) {
      alert("❌ Gagal menghapus: " + err.message);
    }
  };
}

// ═══ ABSEN VIA QR ═════════════════════════════════════════

let sesiQRTerakhir = null;

async function buatSesiQR() {
  const tanggal  = document.getElementById("qrTanggal").value;
  const kategori = document.getElementById("qrKategori").value;
  const tempat   = document.getElementById("qrTempat").value;

  if (!tanggal || !kategori || !tempat) {
    showAlert("qrAlert", "error", "Tanggal, kategori, dan tempat wajib diisi.");
    return;
  }

  setLoading("qrSubmitBtn", true);
  try {
    const result = await writeAPI("buatSesiQR", { tanggal, kategori, tempat });
    const kode   = result.kode;

    sesiQRTerakhir = { kode, tanggal, kategori, tempat };
    tampilkanQR(kode, tanggal, kategori, tempat);

    showAlert("qrAlert", "success", "✅ Sesi QR berhasil dibuat!");
    loadDaftarSesiQR();
  } catch (err) {
    showAlert("qrAlert", "error", "❌ Gagal: " + err.message);
  } finally {
    setLoading("qrSubmitBtn", false);
  }
}

function tampilkanQR(kode, tanggal, kategori, tempat) {
  document.getElementById("qrPlaceholder").classList.add("hidden");
  document.getElementById("qrResult").classList.remove("hidden");

  const box = document.getElementById("qrCodeBox");
  box.innerHTML = ""; // reset

  // URL halaman absen.html dengan parameter kode sesi
  const baseUrl = window.location.href.replace(/index\.html$/, "").replace(/\/$/, "");
  const absenUrl = baseUrl + "/absen.html?kode=" + kode;

  new QRCode(box, {
    text: absenUrl,
    width: 220,
    height: 220,
    colorDark: "#1E2B4A",
    colorLight: "#ffffff"
  });

  document.getElementById("qrInfoBox").innerHTML = `
    <div style="margin-top:14px;font-size:.85rem;color:var(--muted);">
      <div style="font-weight:700;color:var(--navy);font-size:1rem;margin-bottom:4px;">${kategori}</div>
      <div>${tempat}</div>
      <div>${formatTanggal(tanggal)}</div>
      <div style="margin-top:8px;font-size:.75rem;">Kode: <strong>${kode}</strong></div>
      <div style="margin-top:6px;font-size:.72rem;word-break:break-all;color:var(--gold-dark);">${absenUrl}</div>
    </div>
  `;
}

function downloadQR() {
  const canvas = document.querySelector("#qrCodeBox canvas");
  if (!canvas) { alert("QR belum dibuat."); return; }
  const link = document.createElement("a");
  link.download = "QR_Absensi_" + (sesiQRTerakhir?.kode || "kegiatan") + ".png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function cetakQR() {
  if (!sesiQRTerakhir) { alert("QR belum dibuat."); return; }
  const canvas = document.querySelector("#qrCodeBox canvas");
  const imgData = canvas.toDataURL("image/png");

  const w = window.open("", "_blank");
  w.document.write(`
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Cetak QR Absensi</title>
    <style>
      body { font-family: Inter, sans-serif; text-align:center; padding:40px; color:#1E2B4A; }
      h1 { font-size:20px; margin-bottom:4px; }
      h2 { font-size:16px; color:#555; margin-bottom:20px; font-weight:500; }
      img { width:280px; height:280px; }
      .info { margin-top:20px; font-size:14px; }
      .kode { margin-top:10px; font-size:13px; color:#888; }
    </style></head><body>
    <h1>STT Panca Kerti</h1>
    <h2>Absensi: ${sesiQRTerakhir.kategori}</h2>
    <img src="${imgData}" />
    <div class="info">
      <div><strong>${sesiQRTerakhir.tempat}</strong></div>
      <div>${formatTanggal(sesiQRTerakhir.tanggal)}</div>
    </div>
    <div class="kode">Kode Sesi: ${sesiQRTerakhir.kode}</div>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>
  `);
  w.document.close();
}

async function loadDaftarSesiQR() {
  const tbody = document.getElementById("qrSesiTableBody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="6">Memuat data...</td></tr>`;
  try {
    const result = await fetchAPI("getDaftarSesiQR");
    const rows   = result.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Belum ada sesi QR dibuat.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.kode}</strong></td>
        <td>${formatTanggal(r.tanggal)}</td>
        <td>${r.kategori}</td>
        <td>${r.tempat}</td>
        <td><span class="status-badge ${r.statusSesi === 'Aktif' ? 'hadir' : 'alfa'}">${r.statusSesi}</span></td>
        <td>
          ${r.statusSesi === 'Aktif'
            ? `<button class="btn-hapus" onclick="konfirmasiTutupSesi('${r.kode}')">Tutup</button>`
            : `<span style="color:var(--muted);font-size:.78rem;">—</span>`}
        </td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">❌ Error: ${err.message}</td></tr>`;
  }
}

function konfirmasiTutupSesi(kode) {
  document.getElementById("modalBody").textContent =
    `Sesi QR "${kode}" akan ditutup dan tidak bisa dipakai absen lagi. Anggota aktif yang belum mengisi absensi pada sesi ini akan otomatis ditandai Alfa.`;
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    try {
      const result = await writeAPI("tutupSesiQR", { kode });
      alert("✅ " + result.message);
      loadDaftarSesiQR();
    } catch (err) {
      alert("❌ Gagal menutup sesi: " + err.message);
    }
  };
}

// ─── TUTUP ABSENSI MANUAL (auto-Alfa untuk anggota yang tidak absen) ──
function konfirmasiTutupAbsensiManual() {
  const tanggal  = document.getElementById("tutupAbsTanggal").value;
  const kategori = document.getElementById("tutupAbsKategori").value;
  const tempat   = document.getElementById("tutupAbsTempat").value;

  if (!tanggal || !kategori) {
    showAlert("tutupAbsAlert", "error", "Tanggal dan kategori wajib diisi.");
    return;
  }

  document.getElementById("modalBody").textContent =
    `Anggota aktif yang belum mengisi absensi pada tanggal ${formatTanggal(tanggal)} untuk kegiatan "${kategori}" akan otomatis ditandai Alfa. Lanjutkan?`;
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    setLoading("tutupAbsBtn", true);
    try {
      const result = await writeAPI("tutupAbsensiManual", { tanggal, kategori, tempat });
      showAlert("tutupAbsAlert", "success", "✅ " + result.message);
      loadAbsensi();
    } catch (err) {
      showAlert("tutupAbsAlert", "error", "❌ Gagal: " + err.message);
    } finally {
      setLoading("tutupAbsBtn", false);
    }
  };
}

// ═══ MODUL EVENT & PANITIA ════════════════════════════════

let eventAktifId   = null;   // ID event yang sedang dilihat detailnya
let html5QrScanner = null;   // instance scanner kamera

async function buatEventBaru() {
  const nama           = document.getElementById("evtNama").value.trim();
  const lokasi         = document.getElementById("evtLokasi").value.trim();
  const tanggalMulai   = document.getElementById("evtTanggalMulai").value;
  const tanggalSelesai = document.getElementById("evtTanggalSelesai").value;

  if (!nama || !tanggalMulai) {
    showAlert("evtAlert", "error", "Nama event dan tanggal mulai wajib diisi.");
    return;
  }

  setLoading("evtSubmitBtn", true);
  try {
    await writeAPI("buatEvent", { nama, lokasi, tanggalMulai, tanggalSelesai });
    showAlert("evtAlert", "success", "✅ Event berhasil dibuat!");
    document.getElementById("evtNama").value = "";
    document.getElementById("evtLokasi").value = "";
    document.getElementById("evtTanggalMulai").value = "";
    document.getElementById("evtTanggalSelesai").value = "";
    loadDaftarEvent();
  } catch (err) {
    showAlert("evtAlert", "error", "❌ Gagal: " + err.message);
  } finally {
    setLoading("evtSubmitBtn", false);
  }
}

async function loadDaftarEvent() {
  const tbody = document.getElementById("eventTableBody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="6">Memuat data...</td></tr>`;
  try {
    const result = await fetchAPI("getDaftarEvent");
    const rows   = result.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Belum ada event dibuat.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.nama}</strong></td>
        <td>${formatTanggal(r.tanggalMulai)}${r.tanggalSelesai !== r.tanggalMulai ? " – " + formatTanggal(r.tanggalSelesai) : ""}</td>
        <td>${r.lokasi || "—"}</td>
        <td>${r.jumlahPanitia} orang</td>
        <td><span class="status-badge ${r.status === 'Aktif' ? 'hadir' : 'alfa'}">${r.status}</span></td>
        <td>
          <button class="btn-export" onclick="bukaDetailEvent('${r.id}')">Kelola</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">❌ Error: ${err.message}</td></tr>`;
  }
}

async function bukaDetailEvent(eventId) {
  eventAktifId = eventId;
  document.getElementById("eventListView").classList.add("hidden");
  document.getElementById("eventDetailView").classList.remove("hidden");

  // Isi datalist nama anggota untuk form tambah panitia
  try {
    const result = await fetchAPI("getAnggota");
    const datalist = document.getElementById("listAnggotaPanitia");
    datalist.innerHTML = (result.data || []).map(a => `<option value="${a.nama}">`).join("");
  } catch (e) { /* abaikan jika gagal load nama */ }

  await refreshDetailEvent();
  await refreshKeuanganEvent();
}

function kembaliKeListEvent() {
  eventAktifId = null;
  hentikanScanner();
  document.getElementById("eventDetailView").classList.add("hidden");
  document.getElementById("eventListView").classList.remove("hidden");
}

async function refreshDetailEvent() {
  if (!eventAktifId) return;
  try {
    const result = await fetchAPI("getDetailEvent", { eventId: eventAktifId });
    const { event, panitia } = result.data;

    document.getElementById("evtDetailNama").textContent = event.nama;
    document.getElementById("evtDetailStatus").textContent = event.status;
    document.getElementById("evtDetailStatus").className =
      "badge " + (event.status === "Aktif" ? "" : "");
    document.getElementById("evtDetailInfo").textContent =
      (event.lokasi ? event.lokasi + " · " : "") +
      formatTanggal(event.tanggalMulai) +
      (event.tanggalSelesai !== event.tanggalMulai ? " – " + formatTanggal(event.tanggalSelesai) : "");

    const tbody = document.getElementById("panitiaTableBody");
    if (!panitia.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Belum ada panitia. Tambahkan dari form di atas.</td></tr>`;
      return;
    }

    tbody.innerHTML = panitia.map(p => `
      <tr>
        <td><strong>${p.nama}</strong></td>
        <td>
          ${p.sedangDiDalam
            ? `<span class="status-badge hadir">Di Lokasi</span><span class="sedang-aktif-badge">sejak ${new Date(p.jamMasukTerakhir).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span>`
            : `<span class="status-badge alfa">Belum/Sudah Pulang</span>`}
        </td>
        <td>${p.jumlahScan}x</td>
        <td class="kontribusi-jam">${formatDurasi(p.totalMenit)}</td>
        <td><span class="kode-qr-mini">${p.kodeQR}</span></td>
        <td style="display:flex; gap:6px;">
          <button class="btn-export" onclick="lihatQRPanitia('${p.nama}', '${p.kodeQR}')">QR</button>
          <button class="btn-hapus" onclick="konfirmasiHapusPanitia('${p.id}', '${p.nama}')">Hapus</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    alert("❌ Gagal memuat detail event: " + err.message);
  }
}

function formatDurasi(menit) {
  if (!menit || menit <= 0) return "0 menit";
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (jam === 0) return sisaMenit + " menit";
  if (sisaMenit === 0) return jam + " jam";
  return jam + " jam " + sisaMenit + " menit";
}

async function tambahPanitiaBaru() {
  const nama = document.getElementById("panitiaNamaInput").value.trim();
  if (!nama) { showAlert("panitiaAlert", "error", "Pilih atau ketik nama anggota."); return; }
  if (!eventAktifId) return;

  setLoading("panitiaSubmitBtn", true);
  try {
    await writeAPI("tambahPanitia", { eventId: eventAktifId, nama });
    showAlert("panitiaAlert", "success", "✅ " + nama + " berhasil ditambahkan sebagai panitia!");
    document.getElementById("panitiaNamaInput").value = "";
    refreshDetailEvent();
  } catch (err) {
    showAlert("panitiaAlert", "error", "❌ Gagal: " + err.message);
  } finally {
    setLoading("panitiaSubmitBtn", false);
  }
}

function konfirmasiHapusPanitia(id, nama) {
  document.getElementById("modalBody").textContent =
    `${nama} akan dihapus dari daftar panitia event ini. Riwayat scan tetap tersimpan.`;
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    try {
      await writeAPI("hapusPanitia", { id });
      refreshDetailEvent();
    } catch (err) {
      alert("❌ Gagal menghapus: " + err.message);
    }
  };
}

let qrPanitiaAktif = { nama: "", kode: "" };

function lihatQRPanitia(nama, kodeQR) {
  qrPanitiaAktif = { nama, kode: kodeQR };

  document.getElementById("qrPanitiaNama").textContent = nama;
  document.getElementById("qrPanitiaKode").textContent = kodeQR;

  // Kosongkan dulu container, lalu generate QR via library QRCode.js (lokal,
  // tidak bergantung API eksternal yang bisa down/deprecated).
  const container = document.getElementById("qrPanitiaImgBox");
  container.innerHTML = "";
  new QRCode(container, {
    text: kodeQR,
    width: 220,
    height: 220,
    colorDark: "#1E2B4A",
    colorLight: "#ffffff"
  });

  document.getElementById("qrPanitiaBackdrop").classList.remove("hidden");
}

function closeQRPanitiaModal() {
  document.getElementById("qrPanitiaBackdrop").classList.add("hidden");
}

// QRCode.js menghasilkan <canvas> (umumnya) atau <img> di dalam container,
// tergantung browser. Helper ini mengambil data gambar (base64 PNG) dari keduanya.
function ambilDataURLQRPanitia() {
  const container = document.getElementById("qrPanitiaImgBox");
  const canvas = container.querySelector("canvas");
  if (canvas) return canvas.toDataURL("image/png");

  const img = container.querySelector("img");
  if (img) return img.src; // QRCode.js biasanya sudah set src berupa data URL

  return null;
}

function downloadQRPanitia() {
  const dataUrl = ambilDataURLQRPanitia();
  if (!dataUrl) { alert("QR belum siap, coba lagi sebentar."); return; }

  const qrImg = new Image();
  qrImg.onload = function () {
    // Ukuran kanvas final & layout
    const W = 480, H = 620;
    const qrSize = 360;
    const qrX = (W - qrSize) / 2;
    const qrBoxY = 150;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background putih
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);

    // Header navy
    ctx.fillStyle = "#1E2B4A";
    ctx.fillRect(0, 0, W, 90);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("STT Panca Kerti", W / 2, 52);

    // Kotak putih dengan border tipis untuk QR
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - 16, qrBoxY - 16, qrSize + 32, qrSize + 32);

    // Gambar QR
    ctx.drawImage(qrImg, qrX, qrBoxY, qrSize, qrSize);

    // Nama panitia
    ctx.fillStyle = "#1E2B4A";
    ctx.font = "bold 26px Arial";
    ctx.fillText(qrPanitiaAktif.nama, W / 2, qrBoxY + qrSize + 60);

    // Kode QR
    ctx.fillStyle = "#718096";
    ctx.font = "16px Arial";
    ctx.fillText("Kode: " + qrPanitiaAktif.kode, W / 2, qrBoxY + qrSize + 92);

    // Trigger download
    const finalUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = finalUrl;
    link.download = "QR_Panitia_" + qrPanitiaAktif.nama.replace(/\s+/g, "_") + ".png";
    link.click();
  };
  qrImg.src = dataUrl;
}

function printQRPanitia() {
  const dataUrl = ambilDataURLQRPanitia();
  if (!dataUrl) { alert("QR belum siap, coba lagi sebentar."); return; }

  const w = window.open("", "_blank");
  w.document.write(`
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>QR Panitia - ${qrPanitiaAktif.nama}</title>
    <style>
      body { font-family: Arial, sans-serif; text-align:center; padding:40px; color:#1E2B4A; }
      h1 { font-size:20px; margin-bottom:4px; }
      h2 { font-size:16px; color:#555; margin-bottom:24px; font-weight:500; }
      img { width:280px; height:280px; }
      .kode { margin-top:14px; font-size:13px; color:#888; }
    </style></head><body>
    <h1>STT Panca Kerti</h1>
    <h2>Kartu Panitia: ${qrPanitiaAktif.nama}</h2>
    <img src="${dataUrl}" />
    <div class="kode">Kode: ${qrPanitiaAktif.kode}</div>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>
  `);
  w.document.close();
}

// ─── Scanner Kamera untuk Scan QR Panitia ──────────────────

function mulaiScanner() {
  document.getElementById("scannerPlaceholder").classList.add("hidden");
  document.getElementById("scannerBox").classList.remove("hidden");
  document.getElementById("scanResultBox").classList.add("hidden");

  html5QrScanner = new Html5Qrcode("qrReaderEvent");
  html5QrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 220 },
    onScanSuccess,
    () => {} // error callback per-frame, diabaikan (normal saat belum ada QR di kamera)
  ).catch(err => {
    document.getElementById("scanResultBox").classList.remove("hidden");
    document.getElementById("scanResultBox").innerHTML =
      `<div class="scan-result-card error"><div class="nama">Gagal membuka kamera</div><div class="tipe">${err}</div></div>`;
  });
}

function hentikanScanner() {
  if (html5QrScanner) {
    html5QrScanner.stop().catch(() => {});
    html5QrScanner = null;
  }
  document.getElementById("scannerBox").classList.add("hidden");
  document.getElementById("scannerPlaceholder").classList.remove("hidden");
}

let sedangProsesScan = false;

async function onScanSuccess(decodedText) {
  if (sedangProsesScan) return; // cegah scan ganda dari frame berturutan
  sedangProsesScan = true;

  try {
    const result = await writeAPI("scanPanitia", { kode: decodedText });
    const resultBox = document.getElementById("scanResultBox");
    resultBox.classList.remove("hidden");
    resultBox.innerHTML = `
      <div class="scan-result-card ${result.tipe === 'Masuk' ? 'masuk' : 'keluar'}">
        <div class="nama">${result.nama}</div>
        <div class="tipe">${result.tipe === 'Masuk' ? '✅ Tercatat Masuk' : '🚪 Tercatat Keluar'} — ${new Date(result.waktu).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>`;
    refreshDetailEvent();
  } catch (err) {
    const resultBox = document.getElementById("scanResultBox");
    resultBox.classList.remove("hidden");
    resultBox.innerHTML = `<div class="scan-result-card error"><div class="nama">QR Tidak Valid</div><div class="tipe">${err.message}</div></div>`;
  }

  // Beri jeda 2.5 detik sebelum bisa scan lagi (mencegah scan berulang untuk QR yang sama)
  setTimeout(() => { sedangProsesScan = false; }, 2500);
}

// ═══ CEK GRUP WA (Database Permanen) ═════════════════════

// Normalisasi nomor HP ke format standar (0xxxxxxxxxx) agar bisa dibandingkan
// meski format aslinya beda-beda (62xx, +62xx, 8xx tanpa 0, dengan spasi/strip, dll).
// Format "0 di depan" dipakai supaya konsisten dengan kolom Kontak di Daftar Anggota.
function normalisasiNomor(nomor) {
  if (!nomor) return "";
  let bersih = nomor.toString().replace(/[^\d]/g, ""); // hanya sisakan digit
  if (!bersih) return "";

  if (bersih.startsWith("62") && bersih.length > 9) {
    bersih = "0" + bersih.substring(2);
  } else if (bersih.startsWith("8")) {
    bersih = "0" + bersih;
  }
  // kalau sudah diawali 0, biarkan apa adanya
  return bersih;
}

let daftarNomorWADB = []; // cache database nomor WA tersimpan

async function loadDatabaseNomorWA() {
  try {
    const result = await fetchAPI("getNomorWA");
    daftarNomorWADB = result.data || [];
    document.getElementById("waDbBadge").textContent = daftarNomorWADB.length + " nomor tersimpan";
  } catch (err) {
    document.getElementById("waDbBadge").textContent = "Gagal memuat";
  }
}

async function simpanNomorWABaru() {
  const rawInput = document.getElementById("waNomorInput").value.trim();
  if (!rawInput) { showAlert("waSimpanAlert", "error", "Tempel daftar nomor HP terlebih dahulu."); return; }

  const nomorList = [...new Set(
    rawInput.split("\n")
      .map(n => normalisasiNomor(n))
      .filter(n => n.length >= 8)
  )];

  if (nomorList.length === 0) {
    showAlert("waSimpanAlert", "error", "Tidak ada nomor valid yang terdeteksi.");
    return;
  }

  setLoading("waSimpanBtn", true);
  try {
    const result = await writeAPI("simpanNomorWA", { nomorList });
    showAlert("waSimpanAlert", "success", "✅ " + result.message);
    document.getElementById("waNomorInput").value = "";
    await loadDatabaseNomorWA();
  } catch (err) {
    showAlert("waSimpanAlert", "error", "❌ Gagal: " + err.message);
  } finally {
    setLoading("waSimpanBtn", false);
  }
}

function konfirmasiHapusSemuaNomorWA() {
  document.getElementById("modalBody").textContent =
    "Seluruh database nomor grup WA (" + daftarNomorWADB.length + " nomor) akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.";
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    try {
      await writeAPI("hapusSemuaNomorWA", {});
      await loadDatabaseNomorWA();
      document.getElementById("waHasilBox").classList.add("hidden");
      alert("✅ Database nomor WA berhasil dikosongkan.");
    } catch (err) {
      alert("❌ Gagal menghapus: " + err.message);
    }
  };
}

async function bandingkanGrupWA() {
  if (daftarNomorWADB.length === 0) {
    await loadDatabaseNomorWA();
  }
  if (daftarNomorWADB.length === 0) {
    alert("Database nomor grup WA masih kosong. Simpan nomor terlebih dahulu sebelum membandingkan.");
    return;
  }

  // Normalisasi juga sisi database grup WA — supaya tetap cocok meski data
  // di sheet "Nomor_Grup_WA" formatnya belum/sudah dirapikan ke 0xxx,
  // atau ada sisa format 62xxx dari sebelum migrasi.
  const nomorGrupSet = new Set(daftarNomorWADB.map(n => normalisasiNomor(n.nomor)));

  try {
    const result   = await fetchAPI("getAnggota");
    const anggota  = result.data || [];

    const sudahDiGrup   = [];
    const belumDiGrup   = [];
    const tanpaNomor    = [];

    anggota.forEach(a => {
      const nomorBersih = normalisasiNomor(a.kontak);
      if (!nomorBersih) {
        tanpaNomor.push(a);
      } else if (nomorGrupSet.has(nomorBersih)) {
        sudahDiGrup.push(a);
      } else {
        belumDiGrup.push(a);
      }
    });

    document.getElementById("waHasilBox").classList.remove("hidden");
    document.getElementById("waJmlSudah").textContent      = sudahDiGrup.length;
    document.getElementById("waJmlBelum").textContent      = belumDiGrup.length;
    document.getElementById("waJmlTanpaNomor").textContent = tanpaNomor.length;

    const tbodyBelum = document.getElementById("waBelumTableBody");
    tbodyBelum.innerHTML = belumDiGrup.length
      ? belumDiGrup.map(a => `
          <tr>
            <td><strong>${a.nama}</strong></td>
            <td>${a.jabatan || "Anggota"}</td>
            <td>${a.kontak}</td>
          </tr>`).join("")
      : `<tr><td colspan="3" class="empty-row">🎉 Semua anggota dengan No. HP sudah ada di grup WA!</td></tr>`;

    const tbodyTanpaNomor = document.getElementById("waTanpaNomorTableBody");
    tbodyTanpaNomor.innerHTML = tanpaNomor.length
      ? tanpaNomor.map(a => `
          <tr>
            <td><strong>${a.nama}</strong></td>
            <td>${a.jabatan || "Anggota"}</td>
          </tr>`).join("")
      : `<tr><td colspan="2" class="empty-row">Semua anggota sudah punya No. HP tercatat.</td></tr>`;

    // simpan untuk export
    window._belumDiGrupWA = belumDiGrup;

    document.getElementById("waHasilBox").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    alert("❌ Gagal memuat data anggota: " + err.message);
  }
}

function exportBelumWA() {
  const data = window._belumDiGrupWA || [];
  if (!data.length) { alert("Tidak ada data untuk diexport. Jalankan perbandingan dulu."); return; }

  const rows = data.map((a, i) => ({
    "No"     : i + 1,
    "Nama"   : a.nama,
    "Jabatan": a.jabatan || "Anggota",
    "No. HP" : a.kontak
  }));
  downloadExcel(rows, "Belum_Gabung_Grup_WA");
}

// ═══════════════════════════════════════════════════════════════
// KALENDER KEGIATAN
// ═══════════════════════════════════════════════════════════════

// State kalender
let kalBulan     = new Date().getMonth();  // 0-11
let kalTahun     = new Date().getFullYear();
let kalAllData   = [];   // semua kegiatan dari getDaftarKegiatan()
let kalTerpilih  = null; // tanggal yang sedang diklik (string YYYY-MM-DD)

const NAMA_BULAN = ["Januari","Februari","Maret","April","Mei","Juni",
                    "Juli","Agustus","September","Oktober","November","Desember"];
const NAMA_HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

// Muat data kegiatan dari backend, lalu render kalender
async function loadKalender() {
  try {
    const result = await fetchAPI("getDaftarKegiatan");
    kalAllData = result.data || [];
  } catch (e) {
    kalAllData = [];
  }
  renderKalender();
  renderListBulan();
}

function kalPrevBulan() {
  kalBulan--;
  if (kalBulan < 0) { kalBulan = 11; kalTahun--; }
  kalTerpilih = null;
  renderKalender();
  renderListBulan();
}

function kalNextBulan() {
  kalBulan++;
  if (kalBulan > 11) { kalBulan = 0; kalTahun++; }
  kalTerpilih = null;
  renderKalender();
  renderListBulan();
}

// Buat peta tanggal → array kegiatan dari kalAllData
function kalBuatPeta(bulan, tahun) {
  const peta = {};
  kalAllData.forEach(k => {
    if (!k.tanggal) return;
    const [y, m] = k.tanggal.split("-").map(Number);
    if (y === tahun && m === bulan + 1) {
      if (!peta[k.tanggal]) peta[k.tanggal] = [];
      peta[k.tanggal].push(k);
    }
  });
  return peta;
}

function renderKalender() {
  document.getElementById("kalJudulBulan").textContent =
    NAMA_BULAN[kalBulan] + " " + kalTahun;

  const peta   = kalBuatPeta(kalBulan, kalTahun);
  const grid   = document.getElementById("kalGrid");
  const hari1  = new Date(kalTahun, kalBulan, 1).getDay(); // 0=Minggu
  const awal   = (hari1 + 6) % 7; // konversi ke Senin=0
  const harini = new Date().toISOString().split("T")[0];

  // Total sel = hari di bulan ini + padding awal + padding akhir (kelipatan 7)
  const totalHariBulan = new Date(kalTahun, kalBulan + 1, 0).getDate();
  const totalSel = Math.ceil((awal + totalHariBulan) / 7) * 7;

  let html = "";
  for (let i = 0; i < totalSel; i++) {
    const hariKe = i - awal + 1;
    const lain   = hariKe < 1 || hariKe > totalHariBulan;
    let tanggalStr = "";

    if (!lain) {
      const mm = String(kalBulan + 1).padStart(2, "0");
      const dd = String(hariKe).padStart(2, "0");
      tanggalStr = `${kalTahun}-${mm}-${dd}`;
    }

    const events   = tanggalStr ? (peta[tanggalStr] || []) : [];
    const isHarini = tanggalStr === harini;
    const isPilih  = tanggalStr === kalTerpilih;
    const tampil   = lain ? (hariKe < 1
      ? new Date(kalTahun, kalBulan, hariKe).getDate()
      : hariKe - totalHariBulan) : hariKe;

    const cls = [
      "kal-cell",
      lain ? "lain-bulan" : "",
      isHarini && !isPilih ? "hari-ini" : "",
      isPilih ? "dipilih" : ""
    ].filter(Boolean).join(" ");

    const onclick = !lain ? `onclick="kalPilihTanggal('${tanggalStr}')"` : "";

    // Dot: max 3 titik (biru = kegiatan ada)
    const dots = events.slice(0, 3).map(() =>
      `<span class="kal-dot"></span>`).join("");

    html += `
      <div class="${cls}" ${onclick}>
        <div class="kal-day-num">${tampil}</div>
        ${events.length ? `<div class="kal-dots">${dots}</div>` : ""}
      </div>`;
  }

  grid.innerHTML = html;

  // Tampilkan info tanggal yang sedang terpilih (atau hari ini)
  const terpilihAktif = kalTerpilih || harini;
  const eventsTerpilih = peta[terpilihAktif] || [];
  tampilkanDetailTanggal(terpilihAktif, eventsTerpilih);
}

function kalPilihTanggal(tgl) {
  kalTerpilih = tgl;
  renderKalender();
}

function tampilkanDetailTanggal(tgl, events) {
  const infoTgl   = document.getElementById("kalSelectedTanggal");
  const infoEvts  = document.getElementById("kalSelectedEvents");

  if (!tgl) { infoTgl.textContent = "—"; infoEvts.innerHTML = ""; return; }

  const d = new Date(tgl + "T00:00:00");
  infoTgl.textContent = NAMA_HARI[d.getDay()] + ", " + d.getDate() + " " +
    NAMA_BULAN[d.getMonth()] + " " + d.getFullYear();

  if (!events.length) {
    infoEvts.innerHTML = `<div class="kal-empty">Tidak ada kegiatan pada tanggal ini.</div>`;
    return;
  }

  infoEvts.innerHTML = events.map(k => `
    <div class="kal-event-chip">
      <div>
        <div class="chip-kategori">${k.kategori || "—"}</div>
        <div class="chip-tempat">${k.tempat || "—"}</div>
      </div>
      <div class="chip-stats">
        <span class="chip-stat hadir">✅ ${k.hadir}</span>
        <span class="chip-stat alfa">❌ ${k.alfa}</span>
      </div>
    </div>
  `).join("");
}

// Tabel daftar kegiatan di bulan yang sedang dilihat
function renderListBulan() {
  const tbody = document.getElementById("kalListBody");
  const judul = document.getElementById("kalListJudul");

  judul.textContent = "Kegiatan " + NAMA_BULAN[kalBulan] + " " + kalTahun;

  const bulanRows = kalAllData.filter(k => {
    if (!k.tanggal) return false;
    const [y, m] = k.tanggal.split("-").map(Number);
    return y === kalTahun && m === kalBulan + 1;
  });

  if (!bulanRows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Tidak ada kegiatan bulan ini.</td></tr>`;
    return;
  }

  // Urutkan per tanggal ascending
  bulanRows.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  tbody.innerHTML = bulanRows.map(k => {
    const d = new Date(k.tanggal + "T00:00:00");
    const tglLabel = d.getDate() + " " + NAMA_BULAN[d.getMonth()];
    return `
      <tr style="cursor:pointer" onclick="kalPilihTanggal('${k.tanggal}'); document.getElementById('kalGrid').scrollIntoView({behavior:'smooth'})">
        <td>${tglLabel}</td>
        <td><strong>${k.kategori || "—"}</strong></td>
        <td>${k.tempat || "—"}</td>
        <td><span class="chip-stat hadir">${k.hadir}</span></td>
        <td><span class="chip-stat alfa">${k.alfa}</span></td>
      </tr>
    `;
  }).join("");
}

// ═══════════════════════════════════════════════════════════════
// UKURAN BAJU ANGGOTA
// ═══════════════════════════════════════════════════════════════

const UKURAN_BAJU_URL_PATH = "ukuran.html"; // nama file halaman pengisian

function initUkuranBaju() {
  // Bangun link pengisian berdasarkan URL halaman ini
  const baseURL = window.location.href.replace(/\/[^/]*$/, "/");
  const linkPengisian = baseURL + UKURAN_BAJU_URL_PATH;

  document.getElementById("ukuranLinkInput").value = linkPengisian;

  // Render QR code pakai library QRCode.js (CDN)
  const qrBox = document.getElementById("ukuranQRCode");
  qrBox.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    new QRCode(qrBox, {
      text  : linkPengisian,
      width : 136,
      height: 136,
      colorDark  : "#1E2B4A",
      colorLight : "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    // Fallback: QR via Google Charts API
    const img = document.createElement("img");
    img.src = "https://chart.googleapis.com/chart?cht=qr&chs=136x136&chl=" +
              encodeURIComponent(linkPengisian) + "&chco=1E2B4A";
    img.alt = "QR Code";
    img.style.cssText = "width:136px;height:136px;";
    qrBox.appendChild(img);
  }

  loadUkuranBaju();
}

function salinLinkUkuran() {
  const input = document.getElementById("ukuranLinkInput");
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = event.target;
    btn.textContent = "✅ Disalin!";
    setTimeout(() => { btn.textContent = "Salin"; }, 2000);
  }).catch(() => {
    input.select();
    document.execCommand("copy");
  });
}

async function loadUkuranBaju() {
  try {
    // Ambil data ukuran dan daftar anggota secara paralel
    const [resUkuran, resAnggota] = await Promise.all([
      fetchAPI("getUkuranBaju"),
      Promise.resolve({ data: daftarAnggota })
    ]);

    const dataUkuran  = resUkuran.data || [];
    const dataAnggota = daftarAnggota || [];

    // Map nama → ukuran untuk lookup cepat (key dinormalisasi: trim + lowercase)
    const mapUkuran = {};
    dataUkuran.forEach(u => { mapUkuran[normalisasiNamaUkuran(u.nama)] = u; });

    // Gabungkan: semua anggota + status ukurannya
    const namaAnggotaTernormal = new Set();
    const gabungan = dataAnggota.map(a => {
      const key = normalisasiNamaUkuran(a.nama);
      namaAnggotaTernormal.add(key);
      const u = mapUkuran[key];
      return {
        nama     : a.nama,
        jabatan  : a.jabatan || "Anggota",
        status   : a.statusKeanggotaan || "Aktif",
        gender   : u?.gender || null,
        ukuran   : u?.ukuran || null,
        timestamp: u?.timestamp || null
      };
    });

    // Cari entri di sheet Ukuran_Baju yang namanya TIDAK cocok dengan siapapun
    // di Daftar Anggota (mis. typo nama, atau orang yang sudah isi tapi belum
    // terdaftar sebagai anggota). Supaya tetap kehitung di ringkasan & tabel,
    // bukan "hilang diam-diam".
    const tidakCocok = dataUkuran.filter(u => !namaAnggotaTernormal.has(normalisasiNamaUkuran(u.nama)));
    tidakCocok.forEach(u => {
      gabungan.push({
        nama     : u.nama + " ⚠️",
        jabatan  : "Tidak terdaftar di Anggota",
        status   : "—",
        gender   : u.gender || null,
        ukuran   : u.ukuran || null,
        timestamp: u.timestamp || null
      });
    });

    renderTabelUkuran(gabungan);
    renderStatsUkuran(gabungan);

    const sudahIsi = gabungan.filter(g => g.ukuran).length;
    document.getElementById("ukuranBadge").textContent =
      sudahIsi + " / " + gabungan.length + " sudah isi";

    if (tidakCocok.length > 0) {
      console.warn(
        tidakCocok.length + " entri di Ukuran_Baju namanya tidak cocok persis dengan Daftar Anggota:",
        tidakCocok.map(u => u.nama)
      );
    }

  } catch (err) {
    document.getElementById("ukuranTableBody").innerHTML =
      `<tr><td colspan="6" class="empty-row">❌ ${err.message}</td></tr>`;
  }
}

// Normalisasi nama untuk pencocokan: trim spasi berlebih, lowercase,
// dan rapikan spasi ganda jadi satu spasi (mengantisipasi typo spasi).
function normalisasiNamaUkuran(nama) {
  if (!nama) return "";
  return nama.toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function renderTabelUkuran(data) {
  const tbody = document.getElementById("ukuranTableBody");
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Belum ada data anggota.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((r, i) => {
    const genderIcon = r.gender === "Perempuan" ? "👧" : r.gender === "Laki-laki" ? "👦" : "—";
    const ukuranCell = r.ukuran
      ? `<span class="ukuran-badge-pill">${r.ukuran}</span>`
      : `<span class="ukuran-badge-pill belum">Belum isi</span>`;
    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${r.nama}</strong></td>
        <td>${r.jabatan}</td>
        <td><span class="status-badge ${(r.status||"").toLowerCase()}">${r.status}</span></td>
        <td>${genderIcon} ${r.gender || "—"}</td>
        <td>${ukuranCell}</td>
        <td style="font-size:.78rem;color:var(--muted)">${r.timestamp || "—"}</td>
      </tr>`;
  }).join("");
}

function renderStatsUkuran(data) {
  const URUTAN = ["XS","S","M","L","XL","XXL","XXXL"];
  const hL = {}, hP = {};
  URUTAN.forEach(u => { hL[u] = 0; hP[u] = 0; });

  data.forEach(r => {
    if (!r.ukuran) return;
    if (r.gender === "Perempuan" && hP[r.ukuran] !== undefined) hP[r.ukuran]++;
    else if (hL[r.ukuran] !== undefined) hL[r.ukuran]++;
  });

  const belumIsi = data.filter(r => !r.ukuran).length;
  const totalL   = data.filter(r => r.gender === "Laki-laki" && r.ukuran).length;
  const totalP   = data.filter(r => r.gender === "Perempuan" && r.ukuran).length;

  const container = document.getElementById("ukuranStats");
  container.innerHTML = `
    <div style="grid-column:1/-1;font-size:.78rem;font-weight:700;color:var(--navy);padding:4px 0 2px;">👦 Laki-laki (${totalL} orang)</div>
    ${URUTAN.map(u => `
      <div class="ukuran-stat-card">
        <div class="ukuran-stat-size">${u}</div>
        <div class="ukuran-stat-count">${hL[u]} orang</div>
      </div>`).join("")}
    <div style="grid-column:1/-1;font-size:.78rem;font-weight:700;color:var(--navy);padding:10px 0 2px;">👧 Perempuan (${totalP} orang)</div>
    ${URUTAN.map(u => `
      <div class="ukuran-stat-card">
        <div class="ukuran-stat-size">${u}</div>
        <div class="ukuran-stat-count">${hP[u]} orang</div>
      </div>`).join("")}
    <div style="grid-column:1/-1;">
      <div class="ukuran-stat-card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;">
        <span style="font-size:1.1rem;">❓</span>
        <span style="font-size:.82rem;color:var(--muted);">${belumIsi} anggota belum mengisi</span>
      </div>
    </div>`;
}

function exportUkuranExcel() {
  const rows = [];
  document.querySelectorAll("#ukuranTableBody tr").forEach(tr => {
    const cols = tr.querySelectorAll("td");
    if (cols.length < 6) return;
    rows.push({
      "No"            : cols[0].textContent.trim(),
      "Nama"          : cols[1].textContent.trim(),
      "Jabatan"       : cols[2].textContent.trim(),
      "Status"        : cols[3].textContent.trim(),
      "Gender"        : cols[4].textContent.trim(),
      "Ukuran Baju"   : cols[5].textContent.trim(),
      "Terakhir Diisi": cols[6].textContent.trim()
    });
  });
  downloadExcel(rows, "Ukuran_Baju_Anggota");
}

// ═══ KEUANGAN EVENT ════════════════════════════════════════
//
// Pencatatan keuangan khusus per event (terpisah dari Keuangan STT utama).
// Saat event selesai, bendahara klik "Tambahkan ke Keuangan STT" untuk
// mengirim ringkasan total (Pemasukan & Pengeluaran) ke modul Keuangan utama,
// setelah itu transaksi event ini terkunci permanen.

async function refreshKeuanganEvent() {
  if (!eventAktifId) return;
  try {
    const result = await fetchAPI("getKeuanganEvent", { eventId: eventAktifId });
    const { transaksi, terkunci, totalPemasukan, totalPengeluaran } = result.data;
    const saldo = totalPemasukan - totalPengeluaran;

    document.getElementById("evtKeuTotalMasuk").textContent = formatRupiah(totalPemasukan);
    document.getElementById("evtKeuTotalKeluar").textContent = formatRupiah(totalPengeluaran);
    document.getElementById("evtKeuSaldo").textContent = formatRupiah(saldo);

    const lockedBadge = document.getElementById("evtKeuLockedBadge");
    const formBox      = document.getElementById("evtKeuFormBox");
    const submitBox     = document.getElementById("evtKeuSubmitBox");

    if (terkunci) {
      lockedBadge.textContent = "🔒 Terkunci (sudah disubmit)";
      lockedBadge.style.display = "inline-block";
      formBox.classList.add("hidden");
      submitBox.classList.add("hidden");
    } else {
      lockedBadge.textContent = "";
      lockedBadge.style.display = "none";
      formBox.classList.remove("hidden");
      // Tombol submit hanya muncul kalau sudah ada minimal 1 transaksi
      submitBox.classList.toggle("hidden", transaksi.length === 0);
    }

    const tbody = document.getElementById("evtKeuTableBody");
    const transaksiNyata = transaksi.filter(t => t.jenis !== "__LOCKED__");
    if (!transaksiNyata.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Belum ada transaksi.</td></tr>`;
      return;
    }

    tbody.innerHTML = transaksiNyata.map(t => {
      const isPos = t.jenis === "Pemasukan";
      return `
        <tr>
          <td>${formatTanggal(t.tanggal)}</td>
          <td><span class="status-badge ${isPos ? 'hadir' : 'alfa'}">${t.jenis}</span></td>
          <td style="font-weight:600; color:${isPos ? 'var(--green)' : 'var(--red)'};">${isPos ? '+' : '-'}${formatRupiah(t.nominal)}</td>
          <td>${t.keterangan || '—'}</td>
          <td>${terkunci ? '—' : `<button class="btn-hapus" onclick="hapusTransaksiEvent('${t.id}')">Hapus</button>`}</td>
        </tr>`;
    }).join("");
  } catch (err) {
    console.error("Gagal memuat keuangan event:", err.message);
  }
}

async function tambahTransaksiEvent() {
  const tanggal    = document.getElementById("evtKeuTanggal").value;
  const jenis      = document.getElementById("evtKeuJenis").value;
  const nominal    = document.getElementById("evtKeuNominal").value;
  const keterangan = document.getElementById("evtKeuKeterangan").value.trim();

  if (!tanggal || !nominal) {
    showAlert("evtKeuAlert", "error", "Tanggal dan nominal wajib diisi.");
    return;
  }
  if (!eventAktifId) return;

  setLoading("evtKeuSubmitBtn", true);
  try {
    await writeAPI("tambahKeuanganEvent", { eventId: eventAktifId, tanggal, jenis, nominal, keterangan });
    showAlert("evtKeuAlert", "success", "✅ Transaksi berhasil ditambahkan!");
    document.getElementById("evtKeuNominal").value = "";
    document.getElementById("evtKeuKeterangan").value = "";
    refreshKeuanganEvent();
  } catch (err) {
    showAlert("evtKeuAlert", "error", "❌ Gagal: " + err.message);
  } finally {
    setLoading("evtKeuSubmitBtn", false);
  }
}

function hapusTransaksiEvent(id) {
  document.getElementById("modalBody").textContent =
    "Transaksi ini akan dihapus dari catatan keuangan event.";
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    try {
      await writeAPI("hapusKeuanganEvent", { id, eventId: eventAktifId });
      refreshKeuanganEvent();
    } catch (err) {
      alert("❌ Gagal menghapus: " + err.message);
    }
  };
}

function konfirmasiSubmitKeuanganEvent() {
  document.getElementById("modalBody").textContent =
    "Ringkasan total Pemasukan & Pengeluaran event ini akan ditambahkan ke Keuangan STT. " +
    "Setelah ini, seluruh transaksi keuangan event TIDAK BISA diubah lagi. Lanjutkan?";
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    setLoading("evtKeuSubmitUtamaBtn", true);
    try {
      const result = await writeAPI("submitKeuanganEventKeUtama", { eventId: eventAktifId });
      alert("✅ " + result.message);
      refreshKeuanganEvent();
    } catch (err) {
      alert("❌ Gagal: " + err.message);
    } finally {
      setLoading("evtKeuSubmitUtamaBtn", false);
    }
  };
}

// Cetak laporan keuangan KHUSUS untuk 1 event yang sedang dibuka.
// Tampilan dibuat sama persis dengan cetakKeuangan() (Keuangan STT utama),
// tapi datanya diambil dari Keuangan_Event (bukan Keuangan utama).
async function cetakKeuanganEvent() {
  if (!eventAktifId) { alert("Tidak ada event yang dibuka."); return; }

  try {
    const result = await fetchAPI("getKeuanganEvent", { eventId: eventAktifId });
    const { transaksi } = result.data;
    let data = transaksi.filter(t => t.jenis !== "__LOCKED__");

    if (!data.length) { alert("Belum ada transaksi keuangan untuk event ini."); return; }

    // Urutkan kronologis (tanggal lama ke baru), sama seperti cetak Keuangan utama
    data = [...data].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    const namaEvent = document.getElementById("evtDetailNama").textContent;

    let totalPemasukan = 0, totalPengeluaran = 0;
    const baris = data.map((r, i) => {
      if (r.jenis === "Pemasukan") totalPemasukan += r.nominal;
      else totalPengeluaran += r.nominal;
      const isPos = r.jenis === "Pemasukan";
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${formatTanggal(r.tanggal)}</td>
          <td><span class="badge-cetak ${isPos ? 'pos' : 'neg'}">${r.jenis}</span></td>
          <td class="nominal ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : '-'}${formatRupiahPolos(r.nominal)}</td>
          <td>${r.keterangan || '—'}</td>
        </tr>`;
    }).join("");

    const saldo = totalPemasukan - totalPengeluaran;

    const w = window.open("", "_blank");
    w.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>STT Panca Kerti — Keuangan Event: ${namaEvent}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #2D3748; padding: 30px 36px; }
        .header { display:flex; align-items:center; gap:14px; border-bottom: 3px solid #1E2B4A; padding-bottom:14px; margin-bottom:18px; }
        .header img { width:50px; height:50px; object-fit:contain; }
        .header h1 { color: #1E2B4A; font-size: 19px; margin:0; }
        .header p  { color: #718096; font-size: 12px; margin:2px 0 0; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
        th { background: #1E2B4A; color: #fff; padding: 9px 8px; text-align: left; font-size:11px; text-transform:uppercase; letter-spacing:.02em; }
        td { padding: 8px; border-bottom: 1px solid #E2E8F0; }
        tr:nth-child(even) td { background: #F7F9FC; }
        .nominal { text-align: right; font-weight:600; white-space:nowrap; }
        .nominal.pos { color: #2F855A; }
        .nominal.neg { color: #C53030; }
        .badge-cetak { padding:3px 9px; border-radius:12px; font-size:10.5px; font-weight:600; }
        .badge-cetak.pos { background:#F0FFF4; color:#2F855A; }
        .badge-cetak.neg { background:#FFF5F5; color:#C53030; }
        tfoot td { font-weight:700; border-top: 2px solid #1E2B4A; background:#fff !important; }
        tfoot tr.saldo td { background:#1E2B4A !important; color:#fff; font-size:13px; }
        .no-print { display:none; }
        @media print { body { padding: 10px 18px; } }
      </style></head><body>
      <div class="header">
        <img src="logo.png" alt="logo" onerror="this.style.display='none'" />
        <div>
          <h1>STT Panca Kerti — Keuangan Event</h1>
          <p>${namaEvent} &middot; Dicetak: ${new Date().toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>No</th><th>Tanggal</th><th>Jenis</th><th style="text-align:right;">Nominal</th><th>Keterangan</th></tr>
        </thead>
        <tbody>${baris}</tbody>
        <tfoot>
          <tr><td colspan="3"></td><td class="nominal pos">+${formatRupiahPolos(totalPemasukan)}</td><td>Total Pemasukan</td></tr>
          <tr><td colspan="3"></td><td class="nominal neg">-${formatRupiahPolos(totalPengeluaran)}</td><td>Total Pengeluaran</td></tr>
          <tr class="saldo"><td colspan="3"></td><td class="nominal" style="color:#fff;">${saldo >= 0 ? '+' : '-'}${formatRupiahPolos(Math.abs(saldo))}</td><td>SALDO EVENT</td></tr>
        </tfoot>
      </table>
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>
    `);
    w.document.close();
  } catch (e) { alert("Gagal memuat data: " + e.message); }
}

// Cetak Daftar Anggota dengan urutan hierarki: jabatan struktural dulu
// (Ketua → Wakil Ketua → Sekretaris → Bendahara → Kesinoman), lalu anggota
// biasa dikelompokkan per status (Aktif → Nonaktif → Pengampel). Tiap
// kelompok punya header pemisah, mirip pengelompokan per bulan di cetak Keuangan.
async function cetakAnggota() {
  try {
    const result = await fetchAPI("getAnggota");
    const data = result.data || [];
    if (!data.length) { alert("Tidak ada data anggota untuk dicetak."); return; }

    const terurut = urutkanHierarkiAnggota(data);

    // Kelompokkan untuk header pemisah
    const grup = {};
    const urutanGrup = [];
    terurut.forEach(r => {
      const jabatan = r.jabatan || "Anggota";
      let label;
      if (URUTAN_JABATAN.includes(jabatan)) {
        label = jabatan;
      } else {
        label = "Anggota — " + (r.statusKeanggotaan || "Aktif");
      }
      if (!grup[label]) { grup[label] = []; urutanGrup.push(label); }
      grup[label].push(r);
    });

    let noUrut = 0;
    let bodyHtml = "";
    urutanGrup.forEach(label => {
      bodyHtml += `<tr class="grup-jabatan"><td colspan="5">${label} (${grup[label].length} orang)</td></tr>`;
      bodyHtml += grup[label].map(r => {
        noUrut++;
        return `
          <tr>
            <td>${noUrut}</td>
            <td>${r.nama}</td>
            <td>${r.jabatan || "Anggota"}</td>
            <td><span class="badge-cetak ${(r.statusKeanggotaan || 'aktif').toLowerCase() === 'nonaktif' ? 'neg' : 'pos'}">${r.statusKeanggotaan || "Aktif"}</span></td>
            <td>${r.kontak || "—"}</td>
          </tr>`;
      }).join("");
    });

    const w = window.open("", "_blank");
    w.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>STT Panca Kerti — Data Anggota</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #2D3748; padding: 30px 36px; }
        .header { display:flex; align-items:center; gap:14px; border-bottom: 3px solid #1E2B4A; padding-bottom:14px; margin-bottom:18px; }
        .header img { width:50px; height:50px; object-fit:contain; }
        .header h1 { color: #1E2B4A; font-size: 19px; margin:0; }
        .header p  { color: #718096; font-size: 12px; margin:2px 0 0; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
        th { background: #1E2B4A; color: #fff; padding: 9px 8px; text-align: left; font-size:11px; text-transform:uppercase; letter-spacing:.02em; }
        td { padding: 8px; border-bottom: 1px solid #E2E8F0; }
        tr:nth-child(even) td { background: #F7F9FC; }
        .badge-cetak { padding:3px 9px; border-radius:12px; font-size:10.5px; font-weight:600; }
        .badge-cetak.pos { background:#F0FFF4; color:#2F855A; }
        .badge-cetak.neg { background:#FFF5F5; color:#C53030; }
        tr.grup-jabatan td {
          background:#1E2B4A !important; color:#fff; font-weight:700; font-size:12.5px;
          padding:10px 8px; letter-spacing:.02em;
        }
        .no-print { display:none; }
        @media print { body { padding: 10px 18px; } tr.grup-jabatan { break-inside: avoid; } }
      </style></head><body>
      <div class="header">
        <img src="logo.png" alt="logo" onerror="this.style.display='none'" />
        <div>
          <h1>STT Panca Kerti — Data Anggota</h1>
          <p>Total ${data.length} anggota &middot; Dicetak: ${new Date().toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Status</th><th>Kontak</th></tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>
    `);
    w.document.close();
  } catch (e) { alert("Gagal memuat data: " + e.message); }
}

// ═══════════════════════════════════════════════════════════════
// PEMBAYARAN GALUNGAN
// ═══════════════════════════════════════════════════════════════

let galPeriodeAktifId = null;
let galEkstraHari     = 0;
let galDataCache      = null; // cache hasil getStatusPembayaranGalungan
let galTabAktif       = "belum";

function initGalungan() {
  // Set tanggal default hari ini
  const hariIni = new Date().toISOString().split("T")[0];
  document.getElementById("galTglGalungan").value = hariIni;
  updateDeadlineInfo();
  loadDaftarPeriodeGalungan();
}

function pilihEkstraGalungan(el) {
  document.querySelectorAll(".galungan-ekstra-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  galEkstraHari = parseInt(el.dataset.val) || 0;
  updateDeadlineInfo();
}

function updateDeadlineInfo() {
  const tgl = document.getElementById("galTglGalungan").value;
  const info = document.getElementById("galDeadlineInfo");
  if (!tgl) { info.textContent = "Pilih tanggal Galungan dulu"; return; }

  const kuningan = tambahHariJS(tgl, 10);
  const deadline = tambahHariJS(kuningan, galEkstraHari);

  const tglF = (s) => {
    const d = new Date(s + "T00:00:00");
    const b = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    return d.getDate() + " " + b[d.getMonth()] + " " + d.getFullYear();
  };

  info.textContent = "Kuningan: " + tglF(kuningan) +
    (galEkstraHari > 0 ? " → Deadline: " + tglF(deadline) : " (deadline tepat Kuningan)");
}

// Helper: tambah N hari ke string tanggal YYYY-MM-DD → YYYY-MM-DD
function tambahHariJS(tglStr, n) {
  const d = new Date(tglStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

document.addEventListener("DOMContentLoaded", () => {
  const inp = document.getElementById("galTglGalungan");
  if (inp) inp.addEventListener("change", updateDeadlineInfo);
});

async function buatPeriodeGalungan() {
  const nama     = document.getElementById("galNama").value.trim();
  const tgl      = document.getElementById("galTglGalungan").value;
  const nominal  = document.getElementById("galNominal").value;

  if (!tgl)     { showAlert("galBuatAlert","error","Tanggal Galungan wajib diisi."); return; }
  if (!nominal) { showAlert("galBuatAlert","error","Nominal iuran wajib diisi."); return; }

  setLoading("galBuatBtn", true);
  try {
    const result = await writeAPI("buatPeriodeGalungan", {
      nama, tglGalungan: tgl, nominal: parseFloat(nominal), ekstraHari: galEkstraHari
    });
    showAlert("galBuatAlert","success","✅ " + result.message);
    document.getElementById("galNama").value    = "";
    document.getElementById("galNominal").value = "";
    loadDaftarPeriodeGalungan();
  } catch (err) {
    showAlert("galBuatAlert","error","❌ " + err.message);
  } finally {
    setLoading("galBuatBtn", false);
  }
}

async function loadDaftarPeriodeGalungan() {
  const container = document.getElementById("galPeriodeList");
  container.innerHTML = `<p class="empty-row" style="padding:16px;text-align:center;">Memuat...</p>`;
  try {
    const result = await fetchAPI("getDaftarPeriodeGalungan");
    const data   = result.data || [];

    if (!data.length) {
      container.innerHTML = `<p class="empty-row" style="padding:20px;text-align:center;">Belum ada periode pembayaran. Buat periode baru di atas.</p>`;
      return;
    }

    const bln = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    const fmt = s => { if (!s) return "—"; const d = new Date(s+"T00:00:00"); return d.getDate()+" "+bln[d.getMonth()]+" "+d.getFullYear(); };

    container.innerHTML = data.map(p => {
      const isAktif   = p.status === "Aktif";
      const hariIni   = new Date().toISOString().split("T")[0];
      const terlambat = hariIni > p.deadline && isAktif;
      const pct       = p.sudahBayar && p.sudahBayar > 0 ? Math.round(p.sudahBayar / (p.sudahBayar + (p.totalBelum||0)) * 100) : 0;

      return `
        <div class="galungan-periode-card ${isAktif?"aktif-card":"selesai-card"}" onclick="pilihPeriodeGalungan('${p.id}')">
          <div class="gal-periode-info">
            <div class="gal-periode-nama">${p.nama}</div>
            <div class="gal-periode-sub">
              Galungan: ${fmt(p.tglGalungan)} &nbsp;·&nbsp; Kuningan: ${fmt(p.tglKuningan)} &nbsp;·&nbsp; Deadline: ${fmt(p.deadline)}
              ${terlambat ? ' &nbsp;<span class="terlambat-badge">⚠ Lewat Deadline</span>' : ""}
            </div>
            <div class="gal-periode-sub" style="margin-top:4px;">
              Iuran: <strong>${formatRupiah(p.nominal)}</strong>
            </div>
          </div>
          <div class="gal-periode-stat">
            <strong>${p.sudahBayar || 0}</strong> sudah bayar
            <div style="margin-top:4px;"><span class="gal-status-badge ${isAktif?"aktif":"selesai"}">${p.status}</span></div>
          </div>
        </div>`;
    }).join("");

  } catch (err) {
    container.innerHTML = `<p class="empty-row" style="padding:16px;text-align:center;color:var(--red);">❌ ${err.message}</p>`;
  }
}

async function pilihPeriodeGalungan(periodeId) {
  galPeriodeAktifId = periodeId;
  document.getElementById("galDetailCard").classList.remove("hidden");
  document.getElementById("galDetailCard").scrollIntoView({ behavior: "smooth" });
  await refreshDetailGalungan();
}

async function refreshDetailGalungan() {
  if (!galPeriodeAktifId) return;
  try {
    const result = await fetchAPI("getStatusPembayaranGalungan", { periodeId: galPeriodeAktifId });
    galDataCache  = result.data;
    renderDetailGalungan(galDataCache);
  } catch (err) {
    alert("❌ Gagal memuat detail: " + err.message);
  }
}

function renderDetailGalungan(d) {
  const { periode, sudahBayar, belumBayar, totalSudah, totalBelum, totalAnggota, totalTerkumpul } = d;
  const bln = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const fmt = s => { if (!s) return "—"; const dt=new Date(s+"T00:00:00"); return dt.getDate()+" "+bln[dt.getMonth()]+" "+dt.getFullYear(); };
  const hariIni = new Date().toISOString().split("T")[0];
  const sisaHari= periode.deadline ? Math.ceil((new Date(periode.deadline)-new Date(hariIni))/(1000*60*60*24)) : 0;

  document.getElementById("galDetailJudul").textContent = "🪔 " + periode.nama;

  // Info grid
  document.getElementById("galInfoGrid").innerHTML = `
    <div class="gal-info-card"><div class="gal-info-label">Galungan</div><div class="gal-info-value" style="font-size:.85rem;">${fmt(periode.tglGalungan)}</div></div>
    <div class="gal-info-card"><div class="gal-info-label">Kuningan</div><div class="gal-info-value" style="font-size:.85rem;">${fmt(periode.tglKuningan)}</div></div>
    <div class="gal-info-card"><div class="gal-info-label">Deadline</div><div class="gal-info-value" style="font-size:.85rem;">${fmt(periode.deadline)}</div></div>
    <div class="gal-info-card"><div class="gal-info-label">Sisa Hari</div><div class="gal-info-value ${sisaHari<0?"red":sisaHari<=3?"gold":"green"}">${sisaHari<0?"Lewat":sisaHari+" hari"}</div></div>
    <div class="gal-info-card"><div class="gal-info-label">Sudah Bayar</div><div class="gal-info-value green">${totalSudah} orang</div></div>
    <div class="gal-info-card"><div class="gal-info-label">Belum Bayar</div><div class="gal-info-value red">${totalBelum} orang</div></div>
    <div class="gal-info-card"><div class="gal-info-label">Iuran/Orang</div><div class="gal-info-value" style="font-size:.82rem;">${formatRupiah(periode.nominal)}</div></div>
    <div class="gal-info-card"><div class="gal-info-label">Terkumpul</div><div class="gal-info-value gold" style="font-size:.82rem;">${formatRupiah(totalTerkumpul)}</div></div>`;

  // Progress
  const pct = totalAnggota > 0 ? Math.round(totalSudah / totalAnggota * 100) : 0;
  document.getElementById("galProgressLabel").textContent = `${totalSudah} dari ${totalAnggota} anggota sudah membayar`;
  document.getElementById("galProgressPct").textContent   = pct + "%";
  document.getElementById("galProgressBar").style.width   = pct + "%";

  // Badge
  document.getElementById("badgeBelum").textContent = totalBelum;
  document.getElementById("badgeSudah").textContent = totalSudah;

  // Sembunyikan tombol tutup kalau sudah selesai
  document.getElementById("galTutupBtn").style.display = periode.status === "Selesai" ? "none" : "";

  // Render tabel sesuai tab aktif
  renderTabelGalungan();
}

function renderTabelGalungan() {
  if (!galDataCache) return;
  const { sudahBayar, belumBayar, periode } = galDataCache;
  const hariIni = new Date().toISOString().split("T")[0];
  const isSelesai = periode.status === "Selesai";

  // Tabel belum bayar
  const tblB = document.getElementById("tblBelumBayar");
  if (!belumBayar.length) {
    tblB.innerHTML = `<tr><td colspan="5" class="empty-row">🎉 Semua anggota sudah membayar!</td></tr>`;
  } else {
    tblB.innerHTML = belumBayar.map((a, i) => {
      const terlambat = a.terlambat;
      const aksiBtn = isSelesai ? "—" :
        `<button class="btn-secondary-sm" style="font-size:.75rem;" onclick="modalTandaiBayarGalungan('${a.nama}')">✅ Tandai Bayar</button>`;
      return `<tr>
        <td>${i+1}</td>
        <td><strong>${a.nama}</strong></td>
        <td>${a.jabatan||"Anggota"}</td>
        <td>${terlambat ? '<span class="terlambat-badge">⚠ Terlambat</span>' : '<span style="color:var(--muted);font-size:.8rem;">Belum jatuh tempo</span>'}</td>
        <td>${aksiBtn}</td>
      </tr>`;
    }).join("");
  }

  // Tabel sudah bayar
  const tblS = document.getElementById("tblSudahBayar");
  if (!sudahBayar.length) {
    tblS.innerHTML = `<tr><td colspan="6" class="empty-row">Belum ada yang membayar.</td></tr>`;
  } else {
    tblS.innerHTML = sudahBayar.map((a, i) => `
      <tr>
        <td>${i+1}</td>
        <td><strong>${a.nama}</strong></td>
        <td>${a.jabatan||"Anggota"}</td>
        <td>${a.bayar?.tglBayar || "—"}</td>
        <td>${formatRupiah(a.bayar?.nominal || periode.nominal)}</td>
        <td>${isSelesai ? "—" : `<button class="btn-secondary-sm" style="font-size:.72rem;color:var(--red);" onclick="batalBayarGalungan('${a.bayar?.id}')">Batal</button>`}</td>
      </tr>`).join("");
  }
}

function switchTabGalungan(tab) {
  galTabAktif = tab;
  document.getElementById("tabBelum").classList.toggle("active", tab==="belum");
  document.getElementById("tabSudah").classList.toggle("active", tab==="sudah");
  document.getElementById("panelBelum").classList.toggle("hidden", tab!=="belum");
  document.getElementById("panelSudah").classList.toggle("hidden", tab!=="sudah");
}

function modalTandaiBayarGalungan(nama) {
  if (!galPeriodeAktifId) return;
  const nominal = galDataCache?.periode?.nominal || 0;
  document.getElementById("modalBody").innerHTML =
    `Tandai <strong>${nama}</strong> sudah membayar iuran Galungan sebesar <strong>${formatRupiah(nominal)}</strong>?`;
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    try {
      await writeAPI("tandaiSudahBayarGalungan", { periodeId: galPeriodeAktifId, nama, nominal });
      await refreshDetailGalungan();
      loadDaftarPeriodeGalungan();
    } catch (err) { alert("❌ " + err.message); }
  };
}

async function batalBayarGalungan(id) {
  if (!id) return;
  document.getElementById("modalBody").textContent = "Batalkan catatan pembayaran ini?";
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    try {
      await writeAPI("hapusBayarGalungan", { id });
      await refreshDetailGalungan();
      loadDaftarPeriodeGalungan();
    } catch (err) { alert("❌ " + err.message); }
  };
}

async function tutupPeriodeGalungan() {
  if (!galPeriodeAktifId) return;
  document.getElementById("modalBody").textContent = "Tutup periode ini? Statusnya akan berubah menjadi 'Selesai' dan tidak bisa ditandai bayar lagi.";
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = async () => {
    closeModal();
    try {
      await writeAPI("tutupPeriodeGalungan", { periodeId: galPeriodeAktifId });
      await refreshDetailGalungan();
      loadDaftarPeriodeGalungan();
    } catch (err) { alert("❌ " + err.message); }
  };
}

function exportBayarGalungan() {
  if (!galDataCache) return;
  const { periode, sudahBayar, belumBayar } = galDataCache;
  const rows = [];
  sudahBayar.forEach(a => rows.push({
    "Status"    : "Sudah Bayar",
    "Nama"      : a.nama,
    "Jabatan"   : a.jabatan || "Anggota",
    "Tgl Bayar" : a.bayar?.tglBayar || "—",
    "Nominal"   : a.bayar?.nominal || periode.nominal
  }));
  belumBayar.forEach(a => rows.push({
    "Status"    : a.terlambat ? "Belum (Terlambat)" : "Belum Bayar",
    "Nama"      : a.nama,
    "Jabatan"   : a.jabatan || "Anggota",
    "Tgl Bayar" : "—",
    "Nominal"   : 0
  }));
  downloadExcel(rows, "Pembayaran_" + periode.nama.replace(/\s+/g,"_"));
}
