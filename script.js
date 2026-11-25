// ============================================
// SUPABASE CONFIGURATION
// ============================================

const SUPABASE_URL = "https://fatdiclbwlacpvoeronr.supabase.co";
const SUPABASE_KEY = "sb_publishable_B_KpQFcM84U5NpxRaap-sw_rsa4HQEx";

const TABLE = "accounting_database";
const ROW_ID = 1;

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ============================================
// DATABASE
// ============================================

const today = () => {
    const d = new Date();
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");
};

const createID = () => crypto.randomUUID();

function initialDatabase() {
    return {
        company: "Sharing Merchandise Cortis",
        capital: 1500000,

        sales: [
            ["@iampjmm", "Ld Seonghyeon WV", 90000, "paid"],
            ["@prettukeonholic", "Portrait A + B Mukor", 150000, "paid"],
            ["@yojeneko", "Panorama B Mukor", 75000, "unpaid"],
            ["@thinkbtjju", "Ld Juhoon WV", 90000, "unpaid"],
            ["@Jimilabradore", "Ld Juhoon Mukor", 85000, "unpaid"],
            ["@Stoberycia", "Album set WV", 300000, "paid"],
            ["@wonhui_josumk", "Ld Seonghyeon Mukor + Panorama A Mukor", 165000, "paid"],
            ["@drexyxnry", "Ld James WV + Mukor", 140000, "paid"],
            ["@martinaeyo_", "Ld Martin WV + Mukor + Ld Keonho", 320000, "paid"]
        ].map(x => ({
            id: createID(),
            date: today(),
            customer: x[0],
            description: x[1],
            amount: x[2],
            status: x[3]
        })),

        purchases: [{
            id: createID(),
            date: today(),
            supplier: "Supplier Korea",
            description: "Album Korea 100.000 KRW",
            amount: 1180000,
            status: "paid"
        }],

        expenses: [
            {
                id: createID(),
                date: today(),
                category: "Pengiriman",
                description: "EMS",
                amount: 85000,
                status: "paid"
            },
            {
                id: createID(),
                date: today(),
                category: "Pajak impor",
                description: "Pajak impor",
                amount: 50000,
                status: "paid"
            }
        ]
    };
}

let db = null;
let editing = null;
let activeType = null;
let currentUser = null;
let realtimeChannel = null;
let saveQueue = Promise.resolve();

const money = value => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
}).format(Number(value || 0));

const $ = selector => document.querySelector(selector);

function notify(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function setSync(message, status) {
    $("#syncStatus").textContent = message;
    $("#syncDot").className = status;
}

function normalizeDatabase(data) {
    const base = initialDatabase();
    return {
        company: String(data.company || base.company),
        capital: Number(data.capital ?? base.capital),
        sales: Array.isArray(data.sales) ? data.sales : base.sales,
        purchases: Array.isArray(data.purchases) ? data.purchases : base.purchases,
        expenses: Array.isArray(data.expenses) ? data.expenses : base.expenses
    };
}


// ============================================
// AUTHENTICATION
// ============================================

$("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;

    $("#loginButton").disabled = true;
    $("#loginMessage").textContent = "Memeriksa akun...";

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) throw error;

        currentUser = data.user;
        await openApplication();

    } catch (error) {
        $("#loginMessage").textContent = error.message;
    }

    $("#loginButton").disabled = false;
});

async function logout() {
    if (realtimeChannel) {
        await supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    await supabaseClient.auth.signOut();

    currentUser = null;
    db = null;

    $("#app").classList.add("hidden");
    $("#loginScreen").classList.remove("hidden");
}

$("#logoutButton").addEventListener("click", logout);


// ============================================
// DATABASE LOAD
// ============================================

async function loadDatabase() {
    setSync("Memuat database...", "");

    const { data, error } = await supabaseClient
        .from(TABLE)
        .select("data")
        .eq("id", ROW_ID)
        .maybeSingle();

    if (error) throw error;

    if (data) {
        db = normalizeDatabase(data.data);
    } else {
        db = initialDatabase();

        const { error: insertError } = await supabaseClient
            .from(TABLE)
            .insert({
                id: ROW_ID,
                data: db
            });

        if (insertError) {
            // Jika pengguna lain membuat data awal lebih dahulu.
            if (insertError.code === "23505") {
                const retry = await supabaseClient
                    .from(TABLE)
                    .select("data")
                    .eq("id", ROW_ID)
                    .single();

                if (retry.error) throw retry.error;
                db = normalizeDatabase(retry.data.data);
            } else {
                throw insertError;
            }
        }
    }

    renderAll();
    setSync("Database tersinkron", "online");
}

async function openApplication() {
    $("#loginScreen").classList.add("hidden");
    $("#app").classList.remove("hidden");

    $("#userEmail").textContent = currentUser.email;
    $("#userAvatar").textContent = currentUser.email[0].toUpperCase();

    try {
        await loadDatabase();
        subscribeRealtime();
    } catch (error) {
        setSync("Database gagal dimuat", "offline");
        notify(error.message);
    }
}


// ============================================
// REALTIME
// ============================================

function subscribeRealtime() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
        .channel("accounting-shared-data")
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: TABLE,
                filter: "id=eq.1"
            },
            payload => {
                if (!payload.new?.data) return;

                db = normalizeDatabase(payload.new.data);
                renderAll();

                setSync("Data diperbarui", "online");
            }
        )
        .subscribe();
}


// ============================================
// SAVE DATABASE
// ============================================

function saveDatabase() {
    const snapshot = JSON.parse(JSON.stringify(db));

    saveQueue = saveQueue.then(async () => {
        setSync("Menyimpan...", "");

        const { error } = await supabaseClient
            .from(TABLE)
            .upsert({
                id: ROW_ID,
                data: snapshot,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        setSync("Database tersinkron", "online");
    }).catch(error => {
        console.error(error);
        setSync("Gagal menyimpan", "offline");
        notify("Gagal menyimpan: " + error.message);
    });

    return saveQueue;
}


// ============================================
// FINANCIAL CALCULATIONS
// ============================================

function totals() {
    const sales = db.sales.reduce((s, x) => s + Number(x.amount), 0);

    const received = db.sales
        .filter(x => x.status === "paid")
        .reduce((s, x) => s + Number(x.amount), 0);

    const receivable = sales - received;

    const purchases = db.purchases.reduce((s, x) => s + Number(x.amount), 0);

    const purchasePaid = db.purchases
        .filter(x => x.status === "paid")
        .reduce((s, x) => s + Number(x.amount), 0);

    const expenses = db.expenses.reduce((s, x) => s + Number(x.amount), 0);

    const expensePaid = db.expenses
        .filter(x => x.status === "paid")
        .reduce((s, x) => s + Number(x.amount), 0);

    const cash = db.capital + received - purchasePaid - expensePaid;

    const profit = sales - purchases - expenses;

    return {
        sales,
        received,
        receivable,
        purchases,
        purchasePaid,
        expenses,
        expensePaid,
        cash,
        profit
    };
}


// ============================================
// DASHBOARD
// ============================================

function renderDashboard() {
    const t = totals();

    const metrics = [
        ["Total penjualan", t.sales],
        ["Kas / bank", t.cash],
        ["Piutang pelanggan", t.receivable],
        ["Laba / rugi sederhana", t.profit]
    ];

    $("#dashboardMetrics").innerHTML = metrics.map(x => `
        <div class="metric">
            <span>${x[0]}</span>
            <strong>${money(x[1])}</strong>
        </div>
    `).join("");

    const cashRows = [
        ["Modal awal", db.capital],
        ["Uang diterima", t.received],
        ["Pembelian dibayar", t.purchasePaid],
        ["Pengeluaran dibayar", t.expensePaid]
    ];

    $("#cashSummary").innerHTML = cashRows.map(x => `
        <div class="cash-item">
            <span>${x[0]}</span>
            <strong>${money(x[1])}</strong>
        </div>
    `).join("");

    const recent = [
        ...db.sales.map(x => ({
            name: x.customer,
            date: x.date,
            amount: x.amount,
            type: "Penjualan"
        })),
        ...db.purchases.map(x => ({
            name: x.supplier,
            date: x.date,
            amount: x.amount,
            type: "Pembelian"
        })),
        ...db.expenses.map(x => ({
            name: x.category,
            date: x.date,
            amount: x.amount,
            type: "Pengeluaran"
        }))
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    $("#recentTransactions").innerHTML = recent.map(x => `
        <div class="recent-item">
            <div>
                <strong>${escapeHTML(x.name)}</strong><br>
                <span>${x.type} · ${escapeHTML(x.date)}</span>
            </div>
            <strong>${money(x.amount)}</strong>
        </div>
    `).join("") || "Belum ada transaksi.";

    $("#companySidebar").textContent = db.company;
}


// ============================================
// SAFE HTML
// ============================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}


// ============================================
// TABLE RENDERING
// ============================================

function statusHTML(status) {
    return `<span class="status ${status}">
        ${status === "paid" ? "LUNAS" : "BELUM LUNAS"}
    </span>`;
}

function actionsHTML(type, id) {
    return `
        <button class="action" data-edit="${type}" data-id="${escapeHTML(id)}">Edit</button>
        <button class="action" data-delete="${type}" data-id="${escapeHTML(id)}">Hapus</button>
    `;
}

function renderSales() {
    const t = totals();

    $("#salesMetrics").innerHTML = `
        <div class="mini-card"><span>Total penjualan</span><strong>${money(t.sales)}</strong></div>
        <div class="mini-card"><span>Sudah diterima</span><strong>${money(t.received)}</strong></div>
        <div class="mini-card"><span>Piutang</span><strong>${money(t.receivable)}</strong></div>
    `;

    const q = ($("#salesSearch").value || "").toLowerCase();

    const rows = db.sales.filter(x =>
        `${x.customer} ${x.description}`.toLowerCase().includes(q)
    );

    $("#salesTable").innerHTML = rows.map(x => `
        <tr>
            <td>${escapeHTML(x.date)}</td>
            <td>${escapeHTML(x.customer)}</td>
            <td>${escapeHTML(x.description)}</td>
            <td>${money(x.amount)}</td>
            <td>${statusHTML(x.status)}</td>
            <td>${actionsHTML("sale", x.id)}</td>
        </tr>
    `).join("") || `<tr><td colspan="6">Belum ada data.</td></tr>`;
}

function renderPurchases() {
    const total = db.purchases.reduce((s, x) => s + Number(x.amount), 0);
    const paid = db.purchases.filter(x => x.status === "paid")
        .reduce((s, x) => s + Number(x.amount), 0);

    $("#purchaseMetrics").innerHTML = `
        <div class="mini-card"><span>Total pembelian</span><strong>${money(total)}</strong></div>
        <div class="mini-card"><span>Sudah dibayar</span><strong>${money(paid)}</strong></div>
        <div class="mini-card"><span>Belum dibayar</span><strong>${money(total-paid)}</strong></div>
    `;

    $("#purchaseTable").innerHTML = db.purchases.map(x => `
        <tr>
            <td>${escapeHTML(x.date)}</td>
            <td>${escapeHTML(x.supplier)}</td>
            <td>${escapeHTML(x.description)}</td>
            <td>${money(x.amount)}</td>
            <td>${statusHTML(x.status)}</td>
            <td>${actionsHTML("purchase", x.id)}</td>
        </tr>
    `).join("") || `<tr><td colspan="6">Belum ada data.</td></tr>`;
}

function renderExpenses() {
    const total = db.expenses.reduce((s, x) => s + Number(x.amount), 0);
    const paid = db.expenses.filter(x => x.status === "paid")
        .reduce((s, x) => s + Number(x.amount), 0);

    $("#expenseMetrics").innerHTML = `
        <div class="mini-card"><span>Total pengeluaran</span><strong>${money(total)}</strong></div>
        <div class="mini-card"><span>Sudah dibayar</span><strong>${money(paid)}</strong></div>
        <div class="mini-card"><span>Belum dibayar</span><strong>${money(total-paid)}</strong></div>
    `;

    $("#expenseTable").innerHTML = db.expenses.map(x => `
        <tr>
            <td>${escapeHTML(x.date)}</td>
            <td>${escapeHTML(x.category)}</td>
            <td>${escapeHTML(x.description)}</td>
            <td>${money(x.amount)}</td>
            <td>${statusHTML(x.status)}</td>
            <td>${actionsHTML("expense", x.id)}</td>
        </tr>
    `).join("") || `<tr><td colspan="6">Belum ada data.</td></tr>`;
}


// ============================================
// REPORTS
// ============================================

function renderReports() {
    const t = totals();

    $("#reportContent").innerHTML = `
        <div class="report-card">
            <h3>Laporan laba / rugi sederhana</h3>
            <div class="report-line"><span>Penjualan</span><strong>${money(t.sales)}</strong></div>
            <div class="report-line"><span>Pembelian</span><strong>${money(t.purchases)}</strong></div>
            <div class="report-line"><span>Pengeluaran</span><strong>${money(t.expenses)}</strong></div>
            <div class="report-line"><span>Laba / rugi</span><strong>${money(t.profit)}</strong></div>
        </div>

        <div class="report-card">
            <h3>Posisi kas dan piutang</h3>
            <div class="report-line"><span>Modal awal</span><strong>${money(db.capital)}</strong></div>
            <div class="report-line"><span>Penerimaan</span><strong>${money(t.received)}</strong></div>
            <div class="report-line"><span>Kas / bank perkiraan</span><strong>${money(t.cash)}</strong></div>
            <div class="report-line"><span>Piutang pelanggan</span><strong>${money(t.receivable)}</strong></div>
        </div>
    `;
}


// ============================================
// SETTINGS
// ============================================

function renderSettings() {
    $("#companyInput").value = db.company;
    $("#capitalInput").value = db.capital;
}


// ============================================
// RENDER ALL
// ============================================

function renderAll() {
    if (!db) return;

    renderDashboard();
    renderSales();
    renderPurchases();
    renderExpenses();
    renderReports();
    renderSettings();
}


// ============================================
// NAVIGATION
// ============================================

document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
        const page = button.dataset.page;

        document.querySelectorAll(".page").forEach(x =>
            x.classList.remove("active")
        );

        document.querySelectorAll(".nav").forEach(x =>
            x.classList.remove("active")
        );

        $("#" + page).classList.add("active");
        button.classList.add("active");

        const titles = {
            dashboard: "Ringkasan",
            sales: "Penjualan",
            purchases: "Pembelian",
            expenses: "Pengeluaran",
            reports: "Laporan",
            settings: "Pengaturan"
        };

        $("#pageTitle").textContent = titles[page];
    });
});


// ============================================
// TRANSACTION MODAL
// ============================================

function inputField(label, name, type, value = "", full = false) {
    return `
        <div class="modal-field">
            <label>${label}</label>
            <input
                name="${name}"
                type="${type}"
                value="${escapeHTML(value)}"
                ${type === "number" ? 'min="0" step="1"' : ""}
                required
            >
        </div>
    `;
}

function selectStatus(value = "paid") {
    return `
        <div class="modal-field">
            <label>Status pembayaran</label>
            <select name="status">
                <option value="paid" ${value === "paid" ? "selected" : ""}>Lunas / Dibayar</option>
                <option value="unpaid" ${value === "unpaid" ? "selected" : ""}>Belum lunas</option>
            </select>
        </div>
    `;
}

function openModal(type, id = null) {
    activeType = type;
    editing = null;

    const collections = {
        sale: db.sales,
        purchase: db.purchases,
        expense: db.expenses
    };

    if (id) {
        editing = collections[type].find(x => x.id === id);
    }

    const old = editing || {};

    $("#modalTitle").textContent =
        (editing ? "Edit " : "Tambah ") +
        ({sale:"penjualan",purchase:"pembelian",expense:"pengeluaran"}[type]);

    let fields = inputField("Tanggal", "date", "date", old.date || today());

    if (type === "sale") {
        fields += inputField("Pelanggan", "customer", "text", old.customer || "");
        fields += inputField("Produk", "description", "text", old.description || "");
    }

    if (type === "purchase") {
        fields += inputField("Pemasok", "supplier", "text", old.supplier || "");
        fields += inputField("Keterangan", "description", "text", old.description || "");
    }

    if (type === "expense") {
        fields += inputField("Kategori", "category", "text", old.category || "");
        fields += inputField("Keterangan", "description", "text", old.description || "");
    }

    fields += inputField("Jumlah (Rp)", "amount", "number", old.amount ?? "");
    fields += selectStatus(old.status || "paid");

    $("#modalFields").innerHTML = fields;
    $("#modal").classList.remove("hidden");
}

function closeModal() {
    $("#modal").classList.add("hidden");
    $("#transactionForm").reset();
}

document.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => {
        openModal(button.dataset.add);
    });
});

$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);


// ============================================
// SAVE TRANSACTION
// ============================================

$("#transactionForm").addEventListener("submit", async event => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form.entries());

    const record = {
        id: editing?.id || createID(),
        date: data.date,
        amount: Number(data.amount),
        status: data.status
    };

    if (activeType === "sale") {
        record.customer = data.customer.trim();
        record.description = data.description.trim();
    }

    if (activeType === "purchase") {
        record.supplier = data.supplier.trim();
        record.description = data.description.trim();
    }

    if (activeType === "expense") {
        record.category = data.category.trim();
        record.description = data.description.trim();
    }

    const key = {
        sale: "sales",
        purchase: "purchases",
        expense: "expenses"
    }[activeType];

    if (editing) {
        db[key] = db[key].map(x =>
            x.id === editing.id ? record : x
        );
    } else {
        db[key].push(record);
    }

    closeModal();
    renderAll();

    await saveDatabase();
    notify("Transaksi tersimpan.");
});


// ============================================
// EDIT / DELETE
// ============================================

document.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit]");

    if (edit) {
        openModal(edit.dataset.edit, edit.dataset.id);
    }

    const del = event.target.closest("[data-delete]");

    if (del) {
        if (!confirm("Yakin ingin menghapus transaksi ini?")) return;

        const key = {
            sale: "sales",
            purchase: "purchases",
            expense: "expenses"
        }[del.dataset.delete];

        db[key] = db[key].filter(x => x.id !== del.dataset.id);

        renderAll();
        await saveDatabase();

        notify("Transaksi dihapus.");
    }
});


// ============================================
// SEARCH
// ============================================

$("#salesSearch").addEventListener("input", renderSales);


// ============================================
// SETTINGS SAVE
// ============================================

$("#saveSettings").addEventListener("click", async () => {
    const company = $("#companyInput").value.trim();
    const capital = Number($("#capitalInput").value);

    if (!company || !Number.isFinite(capital) || capital < 0) {
        notify("Periksa nama perusahaan dan modal awal.");
        return;
    }

    db.company = company;
    db.capital = capital;

    renderAll();
    await saveDatabase();

    notify("Pengaturan disimpan.");
});


// ============================================
// EXPORT CSV
// ============================================

$("#exportCSV").addEventListener("click", () => {
    const rows = [
        ["Jenis", "Tanggal", "Nama", "Keterangan", "Jumlah", "Status"]
    ];

    db.sales.forEach(x => rows.push([
        "Penjualan", x.date, x.customer, x.description, x.amount, x.status
    ]));

    db.purchases.forEach(x => rows.push([
        "Pembelian", x.date, x.supplier, x.description, x.amount, x.status
    ]));

    db.expenses.forEach(x => rows.push([
        "Pengeluaran", x.date, x.category, x.description, x.amount, x.status
    ]));

    const csv = rows.map(row =>
        row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "accurate-modern.csv";
    a.click();

    URL.revokeObjectURL(url);
});


// ============================================
// REFRESH
// ============================================

$("#refreshButton").addEventListener("click", async () => {
    try {
        await loadDatabase();
        notify("Data diperbarui.");
    } catch (error) {
        notify(error.message);
    }
});


// ============================================
// INITIALIZATION
// ============================================

async function initialize() {
    $("#today").textContent = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(new Date());

    if (
        SUPABASE_URL.includes("MASUKKAN") ||
        SUPABASE_KEY.includes("MASUKKAN")
    ) {
        $("#loginMessage").textContent =
            "Masukkan Supabase URL dan Publishable Key di script.js terlebih dahulu.";
        $("#loginButton").disabled = true;
        return;
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        $("#loginMessage").textContent = error.message;
        return;
    }

    if (data.session) {
        currentUser = data.session.user;
        await openApplication();
    }
}

initialize();
