/***********************
 * Flashcards 3x5 (Cut Boxes on Letter) + Manual Duplex + Q/A Import
 * - Front/back editing
 * - Bulk import: Q: ... A: ...
 * - Print: 4 cards per letter page with cut outlines
 * - Manual duplex: flip mode + reverse order
 * - Auto-fit text: start 10pt, shrink if needed (no cutoff)
 ***********************/

const LS_KEY = "flashcards_3x5_letter_v3";

/* ---------- Helpers ---------- */
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadCards() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveCards(cards) {
  localStorage.setItem(LS_KEY, JSON.stringify(cards));
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Fit text inside its container by shrinking font size.
 * Starts at 10pt (your request) and only shrinks if needed.
 * It NEVER lets text overflow.
 */
function fitText(el, minPt = 7) {
  let size = 10; // start at 10pt
  el.style.fontSize = size + "pt";

  // Sometimes layout needs a tick to compute accurate heights
  // but we keep it simple and deterministic.
  while (el.scrollHeight > el.clientHeight && size > minPt) {
    size -= 0.25;
    el.style.fontSize = size + "pt";
  }
}

/* ---------- Read DOM ---------- */
let cards = loadCards();

const elCards = document.getElementById("cards");
const elEmpty = document.getElementById("empty");

const btnAdd = document.getElementById("btnAdd");
const btnBulk = document.getElementById("btnBulk");
const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");

const btnPrintFronts = document.getElementById("btnPrintFronts");
const btnPrintBacks = document.getElementById("btnPrintBacks");
const btnTest = document.getElementById("btnTest");

const flipMode = document.getElementById("flipMode");     // "long" | "short"
const backOrder = document.getElementById("backOrder");   // "same" | "reverse"
const guides = document.getElementById("guides");

const printRoot = document.getElementById("printRoot");

/* Bulk import modal elements */
const bulkModal = document.getElementById("bulkModal");
const btnBulkClose = document.getElementById("btnBulkClose");
const btnBulkImport = document.getElementById("btnBulkImport");
const bulkText = document.getElementById("bulkText");
const bulkReplace = document.getElementById("bulkReplace");

/* ---------- Render ---------- */
function render() {
  elCards.innerHTML = "";
  elEmpty.style.display = cards.length ? "none" : "block";

  cards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "cardItem";

    const header = document.createElement("div");
    header.className = "row";
    header.style.justifyContent = "space-between";
    header.innerHTML = `<strong>Card ${idx + 1}</strong><span class="muted">id: ${String(c.id).slice(0,6)}</span>`;
    wrap.appendChild(header);

    const cols = document.createElement("div");
    cols.className = "cols";

    const front = document.createElement("div");
    front.innerHTML = `
      <div class="muted small">Front</div>
      <textarea data-side="front" data-id="${c.id}"></textarea>
    `;

    const back = document.createElement("div");
    back.innerHTML = `
      <div class="muted small">Back</div>
      <textarea data-side="back" data-id="${c.id}"></textarea>
    `;

    cols.appendChild(front);
    cols.appendChild(back);
    wrap.appendChild(cols);

    const actions = document.createElement("div");
    actions.className = "cardActions";
    actions.innerHTML = `
      <button class="btn subtle" data-act="dup" data-id="${c.id}">Duplicate</button>
      <button class="btn subtle" data-act="del" data-id="${c.id}">Delete</button>
    `;
    wrap.appendChild(actions);

    elCards.appendChild(wrap);

    wrap.querySelector(`textarea[data-side="front"][data-id="${c.id}"]`).value = c.front ?? "";
    wrap.querySelector(`textarea[data-side="back"][data-id="${c.id}"]`).value = c.back ?? "";
  });
}

/* ---------- Edit cards ---------- */
function updateCard(id, side, value) {
  const i = cards.findIndex(x => x.id === id);
  if (i === -1) return;
  cards[i] = { ...cards[i], [side]: value };
  saveCards(cards);
}

elCards.addEventListener("input", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLTextAreaElement)) return;
  const id = t.getAttribute("data-id");
  const side = t.getAttribute("data-side");
  if (!id || (side !== "front" && side !== "back")) return;
  updateCard(id, side, t.value);
});

elCards.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;
  const act = btn.getAttribute("data-act");
  const id = btn.getAttribute("data-id");
  if (!act || !id) return;

  if (act === "del") {
    cards = cards.filter(x => x.id !== id);
    saveCards(cards);
    render();
    return;
  }

  if (act === "dup") {
    const i = cards.findIndex(x => x.id === id);
    if (i === -1) return;
    const c = cards[i];
    cards.splice(i + 1, 0, { id: uid(), front: c.front ?? "", back: c.back ?? "" });
    saveCards(cards);
    render();
    return;
  }
});

btnAdd.addEventListener("click", () => {
  cards.unshift({ id: uid(), front: "", back: "" });
  saveCards(cards);
  render();
});

/* ---------- Export / Import JSON ---------- */
btnExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "flashcards-3x5.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

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

    saveCards(cards);
    render();
  } catch {
    alert("Import failed. Use a JSON export from this app.");
  } finally {
    fileImport.value = "";
  }
});

/* ---------- Bulk Import (Q:/A:) ---------- */
function parseQA(raw) {
  // Multiline supported.
  // Q: ... up to A: is question
  // A: ... up to next Q: (or end) is answer
  const text = (raw || "").replace(/\r\n/g, "\n");

  // Matches blocks like:
  // Q: question text
  // A: answer text
  // (until next Q: or end)
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
  bulkModal.setAttribute("aria-hidden", "false");
  bulkText.focus();
}

function closeBulk() {
  bulkModal.setAttribute("aria-hidden", "true");
}

btnBulk.addEventListener("click", openBulk);
btnBulkClose.addEventListener("click", closeBulk);

bulkModal.addEventListener("click", (e) => {
  if (e.target === bulkModal) closeBulk();
});

btnBulkImport.addEventListener("click", () => {
  const parsed = parseQA(bulkText.value);

  if (parsed.length === 0) {
    alert('No cards found. Make sure your text has "Q:" and "A:".');
    return;
  }

  if (bulkReplace.checked) {
    cards = parsed;
  } else {
    cards = parsed.concat(cards); // new ones on top
  }

  saveCards(cards);
  render();

  bulkText.value = "";
  bulkReplace.checked = false;
  closeBulk();
});

/* ---------- Printing ---------- */
function buildPrint(side, useTest = false) {
  printRoot.innerHTML = "";

  // Reset classes and apply print options
  printRoot.className = "";
  if (guides.checked) printRoot.classList.add("guides");
  if (side === "back" && flipMode.value === "long") {
    printRoot.classList.add("flip-long");
  }

  let list;

  if (useTest) {
    // Always exactly 4 so a full sheet prints
    list = [
      { front: "FRONT (1)\n▲ TOP", back: "BACK (1)\n▲ TOP" },
      { front: "FRONT (2)\n▲ TOP", back: "BACK (2)\n▲ TOP" },
      { front: "FRONT (3)\n▲ TOP", back: "BACK (3)\n▲ TOP" },
      { front: "FRONT (4)\n▲ TOP", back: "BACK (4)\n▲ TOP" }
    ];
  } else {
    list = cards.slice();
    if (side === "back" && backOrder.value === "reverse") {
      list.reverse();
    }
  }

  const pages = chunk(list, 4);

  pages.forEach((pageCards) => {
    const sheet = document.createElement("div");
    sheet.className = "sheet";

    // Always render 4 boxes so cutting stays consistent
    for (let i = 0; i < 4; i++) {
      const c = pageCards[i];

      const box = document.createElement("div");
      box.className = "cardBox";

      const text = document.createElement("div");
      text.className = "printText";

      if (c) {
        text.textContent = side === "front" ? (c.front ?? "") : (c.back ?? "");
      } else {
        text.textContent = "";
      }

      box.appendChild(text);
      sheet.appendChild(box);

      // Fit text after it is in the box
      // (works best when it has a real layout size)
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

  buildPrint(side, useTest);

  // give browser a moment to layout before printing
  setTimeout(() => window.print(), 50);
}

btnPrintFronts.addEventListener("click", () => doPrint("front"));
btnPrintBacks.addEventListener("click", () => doPrint("back"));

btnTest.addEventListener("click", () => {
  const which = prompt('Type "front" to print the FRONT test, or "back" to print the BACK test:', "front");
  if (String(which).toLowerCase().trim() === "back") doPrint("back", true);
  else doPrint("front", true);
});

/* ---------- Start ---------- */
render();
