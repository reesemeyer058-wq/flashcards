/***********************
 * Flashcards — FIXED PRINT ENGINE + IMPORT/EXPORT
 ***********************/

const LS_KEY = "flashcards_full_robust_v1";

/* ---------- Utilities ---------- */
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const load = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const save = (cards) => localStorage.setItem(LS_KEY, JSON.stringify(cards));

/* ---------- SAFE AUTO-FIT ---------- */
function fitText(el, minPt = 7) {
  if (!el) return;
  const box = el.parentElement;
  if (!box) return;

  // If layout isn't measurable yet, skip (prevents freezes)
  if (box.clientHeight === 0 || box.clientWidth === 0) return;

  let size = 10;
  el.style.fontSize = size + "pt";

  let guard = 0;
  while (
    guard < 40 &&
    (el.scrollHeight > box.clientHeight || el.scrollWidth > box.clientWidth) &&
    size > minPt
  ) {
    size -= 0.25;
    el.style.fontSize = size + "pt";
    guard++;
  }
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);

const elCards = $("cards");
const elEmpty = $("empty");
const countLabel = $("countLabel");
const printRoot = $("printRoot");

/* Buttons */
const btnAdd = $("btnAdd");
const btnBulk = $("btnBulk");
const btnExport = $("btnExport");
const fileImport = $("fileImport");
const btnPrintFronts = $("btnPrintFronts");
const btnPrintBacks = $("btnPrintBacks");
const btnTestFront = $("btnTestFront");
const btnTestBack = $("btnTestBack");

/* Bulk modal */
const bulkModal = $("bulkModal");
const btnBulkClose = $("btnBulkClose");
const btnBulkImport = $("btnBulkImport");
const bulkText = $("bulkText");
const bulkReplace = $("bulkReplace");

/* Alignment controls */
const backOrderEl = $("backOrder");
const backMapEl = $("backMap");
const backRotateEl = $("backRotate");
const guidesEl = $("guides");

const getBackOrder = () => backOrderEl?.value ?? "same";
const getBackMap = () => backMapEl?.value ?? "none";
const getBackRotate = () => backRotateEl?.value ?? "0";
const getGuides = () => guidesEl?.checked ?? false;

/* ---------- State ---------- */
let cards = load();

/* ---------- UI Render ---------- */
function render() {
  if (!elCards) return;
  elCards.innerHTML = "";

  if (elEmpty) elEmpty.style.display = cards.length ? "none" : "block";
  if (countLabel)
    countLabel.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;

  cards.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "cardItem";
    wrap.innerHTML = `
      <div class="cardTop">
        <strong>Card ${i + 1}</strong>
        <div class="id">${String(c.id ?? "").slice(0, 6)}</div>
      </div>
      <div class="cols">
        <textarea class="editor" data-side="front" data-id="${c.id}" placeholder="Question…">${c.front ?? ""}</textarea>
        <textarea class="editor" data-side="back" data-id="${c.id}" placeholder="Answer…">${c.back ?? ""}</textarea>
      </div>
      <div class="cardActions">
        <button class="btn ghost" data-act="dup" data-id="${c.id}">Duplicate</button>
        <button class="btn ghost" data-act="del" data-id="${c.id}">Delete</button>
      </div>
    `;
    elCards.appendChild(wrap);
  });
}

/* ---------- Editing ---------- */
elCards?.addEventListener("input", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLTextAreaElement)) return;
  const id = t.dataset.id;
  const side = t.dataset.side;
  const i = cards.findIndex((c) => c.id === id);
  if (i !== -1 && (side === "front" || side === "back")) {
    cards[i][side] = t.value;
    save(cards);
  }
});

elCards?.addEventListener("click", (e) => {
  const b = e.target;
  if (!(b instanceof HTMLButtonElement)) return;
  const id = b.dataset.id;
  const act = b.dataset.act;

  if (act === "del") cards = cards.filter((c) => c.id !== id);

  if (act === "dup") {
    const i = cards.findIndex((c) => c.id === id);
    if (i !== -1) {
      const c = cards[i];
      cards.splice(i + 1, 0, { id: uid(), front: c.front ?? "", back: c.back ?? "" });
    }
  }

  save(cards);
  render();
});

btnAdd?.addEventListener("click", () => {
  cards.unshift({ id: uid(), front: "", back: "" });
  save(cards);
  render();
});

/* ---------- EXPORT ---------- */
btnExport?.addEventListener("click", () => {
  const payload = JSON.stringify(cards, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `flashcards_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 500);
});

/* ---------- IMPORT JSON ---------- */
function normalizeImportedCards(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      id: typeof x.id === "string" && x.id.trim() ? x.id : uid(),
      front: typeof x.front === "string" ? x.front : "",
      back: typeof x.back === "string" ? x.back : "",
    }));
}

fileImport?.addEventListener("change", async (e) => {
  const input = e.currentTarget;
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = normalizeImportedCards(parsed);

    if (!incoming.length) {
      alert("Import failed: file had no valid cards (expected an array of {id, front, back}).");
      return;
    }

    // merge (avoid id collisions)
    const existingIds = new Set(cards.map((c) => c.id));
    const merged = incoming.map((c) =>
      existingIds.has(c.id) ? { ...c, id: uid() } : c
    );

    cards = merged;
    save(cards);
    render();
  } catch (err) {
    console.error(err);
    alert("Import failed: invalid JSON.");
  } finally {
    // allow importing the same file twice
    input.value = "";
  }
});

/* ---------- BULK IMPORT (Q:/A:) ---------- */
function openBulk() {
  if (!bulkModal) return;
  bulkModal.setAttribute("aria-hidden", "false");
}
function closeBulk() {
  if (!bulkModal) return;
  bulkModal.setAttribute("aria-hidden", "true");
}

btnBulk?.addEventListener("click", openBulk);
btnBulkClose?.addEventListener("click", closeBulk);

// click backdrop to close
bulkModal?.addEventListener("click", (e) => {
  if (e.target === bulkModal) closeBulk();
});

function parseBulkQA(text) {
  const lines = String(text || "").split(/\r?\n/);

  const out = [];
  let curQ = null;
  let curA = null;

  function pushIfValid() {
    if (curQ !== null && curA !== null) {
      const front = curQ.trim();
      const back = curA.trim();
      if (front || back) out.push({ id: uid(), front, back });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const qMatch = line.match(/^\s*Q:\s*(.*)$/i);
    const aMatch = line.match(/^\s*A:\s*(.*)$/i);

    if (qMatch) {
      // starting a new Q means previous card ends (if it had A)
      pushIfValid();
      curQ = qMatch[1] ?? "";
      curA = null;
      continue;
    }

    if (aMatch) {
      curA = aMatch[1] ?? "";
      continue;
    }

    // multiline support: append to last started section
    if (curA !== null) {
      curA += (curA.length ? "\n" : "") + line;
    } else if (curQ !== null) {
      curQ += (curQ.length ? "\n" : "") + line;
    }
  }

  pushIfValid();
  return out;
}

btnBulkImport?.addEventListener("click", () => {
  const incoming = parseBulkQA(bulkText?.value ?? "");
  if (!incoming.length) {
    alert("No valid Q:/A: pairs found.");
    return;
  }

  if (bulkReplace?.checked) {
    cards = incoming;
  } else {
    cards = [...incoming, ...cards];
  }

  save(cards);
  render();
  closeBulk();
});

/* ---------- PRINT ENGINE ---------- */
function remap(page, mode) {
  const p = [...page, null, null, null, null].slice(0, 4);
  if (mode === "swapRows") return [p[2], p[3], p[0], p[1]];
  if (mode === "swapCols") return [p[1], p[0], p[3], p[2]];
  if (mode === "rotate180") return [p[3], p[2], p[1], p[0]];
  return p;
}

function buildPrint(side, test = false) {
  if (!printRoot) return;

  printRoot.innerHTML = "";
  printRoot.className = "";

  if (getGuides()) printRoot.classList.add("guides");
  if (side === "back" && getBackRotate() === "180") printRoot.classList.add("back-rotate-180");

  const list = test
    ? Array.from({ length: 12 }, (_, i) => ({ front: `Q${i + 1}`, back: `A${i + 1}` }))
    : cards;

  let pages = chunk(list, 4);

  if (side === "back" && getBackOrder() === "reverse") pages = pages.reverse();
  if (side === "back") pages = pages.map((p) => remap(p, getBackMap()));

  pages.forEach((p) => {
    const sheet = document.createElement("div");
    sheet.className = "sheet";

    p.forEach((c) => {
      const box = document.createElement("div");
      box.className = "cardBox";

      const t = document.createElement("div");
      t.className = "printText";
      t.textContent = c ? c[side] ?? "" : "";

      box.appendChild(t);
      sheet.appendChild(box);

      requestAnimationFrame(() => fitText(t));
    });

    printRoot.appendChild(sheet);
  });
}

function doPrint(side, test = false) {
  if (!test && cards.length === 0) {
    alert("Add cards first.");
    return;
  }

  buildPrint(side, test);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => setTimeout(() => window.print(), 50))
  );
}

btnPrintFronts?.addEventListener("click", () => doPrint("front"));
btnPrintBacks?.addEventListener("click", () => doPrint("back"));
btnTestFront?.addEventListener("click", () => doPrint("front", true));
btnTestBack?.addEventListener("click", () => doPrint("back", true));

/* ---------- Init ---------- */
render();
