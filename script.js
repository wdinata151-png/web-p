
"use strict";

/* ==========================================
   ACCURATE MODERN
   LOCAL DATABASE ENGINE
========================================== */

const DB_KEY = "accurate_modern_database_v1";

const rupiah = value =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);

const number = value => Number(value) || 0;

const today = () => new Date().toISOString().slice(0, 10);

const uid = prefix =>
    prefix + "-" + Date.now().toString(36).toUpperCase();

const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);

/* ==========================================
   DATABASE AWAL
========================================== */

function initialDatabase() {
    return {
        version: 1,
        company: "Sharing Merchandise Cortis",
        capital: 1500000,
        cogs: 1180000,
        sales: [
            { id:"INV-001", date:"2026-01-01", customer:"@iampjmm", item:"Ld Seonghyeon WV", total:90000, paid:90000 },
            { id:"INV-002", date:"2026-01-01", customer:"@prettukeonholic", item:"Portrait A + B Mukor", total:150000, paid:150000 },
            { id:"INV-003", date:"2026-01-01", customer:"@yojeneko", item:"Panorama B Mukor", total:75000, paid:0 },
            { id:"INV-004", date:"2026-01-01", customer:"@thinkbtjju", item:"Ld Juhoon WV", total:90000, paid:0 },
            { id:"INV-005", date:"2026-01-01", customer:"@Jimilabradore", item:"Ld Juhoon Mukor", total:85000, paid:0 },
            { id:"INV-006", date:"2026-01-01", customer:"@Stoberycia", item:"Album set WV", total:300000, paid:300000 },
            { id:"INV-007", date:"2026-01-01", customer:"@wonhui_josumk", item:"Ld Seonghyeon Mukor + Panorama A Mukor", total:165000, paid:165000 },
            { id:"INV-008", date:"2026-01-01", customer:"@drexyxnry", item:"Ld James WV + Mukor", total:140000, paid:140000 },
            { id:"INV-009", date:"2026-01-01", customer:"@martinaeyo_", item:"Ld Martin WV + Mukor + Ld Keonho", total:320000, paid:320000 }
        ],
        purchases: [
            {
                id:"PUR-001",
                date:"2026-01-01",
                vendor:"Supplier Korea",
                item:"Album dari Korea",
                currency:"KRW",
                original:100000,
                exchangeRate:11.8,
                amount:1180000,
                paid:1180000
            }
        ],
        expenses: [
            { id:"EXP-001", date:"2026-01-01", category:"Ongkos Kirim EMS", description:"Pengiriman album Korea", amount:85000, paid:85000 },
            { id:"EXP-002", date:"2026-01-01", category:"Pajak Impor", description:"Tax impor", amount:50000, paid:50000 }
        ],
        assets: [],
        journals: []
    };
}

function loadDatabase() {
    try {
        const raw = localStorage.getItem(DB_KEY);

        if (!raw) {
            const fresh = initialDatabase();
            localStorage.setItem(DB_KEY, JSON.stringify(fresh));
            return fresh;
        }

        const parsed = JSON.parse(raw);

        if (parsed.version !== 1) {
            throw new Error("Versi database tidak didukung");
        }

        return parsed;
    } catch (error) {
        console.error("Database error:", error);
        alert("Database tidak dapat dibaca. Silakan periksa data atau pulihkan dari backup.");
        return initialDatabase();
    }
}

let db = loadDatabase();

function saveDatabase() {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        renderAll();
    } catch (error) {
        console.error(error);
        notify("Gagal menyimpan data. Periksa kapasitas penyimpanan browser.");
    }
}

/* ==========================================
   PERHITUNGAN AKUNTANSI
========================================== */

function totals() {
    const revenue = db.sales.reduce((sum, item) => sum + number(item.total), 0);

    const received = db.sales.reduce((sum, item) => sum + number(item.paid), 0);

    const receivable = db.sales.reduce(
        (sum, item) => sum + Math.max(0, number(item.total) - number(item.paid)), 0
    );

    const purchase = db.purchases.reduce(
        (sum, item) => sum + number(item.amount), 0
    );

    const purchasePaid = db.purchases.reduce(
        (sum, item) => sum + number(item.paid), 0
    );

    const payable = db.purchases.reduce(
        (sum, item) => sum + Math.max(0, number(item.amount) - number(item.paid)), 0
    );

    const expenses = db.expenses.reduce(
        (sum, item) => sum + number(item.amount), 0
    );

    const expensePaid = db.expenses.reduce(
        (sum, item) => sum + number(item.paid), 0
    );

    const assetValue = db.assets.reduce(
        (sum, item) => sum + number(item.value), 0
    );

    const inventory = Math.max(0, purchase - number(db.cogs));

    const cash = number(db.capital) + received - purchasePaid - expensePaid - assetValue;

    const grossProfit = revenue - number(db.cogs);

    const netProfit = grossProfit - expenses;

    const equity = number(db.capital) + netProfit;

    const totalAssets = cash + receivable + inventory + assetValue;

    return {
        revenue,
        received,
        receivable,
        purchase,
        purchasePaid,
        payable,
        expenses,
        expensePaid,
        inventory,
        cash,
        grossProfit,
        netProfit,
        equity,
        assetValue,
        totalAssets
    };
}

/* ==========================================
   NOTIFICATION
========================================== */

let toastTimer;

function notify(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

/* ==========================================
   NAVIGATION
========================================== */

function openView(viewName) {
    document.querySelectorAll(".view").forEach(view => {
        view.classList.toggle("active", view.id === viewName);
    });

    document.querySelectorAll(".nav-item").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.view === viewName
        );
    });

    document.querySelector(".sidebar").classList.remove("open");

    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        openView(button.dataset.view);
    });
});

document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
        openView(button.dataset.goto);
    });
});

document.getElementById("mobileMenu").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("open");
});

document.getElementById("currentYear").textContent = new Date().getFullYear();

/* ==========================================
   TABLE HELPER
========================================== */

function table(headers, rows) {
    if (!rows.length) {
        return `<div class="empty">Belum ada data tersedia.</div>`;
    }

    return `
        <div class="table-wrap">
            <table class="table">
                <thead>
                    <tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr>
                </thead>
                <tbody>
                    ${rows.join("")}
                </tbody>
            </table>
        </div>
    `;
}

function statusBadge(status) {
    const classes = {
        paid: "green",
        unpaid: "orange",
        partial: "orange"
    };

    const labels = {
        paid: "Lunas",
        unpaid: "Belum bayar",
        partial: "Sebagian"
    };

    return `<span class="status ${classes[status]}">${labels[status]}</span>`;
}

function paymentStatus(paid, total) {
    if (paid >= total) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
}

/* ==========================================
   DASHBOARD
========================================== */

function renderDashboard() {
    const t = totals();

    const metrics = [
        ["Total Kas & Bank", rupiah(t.cash), "Termasuk modal dan penerimaan", "blue", "Rp"],
        ["Piutang Usaha", rupiah(t.receivable), "Tagihan belum dibayar", "purple", "◈"],
        ["Hutang Usaha", rupiah(t.payable), "Tagihan vendor", "orange", "◇"],
        ["Laba Berjalan", rupiah(t.netProfit), "Penjualan - HPP - biaya", "green", "↑"]
    ];

    document.getElementById("dashboardMetrics").innerHTML =
        metrics.map(item => `
            <div class="metric">
                <div class="metric-top">
                    <span class="metric-label">${item[0]}</span>
                    <div class="metric-icon ${item[3]}">${item[4]}</div>
                </div>
                <div class="metric-value">${item[1]}</div>
                <span class="trend ${item[3] === "green" ? "up" : ""}">${item[2]}</span>
            </div>
        `).join("");

    const cashRows = [
        ["Modal awal pemilik", db.capital, "in"],
        ["Penerimaan penjualan", t.received, "in"],
        ["Pembelian barang", t.purchasePaid, "out"],
        ["Biaya operasional", t.expensePaid, "out"],
        ["Pembelian aset tetap", t.assetValue, "out"]
    ];

    document.getElementById("cashSummary").innerHTML =
        cashRows.map(item => `
            <div class="summary-row">
                <span>${item[0]}</span>
                <strong class="amount">${item[2] === "out" ? "(" + rupiah(item[1]) + ")" : rupiah(item[1])}</strong>
            </div>
        `).join("") + `
            <div class="summary-row">
                <strong>Saldo Kas & Bank</strong>
                <strong class="amount">${rupiah(t.cash)}</strong>
            </div>
        `;

    const transactions = buildTransactions().slice(0, 5);

    document.getElementById("recentTransactions").innerHTML = table(
        ["Nomor", "Keterangan", "Nilai", "Status"],
        transactions.map(item => `
            <tr>
                <td><b>${escapeHTML(item.id)}</b></td>
                <td>${escapeHTML(item.description)}</td>
                <td class="amount">${rupiah(item.amount)}</td>
                <td>${statusBadge("paid")}</td>
            </tr>
        `)
    );
}

/* ==========================================
   TRANSACTION HISTORY
========================================== */

function buildTransactions() {
    const rows = [];

    db.sales.forEach(item => {
        rows.push({
            id: item.id,
            date: item.date,
            description: "Penjualan - " + item.customer,
            amount: item.total,
            type: "Penjualan"
        });
    });

    db.purchases.forEach(item => {
        rows.push({
            id: item.id,
            date: item.date,
            description: "Pembelian - " + item.item,
            amount: item.amount,
            type: "Pembelian"
        });
    });

    db.expenses.forEach(item => {
        rows.push({
            id: item.id,
            date: item.date,
            description: item.category + " - " + item.description,
            amount: item.amount,
            type: "Pengeluaran"
        });
    });

    rows.sort((a, b) => b.date.localeCompare(a.date));

    return rows;
}

/* ==========================================
   SALES
========================================== */

function renderSales() {
    const t = totals();

    const openInvoices = db.sales.filter(
        item => item.paid < item.total
    ).length;

    const metrics = [
        ["Total Penjualan", rupiah(t.revenue), "Total seluruh invoice"],
        ["Piutang Usaha", rupiah(t.receivable), "Belum diterima"],
        ["Invoice Terbuka", openInvoices, "Belum lunas"],
        ["Pembeli Aktif", db.sales.length, "Jumlah invoice"]
    ];

    document.getElementById("salesMetrics").innerHTML =
        metrics.map(item => `
            <div class="metric">
                <span class="metric-label">${item[0]}</span>
                <div class="metric-value">${item[1]}</div>
                <span class="trend">${item[2]}</span>
            </div>
        `).join("");

    document.getElementById("salesTable").innerHTML = table(
        ["Invoice", "Tanggal", "Pembeli", "Item", "Total", "Dibayar", "Status", "Aksi"],
        db.sales.map(item => {
            const status = paymentStatus(item.paid, item.total);

            return `
                <tr>
                    <td><b>${escapeHTML(item.id)}</b></td>
                    <td>${escapeHTML(item.date)}</td>
                    <td>${escapeHTML(item.customer)}</td>
                    <td>${escapeHTML(item.item)}</td>
                    <td class="amount">${rupiah(item.total)}</td>
                    <td class="amount">${rupiah(item.paid)}</td>
                    <td>${statusBadge(status)}</td>
                    <td>
                        ${item.paid < item.total
                            ? `<button class="action-btn" data-pay-sale="${item.id}">Bayar</button>`
                            : ""}
                        <button class="action-btn" data-delete-sale="${item.id}">Hapus</button>
                    </td>
                </tr>
            `;
        })
    );
}

/* ==========================================
   PURCHASE
========================================== */

function renderPurchases() {
    const t = totals();

    const metrics = [
        ["Pembelian Barang", rupiah(t.purchase), "Nilai pembelian"],
        ["Hutang Usaha", rupiah(t.payable), "Belum dibayar"],
        ["Tagihan Terbuka", db.purchases.filter(x => x.paid < x.amount).length, "Vendor"],
        ["Persediaan", rupiah(t.inventory), "Nilai stok tersisa"]
    ];

    document.getElementById("purchaseMetrics").innerHTML =
        metrics.map(item => `
            <div class="metric">
                <span class="metric-label">${item[0]}</span>
                <div class="metric-value">${item[1]}</div>
                <span class="trend">${item[2]}</span>
            </div>
        `).join("");

    document.getElementById("purchaseTable").innerHTML = table(
        ["Nomor", "Tanggal", "Vendor", "Barang", "Total", "Dibayar", "Status", "Aksi"],
        db.purchases.map(item => `
            <tr>
                <td><b>${escapeHTML(item.id)}</b></td>
                <td>${escapeHTML(item.date)}</td>
                <td>${escapeHTML(item.vendor)}</td>
                <td>${escapeHTML(item.item)}</td>
                <td class="amount">${rupiah(item.amount)}</td>
                <td class="amount">${rupiah(item.paid)}</td>
                <td>${statusBadge(paymentStatus(item.paid, item.amount))}</td>
                <td>
                    ${item.paid < item.amount
                        ? `<button class="action-btn" data-pay-purchase="${item.id}">Bayar</button>`
                        : ""}
                    <button class="action-btn" data-delete-purchase="${item.id}">Hapus</button>
                </td>
            </tr>
        `)
    );
}

/* ==========================================
   EXPENSE / CASH
========================================== */

function renderCash() {
    const t = totals();

    document.getElementById("cashMetrics").innerHTML = [
        ["Total Saldo", rupiah(t.cash)],
        ["Penerimaan", rupiah(t.received)],
        ["Pengeluaran", rupiah(t.purchasePaid + t.expensePaid)],
        ["Piutang", rupiah(t.receivable)]
    ].map(item => `
        <div class="metric">
            <span class="metric-label">${item[0]}</span>
            <div class="metric-value">${item[1]}</div>
        </div>
    `).join("");

    const rows = [];

    rows.push(...db.sales.filter(x => x.paid > 0).map(x => `
        <tr>
            <td>${escapeHTML(x.id)}</td>
            <td>Penerimaan penjualan - ${escapeHTML(x.customer)}</td>
            <td class="amount">${rupiah(x.paid)}</td>
            <td class="amount">—</td>
        </tr>
    `));

    rows.push(...db.purchases.filter(x => x.paid > 0).map(x => `
        <tr>
            <td>${escapeHTML(x.id)}</td>
            <td>Pembelian - ${escapeHTML(x.item)}</td>
            <td class="amount">—</td>
            <td class="amount">${rupiah(x.paid)}</td>
        </tr>
    `));

    rows.push(...db.expenses.filter(x => x.paid > 0).map(x => `
        <tr>
            <td>${escapeHTML(x.id)}</td>
            <td>${escapeHTML(x.category)} - ${escapeHTML(x.description)}</td>
            <td class="amount">—</td>
            <td class="amount">${rupiah(x.paid)}</td>
        </tr>
    `));

    document.getElementById("cashTable").innerHTML = table(
        ["Referensi", "Keterangan", "Kas Masuk", "Kas Keluar"],
        rows
    );
}

/* ==========================================
   INVENTORY
========================================== */

function renderInventory() {
    const t = totals();

    document.getElementById("inventoryMetrics").innerHTML = [
        ["Nilai Persediaan", rupiah(t.inventory)],
        ["Total Pembelian", rupiah(t.purchase)],
        ["Harga Pokok Penjualan", rupiah(db.cogs)],
        ["Jumlah Barang", db.purchases.length]
    ].map(item => `
        <div class="metric">
            <span class="metric-label">${item[0]}</span>
            <div class="metric-value">${item[1]}</div>
        </div>
    `).join("");

    document.getElementById("inventoryTable").innerHTML = table(
        ["Barang", "Supplier", "Nilai Pembelian", "Status"],
        db.purchases.map(item => `
            <tr>
                <td><b>${escapeHTML(item.item)}</b></td>
                <td>${escapeHTML(item.vendor)}</td>
                <td class="amount">${rupiah(item.amount)}</td>
                <td><span class="status green">Tercatat</span></td>
            </tr>
        `)
    );
}

/* ==========================================
   ASSET
========================================== */

function renderAssets() {
    document.getElementById("assetTable").innerHTML = table(
        ["Kode", "Nama Aset", "Tanggal", "Nilai"],
        db.assets.map(item => `
            <tr>
                <td>${escapeHTML(item.id)}</td>
                <td><b>${escapeHTML(item.name)}</b></td>
                <td>${escapeHTML(item.date)}</td>
                <td class="amount">${rupiah(item.value)}</td>
            </tr>
        `)
    );
}

/* ==========================================
   JOURNAL
========================================== */

function renderJournal() {
    const t = totals();
    const rows = [];

    function addJournal(id, description, account, debit, credit) {
        rows.push(`
            <tr>
                <td>${escapeHTML(id)}</td>
                <td>${escapeHTML(description)}</td>
                <td>${escapeHTML(account)}</td>
                <td class="amount">${debit ? rupiah(debit) : "—"}</td>
                <td class="amount">${credit ? rupiah(credit) : "—"}</td>
            </tr>
        `);
    }

    addJournal("JU-001", "Setoran modal awal", "Kas di Bank", db.capital, 0);
    addJournal("JU-001", "Setoran modal awal", "Modal Pemilik", 0, db.capital);

    db.purchases.forEach(x => {
        addJournal(x.id, "Pembelian " + x.item, "Persediaan Barang Dagang", x.amount, 0);
        addJournal(x.id, "Pembelian " + x.item, "Kas / Utang", 0, x.amount);
    });

    db.expenses.forEach(x => {
        addJournal(x.id, x.category, "Beban " + x.category, x.amount, 0);
        addJournal(x.id, x.category, "Kas / Utang", 0, x.amount);
    });

    db.sales.forEach(x => {
        addJournal(x.id, "Penjualan " + x.customer, "Kas di Bank", x.paid, 0);
        addJournal(x.id, "Penjualan " + x.customer, "Piutang Usaha", x.total - x.paid, 0);
        addJournal(x.id, "Penjualan " + x.customer, "Penjualan", 0, x.total);
    });

    addJournal("JU-HPP", "Harga pokok penjualan", "Harga Pokok Penjualan", db.cogs, 0);
    addJournal("JU-HPP", "Harga pokok penjualan", "Persediaan Barang", 0, db.cogs);

    db.journals.forEach(x => {
        addJournal(x.id, x.description, x.account, x.debit, x.credit);
    });

    document.getElementById("journalTable").innerHTML = table(
        ["Referensi", "Keterangan", "Akun", "Debit", "Kredit"],
        rows
    );
}

/* ==========================================
   FINANCIAL REPORT
========================================== */

function reportTable(title, rows) {
    return `
        <div class="card activity">
            <div class="card-head">
                <div><h2>${title}</h2><span>Sharing Merchandise Cortis</span></div>
            </div>
            ${table(
                ["Keterangan", "Nilai"],
                rows.map(row => `
                    <tr>
                        <td>${row[0]}</td>
                        <td class="amount"><b>${row[1]}</b></td>
                    </tr>
                `)
            )}
        </div>
    `;
}

function renderReports() {
    const t = totals();

    const metrics = [
        ["Laba Bersih", rupiah(t.netProfit)],
        ["Total Aset", rupiah(t.totalAssets)],
        ["Total Modal", rupiah(t.equity)],
        ["Kas Akhir", rupiah(t.cash)]
    ];

    let html = `
        <div class="metrics">
            ${metrics.map(item => `
                <div class="metric">
                    <span class="metric-label">${item[0]}</span>
                    <div class="metric-value">${item[1]}</div>
                </div>
            `).join("")}
        </div>
    `;

    html += reportTable("Laporan Laba Rugi", [
        ["Penjualan Barang Dagang", rupiah(t.revenue)],
        ["Harga Pokok Penjualan", "(" + rupiah(db.cogs) + ")"],
        ["Laba Kotor", rupiah(t.grossProfit)],
        ["Beban Operasional", "(" + rupiah(t.expenses) + ")"],
        ["Laba Bersih", rupiah(t.netProfit)]
    ]);

    html += reportTable("Laporan Perubahan Modal", [
        ["Modal Awal", rupiah(0)],
        ["Setoran Modal", rupiah(db.capital)],
        ["Laba Bersih", rupiah(t.netProfit)],
        ["Modal Akhir", rupiah(t.equity)]
    ]);

    html += reportTable("Laporan Posisi Keuangan", [
        ["Kas & Bank", rupiah(t.cash)],
        ["Piutang Usaha", rupiah(t.receivable)],
        ["Persediaan", rupiah(t.inventory)],
        ["Aset Tetap", rupiah(t.assetValue)],
        ["Total Aset", rupiah(t.totalAssets)],
        ["Utang Usaha", rupiah(t.payable)],
        ["Modal Akhir", rupiah(t.equity)],
        ["Total Kewajiban & Ekuitas", rupiah(t.payable + t.equity)]
    ]);

    html += reportTable("Laporan Arus Kas", [
        ["Penerimaan dari pelanggan", rupiah(t.received)],
        ["Pembayaran pembelian barang", "(" + rupiah(t.purchasePaid) + ")"],
        ["Pembayaran biaya", "(" + rupiah(t.expensePaid) + ")"],
        ["Pembelian aset tetap", "(" + rupiah(t.assetValue) + ")"],
        ["Arus Kas Operasional", rupiah(t.received - t.purchasePaid - t.expensePaid)],
        ["Setoran Modal", rupiah(db.capital)],
        ["Kas Akhir", rupiah(t.cash)]
    ]);

    document.getElementById("reportContent").innerHTML = html;
}

/* ==========================================
   RENDER ALL
========================================== */

function renderAll() {
    renderDashboard();
    renderSales();
    renderPurchases();
    renderCash();
    renderInventory();
    renderAssets();
    renderJournal();
    renderReports();
}

/* ==========================================
   MODAL SYSTEM
========================================== */

const modal = document.getElementById("modal");
const modalFields = document.getElementById("modalFields");

function field(name, label, type = "text", value = "", extra = "") {
    return `
        <div class="field">
            <label for="${name}">${label}</label>
            <input id="${name}" name="${name}" type="${type}"
                value="${escapeHTML(value)}" ${extra} required>
        </div>
    `;
}

function selectField(name, label, options) {
    return `
        <div class="field">
            <label for="${name}">${label}</label>
            <select name="${name}" id="${name}" required>
                ${options.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join("")}
            </select>
        </div>
    `;
}

let activeAction = "";

function openModal(action) {
    activeAction = action;

    const definitions = {
        "new-sale": {
            title: "Invoice Penjualan Baru",
            subtitle: "Masukkan data penjualan pelanggan",
            fields:
                field("customer", "Nama / Username Pembeli") +
                field("item", "Nama Barang") +
                field("total", "Total Penjualan (Rp)", "number", "", 'min="1"') +
                field("paid", "Uang Diterima (Rp)", "number", "0", 'min="0"') +
                field("cost", "Harga Pokok Penjualan (Rp)", "number", "0", 'min="0"')
        },
        "new-purchase": {
            title: "Pembelian Barang Baru",
            subtitle: "Masukkan data pembelian persediaan",
            fields:
                field("vendor", "Nama Supplier") +
                field("item", "Nama Barang") +
                field("amount", "Nilai Pembelian (Rp)", "number", "", 'min="1"') +
                field("paid", "Pembayaran (Rp)", "number", "0", 'min="0"')
        },
        "new-expense": {
            title: "Pengeluaran Baru",
            subtitle: "Catat pengeluaran perusahaan",
            fields:
                selectField("category", "Kategori Pengeluaran", [
                    "Ongkos Kirim EMS",
                    "Pajak Impor",
                    "Biaya Operasional",
                    "Biaya Administrasi",
                    "Biaya Lainnya"
                ]) +
                field("description", "Keterangan") +
                field("amount", "Jumlah (Rp)", "number", "", 'min="1"') +
                field("paid", "Pembayaran (Rp)", "number", "0", 'min="0"')
        },
        "new-capital": {
            title: "Setoran Modal",
            subtitle: "Tambahkan modal pemilik",
            fields:
                field("amount", "Jumlah Modal (Rp)", "number", "", 'min="1"')
        },
        "new-asset": {
            title: "Tambah Aset Tetap",
            subtitle: "Catat aset perusahaan",
            fields:
                field("name", "Nama Aset") +
                field("value", "Harga Perolehan (Rp)", "number", "", 'min="1"') +
                field("date", "Tanggal Pembelian", "date", today())
        },
        "new-journal": {
            title: "Jurnal Manual",
            subtitle: "Catat jurnal tambahan",
            fields:
                field("description", "Keterangan") +
                field("account", "Nama Akun") +
                field("debit", "Debit (Rp)", "number", "0", 'min="0"') +
                field("credit", "Kredit (Rp)", "number", "0", 'min="0"')
        }
    };

    const config = definitions[action];

    if (!config) return;

    document.getElementById("modalTitle").textContent = config.title;
    document.getElementById("modalSubtitle").textContent = config.subtitle;

    modalFields.innerHTML =
        field("date", "Tanggal Transaksi", "date", today()) +
        config.fields;

    modal.classList.add("show");
}

function closeModal() {
    modal.classList.remove("show");
    document.getElementById("transactionForm").reset();
}

document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);

modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
});

/* ==========================================
   SAVE TRANSACTIONS
========================================== */

document.getElementById("transactionForm").addEventListener("submit", event => {
    event.preventDefault();

    const form = new FormData(event.target);
    const data = Object.fromEntries(form.entries());

    const date = data.date || today();

    if (activeAction === "new-sale") {
        const total = number(data.total);
        const paid = number(data.paid);
        const cost = number(data.cost);

        if (total <= 0 || paid < 0 || paid > total || cost < 0) {
            return notify("Periksa nominal penjualan, pembayaran, dan HPP.");
        }

        db.sales.push({
            id: uid("INV"),
            date,
            customer: data.customer.trim(),
            item: data.item.trim(),
            total,
            paid
        });

        db.cogs += cost;
    }

    else if (activeAction === "new-purchase") {
        const amount = number(data.amount);
        const paid = number(data.paid);

        if (amount <= 0 || paid < 0 || paid > amount) {
            return notify("Nominal pembelian atau pembayaran tidak valid.");
        }

        db.purchases.push({
            id: uid("PUR"),
            date,
            vendor: data.vendor.trim(),
            item: data.item.trim(),
            currency: "IDR",
            original: amount,
            exchangeRate: 1,
            amount,
            paid
        });
    }

    else if (activeAction === "new-expense") {
        const amount = number(data.amount);
        const paid = number(data.paid);

        if (amount <= 0 || paid < 0 || paid > amount) {
            return notify("Nominal pengeluaran tidak valid.");
        }

        db.expenses.push({
            id: uid("EXP"),
            date,
            category: data.category,
            description: data.description.trim(),
            amount,
            paid
        });
    }

    else if (activeAction === "new-capital") {
        const amount = number(data.amount);

        if (amount <= 0) return notify("Nominal modal harus lebih dari nol.");

        db.capital += amount;
    }

    else if (activeAction === "new-asset") {
        const value = number(data.value);

        if (value <= 0) return notify("Harga aset tidak valid.");

        db.assets.push({
            id: uid("AST"),
            date,
            name: data.name.trim(),
            value
        });
    }

    else if (activeAction === "new-journal") {
        const debit = number(data.debit);
        const credit = number(data.credit);

        if (debit !== credit || debit <= 0) {
            return notify("Jurnal harus seimbang: debit = kredit.");
        }

        db.journals.push({
            id: uid("JU"),
            date,
            description: data.description.trim(),
            account: data.account.trim(),
            debit,
            credit
        });
    }

    saveDatabase();
    closeModal();
    notify("Transaksi berhasil disimpan.");
});

/* ==========================================
   BUTTON ACTIONS
========================================== */

document.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-action]");

    if (actionButton) {
        openModal(actionButton.dataset.action);
    }

    const paySale = event.target.closest("[data-pay-sale]");

    if (paySale) {
        const item = db.sales.find(x => x.id === paySale.dataset.paySale);

        if (!item) return;

        const remaining = item.total - item.paid;
        const payment = Number(prompt(
            "Sisa tagihan: " + rupiah(remaining) +
            "\nMasukkan jumlah pembayaran:"
        ));

        if (!Number.isFinite(payment) || payment <= 0 || payment > remaining) {
            return notify("Pembayaran tidak valid.");
        }

        item.paid += payment;
        saveDatabase();
        notify("Pembayaran berhasil dicatat.");
    }

    const payPurchase = event.target.closest("[data-pay-purchase]");

    if (payPurchase) {
        const item = db.purchases.find(x => x.id === payPurchase.dataset.payPurchase);

        if (!item) return;

        const remaining = item.amount - item.paid;
        const payment = Number(prompt(
            "Sisa hutang: " + rupiah(remaining) +
            "\nMasukkan jumlah pembayaran:"
        ));

        if (!Number.isFinite(payment) || payment <= 0 || payment > remaining) {
            return notify("Pembayaran tidak valid.");
        }

        item.paid += payment;
        saveDatabase();
        notify("Pembayaran vendor berhasil dicatat.");
    }

    const deleteSale = event.target.closest("[data-delete-sale]");

    if (deleteSale) {
        const item = db.sales.find(x => x.id === deleteSale.dataset.deleteSale);

        if (!item || !confirm("Hapus invoice ini? HPP yang pernah dicatat tidak otomatis dikembalikan.")) return;

        db.sales = db.sales.filter(x => x.id !== item.id);
        saveDatabase();
        notify("Invoice dihapus.");
    }

    const deletePurchase = event.target.closest("[data-delete-purchase]");

    if (deletePurchase) {
        const item = db.purchases.find(x => x.id === deletePurchase.dataset.deletePurchase);

        if (!item || !confirm("Hapus pembelian ini? Pastikan transaksi terkait sudah diperiksa.")) return;

        db.purchases = db.purchases.filter(x => x.id !== item.id);
        saveDatabase();
        notify("Pembelian dihapus.");
    }
});

/* ==========================================
   EXPORT / BACKUP
========================================== */

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

document.getElementById("backupBtn").addEventListener("click", () => {
    downloadFile(
        "accurate-backup-" + today() + ".json",
        JSON.stringify(db, null, 2),
        "application/json"
    );

    notify("Backup database berhasil dibuat.");
});

document.getElementById("restoreBtn").addEventListener("click", () => {
    document.getElementById("restoreInput").click();
});

document.getElementById("restoreInput").addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        try {
            const imported = JSON.parse(reader.result);

            if (
                imported.version !== 1 ||
                !Array.isArray(imported.sales) ||
                !Array.isArray(imported.purchases) ||
                !Array.isArray(imported.expenses) ||
                !Array.isArray(imported.assets) ||
                !Array.isArray(imported.journals)
            ) {
                throw new Error("Format database tidak valid.");
            }

            if (!confirm("Pulihkan backup? Data lokal saat ini akan diganti.")) return;

            db = imported;
            saveDatabase();
            notify("Database berhasil dipulihkan.");
        } catch (error) {
            notify("File backup tidak valid.");
        }

        event.target.value = "";
    };

    reader.readAsText(file);
});

/* ==========================================
   CSV EXPORT
========================================== */

document.getElementById("exportReport").addEventListener("click", () => {
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
        ["Utang", t.payable],
        ["Total Aset", t.totalAssets],
        ["Modal", t.equity]
    ];

    const csv = rows.map(row =>
        row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    downloadFile(
        "accurate-laporan-" + today() + ".csv",
        "\uFEFF" + csv,
        "text/csv;charset=utf-8"
    );

    notify("Laporan berhasil diekspor.");
});

/* ==========================================
   PRINT
========================================== */

document.getElementById("printReport").addEventListener("click", () => {
    openView("report");
    window.print();
});

/* ==========================================
   SEARCH
========================================== */

document.getElementById("globalSearch").addEventListener("input", event => {
    const query = event.target.value.toLowerCase().trim();

    document.querySelectorAll(".view.active .table tbody tr").forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(query)
            ? ""
            : "none";
    });
});

/* ==========================================
   SETTINGS
========================================== */

document.getElementById("settingsBtn").addEventListener("click", () => {
    const choice = prompt(
        "PENGATURAN DATABASE\n\n" +
        "1. Lihat informasi database\n" +
        "2. Reset database ke data contoh\n\n" +
        "Masukkan pilihan:"
    );

    if (choice === "1") {
        notify("Database tersimpan secara lokal di browser.");
    }

    if (choice === "2") {
        if (!confirm("PERINGATAN: Semua data akan direset ke data contoh. Lanjutkan?")) return;

        db = initialDatabase();
        saveDatabase();
        notify("Database berhasil direset.");
    }
});

/* ==========================================
   INITIALIZE
========================================== */

renderAll();

console.log("Accurate Modern berhasil dijalankan.");
console.log("Database:", DB_KEY);
console.log("Ringkasan:", totals());
