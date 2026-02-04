/***********************
 * Sexy Flashcards v1
 * - Add/edit/delete/duplicate
 * - Bulk import Q:/A:
 * - Export/Import JSON
 * - Print fronts/backs (manual duplex)
 * - Back order fixed by reversing pages-of-4 (prevents Q1->Q3)
 * - Times New Roman 10pt print + rotated for traditional FC reading
 * - Auto-fit so nothing gets cut off
 ***********************/

const LS_KEY = "flashcards_sexy_v1";

/* ---------- tiny utilities ---------- */
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
 * Fit text inside a box by shrinking font size.
 * Starts at 10pt (requested) and shrinks only if needed.
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

/* ---------- state ---------- */
let cards = load();

/* ---------- DOM ---------- */
const elCards = document.getElementById("cards");
const elEmpty = document.getElementById("empty");
const countLabel = document.getElementById("countLabel");

const btnAdd = document.getElementById("btnAdd");
const btnBulk = document.getElementById("btnBulk");
const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");

const btnPrintFronts = document.getElementById("btnPrintFronts");
const btnPrintBacks = document.getElementById("btnPrintBacks");
const btnTestFront = document.getElementById("btnTestFront");
const btnTestBack = document.getElementById("btnTestBack");

const flipMode = document.getElementById("flipMode");
const backOrder = document.getElementById("backOrder");
const guides = document.getElementById("guides");

const printRoot = document.getElementById("printRoot");

/* bulk modal */
const bulkModal = document.getElementById("bulkModal");
const btnBulkClose = document.getElementById("btnBulkClose");
const btnBulkImport = document.getElementById("btnBulkImport");
const bulkText = document.getElementById("bulkText");
const bulkReplace = document.getElementById("bulkReplace");

/* ---------- render ---------- */
function render() {
  elCards.innerHTML = "";
  elEmpty.style.display = cards.length ? "none" : "block";
  countLabel.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;

  cards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "cardItem";

    wrap.innerHTML = `
      <div class="cardTop">
        <strong>Card ${idx + 1}</strong>
        <div class="id">id: ${String(c.id).slice(0,6)}</div>
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

    wrap.querySelector(`textarea[data-side="front"][data-id="${c.id}"]`).value = c.front ?? "";
    wrap.querySelector(`textarea[data-side="back"][data-id="${c.id}"]`).value = c.back ?? "";
  });
}

/* ---------- edit handlers ---------- */
function upsert(id, side, value) {
  const i = cards.findIndex(x => x.id === id);
  if (i === -1) return;
  cards[i] = { ...cards[i], [side]: value };
  save(cards);
}

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

/* ---------- add ---------- */
btnAdd.addEventListener("click", () => {
  cards.unshift({ id: uid(), front: "", back: "" });
  save(cards);
  render();
});

/* ---------- export/import JSON ---------- */
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
    alert("Import failed. Use an export from this app (JSON).");
  } finally {
    fileImport.value = "";
  }
});

/* ---------- bulk Q/A ---------- */
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

/* ---------- printing ---------- */
function buildPrint(side, useTest = false) {
  printRoot.innerHTML = "";

  // apply print classes
  printRoot.className = "";
  if (guides.checked) printRoot.classList.add("guides");
  if (side === "back" && flipMode.value === "long") printRoot.classList.add("flip-long");

  let list;
  if (useTest) {
    // 8 cards so you can validate both pages & reversal
    list = [
      { front: "Q1", back: "A1" },
      { front: "Q2", back: "A2" },
      { front: "Q3", back: "A3" },
      { front: "Q4", back: "A4" },
      { front: "Q5", back: "A5" },
      { front: "Q6", back: "A6" },
      { front: "Q7", back: "A7" },
      { front: "Q8", back: "A8" }
    ];
  } else {
    list = cards.slice();
  }

  // Key fix: reverse by PAGES (groups of 4), not by individual cards
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
      const c = pageCards[i];

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

/**
 * Reliable print trigger:
 * - build DOM
 * - wait 2 animation frames (layout)
 * - small timeout
 * - call window.print()
 */
function doPrint(side, useTest = false) {
  if (!useTest && cards.length === 0) {
    alert("Add or import at least one card first.");
    return;
  }
  buildPrint(side, useTest);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 60);
    });
  });
}

btnPrintFronts.addEventListener("click", () => doPrint("front"));
btnPrintBacks.addEventListener("click", () => doPrint("back"));
btnTestFront.addEventListener("click", () => doPrint("front", true));
btnTestBack.addEventListener("click", () => doPrint("back", true));

/* ---------- start ---------- */
render();
