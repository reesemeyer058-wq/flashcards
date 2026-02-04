const LS_KEY = "flashcards_clean_v1";

function uid(){
  return Math.random().toString(16).slice(2);
}

let cards = JSON.parse(localStorage.getItem(LS_KEY) || "[]");

const elCards = document.getElementById("cards");
const elEmpty = document.getElementById("empty");
const printRoot = document.getElementById("printRoot");

const btnAdd = document.getElementById("btnAdd");
const btnBulk = document.getElementById("btnBulk");
const btnPrintFronts = document.getElementById("btnPrintFronts");
const btnPrintBacks = document.getElementById("btnPrintBacks");
const btnTest = document.getElementById("btnTest");

const bulkModal = document.getElementById("bulkModal");
const bulkText = document.getElementById("bulkText");
const btnBulkImport = document.getElementById("btnBulkImport");
const btnBulkClose = document.getElementById("btnBulkClose");

function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(cards));
}

function render(){
  elCards.innerHTML = "";
  elEmpty.style.display = cards.length ? "none" : "block";

  cards.forEach(c=>{
    const d = document.createElement("div");
    d.className = "card";
    d.innerHTML = `
      <textarea data-side="front" data-id="${c.id}">${c.front}</textarea>
      <textarea data-side="back" data-id="${c.id}">${c.back}</textarea>
    `;
    elCards.appendChild(d);
  });
}

elCards.addEventListener("input", e=>{
  const t = e.target;
  const id = t.dataset.id;
  const side = t.dataset.side;
  const card = cards.find(c=>c.id===id);
  if(card){ card[side] = t.value; save(); }
});

btnAdd.onclick = ()=>{
  cards.unshift({ id:uid(), front:"", back:"" });
  save(); render();
};

btnBulk.onclick = ()=> bulkModal.setAttribute("aria-hidden","false");
btnBulkClose.onclick = ()=> bulkModal.setAttribute("aria-hidden","true");

btnBulkImport.onclick = ()=>{
  const text = bulkText.value.replace(/\r\n/g,"\n");
  const re = /Q:\s*([\s\S]*?)\s*A:\s*([\s\S]*?)(?=\n\s*Q:|$)/g;
  let m;
  while((m=re.exec(text))){
    cards.push({ id:uid(), front:m[1].trim(), back:m[2].trim() });
  }
  bulkText.value="";
  save(); render();
  bulkModal.setAttribute("aria-hidden","true");
};

function fitText(el){
  let size = 10;
  el.style.fontSize = size+"pt";
  while(el.scrollHeight > el.clientHeight && size > 7){
    size -= .25;
    el.style.fontSize = size+"pt";
  }
}

function print(side, test=false){
  printRoot.innerHTML = "";
  const list = test
    ? [
        {front:"Q1",back:"A1"},
        {front:"Q2",back:"A2"},
        {front:"Q3",back:"A3"},
        {front:"Q4",back:"A4"}
      ]
    : cards;

  for(let i=0;i<list.length;i+=4){
    const sheet = document.createElement("div");
    sheet.className="sheet";
    for(let j=0;j<4;j++){
      const box = document.createElement("div");
      box.className="cardBox";
      const txt = document.createElement("div");
      txt.className="printText";
      txt.textContent = list[i+j]?.[side] || "";
      box.appendChild(txt);
      sheet.appendChild(box);
      fitText(txt);
    }
    printRoot.appendChild(sheet);
  }
  setTimeout(()=>window.print(),50);
}

btnPrintFronts.onclick = ()=> print("front");
btnPrintBacks.onclick = ()=> print("back");
btnTest.onclick = ()=> print("front", true);

render();
