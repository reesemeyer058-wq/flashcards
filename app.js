/***********************
 * Flashcards — printer-adaptive version
 * You keep your physical method; software adapts:
 * - backOrder: reverse by sheets (pages of 4)
 * - backMap: remap positions within each sheet (fixes Q1->A3 etc)
 * - backRotate: rotate back 180 to fix upside-down
 ***********************/

const LS_KEY = "flashcards_printer_adaptive_v1";

/* utilities */
function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function chunk(arr, n){ const out=[]; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; }

function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  }catch{ return []; }
}
function save(cards){ localStorage.setItem(LS_KEY, JSON.stringify(cards)); }

function fitText(el, minPt=7){
  let size = 10;
  el.style.fontSize = size + "pt";
  while(el.scrollHeight > el.clientHeight && size > minPt){
    size -= 0.25;
    el.style.fontSize = size + "pt";
  }
}

/* state */
let cards = load();

/* DOM */
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

const backOrder = document.getElementById("backOrder");   // same | reverse
const backMap = document.getElementById("backMap");       // none | swapRows | swapCols | rotate180
const backRotate = document.getElementById("backRotate"); // 0 | 180
const guides = document.getElementById("guides");

const printRoot = document.getElementById("printRoot");

/* bulk modal */
const bulkModal = document.getElementById("bulkModal");
const btnBulkClose = document.getElementById("btnBulkClose");
const btnBulkImport = document.getElementById("btnBulkImport");
const bulkText = document.getElementById("bulkText");
const bulkReplace = document.getElementById("bulkReplace");

/* render */
function render(){
  elCards.innerHTML = "";
  elEmpty.style.display = cards.length ? "none" : "block";
  countLabel.textContent = `${cards.length} card${cards.length===1?"":"s"}`;

  cards.forEach((c, idx)=>{
    const wrap = document.createElement("div");
    wrap.className = "cardItem";
    wrap.innerHTML = `
      <div class="cardTop">
        <strong>Card ${idx+1}</strong>
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

function upsert(id, side, value){
  const i = cards.findIndex(x=>x.id===id);
  if(i===-1) return;
  cards[i] = { ...cards[i], [side]: value };
  save(cards);
}

elCards.addEventListener("input", (e)=>{
  const t = e.target;
  if(!(t instanceof HTMLTextAreaElement)) return;
  const id = t.getAttribute("data-id");
  const side = t.getAttribute("data-side");
  if(!id || !side) return;
  upsert(id, side, t.value);
});

elCards.addEventListener("click", (e)=>{
  const btn = e.target;
  if(!(btn instanceof HTMLButtonElement)) return;
  const act = btn.getAttribute("data-act");
  const id = btn.getAttribute("data-id");
  if(!act || !id) return;

  if(act==="del"){
    cards = cards.filter(x=>x.id!==id);
    save(cards);
    render();
  }
  if(act==="dup"){
    const i = cards.findIndex(x=>x.id===id);
    if(i===-1) return;
    const c = cards[i];
    cards.splice(i+1, 0, { id: uid(), front: c.front ?? "", back: c.back ?? "" });
    save(cards);
    render();
  }
});

btnAdd.addEventListener("click", ()=>{
  cards.unshift({ id: uid(), front: "", back: "" });
  save(cards);
  render();
});

/* export/import */
btnExport.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "flashcards.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

fileImport.addEventListener("change", async ()=>{
  const f = fileImport.files?.[0];
  if(!f) return;
  try{
    const text = await f.text();
    const data = JSON.parse(text);
    if(!Array.isArray(data)) throw new Error("not array");
    cards = data.map(x=>({ id: x.id || uid(), front: String(x.front??""), back: String(x.back??"") }));
    save(cards);
    render();
  }catch{
    alert("Import failed. Use a JSON export from this app.");
  }finally{
    fileImport.value = "";
  }
});

/* bulk Q/A */
function parseQA(raw){
  const text = (raw||"").replace(/\r\n/g,"\n");
  const re = /Q:\s*([\s\S]*?)\s*A:\s*([\s\S]*?)(?=\n\s*Q:|$)/g;
  const out = [];
  let m;
  while((m = re.exec(text)) !== null){
    const q = (m[1]||"").trim();
    const a = (m[2]||"").trim();
    if(!q && !a) continue;
    out.push({ id: uid(), front: q, back: a });
  }
  return out;
}
function openBulk(){ bulkModal.setAttribute("aria-hidden","false"); bulkText.focus(); }
function closeBulk(){ bulkModal.setAttribute("aria-hidden","true"); }

btnBulk.addEventListener("click", openBulk);
btnBulkClose.addEventListener("click", closeBulk);
bulkModal.addEventListener("click", (e)=>{ if(e.target===bulkModal) closeBulk(); });

btnBulkImport.addEventListener("click", ()=>{
  const parsed = parseQA(bulkText.value);
  if(parsed.length===0){ alert('No cards found. Use "Q:" and "A:".'); return; }
  cards = bulkReplace.checked ? parsed : parsed.concat(cards);
  save(cards);
  render();
  bulkText.value="";
  bulkReplace.checked=false;
  closeBulk();
});

/* ---------- printing core ---------- */

/**
 * Apply within-sheet remap to a 4-card page.
 * Positions:
 *   0=top-left (Q1), 1=top-right (Q2), 2=bottom-left (Q3), 3=bottom-right (Q4)
 */
function remapPage(cards4, mode){
  const a = cards4.slice();
  const out = ["","","",""].map(()=>null);

  // if fewer than 4, pad with nulls
  while(a.length < 4) a.push(null);

  if(mode === "swapRows"){
    // 0<->2, 1<->3
    out[0]=a[2]; out[1]=a[3]; out[2]=a[0]; out[3]=a[1];
    return out;
  }
  if(mode === "swapCols"){
    // 0<->1, 2<->3
    out[0]=a[1]; out[1]=a[0]; out[2]=a[3]; out[3]=a[2];
    return out;
  }
  if(mode === "rotate180"){
    // 0<->3, 1<->2
    out[0]=a[3]; out[1]=a[2]; out[2]=a[1]; out[3]=a[0];
    return out;
  }
  // none
  return a;
}

function buildPrint(side, useTest=false){
  printRoot.innerHTML = "";

  // print classes
  printRoot.className = "";
  if(guides.checked) printRoot.classList.add("guides");
  if(side==="back" && backRotate.value === "180") printRoot.classList.add("back-rotate-180");

  let list;
  if(useTest){
    // 12 test cards (3 sheets) with quadrant labels
    list = [
      { front:"Q1 — TOP LEFT", back:"A1 — TOP LEFT" },
      { front:"Q2 — TOP RIGHT", back:"A2 — TOP RIGHT" },
      { front:"Q3 — BOTTOM LEFT", back:"A3 — BOTTOM LEFT" },
      { front:"Q4 — BOTTOM RIGHT", back:"A4 — BOTTOM RIGHT" },
      { front:"Q5 — P2 TOP LEFT", back:"A5 — P2 TOP LEFT" },
      { front:"Q6 — P2 TOP RIGHT", back:"A6 — P2 TOP RIGHT" },
      { front:"Q7 — P2 BOTTOM LEFT", back:"A7 — P2 BOTTOM LEFT" },
      { front:"Q8 — P2 BOTTOM RIGHT", back:"A8 — P2 BOTTOM RIGHT" },
      { front:"Q9 — P3 TOP LEFT", back:"A9 — P3 TOP LEFT" },
      { front:"Q10 — P3 TOP RIGHT", back:"A10 — P3 TOP RIGHT" },
      { front:"Q11 — P3 BOTTOM LEFT", back:"A11 — P3 BOTTOM LEFT" },
      { front:"Q12 — P3 BOTTOM RIGHT", back:"A12 — P3 BOTTOM RIGHT" }
    ];
  }else{
    list = cards.slice();
  }

  // split into pages of 4
  let pages = chunk(list, 4);

  // deck order adjustment (reverse by sheets)
  if(side==="back" && backOrder.value === "reverse"){
    pages = pages.slice().reverse();
  }

  // within-sheet remap (fixes Q1->A3, etc.)
  if(side==="back" && backMap.value !== "none"){
    pages = pages.map(p => remapPage(p, backMap.value));
  }

  // render pages
  pages.forEach((pageCards)=>{
    const sheet = document.createElement("div");
    sheet.className = "sheet";

    for(let i=0;i<4;i++){
      const c = pageCards[i];

      const box = document.createElement("div");
      box.className = "cardBox";

      const text = document.createElement("div");
      text.className = "printText";
      text.textContent = c ? (side==="front" ? (c.front??"") : (c.back??"")) : "";

      box.appendChild(text);
      sheet.appendChild(box);
      fitText(text);
    }

    printRoot.appendChild(sheet);
  });
}

function doPrint(side, useTest=false){
  if(!useTest && cards.length===0){
    alert("Add or import at least one card first.");
    return;
  }
  buildPrint(side, useTest);

  // reliable print trigger
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    setTimeout(()=>window.print(), 60);
  }));
}

/* print buttons */
btnPrintFronts.addEventListener("click", ()=>doPrint("front"));
btnPrintBacks.addEventListener("click", ()=>doPrint("back"));
btnTestFront.addEventListener("click", ()=>doPrint("front", true));
btnTestBack.addEventListener("click", ()=>doPrint("back", true));

/* start */
render();
