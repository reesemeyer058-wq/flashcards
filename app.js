const LS_KEY = "flashcards_3x5_letter_v2";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(cards) {
  localStorage.setItem(LS_KEY, JSON.stringify(cards));
}

let cards = load();

const elCards = document.getElementById("cards");
const elEmpty = document.getElementById("empty");

const btnAdd = document.getElementById("btnAdd");
const btnBulk = document.getElementById("btnBulk");
const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");

const btnPrintFronts = document.getElementById("btnPrintFronts");
const btnPrintBacks = document.getElementById("btnPrintBacks");
const btnTest = document.getElementById("btnTest");

const flipMode = document.getElementById("flipMode");
const backOrder = document.getElementById("backOrder");
const guides = document.getElementById("guides");
const printRoot = document.getElementById("printRoot");

/* Bulk modal */
const bulkModal = document.getElementById("bulkModal");
const btnBulkClose = document.getElementById("btnBulkClose");
const btnBulkImport = document.getElementById("btnBulkImport");
const bulkText = document.getElementById("bulkText");
const bulkReplace = document.getElementById("bulkReplace");

function render() {
  elCards.innerHTML = "";
  elEmpty.style.display = cards.length ? "none" : "block";

  cards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "cardItem";

    const top = document.createElement("div");
    top.className = "row";
    top.style.justifyContent = "space-between";
    top.innerHTML = `<strong>Card ${idx + 1}</strong><span class="muted">id: ${c.id.slice(0,6)}</span>`;
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
    cards.splice(cards.findIndex(x => x.id === id) + 1, 0, {
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

/* Mass Import: Q:/A: */
function parseQA(raw) {
  const text = (raw || "").replace(/\r\n/g, "\n");
  const re = /Q:\s*([\s\S]*?)\s*A:\s*([\s\S]*?)(?=\n\s*Q:|$)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const q = (m[1] || "").trim();
    const a = (m[2] || "").trim();
    if (q.length === 0 && a.length === 0) continue;
    out.push({ id: uid(), front: q, back: a });
  }
  return out;
}

/* Modal open/close */
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
    alert("No cards found. Make sure you have Q: and A: markers.");
    return;
  }
  cards = bulkReplace.checked ? parsed : parsed.concat(cards);
  save(cards);
  render();
  closeBulk();
  bulkText.value = "";
  bulkReplace.checked = false;
});

/* Printing */
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function buildPrintPages(side, useTest = false) {
  printRoot.innerHTML = "";

  printRoot.className = "";
  if (guides.checked) printRoot.classList.add("guides");
  if (side === "back" && flipMode.value === "long") printRoot.classList.add("flip-long");

  let list = cards.slice();

  if (useTest) {
    list = [
      { front: "FRONT (1)\n▲ TOP", back: "BACK (1)\n▲ TOP" },
      { front: "FRONT (2)\n▲ TOP", back: "BACK (2)\n▲ TOP" },
      { front: "FRONT (3)\n▲ TOP", back: "BACK (3)\n▲ TOP" },
      { front: "FRONT (4)\n▲ TOP", back: "BACK (4)\n▲ TOP" }
    ];
  } else {
    if (side === "back" && backOrder.value === "reverse") list.reverse();
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
    }

    printRoot.appendChild(sheet);
  });
}

function doPrint(side, useTest = false) {
  if (!useTest && cards.length === 0) {
    alert("Add at least one card first.");
    return;
  }
  buildPrintPages(side, useTest);
  setTimeout(() => window.print(), 50);
}

btnPrintFronts.addEventListener("click", () => doPrint("front"));
btnPrintBacks.addEventListener("click", () => doPrint("back"));
btnTest.addEventListener("click", () => {
  const which = prompt('Type "front" or "back" to print the test sheet:', "front");
  if (which === "back") doPrint("back", true);
  else doPrint("front", true);
});

render();
