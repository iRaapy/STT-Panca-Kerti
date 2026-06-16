// ─── KONFIGURASI ────────────────────────────────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbxMtRRVkAhz3R6g4TDgFA5Qn_U1TwyQ-UZKVSjXNdCEDjly62VjClEsJNtYDgy80T2-/exec";

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

  const titles = { dashboard: "Dashboard", absensi: "Modul Absensi", keuangan: "Modul Keuangan", anggota: "Daftar Anggota", rekap: "Rekap Absensi", dokumen: "Dokumen" };
  document.getElementById("topbarTitle").textContent = titles[page] || page;

  if (page === "dashboard") loadDashboard();
  if (page === "keuangan")  loadRingkasanKeuangan();
  if (page === "anggota")   loadAnggota();
  if (page === "rekap")     initRekap();
  if (page === "dokumen")   loadDokumen();
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
  btn.querySelector(".btn-text").classList.toggle("hidden", loading);
  btn.querySelector(".btn-loading").classList.toggle("hidden", !loading);
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
  const nama               = document.getElementById("angNama").value.trim();
  const jabatan            = document.getElementById("angJabatan").value;
  const kontak             = document.getElementById("angKontak").value.trim();
  const statusKeanggotaan  = document.getElementById("angStatusKeanggotaan").value;

  if (!nama) { showAlert("angAlert", "error", "Nama anggota wajib diisi."); return; }

  setLoading("angSubmitBtn", true);
  try {
    await writeAPI("tambahAnggota", { nama, jabatan, kontak, statusKeanggotaan });
    showAlert("angAlert", "success", "✅ Anggota berhasil ditambahkan!");
    document.getElementById("angNama").value                  = "";
    document.getElementById("angKontak").value                = "";
    document.getElementById("angJabatan").value               = "Anggota";
    document.getElementById("angStatusKeanggotaan").value     = "Aktif";
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

function filterTabelAnggota() {
  const cariNama   = (document.getElementById("angFilterNama")?.value || "").toLowerCase().trim();
  const cariStatus = (document.getElementById("angFilterStatus")?.value || "");

  let filtered = daftarAnggota;
  if (cariNama)   filtered = filtered.filter(r => r.nama.toLowerCase().includes(cariNama));
  if (cariStatus) filtered = filtered.filter(r => (r.statusKeanggotaan || "Aktif") === cariStatus);

  renderTabelAnggota(filtered);
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
      <td>
        <button class="btn-hapus" onclick="konfirmasiHapus('anggota', '${r.id}', '${r.nama}')">
          Hapus
        </button>
      </td>
    </tr>
  `).join("");
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

// ═══ REKAP ABSENSI ════════════════════════════════════════
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

  // Cari data anggota untuk tahu statusnya
  const infoAnggota = daftarAnggota.find(a =>
    a.nama.toLowerCase() === nama.toLowerCase()
  );

  try {
    const params = { nama };
    const result = await fetchAPI("getAbsensi", params);
    let rows = result.data || [];

    // Filter tanggal jika diisi
    if (dari)   rows = rows.filter(r => r.tanggal >= dari);
    if (sampai) rows = rows.filter(r => r.tanggal <= sampai);

    // Hitung statistik
    const stat = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
    rows.forEach(r => { if (stat[r.status] !== undefined) stat[r.status]++; });

    const totalHadir      = stat.Hadir;
    const totalTidakHadir = stat.Alfa;
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

function exportKeuanganExcel() {
  const rows = getKeuanganRows();
  if (!rows) return;
  downloadExcel(rows, "Data_Keuangan_STT_Panca_Kerti");
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

function exportKeuanganPDF() {
  const rows = getKeuanganRows();
  if (!rows) return;
  const doc = getPDF("Data Keuangan");
  doc.autoTable({
    head: [["No","Tanggal","Jenis","Kategori","Nominal","Keterangan"]],
    body: rows.map(r => [r.No,r.Tanggal,r.Jenis,r.Kategori,r.Nominal,r.Keterangan]),
    startY: 28,
    headStyles: { fillColor: [30,43,74], textColor: 255 },
    alternateRowStyles: { fillColor: [245,247,250] }
  });
  doc.save("Data_Keuangan_STT_Panca_Kerti.pdf");
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
