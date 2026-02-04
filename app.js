/***********************
 * Flashcards — FIXED PRINT ENGINE
 * - Safe auto-fit (no freezes)
 * - Front / Back printing always works
 * - Alignment controls preserved
 ***********************/

const LS_KEY = "flashcards_full_robust_v1";

/* ---------- Utilities ---------- */
const uid = () =>
  Math.random().toString(16).slice(2) + Date.now().toString(16);

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
    arr.slice(i * n, i * n + n)
  );

const load = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const save = (cards) =>
  localStorage.setItem(LS_KEY, JSON.stringify(cards));

/* ---------- SAFE AUTO-FIT ---------- */
function fitText(el, minPt = 7) {
  if (!el) return;

  const box = el.parentElement;
  if (!box) return;

  // If layout isn't measurable yet, skip (CRITICAL FIX)
  if (box.clientHeight === 0 || box.clientWidth === 0) return;

  let size = 10;
  el.style.fontSize = size + "pt";

  let guard = 0;
  while (
    guard < 40 &&
    (el.scrollHeight > box.clientHeight ||
      el.scrollWidth > box.clientWidth) &&
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

  elEmpty.style.display = cards.length ? "none" : "block";
  countLabel.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;

  cards.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "cardItem";
    wrap.innerHTML = `
      <div class="cardTop">
        <strong>Card ${i + 1}</strong>
        <div class="id">${c.id.slice(0, 6)}</div>
      </div>
      <div class="cols">
        <textarea data-side="front" data-id="${c.id}" placeholder="Question…">${c.front ?? ""}</textarea>
        <textarea data-side="back" data-id="${c.id}" placeholder="Answer…">${c.back ?? ""}</textarea>
      </div>
      <div class="cardActions">
        <button data-act="dup" data-id="${c.id}">Duplicate</button>
        <button data-act="del" data-id="${c.id}">Delete</button>
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
  if (i !== -1) {
    cards[i][side] = t.value;
    save(cards);
  }
});

elCards?.addEventListener("click", (e) => {
  const b = e.target;
  if (!(b instanceof HTMLButtonElement)) return;
  const id = b.dataset.id;
  const act = b.dataset.act;

  if (act === "del") {
    cards = cards.filter((c) => c.id !== id);
  }
  if (act === "dup") {
    const i = cards.findIndex((c) => c.id === id);
    if (i !== -1) {
      const c = cards[i];
      cards.splice(i + 1, 0, { id: uid(), front: c.front, back: c.back });
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

/* ---------- PRINT ENGINE ---------- */
function remap(page, mode) {
  const p = [...page, null, null, null, null].slice(0, 4);
  if (mode === "swapRows") return [p[2], p[3], p[0], p[1]];
  if (mode === "swapCols") return [p[1], p[0], p[3], p[2]];
  if (mode === "rotate180") return [p[3], p[2], p[1], p[0]];
  return p;
}

function buildPrint(side, test = false) {
  printRoot.innerHTML = "";
  printRoot.className = "";

  if (getGuides()) printRoot.classList.add("guides");
  if (side === "back" && getBackRotate() === "180")
    printRoot.classList.add("back-rotate-180");

  let list = test
    ? Array.from({ length: 12 }, (_, i) => ({
        front: `Q${i + 1}`,
        back: `A${i + 1}`,
      }))
    : cards;

  let pages = chunk(list, 4);

  if (side === "back" && getBackOrder() === "reverse")
    pages = pages.reverse();

  if (side === "back")
    pages = pages.map((p) => remap(p, getBackMap()));

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

      // SAFELY defer fit
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
    requestAnimationFrame(() =>
      setTimeout(() => window.print(), 50)
    )
  );
}

/* Buttons */
btnPrintFronts?.addEventListener("click", () => doPrint("front"));
btnPrintBacks?.addEventListener("click", () => doPrint("back"));
btnTestFront?.addEventListener("click", () => doPrint("front", true));
btnTestBack?.addEventListener("click", () => doPrint("back", true));

/* ---------- Init ---------- */
render();
