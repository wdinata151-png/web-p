
"use strict";

/* ==========================================
   ACCURATE MODERN
   SUPABASE DATABASE ENGINE
========================================== */

// Project URL milikmu
const SUPABASE_URL = "https://fatdiclbwlacpvoeronr.supabase.co";

// Publishable key milikmu
const SUPABASE_KEY =
"sb_publishable_B_KpQFcM84U5NpxRaap-sw_rsa4HQEx";

const { createClient } = window.supabase;

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
}).format(Number(n) || 0);

const num = v => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const uid = prefix => prefix + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();

let db = null;
let user = null;
let mode = "login";
let editing = null;
let currentType = null;
let toastTimer;

const emptyDatabase = () => ({
    version: 1,
    sales: [],
    purchases: [],
    expenses: [],
    assets: [],
    journals: [],
    capital: 1500000,
    cogs: 0
});

/* ==========================================
   UTILITIES
========================================== */

function notify(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        $("toast").classList.remove("show");
    }, 2600);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[c]);
}

function setSync(message) {
    $("syncStatus").textContent = "● " + message;
}

/* ==========================================
   AUTHENTICATION
========================================== */

function setAuthMode(nextMode) {
    mode = nextMode;

    $("loginTab").classList.toggle("selected", mode === "login");
    $("registerTab").classList.toggle("selected", mode === "register");

    $("authSubmit").textContent =
        mode === "login" ? "Login" : "Buat Akun";

    $("authMessage").textContent = "";
}

$("loginTab").onclick = () => setAuthMode("login");
$("registerTab").onclick = () => setAuthMode("register");

$("authForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("email").value.trim();
    const password = $("password").value;

    $("authSubmit").disabled = true;
    $("authMessage").textContent = "Memproses...";

    try {
        if (mode === "register") {
            const { data, error } = await client.auth.signUp({
                email,
                password
            });

            if (error) throw error;

            if (!data.session) {
                $("authMessage").textContent =
                    "Pendaftaran berhasil. Periksa email untuk verifikasi, kemudian login.";
            } else {
                $("authMessage").textContent = "Akun berhasil dibuat.";
            }
        } else {
            const { error } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            await initializeApp();
        }
    } catch (error) {
        $("authMessage").textContent = error.message;
    } finally {
        $("authSubmit").disabled = false;
    }
});

$("logoutBtn").onclick = async () => {
    const { error } = await client.auth.signOut();

    if (error) return notify(error.message);

    user = null;
    db = null;

    $("app").classList.add("hidden");
    $("authScreen").classList.remove("hidden");

    notify("Berhasil keluar.");
};

/* ==========================================
   DATABASE
========================================== */

async function loadDatabase() {
    setSync("Mengambil data...");

    const { data, error } = await client
        .from("workspace_data")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        db = emptyDatabase();

        const { error: insertError } = await client
            .from("workspace_data")
            .insert({
                user_id: user.id,
                company_name: "Sharing Merchandise Cortis",
                payload: db
            });

        if (insertError) throw insertError;

        $("companyName").textContent = "Sharing Merchandise Cortis";
    } else {
        db = {
            ...emptyDatabase(),
            ...(data.payload || {})
        };

        $("companyName").textContent = data.company_name;
    }

    $("companyInput").value = $("companyName").textContent;

    setSync("Terhubung");
}

let saveQueue = Promise.resolve();

function saveDatabase() {
    const snapshot = structuredClone(db);

    saveQueue = saveQueue.then(async () => {
        setSync("Menyimpan...");

        const { error } = await client
            .from("workspace_data")
            .upsert({
                user_id: user.id,
                company_name: $("companyName").textContent,
                payload: snapshot,
                updated_at: new Date().toISOString()
            }, {
                onConflict: "user_id"
            });

        if (error) throw error;

        setSync("Tersimpan");
    }).catch(error => {
        console.error(error);
        setSync("Gagal menyimpan");
        notify("Gagal menyimpan: " + error.message);
        throw error;
    });

    return saveQueue;
}

async function initializeApp() {
    try {
        const { data, error } = await client.auth.getUser();

        if (error) throw error;

        user = data.user;

        if (!user) return;

        await loadDatabase();

        $("userEmail").textContent = user.email;

        $("authScreen").classList.add("hidden");
        $("app").classList.remove("hidden");

        renderAll();
        openView("dashboard");

    } catch (error) {
        console.error(error);
        notify("Database gagal dimuat: " + error.message);
    }
}

client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
        user = session.user;
        initializeApp();
    }
});

/* ==========================================
   ACCOUNTING CALCULATIONS
========================================== */

function totals() {
    const sum = (arr, key) =>
        arr.reduce((s, x) => s + num(x[key]), 0);

    const revenue = sum(db.sales, "total");
    const received = sum(db.sales, "paid");
    const receivable = sum(db.sales, "total") - received;

    const purchases = sum(db.purchases, "amount");
    const purchasePaid = sum(db.purchases, "paid");

    const expenses = sum(db.expenses, "amount");
    const expensePaid = sum(db.expenses, "paid");

    const payable = purchases - purchasePaid;
    const assets = sum(db.assets, "value");

    const inventory = Math.max(0, purchases - num(db.cogs));

    const cash = num(db.capital) + received
        - purchasePaid - expensePaid - assets;

    const grossProfit = revenue - num(db.cogs);
    const netProfit = grossProfit - expenses;

    const equity = num(db.capital) + netProfit;

    return {
        revenue,
        received,
        receivable,
        purchases,
        purchasePaid,
        expenses,
        expensePaid,
        payable,
        assets,
        inventory,
        cash,
        grossProfit,
        netProfit,
        equity,
        totalAssets: cash + receivable + inventory + assets
    };
}

/* ==========================================
   TABLE RENDERING
========================================== */

function table(headers, rows) {
    if (!rows.length) {
        return '<p class="metric-note">Belum ada data tersedia.</p>';
    }

    return `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>${headers.map(x => `<th>${escapeHTML(x)}</th>`).join("")}</tr>
                </thead>
                <tbody>${rows.join("")}</tbody>
            </table>
        </div>`;
}

function metric(label, value, note = "") {
    return `
        <div class="metric">
            <span class="metric-label">${escapeHTML(label)}</span>
            <div class="metric-value">${escapeHTML(value)}</div>
            <div class="metric-note">${escapeHTML(note)}</div>
        </div>`;
}

function status(paid, total) {
    if (paid >= total) return '<span class="status paid">Lunas</span>';
    if (paid > 0) return '<span class="status partial">Sebagian</span>';
    return '<span class="status unpaid">Belum bayar</span>';
}

function actionButtons(type, id) {
    return `
        <button class="action" data-edit="${type}" data-id="${escapeHTML(id)}">Edit</button>
        <button class="action delete" data-delete="${type}" data-id="${escapeHTML(id)}">Hapus</button>`;
}

function rowsFor(type, records) {
    return records.map(x => `
        <tr>
            <td><b>${escapeHTML(x.id)}</b></td>
            <td>${escapeHTML(x.date)}</td>
            <td>${escapeHTML(x.name)}</td>
            <td>${escapeHTML(x.description)}</td>
            <td class="amount">${money(x.amount)}</td>
            <td>${status(num(x.paid), num(x.amount))}</td>
            <td>${actionButtons(type, x.id)}</td>
        </tr>
    `);
}

/* ==========================================
   DASHBOARD
========================================== */

function renderDashboard() {
    const t = totals();

    $("dashboardMetrics").innerHTML = [
        metric("Kas & Bank", money(t.cash), "Saldo kas"),
        metric("Piutang", money(t.receivable), "Tagihan pelanggan"),
        metric("Hutang", money(t.payable), "Tagihan supplier"),
        metric("Laba Bersih", money(t.netProfit), "Laba berjalan")
    ].join("");

    const all = [
        ...db.sales.map(x => ({ ...x, type: "Penjualan" })),
        ...db.purchases.map(x => ({ ...x, type: "Pembelian" })),
        ...db.expenses.map(x => ({ ...x, type: "Pengeluaran" }))
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

    $("recentTable").innerHTML = table(
        ["Tanggal", "Jenis", "Keterangan", "Nominal"],
        all.map(x => `
            <tr>
                <td>${escapeHTML(x.date)}</td>
                <td>${escapeHTML(x.type)}</td>
                <td>${escapeHTML(x.description || x.item || x.customer || "")}</td>
                <td class="amount">${money(x.amount || x.total)}</td>
            </tr>
        `)
    );
}

/* ==========================================
   SALES
========================================== */

function renderSales() {
    const t = totals();

    $("salesMetrics").innerHTML = [
        metric("Penjualan", money(t.revenue)),
        metric("Kas Diterima", money(t.received)),
        metric("Piutang", money(t.receivable)),
        metric("Invoice", String(db.sales.length))
    ].join("");

    $("salesTable").innerHTML = table(
        ["Invoice", "Tanggal", "Pelanggan", "Barang", "Total", "Pembayaran", "Status", "Aksi"],
        db.sales.map(x => `
            <tr>
                <td>${escapeHTML(x.id)}</td>
                <td>${escapeHTML(x.date)}</td>
                <td>${escapeHTML(x.customer)}</td>
                <td>${escapeHTML(x.item)}</td>
                <td>${money(x.total)}</td>
                <td>${money(x.paid)}</td>
                <td>${status(x.paid, x.total)}</td>
                <td>${actionButtons("sale", x.id)}</td>
            </tr>
        `)
    );
}

/* ==========================================
   PURCHASES
========================================== */

function renderPurchases() {
    const t = totals();

    $("purchaseMetrics").innerHTML = [
        metric("Total Pembelian", money(t.purchases)),
        metric("Pembayaran", money(t.purchasePaid)),
        metric("Hutang", money(t.payable)),
        metric("Persediaan", money(t.inventory))
    ].join("");

    $("purchaseTable").innerHTML = table(
        ["Nomor", "Tanggal", "Supplier", "Barang", "Total", "Pembayaran", "Status", "Aksi"],
        db.purchases.map(x => `
            <tr>
                <td>${escapeHTML(x.id)}</td>
                <td>${escapeHTML(x.date)}</td>
                <td>${escapeHTML(x.vendor)}</td>
                <td>${escapeHTML(x.item)}</td>
                <td>${money(x.amount)}</td>
                <td>${money(x.paid)}</td>
                <td>${status(x.paid, x.amount)}</td>
                <td>${actionButtons("purchase", x.id)}</td>
            </tr>
        `)
    );
}

/* ==========================================
   EXPENSES
========================================== */

function renderExpenses() {
    const t = totals();

    $("expenseMetrics").innerHTML = [
        metric("Total Biaya", money(t.expenses)),
        metric("Sudah Dibayar", money(t.expensePaid)),
        metric("Belum Dibayar", money(t.expenses - t.expensePaid)),
        metric("Jumlah Transaksi", String(db.expenses.length))
    ].join("");

    $("expenseTable").innerHTML = table(
        ["Nomor", "Tanggal", "Kategori", "Keterangan", "Total", "Pembayaran", "Status", "Aksi"],
        db.expenses.map(x => `
            <tr>
                <td>${escapeHTML(x.id)}</td>
                <td>${escapeHTML(x.date)}</td>
                <td>${escapeHTML(x.category)}</td>
                <td>${escapeHTML(x.description)}</td>
                <td>${money(x.amount)}</td>
                <td>${money(x.paid)}</td>
                <td>${status(x.paid, x.amount)}</td>
                <td>${actionButtons("expense", x.id)}</td>
            </tr>
        `)
    );
}

/* ==========================================
   INVENTORY
========================================== */

function renderInventory() {
    $("inventoryTable").innerHTML = table(
        ["Barang", "Supplier", "Tanggal", "Nilai"],
        db.purchases.map(x => `
            <tr>
                <td>${escapeHTML(x.item)}</td>
                <td>${escapeHTML(x.vendor)}</td>
                <td>${escapeHTML(x.date)}</td>
                <td>${money(x.amount)}</td>
            </tr>
        `)
    );
}

/* ==========================================
   ASSETS
========================================== */

function renderAssets() {
    $("assetTable").innerHTML = table(
        ["Kode", "Tanggal", "Nama Aset", "Nilai", "Aksi"],
        db.assets.map(x => `
            <tr>
                <td>${escapeHTML(x.id)}</td>
                <td>${escapeHTML(x.date)}</td>
                <td>${escapeHTML(x.name)}</td>
                <td>${money(x.value)}</td>
                <td>${actionButtons("asset", x.id)}</td>
            </tr>
        `)
    );
}

/* ==========================================
   JOURNAL
========================================== */

function renderJournal() {
    const t = totals();
    const entries = [];

    function add(id, date, description, account, debit, credit) {
        entries.push(`
            <tr>
                <td>${escapeHTML(id)}</td>
                <td>${escapeHTML(date)}</td>
                <td>${escapeHTML(description)}</td>
                <td>${escapeHTML(account)}</td>
                <td>${debit ? money(debit) : "—"}</td>
                <td>${credit ? money(credit) : "—"}</td>
            </tr>
        `);
    }

    add("OPENING", today(), "Modal awal", "Kas", db.capital, 0);
    add("OPENING", today(), "Modal awal", "Modal pemilik", 0, db.capital);

    db.sales.forEach(x => {
        add(x.id, x.date, "Penjualan " + x.customer, "Kas", x.paid, 0);
        add(x.id, x.date, "Penjualan " + x.customer, "Piutang", x.total - x.paid, 0);
        add(x.id, x.date, "Penjualan " + x.customer, "Penjualan", 0, x.total);
    });

    db.purchases.forEach(x => {
        add(x.id, x.date, "Pembelian " + x.item, "Persediaan", x.amount, 0);
        add(x.id, x.date, "Pembelian " + x.item, "Kas / Hutang", 0, x.amount);
    });

    db.expenses.forEach(x => {
        add(x.id, x.date, x.description, "Beban", x.amount, 0);
        add(x.id, x.date, x.description, "Kas / Hutang", 0, x.amount);
    });

    add("HPP", today(), "Harga pokok penjualan", "HPP", db.cogs, 0);
    add("HPP", today(), "Harga pokok penjualan", "Persediaan", 0, db.cogs);

    $("journalTable").innerHTML = table(
        ["Referensi", "Tanggal", "Keterangan", "Akun", "Debit", "Kredit"],
        entries
    );
}

/* ==========================================
   REPORTS
========================================== */

function renderReports() {
    const t = totals();

    const reports = [
        ["Laporan Laba Rugi", [
            ["Penjualan", t.revenue],
            ["Harga Pokok Penjualan", -num(db.cogs)],
            ["Laba Kotor", t.grossProfit],
            ["Biaya Operasional", -t.expenses],
            ["Laba Bersih", t.netProfit]
        ]],
        ["Laporan Posisi Keuangan", [
            ["Kas", t.cash],
            ["Piutang", t.receivable],
            ["Persediaan", t.inventory],
            ["Aset Tetap", t.assets],
            ["Total Aset", t.totalAssets],
            ["Hutang", t.payable],
            ["Ekuitas", t.equity],
            ["Total Kewajiban dan Ekuitas", t.payable + t.equity]
        ]],
        ["Laporan Arus Kas", [
            ["Penerimaan pelanggan", t.received],
            ["Pembayaran pembelian", -t.purchasePaid],
            ["Pembayaran biaya", -t.expensePaid],
            ["Setoran modal", num(db.capital)],
            ["Pembelian aset", -t.assets],
            ["Saldo kas", t.cash]
        ]]
    ];

    $("reportContent").innerHTML = reports.map(([title, rows]) => `
        <div class="panel">
            <h3>${title}</h3>
            ${table(["Keterangan", "Nilai"], rows.map(([name, value]) => `
                <tr>
                    <td>${escapeHTML(name)}</td>
                    <td class="amount">${money(value)}</td>
                </tr>
            `))}
        </div>
    `).join("");
}

/* ==========================================
   RENDER ALL
========================================== */

function renderAll() {
    if (!db) return;

    renderDashboard();
    renderSales();
    renderPurchases();
    renderExpenses();
    renderInventory();
    renderAssets();
    renderJournal();
    renderReports();
}

/* ==========================================
   NAVIGATION
========================================== */

const titles = {
    dashboard: "Dashboard",
    sales: "Penjualan",
    purchases: "Pembelian",
    expenses: "Pengeluaran",
    inventory: "Persediaan",
    assets: "Aset",
    journal: "Jurnal Umum",
    reports: "Laporan Keuangan",
    settings: "Pengaturan"
};

function openView(name) {
    document.querySelectorAll(".view").forEach(x => {
        x.classList.toggle("active", x.id === name);
    });

    document.querySelectorAll(".nav-item").forEach(x => {
        x.classList.toggle("active", x.dataset.view === name);
    });

    $("pageTitle").textContent = titles[name] || "Dashboard";
    $("sidebar").classList.remove("open");
}

document.querySelectorAll(".nav-item").forEach(button => {
    button.onclick = () => openView(button.dataset.view);
});

$("mobileMenu").onclick = () => $("sidebar").classList.toggle("open");

/* ==========================================
   MODAL AND CRUD
========================================== */

const definitions = {
    sale: {
        title: "Penjualan",
        fields: [
            ["customer", "Nama Pelanggan", "text"],
            ["item", "Nama Barang", "text"],
            ["total", "Total Penjualan", "number"],
            ["paid", "Pembayaran", "number"],
            ["cost", "HPP transaksi", "number"]
        ]
    },
    purchase: {
        title: "Pembelian",
        fields: [
            ["vendor", "Supplier", "text"],
            ["item", "Nama Barang", "text"],
            ["amount", "Total Pembelian", "number"],
            ["paid", "Pembayaran", "number"]
        ]
    },
    expense: {
        title: "Pengeluaran",
        fields: [
            ["category", "Kategori", "text"],
            ["description", "Keterangan", "text"],
            ["amount", "Total Biaya", "number"],
            ["paid", "Pembayaran", "number"]
        ]
    },
    asset: {
        title: "Aset Tetap",
        fields: [
            ["name", "Nama Aset", "text"],
            ["value", "Harga Perolehan", "number"]
        ]
    }
};

function getCollection(type) {
    return {
        sale: "sales",
        purchase: "purchases",
        expense: "expenses",
        asset: "assets"
    }[type];
}

function openModal(type, record = null) {
    currentType = type;
    editing = record;

    const config = definitions[type];

    $("modalTitle").textContent =
        (record ? "Edit " : "Tambah ") + config.title;

    const fields = [
        ["date", "Tanggal", "date"],
        ...config.fields
    ];

    $("formFields").innerHTML = fields.map(([name, label, inputType]) => `
        <label>${label}</label>
        <input
            name="${name}"
            type="${inputType}"
            value="${escapeHTML(record?.[name] ?? (name === "date" ? today() : "0"))}"
            ${inputType === "number" ? 'min="0" step="1"' : ""}
            required
        >
    `).join("");

    $("modal").classList.add("show");
}

function closeModal() {
    $("modal").classList.remove("show");
    $("dataForm").reset();
    editing = null;
    currentType = null;
}

document.querySelectorAll("[data-new]").forEach(button => {
    button.onclick = () => openModal(button.dataset.new);
});

$("closeModal").onclick = closeModal;
$("cancelModal").onclick = closeModal;

$("dataForm").addEventListener("submit", async event => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(event.target));

    const collection = getCollection(currentType);
    const record = editing
        ? { ...editing, ...data }
        : { id: uid(currentType.toUpperCase()), ...data };

    for (const key of ["total", "paid", "amount", "value", "cost"]) {
        if (key in record) record[key] = num(record[key]);
    }

    const total = num(record.total ?? record.amount ?? record.value);
    const paid = num(record.paid);

    if (total <= 0 || paid < 0 || paid > total) {
        return notify("Periksa nominal transaksi.");
    }

    if (currentType === "sale" && num(record.cost) < 0) {
        return notify("HPP tidak valid.");
    }

    if (currentType === "sale") {
        if (editing) {
            db.cogs -= num(editing.cost);
        }
        db.cogs += num(record.cost);
    }

    if (editing) {
        const index = db[collection].findIndex(x => x.id === editing.id);
        if (index !== -1) db[collection][index] = record;
    } else {
        db[collection].push(record);
    }

    try {
        await saveDatabase();
        renderAll();
        closeModal();
        notify("Data berhasil disimpan.");
    } catch {
        notify("Penyimpanan gagal. Periksa koneksi.");
    }
});

/* ==========================================
   EDIT AND DELETE
========================================== */

document.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit]");

    if (editButton) {
        const type = editButton.dataset.edit;
        const collection = getCollection(type);
        const record = db[collection].find(
            x => x.id === editButton.dataset.id
        );

        if (record) openModal(type, record);
        return;
    }

    const deleteButton = event.target.closest("[data-delete]");

    if (deleteButton) {
        if (!confirm("Hapus transaksi ini?")) return;

        const type = deleteButton.dataset.delete;
        const collection = getCollection(type);
        const id = deleteButton.dataset.id;

        const record = db[collection].find(x => x.id === id);

        if (!record) return;

        if (type === "sale") {
            db.cogs -= num(record.cost);
        }

        db[collection] = db[collection].filter(x => x.id !== id);

        try {
            await saveDatabase();
            renderAll();
            notify("Data berhasil dihapus.");
        } catch {
            notify("Penghapusan gagal.");
        }
    }
});

/* ==========================================
   COMPANY SETTINGS
========================================== */

$("saveCompany").onclick = async () => {
    const name = $("companyInput").value.trim();

    if (!name) return notify("Nama perusahaan tidak boleh kosong.");

    $("companyName").textContent = name;

    try {
        await saveDatabase();
        notify("Nama perusahaan berhasil diperbarui.");
    } catch {}
};

/* ==========================================
   BACKUP AND RESTORE
========================================== */

function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function backup() {
    download(
        "accurate-modern-" + today() + ".json",
        JSON.stringify(db, null, 2),
        "application/json"
    );
}

$("backupBtn").onclick = backup;

$("restoreBtn").onclick = () => $("restoreInput").click();

$("restoreInput").onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const imported = JSON.parse(await file.text());

        const collections = [
            "sales", "purchases", "expenses", "assets", "journals"
        ];

        if (
            imported.version !== 1 ||
            collections.some(key => !Array.isArray(imported[key])) ||
            !Number.isFinite(Number(imported.capital)) ||
            !Number.isFinite(Number(imported.cogs))
        ) {
            throw new Error("Struktur backup tidak valid.");
        }

        if (!confirm("Data sekarang akan diganti dengan backup. Lanjutkan?")) {
            return;
        }

        db = { ...emptyDatabase(), ...imported };

        await saveDatabase();
        renderAll();
        notify("Backup berhasil dipulihkan.");
    } catch (error) {
        notify("Gagal memulihkan: " + error.message);
    } finally {
        event.target.value = "";
    }
};

/* ==========================================
   RESET
========================================== */

$("resetBtn").onclick = async () => {
    const confirmation = prompt(
        'Ketik RESET untuk menghapus seluruh data transaksi akun ini.'
    );

    if (confirmation !== "RESET") return;

    db = emptyDatabase();

    try {
        await saveDatabase();
        renderAll();
        notify("Database berhasil direset.");
    } catch {}
};

/* ==========================================
   CSV EXPORT
========================================== */

$("exportBtn").onclick = () => {
    const t = totals();

    const rows = [
        ["Laporan", "Nilai"],
        ["Penjualan", t.revenue],
        ["HPP", db.cogs],
        ["Laba Kotor", t.grossProfit],
        ["Pengeluaran", t.expenses],
        ["Laba Bersih", t.netProfit],
        ["Kas", t.cash],
        ["Piutang", t.receivable],
        ["Persediaan", t.inventory],
        ["Hutang", t.payable],
        ["Total Aset", t.totalAssets],
        ["Ekuitas", t.equity]
    ];

    const csv = rows.map(row =>
        row.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(",")
    ).join("\r\n");

    download(
        "laporan-accurate-" + today() + ".csv",
        "\uFEFF" + csv,
        "text/csv;charset=utf-8"
    );
};

/* ==========================================
   START APPLICATION
========================================== */

(async function start() {
    const { data, error } = await client.auth.getSession();

    if (error) {
        notify(error.message);
        return;
    }

    if (data.session) {
        await initializeApp();
    }
})();

console.log("Accurate Modern initialized.");
