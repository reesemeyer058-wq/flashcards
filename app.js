/***********************
 * Flashcards 3x5 on Letter (4-up cut boxes) + Manual Duplex + Q/A Import
 * Features:
 * - Add/edit/delete/duplicate
 * - Bulk import Q:/A: (multiline)
 * - Export/Import JSON
 * - Print fronts / backs (manual duplex)
 * - Back order fixed by reversing PAGES (groups of 4) to avoid Q1->Q3 bug
 * - Times New Roman 10pt + rotate text for traditional flashcard reading
 * - Auto-shrink text so nothing gets cut off
 ***********************/

const LS_KEY = "flashcards_3x5_letter_full_v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
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

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Auto-fit: start at 10pt, shrink until it fits (never clip).
 * Min is 7pt (change if you want).
 */
function fitText(el, minPt = 7) {
  let size = 10;
  el.style.fontSize = size + "pt";

  // shrink until it fits
  while (el.scrollHeight > el.clientHeight && size > minPt) {
    size -= 0.25;
    el.style.fontSize = size + "pt";
  }
}

/* State */
let cards = load();

/* DOM */
const elCards = document.getElementById("cards");
const elEmpty = document.getElementById("empty");

const btnAdd = document.getElementById("btnAdd");
const btnBulk = document.getElementById("btnBulk");
const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");

const btnPrintFronts = document.getElementById("btnPrintFronts");
const btnPrintBacks = document.getElementById("btnPrintBacks");
const btnTest = document.getElementById("btnTest");

const flipMode = document.getElementById("flipMode");   // long | short
const backOrder = document.getElementById("backOrder"); // same | reverse
const guides = document.getElementById("guides");

const printRoot = document.getElementById("printRoot");

/* Bulk modal */
const bulkModal = document.getElementById("bulkModal");
const btnBulkClose = document.getElementById("btnBulkClose");
const btnBulkImport = document.getElementById("btnBulkImport");
const bulkText = document.getElementById("bulkText");
const bulkReplace = document.getElementById("bulkReplace");

/* Render UI */
function render() {
  elCards.innerHTML = "";
  elEmpty.style.display = cards.length ? "none" : "block";

  cards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "cardItem";

    const top = document.createElement("div");
    top.className = "row";
    top.style.justifyContent = "space-between";
    top.innerHTML = `<strong>Card ${idx + 1}</strong><span class="muted">id: ${String(c.id).slice(0,6)}</span>`;
    wrap.appendChild(top);

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

function upsert(id, side, value) {
  const i = cards.findIndex(c => c.id === id);
  if (i === -1) return;
  cards[i] = { ...cards[i], [side]: value };
  save(cards);
}

/* Edit handlers */
elCards.addEventListener("input", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLTextAreaElement)) return;
  const id = t.getAttribute("data-id");
  const side = t.getAttribute("data-side");
  if (!id || !side) return;
  upsert(id, side, t.value);
});

elCards.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;
  const act = btn.getAttribute("data-act");
  const id = btn.getAttribute("data-id");
  if (!act || !id) return;

  if (act === "del") {
    cards = cards.filter(c => c.id !== id);
    save(cards);
    render();
  }

  if (act === "dup") {
    const c = cards.find(x => x.id === id);
    if (!c) return;
    const at = cards.findIndex(x => x.id === id);
    cards.splice(at + 1, 0, {
      id: uid(),
      front: c.front ?? "",
      back: c.back ?? ""
    });
    save(cards);
    render();
  }
});

btnAdd.addEventListener("click", () => {
  cards.unshift({ id: uid(), front: "", back: "" });
  save(cards);
  render();
});

/* Export / Import JSON */
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
    if (!Array.isArray(data)) throw new Error("Not an array");
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

/* Bulk import Q:/A: */
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
    alert('No cards found. Make sure you have "Q:" and "A:" markers.');
    return;
  }

  cards = bulkReplace.checked ? parsed : parsed.concat(cards);
  save(cards);
  render();

  bulkText.value = "";
  bulkReplace.checked = false;
  closeBulk();
});

/* Printing: 4-up on Letter */
function buildPrintPages(side, useTest = false) {
  printRoot.innerHTML = "";

  // classes controlling print appearance
  printRoot.className = "";
  if (guides.checked) printRoot.classList.add("guides");
  if (side === "back" && flipMode.value === "long") printRoot.classList.add("flip-long");

  let list;

  if (useTest) {
    list = [
      { front: "Q1\n(Top →)\n→", back: "A1\n(Top →)\n→" },
      { front: "Q2\n(Top →)\n→", back: "A2\n(Top →)\n→" },
      { front: "Q3\n(Top →)\n→", back: "A3\n(Top →)\n→" },
      { front: "Q4\n(Top →)\n→", back: "A4\n(Top →)\n→" },
      { front: "Q5\n(Top →)\n→", back: "A5\n(Top →)\n→" },
      { front: "Q6\n(Top →)\n→", back: "A6\n(Top →)\n→" },
      { front: "Q7\n(Top →)\n→", back: "A7\n(Top →)\n→" },
      { front: "Q8\n(Top →)\n→", back: "A8\n(Top →)\n→" }
    ];
  } else {
    list = cards.slice();
  }

  // IMPORTANT: back order reversing must happen by PAGES (groups of 4),
  // NOT by individual cards. This prevents Q1->Q3 type mismatches.
  if (!useTest && side === "back" && backOrder.value === "reverse") {
    const pages = chunk(list, 4);
    pages.reverse();
    list = pages.flat();
  }

  const pages = chunk(list, 4);

  pages.forEach((pageCards) => {
    const sheet = document.createElement("div");
    sheet.className = "sheet";

    for (let i = 0; i < 4; i++) {
      const card = pageCards[i];

      const box = document.createElement("div");
      box.className = "cardBox";

      const text = document.createElement("div");
      text.className = "printText";
      text.textContent = card
        ? (side === "front" ? (card.front ?? "") : (card.back ?? ""))
        : "";

      box.appendChild(text);
      sheet.appendChild(box);

      // fit after insertion so sizes are measurable
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
  buildPrintPages(side, useTest);
  setTimeout(() => window.print(), 50);
}

btnPrintFronts.addEventListener("click", () => doPrint("front"));
btnPrintBacks.addEventListener("click", () => doPrint("back"));

btnTest.addEventListener("click", () => {
  const which = prompt('Type "front" to print a FRONT test, or "back" to print a BACK test:', "front");
  if (String(which).toLowerCase().trim() === "back") doPrint("back", true);
  else doPrint("front", true);
});

/* Start */
render();
