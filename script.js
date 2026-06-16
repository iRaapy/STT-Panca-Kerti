// ─── KONFIGURASI ────────────────────────────────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbyji9JjGVAjbrUVFe0UR9NxkBwZCnKUHjpCI2CIy9FEciO28_euMEU8ZMlDuE-_O2_D/exec";

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

  const titles = { dashboard: "Dashboard", absensi: "Modul Absensi", keuangan: "Modul Keuangan", anggota: "Daftar Anggota" };
  document.getElementById("topbarTitle").textContent = titles[page] || page;

  if (page === "dashboard") loadDashboard();
  if (page === "keuangan")  loadRingkasanKeuangan();
  if (page === "anggota")   loadAnggota();
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
  tbody.innerHTML = `<tr class="loading-row"><td colspan="4">Memuat data...</td></tr>`;
  try {
    const result = await fetchAPI("getAnggota");
    const rows   = result.data || [];

    // Update badge & cache
    document.getElementById("angBadge").textContent = rows.length + " anggota";
    daftarAnggota = rows;
    updateDropdownAnggota();

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Belum ada anggota terdaftar.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r, i) => `
      <tr>
        <td><span class="nomor-urut">${i + 1}</span></td>
        <td>
          <div class="anggota-nama">${r.nama}</div>
        </td>
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
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">❌ Error: ${err.message}</td></tr>`;
  }
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
