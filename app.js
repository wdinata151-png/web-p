"use strict";

/* ==========================
   SUPABASE
========================== */

const SUPABASE_URL =
"https://fatdiclbwlacpvoeronr.supabase.co";

const SUPABASE_KEY =
"fatdiclbwlacpvoeronr";

const { createClient } = window.supabase;
const client = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

let db = null;
let user = null;
let mode = "login";

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

/* ==========================
   UTIL
========================== */

function money(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function num(value) {
  return Number(value) || 0;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix) {
  return (
    prefix +
    "-" +
    crypto.randomUUID()
      .slice(0, 8)
      .toUpperCase()
  );
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================
   TOAST
========================== */

let toastTimer;

function notify(message) {

  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);

}

/* ==========================
   AUTH MODE
========================== */

function setAuthMode(nextMode) {

  mode = nextMode;

  $("loginTab").classList.toggle(
    "selected",
    mode === "login"
  );

  $("registerTab").classList.toggle(
    "selected",
    mode === "register"
  );

  $("authSubmit").textContent =
    mode === "login"
      ? "Login"
      : "Daftar";

}

$("loginTab")?.addEventListener(
  "click",
  () => setAuthMode("login")
);

$("registerTab")?.addEventListener(
  "click",
  () => setAuthMode("register")
);

/* ==========================
   DATABASE
========================== */

async function loadDatabase() {

  const { data, error } =
    await client
      .from("workspace_data")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

  if (error) throw error;

  if (!data) {

    db = emptyDatabase();

    const { error: insertError } =
      await client
        .from("workspace_data")
        .insert({
          user_id: user.id,
          company_name:
            "Sharing Merchandise Cortis",
          payload: db
        });

    if (insertError) {
      throw insertError;
    }

    $("companyName").textContent =
      "Sharing Merchandise Cortis";

  } else {

    db = {
      ...emptyDatabase(),
      ...(data.payload || {})
    };

    $("companyName").textContent =
      data.company_name || "Perusahaan";

  }

  $("companyInput").value =
    $("companyName").textContent;

}

async function saveDatabase() {

  const { error } =
    await client
      .from("workspace_data")
      .upsert({
        user_id: user.id,
        company_name:
          $("companyName").textContent,
        payload: db
      });

  if (error) throw error;

}

/* ==========================
   LOGIN REGISTER
========================== */

$("authForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const email =
      $("email").value.trim();

    const password =
      $("password").value;

    try {

      $("authSubmit").disabled = true;

      if (mode === "register") {

        const { error } =
          await client.auth.signUp({
            email,
            password
          });

        if (error) throw error;

        notify(
          "Pendaftaran berhasil"
        );

      } else {

        const { error } =
          await client.auth
            .signInWithPassword({
              email,
              password
            });

        if (error) throw error;

        await initializeApp();

      }

    } catch (err) {

      notify(err.message);

    } finally {

      $("authSubmit").disabled = false;

    }

  }
);

$("logoutBtn")?.addEventListener(
  "click",
  async () => {

    await client.auth.signOut();

    location.reload();

  }
);

/* ==========================
   TOTALS
========================== */

function totals() {

  const sum = (arr, key) =>
    arr.reduce(
      (a, b) =>
        a + num(b[key]),
      0
    );

  const revenue =
    sum(db.sales, "total");

  const received =
    sum(db.sales, "paid");

  const purchases =
    sum(db.purchases, "amount");

  const purchasePaid =
    sum(db.purchases, "paid");

  const expenses =
    sum(db.expenses, "amount");

  const expensePaid =
    sum(db.expenses, "paid");

  const fixedAssets =
    sum(db.assets, "value");

  const receivable =
    revenue - received;

  const payable =
    purchases - purchasePaid;

  const inventory =
    Math.max(
      0,
      purchases - num(db.cogs)
    );

  const cash =
    num(db.capital) +
    received -
    purchasePaid -
    expensePaid -
    fixedAssets;

  const grossProfit =
    revenue - num(db.cogs);

  const netProfit =
    grossProfit - expenses;

  const equity =
    num(db.capital) +
    netProfit;

  return {
    revenue,
    received,
    purchases,
    purchasePaid,
    expenses,
    expensePaid,
    receivable,
    payable,
    inventory,
    cash,
    netProfit,
    grossProfit,
    equity,
    fixedAssets,
    totalAssets:
      cash +
      inventory +
      receivable +
      fixedAssets
  };

}

/* ==========================
   COMPONENTS
========================== */

function metric(
  label,
  value,
  note = ""
) {

  return `
  <div class="metric">
    <div class="metric-label">
      ${escapeHTML(label)}
    </div>

    <div class="metric-value">
      ${escapeHTML(value)}
    </div>

    <div class="metric-note">
      ${escapeHTML(note)}
    </div>
  </div>
  `;

}

function table(
  headers,
  rows
) {

  if (!rows.length) {

    return `
      <p class="metric-note">
        Belum ada data
      </p>
    `;
  }

  return `
  <div class="table-wrap">

    <table>

      <thead>
        <tr>
          ${headers
            .map(
              h =>
              `<th>${escapeHTML(h)}</th>`
            )
            .join("")}
        </tr>
      </thead>

      <tbody>
        ${rows.join("")}
      </tbody>

    </table>

  </div>
  `;

}

function status(
  paid,
  total
) {

  if (paid >= total) {
    return '<span class="status paid">Lunas</span>';
  }

  if (paid > 0) {
    return '<span class="status partial">Sebagian</span>';
  }

  return '<span class="status unpaid">Belum Bayar</span>';

}

/* ==========================
   DASHBOARD
========================== */

function renderDashboard() {

  const t = totals();

  $("dashboardMetrics").innerHTML = [

    metric(
      "Kas",
      money(t.cash)
    ),

    metric(
      "Piutang",
      money(t.receivable)
    ),

    metric(
      "Hutang",
      money(t.payable)
    ),

    metric(
      "Laba Bersih",
      money(t.netProfit)
    )

  ].join("");

}

/* ==========================
   INIT
========================== */

async function initializeApp() {

  const { data } =
    await client.auth.getUser();

  user = data.user;

  if (!user) return;

  await loadDatabase();

  $("userEmail").textContent =
    user.email;

  $("authScreen")
    .classList.add("hidden");

  $("app")
    .classList.remove("hidden");

  renderDashboard();

}

/* ==========================
   SESSION CHECK
========================== */

(async () => {

  const { data } =
    await client.auth.getSession();

  if (data.session) {
    await initializeApp();
  }
   /* ==========================
   NAVIGATION
========================== */

const titles = {
  dashboard: "Dashboard",
  sales: "Penjualan",
  purchases: "Pembelian",
  expenses: "Pengeluaran",
  inventory: "Persediaan",
  assets: "Aset",
  journal: "Jurnal Umum",
  reports: "Laporan",
  settings: "Pengaturan"
};

function openView(name) {

  document
    .querySelectorAll(".view")
    .forEach(view => {
      view.classList.toggle(
        "active",
        view.id === name
      );
    });

  document
    .querySelectorAll(".nav-item")
    .forEach(btn => {

      btn.classList.toggle(
        "active",
        btn.dataset.view === name
      );

    });

  $("pageTitle").textContent =
    titles[name] || "Dashboard";

}

document
  .querySelectorAll(".nav-item")
  .forEach(btn => {

    btn.addEventListener(
      "click",
      () => openView(btn.dataset.view)
    );

  });

$("mobileMenu")?.addEventListener(
  "click",
  () =>
    $("sidebar")
      .classList.toggle("open")
);

/* ==========================
   ACTION BUTTON
========================== */

function actionButtons(type, id) {

  return `
  <button
    class="action"
    data-edit="${type}"
    data-id="${id}">
    Edit
  </button>

  <button
    class="action delete"
    data-delete="${type}"
    data-id="${id}">
    Hapus
  </button>
  `;

}

/* ==========================
   RENDER SALES
========================== */

function renderSales() {

  if (!db) return;

  $("salesTable").innerHTML =
    table(
      [
        "Invoice",
        "Tanggal",
        "Customer",
        "Barang",
        "Total",
        "Bayar",
        "Status",
        "Aksi"
      ],

      db.sales.map(row => `
      <tr>
        <td>${row.id}</td>
        <td>${row.date}</td>
        <td>${row.customer}</td>
        <td>${row.item}</td>
        <td>${money(row.total)}</td>
        <td>${money(row.paid)}</td>
        <td>${status(row.paid,row.total)}</td>
        <td>${actionButtons("sale",row.id)}</td>
      </tr>
      `)

    );

}

/* ==========================
   RENDER PURCHASE
========================== */

function renderPurchases() {

  if (!db) return;

  $("purchaseTable").innerHTML =
    table(
      [
        "Nomor",
        "Tanggal",
        "Supplier",
        "Barang",
        "Total",
        "Bayar",
        "Status",
        "Aksi"
      ],

      db.purchases.map(row => `
      <tr>
        <td>${row.id}</td>
        <td>${row.date}</td>
        <td>${row.vendor}</td>
        <td>${row.item}</td>
        <td>${money(row.amount)}</td>
        <td>${money(row.paid)}</td>
        <td>${status(row.paid,row.amount)}</td>
        <td>${actionButtons("purchase",row.id)}</td>
      </tr>
      `)

    );

}

/* ==========================
   RENDER EXPENSE
========================== */

function renderExpenses() {

  if (!db) return;

  $("expenseTable").innerHTML =
    table(
      [
        "Nomor",
        "Tanggal",
        "Kategori",
        "Keterangan",
        "Total",
        "Bayar",
        "Status",
        "Aksi"
      ],

      db.expenses.map(row => `
      <tr>
        <td>${row.id}</td>
        <td>${row.date}</td>
        <td>${row.category}</td>
        <td>${row.description}</td>
        <td>${money(row.amount)}</td>
        <td>${money(row.paid)}</td>
        <td>${status(row.paid,row.amount)}</td>
        <td>${actionButtons("expense",row.id)}</td>
      </tr>
      `)

    );

}

/* ==========================
   RENDER ASSETS
========================== */

function renderAssets() {

  $("assetTable").innerHTML =
    table(
      [
        "Kode",
        "Tanggal",
        "Nama",
        "Nilai",
        "Aksi"
      ],

      db.assets.map(asset => `
      <tr>
        <td>${asset.id}</td>
        <td>${asset.date}</td>
        <td>${asset.name}</td>
        <td>${money(asset.value)}</td>
        <td>${actionButtons("asset",asset.id)}</td>
      </tr>
      `)

    );

}

/* ==========================
   INVENTORY
========================== */

function renderInventory() {

  $("inventoryTable").innerHTML =
    table(
      [
        "Barang",
        "Supplier",
        "Tanggal",
        "Nilai"
      ],

      db.purchases.map(p => `
      <tr>
        <td>${p.item}</td>
        <td>${p.vendor}</td>
        <td>${p.date}</td>
        <td>${money(p.amount)}</td>
      </tr>
      `)

    );

}

/* ==========================
   REPORT
========================== */

function renderReports() {

  const t = totals();

  $("reportContent").innerHTML = `

  <div class="panel">

    <h3>Laba Rugi</h3>

    <p>Penjualan :
    ${money(t.revenue)}</p>

    <p>HPP :
    ${money(db.cogs)}</p>

    <p>Laba Kotor :
    ${money(t.grossProfit)}</p>

    <p>Biaya :
    ${money(t.expenses)}</p>

    <h2>
      Laba Bersih :
      ${money(t.netProfit)}
    </h2>

  </div>

  <div class="panel">

    <h3>Neraca</h3>

    <p>Kas :
    ${money(t.cash)}</p>

    <p>Piutang :
    ${money(t.receivable)}</p>

    <p>Persediaan :
    ${money(t.inventory)}</p>

    <p>Aset Tetap :
    ${money(t.fixedAssets)}</p>

    <p>Total Aset :
    ${money(t.totalAssets)}</p>

  </div>

  `;

}

/* ==========================
   ALL RENDER
========================== */

function renderAll() {

  renderDashboard();
  renderSales();
  renderPurchases();
  renderExpenses();
  renderInventory();
  renderAssets();
  renderReports();

}

/* ==========================
   MODAL CRUD
========================== */

let currentType = null;

function openSimplePrompt(type) {

  currentType = type;

  const amount =
    Number(prompt("Nominal"));

  if (!amount) return;

  if (type === "sale") {

    db.sales.push({

      id: uid("INV"),
      date: today(),
      customer: "Customer",
      item: "Barang",
      total: amount,
      paid: amount,
      cost: 0

    });

  }

  if (type === "purchase") {

    db.purchases.push({

      id: uid("PO"),
      date: today(),
      vendor: "Supplier",
      item: "Barang",
      amount,
      paid: amount

    });

  }

  if (type === "expense") {

    db.expenses.push({

      id: uid("EXP"),
      date: today(),
      category: "Umum",
      description: "Biaya",
      amount,
      paid: amount

    });

  }

  if (type === "asset") {

    db.assets.push({

      id: uid("AST"),
      date: today(),
      name: "Aset Baru",
      value: amount

    });

  }

  saveDatabase()
    .then(() => {

      renderAll();
      notify("Data tersimpan");

    });

}

document
.querySelectorAll("[data-new]")
.forEach(button => {

  button.addEventListener(
    "click",
    () =>
      openSimplePrompt(
        button.dataset.new
      )
  );

});

/* ==========================
   DELETE
========================== */

document.addEventListener(
  "click",
  async event => {

    const del =
      event.target.closest(
        "[data-delete]"
      );

    if (!del) return;

    if (
      !confirm("Hapus data?")
    ) {
      return;
    }

    const type =
      del.dataset.delete;

    const id =
      del.dataset.id;

    if (type === "sale") {

      db.sales =
        db.sales.filter(
          x => x.id !== id
        );

    }

    if (type === "purchase") {

      db.purchases =
        db.purchases.filter(
          x => x.id !== id
        );

    }

    if (type === "expense") {

      db.expenses =
        db.expenses.filter(
          x => x.id !== id
        );

    }

    if (type === "asset") {

      db.assets =
        db.assets.filter(
          x => x.id !== id
        );

    }

    await saveDatabase();

    renderAll();

    notify("Data dihapus");

  }
);

/* ==========================
   COMPANY
========================== */

$("saveCompany")?.addEventListener(
  "click",
  async () => {

    const name =
      $("companyInput")
      .value.trim();

    if (!name) return;

    $("companyName")
      .textContent = name;

    await saveDatabase();

    notify(
      "Nama perusahaan disimpan"
    );

  }
);

/* ==========================
   BACKUP
========================== */

$("backupBtn")?.addEventListener(
  "click",
  () => {

    const blob = new Blob(
      [
        JSON.stringify(
          db,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "backup-" +
      today() +
      ".json";

    a.click();

  }
);

/* ==========================
   EXPORT CSV
========================== */

$("exportBtn")?.addEventListener(
  "click",
  () => {

    const t = totals();

    const csv = `Laporan,Nilai
Penjualan,${t.revenue}
HPP,${db.cogs}
Laba Bersih,${t.netProfit}
Kas,${t.cash}
Piutang,${t.receivable}
Persediaan,${t.inventory}
`;

    const blob =
      new Blob([csv], {
        type:
        "text/csv;charset=utf-8"
      });

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "laporan.csv";

    a.click();

  }
);

/* ==========================
   RESET
========================== */

$("resetBtn")?.addEventListener(
  "click",
  async () => {

    if (
      prompt(
        "Ketik RESET"
      ) !== "RESET"
    ) {
      return;
    }

    db = emptyDatabase();

    await saveDatabase();

    renderAll();

    notify(
      "Database direset"
    );

  }
);
