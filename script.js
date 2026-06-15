/**
 * ============================================================
 *  STT PANCA KERTI — Frontend Script
 *  Versi: 1.0
 *
 *  LANGKAH SETUP:
 *  1. Deploy Code.gs sebagai Web App di Google Apps Script
 *  2. Salin URL deployment ke variabel API_URL di bawah ini
 *  3. Buka index.html di browser
 * ============================================================
 */

// ─── KONFIGURASI ────────────────────────────────────────────
/**
 * Ganti nilai ini dengan URL Web App Google Apps Script Anda.
 * Format: https://script.google.com/macros/s/XXXXX.../exec
 */
const API_URL = "https://script.google.com/macros/s/AKfycbznUSHSX42s4L1_UPaV_BIeFBcuw2__p-3xhwvIwQZMNKgbokbc2ESzVxqx8V6ogtvu/exec";

// ─── STATE GLOBAL ────────────────────────────────────────────
let currentPage   = "dashboard";
let pendingDelete = { type: null, id: null };

// ─── INISIALISASI ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setTodayDates();
  updateTopbarDate();
  checkConnection();
  loadDashboard();
});

/** Set nilai default tanggal hari ini ke semua input date */
function setTodayDates() {
  const today = new Date().toISOString().split("T")[0];
  ["absT", "keuT"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
}

/** Tampilkan tanggal hari ini di topbar */
function updateTopbarDate() {
  const el = document.getElementById("topbarDate");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString("id-ID", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

// ─── NAVIGASI ────────────────────────────────────────────────
/** Berpindah antar halaman */
function navigateTo(page) {
  currentPage = page;

  // Update nav items
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  // Tampilkan halaman yang sesuai
  document.querySelectorAll(".page").forEach(p => {
    p.classList.toggle("active", p.id === "page-" + page);
  });

  // Update judul topbar
  const titles = { dashboard: "Dashboard", absensi: "Modul Absensi", keuangan: "Modul Keuangan" };
  document.getElementById("topbarTitle").textContent = titles[page] || page;

  // Load data sesuai halaman
  if (page === "dashboard") loadDashboard();
  if (page === "keuangan") loadRingkasanKeuangan();

  // Tutup sidebar di mobile
  closeSidebar();
}

// ─── SIDEBAR MOBILE ──────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("show");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("show");
}

// ─── CONNECTION CHECK ─────────────────────────────────────────
async function checkConnection() {
  const dot  = document.querySelector(".status-dot");
  const text = document.querySelector(".status-text");

  // Periksa apakah URL sudah dikonfigurasi
  if (API_URL.includes("GANTI_DENGAN")) {
    dot.className = "status-dot offline";
    text.textContent = "URL belum dikonfigurasi";
    return;
  }

  try {
    const res = await fetchAPI("getRingkasan");
    dot.className = "status-dot online";
    text.textContent = "Terhubung ke Sheets";
  } catch {
    dot.className = "status-dot offline";
    text.textContent = "Koneksi gagal";
  }
}

// ─── API HELPER ───────────────────────────────────────────────
/**
 * Mengirim GET request ke Google Apps Script Web App.
 * GAS hanya mendukung GET untuk respons JSON publik (menghindari CORS).
 * Untuk operasi write (POST), kita encode payload ke query string.
 *
 * CATATAN CORS:
 * GAS Web App saat di-deploy dengan "Execute as: Me" + "Access: Anyone"
 * akan mengembalikan redirect 302 yang bisa menyebabkan CORS error
 * jika kita pakai fetch() biasa dengan mode 'cors'.
 * Solusinya: gunakan mode: 'no-cors' untuk POST, tapi response tidak bisa dibaca.
 * Alternatif yang LEBIH BAIK: encode semua request (termasuk write) ke GET.
 */
async function fetchAPI(action, params = {}) {
  if (API_URL.includes("GANTI_DENGAN")) {
    throw new Error("API_URL belum dikonfigurasi. Edit script.js dan masukkan URL Web App Anda.");
  }

  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) throw new Error("HTTP error: " + response.status);

  const data = await response.json();
  if (data.status === "error") throw new Error(data.message);
  return data;
}

/**
 * Mengirim operasi write (create/delete) sebagai GET request
 * dengan action khusus yang di-encode di query string.
 * GAS doGet() menangani ini dengan switch case.
 */
async function writeAPI(action, data) {
  if (API_URL.includes("GANTI_DENGAN")) {
    throw new Error("API_URL belum dikonfigurasi.");
  }

  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  // Encode data sebagai JSON dalam query parameter
  url.searchParams.set("payload", JSON.stringify(data));

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) throw new Error("HTTP error: " + response.status);
  const result = await response.json();
  if (result.status === "error") throw new Error(result.message);
  return result;
}

// ─── FORMAT HELPERS ───────────────────────────────────────────
/** Format angka ke Rupiah: 1500000 → "Rp 1.500.000" */
function formatRupiah(angka) {
  return "Rp " + Number(angka).toLocaleString("id-ID");
}

/** Format tanggal dari YYYY-MM-DD ke "15 Jun 2025" */
function formatTanggal(str) {
  if (!str) return "—";
  try {
    // Ambil hanya bagian tanggal (YYYY-MM-DD) dari string apapun
    const s = String(str);
    
    // Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.substring(0, 10).split("-");
      return `${parseInt(d)} ${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][parseInt(m)-1]} ${y}`;
    }
    
    // Format dari Google Sheets: "Mon Dec 30 2024 00:00:00 GMT+0800"
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${d.getDate()} ${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.getMonth()]} ${d.getFullYear()}`;
    }
    
    return s; // tampilkan apa adanya
  } catch(e) {
    return String(str);
  }
}

/** Tampilkan atau sembunyikan alert */
function showAlert(elId, type, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = "alert " + type;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

/** Nonaktifkan/aktifkan tombol submit selama loading */
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector(".btn-text").classList.toggle("hidden", loading);
  btn.querySelector(".btn-loading").classList.toggle("hidden", !loading);
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    // Load ringkasan keuangan
    const keu = await fetchAPI("getRingkasan");
    if (keu.data) {
      document.getElementById("dashSaldo").textContent     = formatRupiah(keu.data.saldo);
      document.getElementById("dashPemasukan").textContent = formatRupiah(keu.data.totalPemasukan);
      document.getElementById("dashPengeluaran").textContent = formatRupiah(keu.data.totalPengeluaran);
    }

    // Load 5 transaksi terakhir
    const trx = await fetchAPI("getKeuangan");
    const recent = (trx.data || []).slice(0, 5);
    renderDashRecentTable(recent);

    // Load jumlah absensi
    const abs = await fetchAPI("getAbsensi");
    document.getElementById("dashAbsensiCount").textContent = (abs.data || []).length + " record";

  } catch (err) {
    console.error("Dashboard error:", err);
    // Tampilkan pesan konfigurasi jika URL belum diset
    if (err.message.includes("belum dikonfigurasi")) {
      document.getElementById("dashSaldo").textContent     = "Belum terhubung";
      document.getElementById("dashPemasukan").textContent = "—";
      document.getElementById("dashPengeluaran").textContent = "—";
      document.getElementById("dashAbsensiCount").textContent = "—";
      document.getElementById("dashRecentBody").innerHTML =
        `<tr><td colspan="5" class="empty-row">⚠️ Konfigurasi API_URL di script.js terlebih dahulu.</td></tr>`;
    }
  }
}

function renderDashRecentTable(rows) {
  const tbody = document.getElementById("dashRecentBody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Belum ada transaksi tercatat.</td></tr>`;
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

// ═══════════════════════════════════════════════════════════
//  MODUL ABSENSI
// ═══════════════════════════════════════════════════════════
async function submitAbsensi() {
  const tanggal    = document.getElementById("absT").value;
  const nama       = document.getElementById("absNama").value.trim();
  const status     = document.getElementById("absStatus").value;
  const keterangan = document.getElementById("absKet").value.trim();

  // Validasi frontend
  if (!tanggal || !nama || !status) {
    showAlert("absAlert", "error", "Tanggal, nama, dan status wajib diisi.");
    return;
  }

  setLoading("absSubmitBtn", true);

  try {
    const result = await writeAPI("tambahAbsensi", { tanggal, nama, status, keterangan });
    showAlert("absAlert", "success", "✅ Absensi berhasil disimpan!");

    // Reset form (kecuali tanggal)
    document.getElementById("absNama").value = "";
    document.getElementById("absStatus").value = "";
    document.getElementById("absKet").value = "";

    // Refresh tabel jika sedang ditampilkan
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

  const tbody = document.getElementById("absTableBody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="5">Memuat data...</td></tr>`;

  try {
    const params = {};
    if (nama)    params.nama    = nama;
    if (tanggal) params.tanggal = tanggal;

    const result = await fetchAPI("getAbsensi", params);
    const rows   = result.data || [];

    // Update badge count
    document.getElementById("absBadge").textContent = rows.length + " data";

    // Update rekap status
    updateAbsensiRekap(rows);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Tidak ada data absensi yang ditemukan.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${formatTanggal(r.tanggal)}</td>
        <td><strong>${r.nama}</strong></td>
        <td><span class="status-badge ${r.status.toLowerCase()}">${r.status}</span></td>
        <td>${r.keterangan || "—"}</td>
        <td>
          <button class="btn-hapus" onclick="konfirmasiHapus('absensi', '${r.id}', '${r.nama}')">
            Hapus
          </button>
        </td>
      </tr>
    `).join("");

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">❌ Error: ${err.message}</td></tr>`;
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

// ═══════════════════════════════════════════════════════════
//  MODUL KEUANGAN
// ═══════════════════════════════════════════════════════════

/** Toggle visual pill Pemasukan/Pengeluaran */
function setJenis(jenis) {
  document.getElementById("keuJenis").value = jenis;
  const btnP = document.getElementById("btnPemasukan");
  const btnN = document.getElementById("btnPengeluaran");

  btnP.classList.toggle("active", jenis === "Pemasukan");
  btnN.classList.toggle("active", jenis === "Pengeluaran");
}

async function submitKeuangan() {
  const tanggal    = document.getElementById("keuT").value;
  const jenis      = document.getElementById("keuJenis").value;
  const kategori   = document.getElementById("keuKategori").value;
  const nominal    = document.getElementById("keuNominal").value;
  const keterangan = document.getElementById("keuKet").value.trim();

  // Validasi frontend
  if (!tanggal || !jenis || !kategori || !nominal) {
    showAlert("keuAlert", "error", "Semua field bertanda * wajib diisi.");
    return;
  }
  if (parseFloat(nominal) <= 0) {
    showAlert("keuAlert", "error", "Nominal harus lebih dari 0.");
    return;
  }

  setLoading("keuSubmitBtn", true);

  try {
    await writeAPI("tambahKeuangan", { tanggal, jenis, kategori, nominal, keterangan });
    showAlert("keuAlert", "success", "✅ Transaksi berhasil disimpan!");

    // Reset form
    document.getElementById("keuKategori").value = "";
    document.getElementById("keuNominal").value  = "";
    document.getElementById("keuKet").value      = "";

    // Refresh saldo dan tabel
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
      document.getElementById("keuSaldo").textContent      = formatRupiah(saldo);
      document.getElementById("keuPemasukan").textContent  = formatRupiah(totalPemasukan);
      document.getElementById("keuPengeluaran").textContent = formatRupiah(totalPengeluaran);

      // Warna saldo negatif
      const saldoEl = document.getElementById("keuSaldo");
      saldoEl.className = "saldo-value" + (saldo < 0 ? " red" : "");
    }
  } catch (err) {
    console.error("Gagal load ringkasan:", err.message);
  }
}

async function loadKeuangan() {
  const jenis    = document.getElementById("keuFilterJenis").value;
  const kategori = document.getElementById("keuFilterKat").value.trim();

  const tbody = document.getElementById("keuTableBody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="6">Memuat data...</td></tr>`;

  try {
    const params = {};
    if (jenis)    params.jenis    = jenis;
    if (kategori) params.kategori = kategori;

    const result = await fetchAPI("getKeuangan", params);
    const rows   = result.data || [];

    document.getElementById("keuBadge").textContent = rows.length + " data";

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Tidak ada transaksi ditemukan.</td></tr>`;
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
        <td>
          <button class="btn-hapus" onclick="konfirmasiHapus('keuangan', '${r.id}', 'transaksi ${formatRupiah(r.nominal)}')">
            Hapus
          </button>
        </td>
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

// ═══════════════════════════════════════════════════════════
//  MODAL KONFIRMASI HAPUS
// ═══════════════════════════════════════════════════════════
function konfirmasiHapus(type, id, label) {
  pendingDelete = { type, id };
  document.getElementById("modalBody").textContent =
    `Anda akan menghapus data "${label}". Tindakan ini tidak bisa dibatalkan.`;

  document.getElementById("modalBackdrop").classList.remove("hidden");

  // Set handler konfirmasi
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

  const action = type === "absensi" ? "hapusAbsensi" : "hapusKeuangan";

  try {
    await writeAPI(action, { id });

    // Refresh data
    if (type === "absensi") {
      loadAbsensi();
    } else {
      loadRingkasanKeuangan();
      loadKeuangan();
    }
  } catch (err) {
    alert("Gagal menghapus data: " + err.message);
  }
}

// Tutup modal jika klik backdrop
document.getElementById("modalBackdrop").addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});

// ─── NOTE: Untuk yang menggunakan doPost() di GAS ───────────
/**
 * Jika Anda ingin menggunakan doPost() (lebih bersih dari sisi arsitektur),
 * ganti fungsi writeAPI() menjadi seperti ini:
 *
 * async function writeAPI(action, data) {
 *   const response = await fetch(API_URL, {
 *     method: "POST",
 *     redirect: "follow",
 *     headers: { "Content-Type": "text/plain;charset=utf-8" },
 *     body: JSON.stringify({ action, data }),
 *   });
 *   const result = await response.json();
 *   if (result.status === "error") throw new Error(result.message);
 *   return result;
 * }
 *
 * Content-Type: "text/plain" digunakan agar request tidak menjadi "non-simple"
 * yang akan memicu preflight CORS. GAS tidak mendukung preflight OPTIONS.
 */
