/* ==========================================================
   Bami Bowl — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #address,
                    #order-items, #items, #skuList, #total, #note
   - admin.html   : #ordersTable tbody (+ ปุ่มพิมพ์ใบหยิบ/ใบปะหน้า)
   ========================================================== */

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx8S1-Fr2GWAht2Sax65Ayfwk3RU4dw5Ht8pPXbenkAElUI3csWtAWgY5uwQADLxHiJSw/exec";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQjyZ9a0iBZaI9ka4z6565XzNrNppSA1Odbg62Md4MvT2Q88fBXSkgkdli6mBB9s0hqXg4s8XHHG6IP/pub?gid=0&single=true&output=csv";

// ข้อมูลผู้ส่ง (พิมพ์บนใบปะหน้า) — แก้เป็นข้อมูลร้านจริง
const SENDER = {
  name: "Bami Bowl",
  phone: "0XX-XXX-XXXX",
  address: "เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์",
};

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatPrice(n) {
  return Number(n).toLocaleString("th-TH");
}

let _productsPromise = null;
function loadProducts() {
  if (!_productsPromise) {
    _productsPromise = fetch("products.json").then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }
  return _productsPromise;
}

/* ==========================================================
   1) product.html
   ========================================================== */
function initProductPage() {
  const filterBar = $("filter-bar");
  const list = $("product-list");
  if (!filterBar || !list) return;

  let products = [];
  let flavors = [];
  let current = "all";

  function renderCards() {
    list.innerHTML = "";
    const shown = current === "all" ? products : products.filter((p) => p.flavor === current);

    if (!shown.length) {
      list.appendChild(el("p", "", "ยังไม่มีสินค้าในหมวดนี้"));
      return;
    }

    shown.forEach((p) => {
      const card = el("article", "product-card");

      const media = el("div", "product-card__media");
      const img = document.createElement("img");
      img.src = p.image;
      img.alt = `${p.name} ${p.pack}`;
      img.loading = "lazy";
      img.addEventListener("error", () => img.remove()); // รูปหาย → เหลือกรอบครีมเรียบๆ
      media.appendChild(img);

      const body = el("div", "product-card__body");

      const flavor = el("div", "product-card__flavor");
      flavor.appendChild(el("span", `flavor-dot flavor-${p.flavor}`));
      flavor.appendChild(el("span", "", p.flavorLabel));

      const footer = el("div", "product-card__footer");
      const price = el("span", "price", formatPrice(p.price));
      price.appendChild(el("small", "", "บาท"));
      const buy = el("a", "btn btn--gold", "สั่งซื้อ");
      buy.href = "order.html?sku=" + encodeURIComponent(p.sku);
      footer.append(price, buy);

      body.append(
        flavor,
        el("h3", "product-card__name", p.name),
        el("p", "product-card__meta", `${p.pack} · รหัส ${p.sku}`),
        el("p", "product-card__desc", p.description || ""),
        footer
      );
      card.append(media, body);
      list.appendChild(card);
    });
  }

  function renderFilters() {
    filterBar.innerHTML = "";
    [{ key: "all", label: "ทั้งหมด" }, ...flavors].forEach((f) => {
      const btn = el("button", "chip");
      btn.type = "button";
      btn.dataset.flavor = f.key;
      if (f.key !== "all") btn.appendChild(el("span", `flavor-dot flavor-${f.key}`));
      btn.appendChild(document.createTextNode(f.label));
      btn.classList.toggle("is-active", f.key === current);
      btn.addEventListener("click", () => setFlavor(f.key));
      filterBar.appendChild(btn);
    });
  }

  function setFlavor(key) {
    current = key;
    filterBar.querySelectorAll(".chip").forEach((c) =>
      c.classList.toggle("is-active", c.dataset.flavor === key)
    );
    const url = new URL(window.location.href);
    if (key === "all") url.searchParams.delete("flavor");
    else url.searchParams.set("flavor", key);
    history.replaceState(null, "", url);
    renderCards();
  }

  loadProducts()
    .then((data) => {
      products = data;
      const seen = new Set();
      products.forEach((p) => {
        if (!seen.has(p.flavor)) { seen.add(p.flavor); flavors.push({ key: p.flavor, label: p.flavorLabel }); }
      });
      const param = (new URLSearchParams(window.location.search).get("flavor") || "").toLowerCase();
      if (seen.has(param)) current = param;
      renderFilters();
      renderCards();
    })
    .catch((error) => {
      console.error(error);
      list.innerHTML = "";
      list.appendChild(el("p", "", "ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง"));
    });
}

/* ==========================================================
   2) order.html
   ========================================================== */
function initOrderPage() {
  const form = $("orderForm");
  if (!form) return;

  const picker = $("order-items");
  const itemsInput = $("items");
  const skuInput = $("skuList");
  const totalInput = $("total");
  const MAX_QTY = 99;
  let byId = {};

  const clamp = (n) => Math.max(0, Math.min(MAX_QTY, n));

  // คำนวณสรุปรายการ / รหัส SKU / ยอดรวม จากจำนวนที่เลือก
  function update() {
    let total = 0;
    const items = [];
    const skus = [];
    picker.querySelectorAll(".picker-row").forEach((row) => {
      const p = byId[row.dataset.sku];
      const qty = clamp(parseInt(row.querySelector("input").value, 10) || 0);
      if (qty > 0) {
        total += p.price * qty;
        items.push(`${p.name} ${p.pack} ×${qty}`);
        skus.push(`${p.sku}:${qty}`);
      }
    });
    itemsInput.value = items.join(", ");
    skuInput.value = skus.join(",");
    totalInput.value = total > 0 ? String(total) : "";
  }

  loadProducts()
    .then((products) => {
      picker.innerHTML = "";
      const preSku = new URLSearchParams(window.location.search).get("sku");

      products.forEach((p) => {
        byId[p.sku] = p;
        const row = el("div", "picker-row");
        row.dataset.sku = p.sku;

        const info = el("div", "picker-info");
        info.append(
          el("strong", "", `${p.name} ${p.pack}`),
          el("span", "", `${formatPrice(p.price)} บาท · รหัส ${p.sku}`)
        );

        const stepper = el("div", "stepper");
        const minus = el("button", "", "−");
        minus.type = "button"; minus.dataset.step = "-1"; minus.setAttribute("aria-label", "ลดจำนวน");
        const input = document.createElement("input");
        input.type = "number"; input.min = "0"; input.max = String(MAX_QTY);
        input.value = p.sku === preSku ? "1" : "0";
        input.setAttribute("aria-label", `จำนวน ${p.name} ${p.pack}`);
        const plus = el("button", "", "+");
        plus.type = "button"; plus.dataset.step = "1"; plus.setAttribute("aria-label", "เพิ่มจำนวน");
        stepper.append(minus, input, plus);

        row.append(info, stepper);
        picker.appendChild(row);
      });
      update();
    })
    .catch((error) => {
      console.error(error);
      picker.innerHTML = "";
      picker.appendChild(el("p", "", "ไม่สามารถโหลดรายการสินค้าได้ กรุณารีเฟรชหน้านี้"));
    });

  picker.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-step]");
    if (!btn) return;
    const input = btn.closest(".picker-row").querySelector("input");
    input.value = clamp((parseInt(input.value, 10) || 0) + Number(btn.dataset.step));
    update();
  });
  picker.addEventListener("input", update);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    update();

    if (!(Number(totalInput.value) > 0)) {
      alert("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    const val = (id) => {
      const node = $(id);
      return node ? node.value : "";
    };

    const payload = {
      customerName: val("customerName"),
      contact: val("contact"),
      address: val("address"),
      items: val("items"),
      skuList: val("skuList"),
      total: val("total"),
      note: val("note"),
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ==========================================================
   3) admin.html — ตารางออเดอร์ + ใบหยิบสินค้า + ใบปะหน้าพัสดุ
   ========================================================== */

// parse CSV เอง: รองรับ "…" ครอบค่า, "" แทน ", คอมมา และขึ้นบรรทัดใหม่ในช่อง
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// ลำดับคอลัมน์มาตรฐานในชีต (ถ้าหาหัวคอลัมน์ไม่เจอ จะใช้ตำแหน่งนี้)
const ORDER_FIELDS = ["timestamp", "orderId", "customerName", "contact", "address", "items", "skuList", "total", "note"];
const FIELD_ALIASES = {
  timestamp: ["timestamp", "วันเวลา", "วันที่"],
  orderId: ["orderid", "เลขที่ออเดอร์", "เลขที่"],
  customerName: ["customername", "ชื่อลูกค้า", "ชื่อ"],
  contact: ["contact", "เบอร์โทร", "เบอร์โทรline", "โทรศัพท์"],
  address: ["address", "ที่อยู่", "ที่อยู่จัดส่ง"],
  items: ["items", "รายการสินค้า", "ราการสินค้า", "รายการ"],
  skuList: ["skulist", "sku"],
  total: ["total", "จำนวนเงินรวม", "ยอดรวม"],
  note: ["note", "หมายเหตุ"],
};

function buildColumnMap(headerRow) {
  const norm = (s) => String(s).trim().toLowerCase().replace(/[\s_\-\/]/g, "");
  const heads = headerRow.map(norm);
  const map = {};
  ORDER_FIELDS.forEach((f) => {
    const found = heads.findIndex((h) => FIELD_ALIASES[f].map(norm).includes(h));
    map[f] = found; // -1 = ไม่มีคอลัมน์นี้ในชีต (เช่น ออเดอร์เก่าที่ไม่มีที่อยู่)
  });
  return map;
}

// "TYK-06:2,PMS-30:1" -> [{sku, qty}]
function parseSkuList(s) {
  return String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [sku, qty] = x.split(":");
      return { sku: (sku || "").trim(), qty: parseInt(qty, 10) || 0 };
    })
    .filter((x) => x.sku && x.qty > 0);
}

function initAdminPage() {
  const tbody = document.querySelector("#ordersTable tbody");
  if (!tbody) return;

  const colCount = document.querySelectorAll("#ordersTable thead th").length || 9;
  const printArea = $("print-area");
  let orders = [];
  let productMap = {};

  function message(text) {
    tbody.innerHTML = "";
    const tr = document.createElement("tr");
    const td = el("td", "", text);
    td.colSpan = colCount;
    td.style.textAlign = "center";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  /* ----- ตารางออเดอร์ ----- */
  function renderTable() {
    tbody.innerHTML = "";
    orders.forEach((o, idx) => {
      const tr = document.createElement("tr");

      const tdCheck = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "order-check";
      cb.dataset.index = String(idx);
      cb.setAttribute("aria-label", "เลือกออเดอร์ " + (o.orderId || idx + 1));
      tdCheck.appendChild(cb);
      tr.appendChild(tdCheck);

      // ใช้ textContent เสมอ เพื่อกัน HTML/สคริปต์ที่ลูกค้ากรอกเข้ามา
      tr.appendChild(el("td", "nowrap", o.timestamp));
      tr.appendChild(el("td", "nowrap", o.orderId));
      tr.appendChild(el("td", "", o.customerName));
      tr.appendChild(el("td", "nowrap", o.contact));
      tr.appendChild(el("td", "wide", o.address));
      tr.appendChild(el("td", "wide", o.items));
      tr.appendChild(el("td", "nowrap", o.total));
      tr.appendChild(el("td", "wide", o.note));
      tbody.appendChild(tr);
    });
  }

  function getSelected() {
    return Array.from(document.querySelectorAll(".order-check:checked")).map((c) => orders[Number(c.dataset.index)]);
  }

  /* ----- ตัวช่วยสร้างเอกสารพิมพ์ ----- */
  function skuName(sku) {
    const p = productMap[sku];
    return p ? `${p.name} ${p.pack}` : sku;
  }

  function skuText(o) {
    const parts = parseSkuList(o.skuList).map((i) => `${i.sku} ×${i.qty}`);
    return parts.length ? parts.join(", ") : o.items;
  }

  function makeTable(headers, rows) {
    const table = el("table", "print-table");
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    headers.forEach((h) => hr.appendChild(el("th", "", h)));
    thead.appendChild(hr);
    const body = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      r.forEach((c) => tr.appendChild(el("td", "", c)));
      body.appendChild(tr);
    });
    table.append(thead, body);
    return table;
  }

  function buildPickList(selected) {
    const doc = document.createElement("div");
    doc.appendChild(el("h2", "", "ใบหยิบสินค้า (Pick list)"));
    doc.appendChild(el("p", "", `พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")} · ทั้งหมด ${selected.length} ออเดอร์`));

    const totals = {};
    const unparsed = [];
    selected.forEach((o) => {
      const items = parseSkuList(o.skuList);
      if (!items.length) unparsed.push(o);
      items.forEach((i) => { totals[i.sku] = (totals[i.sku] || 0) + i.qty; });
    });

    doc.appendChild(el("h2", "", "สรุปจำนวนที่ต้องหยิบ"));
    doc.appendChild(
      makeTable(
        ["SKU", "สินค้า", "จำนวนรวม", "หยิบแล้ว"],
        Object.keys(totals).sort().map((sku) => [sku, skuName(sku), String(totals[sku]), "☐"])
      )
    );

    doc.appendChild(el("h2", "", "แยกตามออเดอร์ (สำหรับแพ็ค)"));
    doc.appendChild(
      makeTable(
        ["เลขที่", "ผู้รับ", "รายการ", "แพ็คแล้ว"],
        selected.map((o) => [o.orderId || "-", o.customerName, skuText(o), "☐"])
      )
    );

    if (unparsed.length) {
      doc.appendChild(
        el("p", "", "⚠ ออเดอร์ที่ไม่มีรหัส SKU (ตรวจรายการด้วยตนเอง): " + unparsed.map((o) => o.orderId || o.customerName).join(", "))
      );
    }
    return doc;
  }

  function buildLabel(o) {
    const label = el("section", "label");

    const from = el("div", "label-from");
    from.textContent = `ผู้ส่ง: ${SENDER.name} โทร ${SENDER.phone} — ${SENDER.address}`;

    const to = el("div", "label-to");
    to.appendChild(el("div", "", "ผู้รับ"));
    to.appendChild(el("div", "label-name", o.customerName));
    to.appendChild(el("div", "label-name", "โทร " + o.contact));
    to.appendChild(el("div", "label-addr", o.address));

    const itemsBox = el("div", "label-items");
    const parsed = parseSkuList(o.skuList);
    let weight = 0;
    if (parsed.length) {
      itemsBox.appendChild(el("div", "", "รายการในพัสดุ"));
      parsed.forEach((i) => {
        const p = productMap[i.sku];
        if (p) weight += p.weight_g * i.qty;
        itemsBox.appendChild(el("div", "", `${i.sku} ${skuName(i.sku)} ×${i.qty}`));
      });
    } else {
      itemsBox.appendChild(el("div", "", "รายการ: " + o.items));
    }
    if (o.note) itemsBox.appendChild(el("div", "", "หมายเหตุ: " + o.note));

    const foot = el("div", "label-foot");
    foot.appendChild(el("span", "", "เลขที่ " + (o.orderId || "-")));
    foot.appendChild(el("span", "", weight ? `น้ำหนักรวม ≈ ${(weight / 1000).toFixed(2)} กก.` : ""));

    label.append(from, to, itemsBox, foot);
    return label;
  }

  function printDoc(nodes, pageSize) {
    let style = $("page-style");
    if (!style) { style = document.createElement("style"); style.id = "page-style"; document.head.appendChild(style); }
    style.textContent = `@page { size: ${pageSize}; margin: 4mm; }`;
    printArea.replaceChildren(...nodes);
    window.print();
  }
  window.addEventListener("afterprint", () => { if (printArea) printArea.replaceChildren(); });

  /* ----- ปุ่มต่างๆ ----- */
  const btnPick = $("btn-pick");
  const btnLabels = $("btn-labels");
  const selectAll = $("selectAll");

  if (selectAll) {
    selectAll.addEventListener("change", () =>
      document.querySelectorAll(".order-check").forEach((c) => { c.checked = selectAll.checked; })
    );
  }
  if (btnPick) {
    btnPick.addEventListener("click", () => {
      const sel = getSelected();
      if (!sel.length) { alert("กรุณาเลือกออเดอร์อย่างน้อย 1 รายการ"); return; }
      printDoc([buildPickList(sel)], "A4");
    });
  }
  if (btnLabels) {
    btnLabels.addEventListener("click", () => {
      const sel = getSelected();
      if (!sel.length) { alert("กรุณาเลือกออเดอร์อย่างน้อย 1 รายการ"); return; }
      printDoc(sel.map(buildLabel), "100mm 150mm");
    });
  }

  /* ----- โหลดข้อมูล ----- */
  message("กำลังโหลดข้อมูล...");

  Promise.all([
    fetch(SHEET_CSV_URL).then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    }),
    loadProducts().catch((err) => { console.error(err); return []; }),
  ])
    .then(([csv, products]) => {
      products.forEach((p) => { productMap[p.sku] = p; });

      const rows = parseCSV(csv);
      if (rows.length < 2) { message("ยังไม่มีรายการสั่งซื้อ"); return; }

      const map = buildColumnMap(rows[0]);
      orders = rows.slice(1).map((r) => {
        const o = {};
        ORDER_FIELDS.forEach((f) => { o[f] = (map[f] >= 0 ? r[map[f]] || "" : "").trim(); });
        return o;
      });

      // ชีตเพิ่มแถวใหม่ต่อท้ายเสมอ จึงกลับลำดับให้ล่าสุดขึ้นก่อน
      orders.reverse();
      renderTable();
    })
    .catch((error) => {
      console.error(error);
      message("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    });
}

/* ---------- start ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
