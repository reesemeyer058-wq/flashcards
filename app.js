/***********************
 * Flashcards — Full App (robust printing + adaptive back alignment)
 * - Add/edit/delete/duplicate
 * - Bulk import Q:/A: (multiline)
 * - Export/Import JSON
 * - Print fronts / backs (4-up 3×5 cut boxes on Letter)
 * - Adaptive back alignment (software adapts to your paper reload habit):
 *    - Deck order: same / reverse-by-sheet
 *    - Within-sheet mapping: none / swapRows / swapCols / rotate180
 *    - Back rotation: 0 / 180 (fix upside-down)
 * - Print font: Times New Roman 10pt
 * - Auto-fit text: shrinks to avoid clipping
 * - Null-safe: will NOT crash if an expected UI element is missing
 ***********************/

const LS_KEY = "flashcards_full_robust_v1";

/* ---------- Utilities ---------- */
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save(cards) {
  localStorage.setItem(LS_KEY, JSON.stringify(cards));
}

/* Auto-fit print text: start 10pt and shrink if needed */
function fitText(el, minPt = 7) {
  let size = 10;
  el.style.fontSize = size + "pt";
  while (el.scrollHeight > el.clientHeight && size > minPt) {
    size -= 0.25;
    el.style.fontSize = size + "pt";
  }
}

/* ---------- DOM (null-safe lookups) ---------- */
function $(id) { return document.getElementById(id); }

const elCards = $("cards");
const elEmpty = $("empty");
const countLabel = $("countLabel");

const btnAdd = $("btnAdd");
const btnBulk = $("btnBulk");
const btnExport = $("btnExport");
const fileImport = $("fileImport");

const btnPrintFronts = $("btnPrintFronts");
const btnPrintBacks = $("btnPrintBacks");
const btnTestFront = $("btnTestFront");
const btnTestBack = $("btnTestBack");

const printRoot = $("printRoot");

/* Bulk modal */
const bulkModal = $("bulkModal");
const btnBulkClose = $("btnBulkClose");
const btnBulkImport = $("btnBulkImport");
const bulkText = $("bulkText");
const bulkReplace = $("bulkReplace");

/* Alignment controls (may be missing in your HTML — safe defaults!) */
const backOrderEl = $("backOrder");     // same | reverse
const backMapEl = $("backMap");         // none | swapRows | swapCols | rotate180
const backRotateEl = $("backRotate");   // 0 | 180
const guidesEl = $("guides");           // checkbox

function getBackOrder()  { return backOrderEl ? backOrderEl.value : "same"; }
function getBackMap()    { return backMapEl ? backMapEl.value : "none"; }
function getBackRotate() { return backRotateEl ? backRotateEl.value : "0"; }
function getGuides()     { return guidesEl ? guidesEl.checked : false; }

/* ---------- App state ---------- */
let cards = load();

/* ---------- Render UI ---------- */
function setCount() {
  if (!countLabel) return;
  countLabel.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;
}

function render() {
  if (!elCards) return;

  elCards.innerHTML = "";
  if (elEmpty) elEmpty.style.display = cards.length ? "none" : "block";
  setCount();

  cards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "cardItem";

    wrap.innerHTML = `
      <div class="cardTop">
        <strong>Card ${idx + 1}</strong>
        <div class="id">id: ${String(c.id).slice(0, 6)}</div>
      </div>

      <div class="cols">
        <div>
          <div class="sideLabel">Front</div>
          <textarea class="editor" data-side="front" data-id="${c.id}" placeholder="Question…"></textarea>
        </div>
        <div>
          <div class="sideLabel">Back</div>
          <textarea class="editor" data-side="back" data-id="${c.id}" placeholder="Answer…"></textarea>
        </div>
      </div>

      <div class="cardActions">
        <button class="btn ghost" data-act="dup" data-id="${c.id}">Duplicate</button>
        <button class="btn ghost" data-act="del" data-id="${c.id}">Delete</button>
      </div>
    `;

    elCards.appendChild(wrap);

    const f = wrap.querySelector(`textarea[data-side="front"][data-id="${c.id}"]`);
    const b = wrap.querySelector(`textarea[data-side="back"][data-id="${c.id}"]`);
    if (f) f.value = c.front ?? "";
    if (b) b.value = c.back ?? "";
  });
}

/* ---------- Edit handlers ---------- */
function upsert(id, side, value) {
  const i = cards.findIndex(x => x.id === id);
  if (i === -1) return;
  cards[i] = { ...cards[i], [side]: value };
  save(cards);
}

if (elCards) {
  elCards.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLTextAreaElement)) return;
    const id = t.getAttribute("data-id");
    const side = t.getAttribute("data-side");
    if (!id || (side !== "front" && side !== "back")) return;
    upsert(id, side, t.value);
  });

  elCards.addEventListener("click", (e) => {
    const btn = e.target;
    if (!(btn instanceof HTMLButtonElement)) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "del") {
      cards = cards.filter(x => x.id !== id);
      save(cards);
      render();
    }

    if (act === "dup") {
      const i = cards.findIndex(x => x.id === id);
      if (i === -1) return;
      const c = cards[i];
      cards.splice(i + 1, 0, { id: uid(), front: c.front ?? "", back: c.back ?? "" });
      save(cards);
      render();
    }
  });
}

if (btnAdd) {
  btnAdd.addEventListener("click", () => {
    cards.unshift({ id: uid(), front: "", back: "" });
    save(cards);
    render();
  });
}

/* ---------- Export / Import JSON ---------- */
if (btnExport) {
  btnExport.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flashcards.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

if (fileImport) {
  fileImport.addEventListener("change", async () => {
    const f = fileImport.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("not array");
      cards = data.map(x => ({
        id: x.id || uid(),
        front: String(x.front ?? ""),
        back: String(x.back ?? "")
      }));
      save(cards);
      render();
    } catch {
      alert("Import failed. Use a JSON export from this app.");
    } finally {
      fileImport.value = "";
    }
  });
}

/* ---------- Bulk import Q:/A: ---------- */
function parseQA(raw) {
  const text = (raw || "").replace(/\r\n/g, "\n");
  const re = /Q:\s*([\s\S]*?)\s*A:\s*([\s\S]*?)(?=\n\s*Q:|$)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const q = (m[1] || "").trim();
    const a = (m[2] || "").trim();
    if (!q && !a) continue;
    out.push({ id: uid(), front: q, back: a });
  }
  return out;
}

function openBulk() {
  if (!bulkModal) return;
  bulkModal.setAttribute("aria-hidden", "false");
  if (bulkText) bulkText.focus();
}
function closeBulk() {
  if (!bulkModal) return;
  bulkModal.setAttribute("aria-hidden", "true");
}

if (btnBulk) btnBulk.addEventListener("click", openBulk);
if (btnBulkClose) btnBulkClose.addEventListener("click", closeBulk);

if (bulkModal) {
  bulkModal.addEventListener("click", (e) => {
    if (e.target === bulkModal) closeBulk();
  });
}

if (btnBulkImport) {
  btnBulkImport.addEventListener("click", () => {
    const parsed = parseQA(bulkText ? bulkText.value : "");
    if (parsed.length === 0) {
      alert('No cards found. Make sure you use "Q:" and "A:".');
      return;
    }

    const replace = !!(bulkReplace && bulkReplace.checked);
    cards = replace ? parsed : parsed.concat(cards);
    save(cards);
    render();

    if (bulkText) bulkText.value = "";
    if (bulkReplace) bulkReplace.checked = false;
    closeBulk();
  });
}

/* ---------- Printing (adaptive mapping) ---------- */
/*
Positions in a 4-up page:
  0 = top-left
  1 = top-right
  2 = bottom-left
  3 = bottom-right
*/

function remapPage(page4, mode) {
  const a = page4.slice();
  while (a.length < 4) a.push(null);
  const out = [null, null, null, null];

  if (mode === "swapRows") {
    // 0<->2, 1<->3
    out[0] = a[2]; out[1] = a[3]; out[2] = a[0]; out[3] = a[1];
    return out;
  }
  if (mode === "swapCols") {
    // 0<->1, 2<->3
    out[0] = a[1]; out[1] = a[0]; out[2] = a[3]; out[3] = a[2];
    return out;
  }
  if (mode === "rotate180") {
    // 0<->3, 1<->2
    out[0] = a[3]; out[1] = a[2]; out[2] = a[1]; out[3] = a[0];
    return out;
  }
  // none
  return a;
}

function buildPrint(side, useTest = false) {
  if (!printRoot) return;

  printRoot.innerHTML = "";
  printRoot.className = "";
  if (getGuides()) printRoot.classList.add("guides");
  if (side === "back" && getBackRotate() === "180") printRoot.classList.add("back-rotate-180");

  let list;
  if (useTest) {
    // 12 diagnostic cards (3 sheets)
    list = [
      { front: "Q1 — TOP LEFT", back: "A1 — TOP LEFT" },
      { front: "Q2 — TOP RIGHT", back: "A2 — TOP RIGHT" },
      { front: "Q3 — BOTTOM LEFT", back: "A3 — BOTTOM LEFT" },
      { front: "Q4 — BOTTOM RIGHT", back: "A4 — BOTTOM RIGHT" },

      { front: "Q5 — P2 TOP LEFT", back: "A5 — P2 TOP LEFT" },
      { front: "Q6 — P2 TOP RIGHT", back: "A6 — P2 TOP RIGHT" },
      { front: "Q7 — P2 BOTTOM LEFT", back: "A7 — P2 BOTTOM LEFT" },
      { front: "Q8 — P2 BOTTOM RIGHT", back: "A8 — P2 BOTTOM RIGHT" },

      { front: "Q9 — P3 TOP LEFT", back: "A9 — P3 TOP LEFT" },
      { front: "Q10 — P3 TOP RIGHT", back: "A10 — P3 TOP RIGHT" },
      { front: "Q11 — P3 BOTTOM LEFT", back: "A11 — P3 BOTTOM LEFT" },
      { front: "Q12 — P3 BOTTOM RIGHT", back: "A12 — P3 BOTTOM RIGHT" },
    ];
  } else {
    list = cards.slice();
  }

  // make pages of 4
  let pages = chunk(list, 4);

  // deck order fix (reverse by sheet)
  if (side === "back" && getBackOrder() === "reverse") {
    pages = pages.slice().reverse();
  }

  // within-sheet remap (fix Q1->A3, etc.)
  if (side === "back") {
    const map = getBackMap();
    if (map && map !== "none") {
      pages = pages.map(p => remapPage(p, map));
    }
  }

  // render pages
  pages.forEach(pageCards => {
    const sheet = document.createElement("div");
    sheet.className = "sheet";

    for (let i = 0; i < 4; i++) {
      const c = pageCards[i] || null;

      const box = document.createElement("div");
      box.className = "cardBox";

      const text = document.createElement("div");
      text.className = "printText";
      text.textContent = c ? (side === "front" ? (c.front ?? "") : (c.back ?? "")) : "";

      box.appendChild(text);
      sheet.appendChild(box);

      fitText(text);
    }

    printRoot.appendChild(sheet);
  });
}

function doPrint(side, useTest = false) {
  if (!useTest && cards.length === 0) {
    alert("Add or import at least one card first.");
    return;
  }
  if (!printRoot) {
    alert("Print container missing (printRoot).");
    return;
  }

  buildPrint(side, useTest);

  // Reliable print trigger:
  // wait for the DOM to paint twice, then print
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 60);
    });
  });
}

/* Print buttons */
if (btnPrintFronts) btnPrintFronts.addEventListener("click", () => doPrint("front"));
if (btnPrintBacks) btnPrintBacks.addEventListener("click", () => doPrint("back"));
if (btnTestFront) btnTestFront.addEventListener("click", () => doPrint("front", true));
if (btnTestBack) btnTestBack.addEventListener("click", () => doPrint("back", true));

/* ---------- Start ---------- */
render();
