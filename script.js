
"use strict";

/* =================================
   ELEMENTS
================================= */

const sidebar = document.querySelector(".sidebar");
const mobileMenu = document.getElementById("mobileMenu");
const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const toastElement = document.getElementById("toast");

let toastTimer;

/* =================================
   NOTIFICATION
================================= */

function toast(message) {
    if (!toastElement) return;

    toastElement.textContent = message;
    toastElement.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toastElement.classList.remove("show");
    }, 2600);
}

/* =================================
   NAVIGATION
================================= */

function openView(viewName) {
    const target = document.getElementById(viewName);

    if (!target) {
        toast("Halaman tidak ditemukan.");
        return;
    }

    views.forEach(view => {
        view.classList.remove("active");
    });

    navItems.forEach(item => {
        item.classList.remove("active");
    });

    target.classList.add("active");

    const activeButton = document.querySelector(
        `.nav-item[data-view="${viewName}"]`
    );

    if (activeButton) {
        activeButton.classList.add("active");
    }

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    document.querySelector(".main-scroll")?.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

navItems.forEach(item => {
    item.addEventListener("click", () => {
        openView(item.dataset.view);
    });
});

document.querySelectorAll("[data-view-link]").forEach(button => {
    button.addEventListener("click", () => {
        openView(button.dataset.viewLink);
    });
});

/* =================================
   MOBILE SIDEBAR
================================= */

mobileMenu?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
});

document.addEventListener("click", event => {
    if (!sidebar || !mobileMenu) return;

    const clickedInsideSidebar = sidebar.contains(event.target);
    const clickedMenuButton = mobileMenu.contains(event.target);

    if (
        window.innerWidth <= 760 &&
        !clickedInsideSidebar &&
        !clickedMenuButton
    ) {
        sidebar.classList.remove("open");
    }
});

/* =================================
   QUICK ACTIONS
================================= */

const actionMessages = {
    "new-transaction": "Form transaksi baru akan dibuka.",
    "new-sales": "Form faktur penjualan akan dibuka.",
    "new-purchase": "Form pembelian akan dibuka.",
    "new-expense": "Form pengeluaran akan dibuka.",
    "new-transfer": "Form transfer dana akan dibuka.",
    "new-journal": "Form jurnal umum akan dibuka.",
    "new-product": "Form produk baru akan dibuka.",
    "new-asset": "Form aset baru akan dibuka.",
    "accounts": "Daftar akun akan dibuka.",
    "journal": "Jurnal umum akan dibuka.",
    "ledger": "Buku besar akan dibuka.",
    "report-profit": "Laporan laba rugi akan dibuka.",
    "report-balance": "Laporan neraca akan dibuka.",
    "report-cash": "Laporan arus kas akan dibuka."
};

document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
        const action = button.dataset.action;
        toast(actionMessages[action] || "Fitur sedang disiapkan.");
    });
});

/* =================================
   TOPBAR BUTTONS
================================= */

document.getElementById("syncButton")?.addEventListener("click", () => {
    toast("Tidak ada transaksi yang perlu disinkronkan.");
});

document.getElementById("notificationButton")?.addEventListener("click", () => {
    toast("Anda memiliki 3 notifikasi.");
});

document.getElementById("settingsButton")?.addEventListener("click", () => {
    toast("Pengaturan akan segera tersedia.");
});

/* =================================
   SEARCH TRANSACTIONS
================================= */

const searchInput = document.getElementById("searchInput");
const transactionTable = document.getElementById("transactionTable");
const emptySearch = document.getElementById("emptySearch");

searchInput?.addEventListener("input", () => {
    const query = searchInput.value
        .trim()
        .toLowerCase();

    if (!transactionTable) return;

    const rows = transactionTable.querySelectorAll("tbody tr");
    let visibleRows = 0;

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matches = text.includes(query);

        row.style.display = matches ? "" : "none";

        if (matches) visibleRows++;
    });

    if (emptySearch) {
        emptySearch.classList.toggle(
            "hidden",
            visibleRows !== 0
        );
    }
});

/* =================================
   KEYBOARD SHORTCUT
================================= */

document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput?.focus();
    }

    if (event.key === "Escape") {
        searchInput?.blur();
        sidebar?.classList.remove("open");
    }
});

/* =================================
   EXPORT DEMO
================================= */

function exportTransactions() {
    const table = document.getElementById("transactionTable");

    if (!table) {
        toast("Data transaksi tidak ditemukan.");
        return;
    }

    const rows = [...table.querySelectorAll("tr")];

    const csv = rows.map(row => {
        const cells = [...row.querySelectorAll("th, td")];

        return cells.map(cell => {
            const value = cell.innerText
                .replaceAll('"', '""')
                .trim();

            return `"${value}"`;
        }).join(",");
    }).join("\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "transaksi-accurate.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    toast("Data transaksi berhasil diekspor.");
}

document.getElementById("exportButton")
    ?.addEventListener("click", exportTransactions);

document.getElementById("reportExport")
    ?.addEventListener("click", exportTransactions);

/* =================================
   CHART PERIOD
================================= */

document.getElementById("chartPeriod")
    ?.addEventListener("change", event => {
        if (event.target.value === "half") {
            toast("Tampilan periode 6 bulan dipilih.");
        } else {
            toast("Tampilan tahun 2026 dipilih.");
        }
    });

/* =================================
   INITIALIZATION
================================= */

document.addEventListener("DOMContentLoaded", () => {
    openView("dashboard");
});
