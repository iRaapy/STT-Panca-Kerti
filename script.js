// ─── KONFIGURASI ────────────────────────────────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbyWOhOOWirYwDiEjW_2OLXJc3DHw1NUcFs8NRur3KodiICPhXmlyy41YnVPXEBRjBik/exec";

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
    let rows = result.data || [];
    const lunasSampaiTanggal = statusBayarResult.data?.lunasSampaiTanggal || null;

    // Filter tanggal jika diisi
    if (dari)   rows = rows.filter(r => r.tanggal >= dari);
    if (sampai) rows = rows.filter(r => r.tanggal <= sampai);

    // Hitung statistik (untuk kartu Hadir/Izin/Sakit/Alfa, mengikuti rentang yang dicari)
    const stat = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
    rows.forEach(r => { if (stat[r.status] !== undefined) stat[r.status]++; });

    // Khusus dedosan: kalau anggota sudah pernah bayar, hanya hitung record
    // SETELAH tanggal lunas terakhir (dedosan sebelumnya dianggap lunas)
    const rowsDedosan = lunasSampaiTanggal
      ? rows.filter(r => r.tanggal > lunasSampaiTanggal)
      : rows;
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
    const data   = result.data || [];
    if (!data.length) { alert("Tidak ada data keuangan untuk dicetak."); return; }

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
          <td>${r.kategori}</td>
          <td class="nominal ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : '-'}${formatRupiahPolos(r.nominal)}</td>
          <td>${r.keterangan || '—'}</td>
        </tr>`;
    }).join("");

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
        tfoot td { font-weight:700; border-top: 2px solid #1E2B4A; background:#fff !important; }
        tfoot tr.saldo td { background:#1E2B4A !important; color:#fff; font-size:13px; }
        .no-print { display:none; }
        @media print { body { padding: 10px 18px; } }
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
        <tbody>${baris}</tbody>
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

function lihatQRPanitia(nama, kodeQR) {
  const box = document.createElement("div");
  new QRCode(box, { text: kodeQR, width: 200, height: 200, colorDark: "#1E2B4A", colorLight: "#ffffff" });

  document.getElementById("modalBody").innerHTML =
    `<div style="text-align:center;">
       <div style="font-weight:700; margin-bottom:10px; color:var(--navy);">${nama}</div>
       <div style="display:inline-block; padding:10px; background:#fff; border:2px solid var(--border); border-radius:10px;">${box.innerHTML}</div>
       <div style="margin-top:10px; font-size:.78rem; color:var(--muted);">Kode: ${kodeQR}</div>
     </div>`;
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("modalConfirmBtn").onclick = closeModal;
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
