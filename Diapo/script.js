const addTextBtn = document.getElementById("addTextBtn");
const addImageBtn = document.getElementById("addImageBtn");
const imageInput = document.getElementById("imageInput");
const slide = document.getElementById("slide");
const bgColorPicker = document.getElementById("bgColorPicker");
const bgImageBtn = document.getElementById("bgImageBtn");
const bgImageInput = document.getElementById("bgImageInput");
const floatingToolbar = document.getElementById("floatingToolbar");
 
// Éléments de formatage
const fontFamily = document.getElementById("fontFamily");
const fontSize = document.getElementById("fontSize");
const textColor = document.getElementById("textColor");
const highlightColor = document.getElementById("highlightColor");
const boldBtn = document.getElementById("boldBtn");
const italicBtn = document.getElementById("italicBtn");
const underlineBtn = document.getElementById("underlineBtn");
const highlightBtn = document.getElementById("highlightBtn");





slide.addEventListener("dblclick", (e) => {
  const bubble = e.target.closest(".bubble-box");
  if (!bubble) return;

  // Empêche que le double-clic déclenche d'autres comportements
  e.stopPropagation();

  const current = bubble.dataset.desc || "";
  const next = prompt("Modifier le texte de la bulle :", current);

  // Si l'utilisateur annule, on ne change rien
  if (next === null) return;

  saveState();
  bubble.dataset.desc = next.trim();
});



function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Force un élément à rester dans la slide (position + taille)
function keepInsideSlide(el) {
  const slideRect = slide.getBoundingClientRect();

  const w = el.offsetWidth;
  const h = el.offsetHeight;

  let left = parseFloat(el.style.left) || 0;
  let top  = parseFloat(el.style.top) || 0;

  left = clamp(left, 0, slideRect.width - w);
  top  = clamp(top,  0, slideRect.height - h);

  el.style.left = `${left}px`;
  el.style.top  = `${top}px`;
}



// Bulles 

const addBubbleBtn = document.getElementById("addBubbleBtn");
let addBubbleMode = false;



addBubbleBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  addBubbleMode = !addBubbleMode;
  addBubbleBtn.classList.toggle("active", addBubbleMode);
  addBubbleBtn.textContent = addBubbleMode ? "Cliquez sur la slide..." : "Ajouter une bulle";

  // Désactive le mode texte pour éviter conflit
  addMode = false;
  addTextBtn.classList.remove("active");
  addTextBtn.textContent = "Ajouter un texte";
});


function createBubble(x, y) {
  saveState();

  const desc = prompt("Texte de la bulle (affiché au survol) :") || "";

  const bubble = document.createElement("div");
  bubble.className = "bubble-box";
  bubble.dataset.desc = desc;

  // ✅ numéro séparé
  const num = document.createElement("span");
  num.className = "bubble-num";
  num.textContent = "?";

  // ✅ bouton supprimer
  const del = document.createElement("div");
  del.className = "delete-btn";
  del.textContent = "✕";

  bubble.appendChild(num);
  bubble.appendChild(del);

  bubble.style.left = `${x - 18}px`;
  bubble.style.top  = `${y - 18}px`;

  slide.appendChild(bubble);
  keepInsideSlide(bubble);

  setupDeleteBtn(bubble);

  renumberBubbles();
  activeItem = bubble;
}


function renumberBubbles() {
  const bubbles = slide.querySelectorAll(".bubble-box");
  bubbles.forEach((bubble, index) => {
    const num = bubble.querySelector(".bubble-num");
    if (num) num.textContent = index + 1;
  });
}





//Bulles
 
let addMode = false;
let activeItem = null;
let activeTextBox = null;
let dragging = null;
let resizing = null;
let rotating = null;
let offsetX = 0, offsetY = 0;
let startW = 0, startH = 0;
let startMouseX = 0, startMouseY = 0;
let startAngle = 0;
let currentRotation = 0;
 
// --- AJOUT TEXTE ---
addTextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    addMode = !addMode;
    addTextBtn.classList.toggle("active", addMode);
    addTextBtn.textContent = addMode ? "Cliquez sur la slide..." : "Ajouter un texte";
});
 
// --- AJOUT IMAGE ---
addImageBtn.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        createImageBox(reader.result);
    };
    reader.readAsDataURL(file);
    imageInput.value = "";
});
 
function createImageBox(src) {
    saveState();
    const box = document.createElement("div");
    box.className = "image-box";
    box.style.width = "260px";
    box.style.height = "180px";
    box.innerHTML = `<img src="${src}"><div class="resize-handle"></div><div class="delete-btn">✕</div><div class="rotate-handle">↻</div>`;
   
    const slideRect = slide.getBoundingClientRect();
    box.style.left = `${(slideRect.width - 260) / 2}px`;
    box.style.top = `${(slideRect.height - 180) / 2}px`;
   
    slide.appendChild(box);
    keepInsideSlide(box);

    setupDeleteBtn(box);
    activeItem = box;
}
 
// --- AJOUT FORME ---
function addShape(type) {
    saveState();
    const box = document.createElement("div");
    box.className = `shape-box ${type}`;
    box.style.width = "150px";
    box.style.height = "150px";
    box.innerHTML = `<div class="shape-content"></div><div class="resize-handle"></div><div class="delete-btn">✕</div>`;
   
    const slideRect = slide.getBoundingClientRect();
    box.style.left = `${(slideRect.width - 150) / 2}px`;
    box.style.top = `${(slideRect.height - 150) / 2}px`;
   
    slide.appendChild(box);
    keepInsideSlide(box);

    setupDeleteBtn(box);
    activeItem = box;
}
 
// --- GESTION DES CLICS (UNIFIÉE) ---
slide.addEventListener("click", (e) => {
    const obj = e.target.closest(".text-box, .image-box, .shape-box, .bubble-box");

 
    // Retirer la bordure de l'ancien élément
    document.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
 
    if (obj) {
        activeItem = obj;
        obj.classList.add("selected"); // Ajouter la classe visuelle
        if (!obj.classList.contains("text-box")) slide.appendChild(obj);
        return;
    }
 
    activeItem = null;


    // 1) Créer une bulle si on est en mode bulle
if (addBubbleMode && e.target === slide) {
  const rect = slide.getBoundingClientRect();
  createBubble(e.clientX - rect.left, e.clientY - rect.top);

  addBubbleMode = false;
  addBubbleBtn.classList.remove("active");
  addBubbleBtn.textContent = "Ajouter une bulle";
  return;
}

 
    // 2. Créer du texte si on est en "addMode"
    if (addMode && e.target === slide) {
        saveState();
        const rect = slide.getBoundingClientRect();
        const box = document.createElement("div");
        box.className = "text-box";
        box.innerHTML = `<div class="content" contenteditable="false">Double-cliquez pour modifier</div><div class="delete-btn">✕</div><div class="rotate-handle">↻</div>`;
        box.style.left = `${e.clientX - rect.left - 75}px`;
        box.style.top = `${e.clientY - rect.top - 20}px`;
       
        slide.appendChild(box);
        keepInsideSlide(box);

        setupDeleteBtn(box);
       
        activeItem = box;
        addMode = false;
        addTextBtn.textContent = "Ajouter un texte";
        addTextBtn.classList.remove("active");
    }
});
 
// --- DRAG, RESIZE ET ROTATION ---
slide.addEventListener("mousedown", (e) => {
    // 1) RESIZE
    const handle = e.target.closest(".resize-handle");
    if (handle) {
        resizing = handle.parentElement;
        const rect = resizing.getBoundingClientRect();
        startW = rect.width;
        startH = rect.height;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        e.preventDefault();
        return;
    }
 
    // 2) ROTATION
    const rotateHandle = e.target.closest(".rotate-handle");
    if (rotateHandle) {
        rotating = rotateHandle.parentElement;
        activeItem = rotating;
       
        const rect = rotating.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
       
        startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
       
        const transform = rotating.style.transform;
        const match = transform.match(/rotate\((-?\d+\.?\d*)deg\)/);
        currentRotation = match ? parseFloat(match[1]) : 0;
       
        e.preventDefault();
        return;
    }
 
    // 3) DRAG
    const target = e.target.closest(".text-box, .image-box, .shape-box, .bubble-box");

    if (!target || (e.target.classList.contains("content") && e.target.isContentEditable)) return;
 
    dragging = target;
    activeItem = target;
    const rect = dragging.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
});
// --- SUPPRESSION AU CLAVIER ---
window.addEventListener("keydown", (e) => {
    // On vérifie si un élément est sélectionné
    if (!activeItem) return;
 
    // Si on appuie sur 'Delete' ou 'Backspace' (ou 'Enter' selon votre préférence)
    if (e.key === "Delete" || e.key === "Backspace") {
       
        // Empêcher la suppression si on est en train d'écrire dans un texte
        const isEditing = document.activeElement &&
                         document.activeElement.classList.contains("content") &&
                         document.activeElement.isContentEditable;
       
        if (isEditing) return;
 
        // Supprimer l'élément
        saveState();
        activeItem.remove();
        activeItem = null;
       
        // Cacher la toolbar si c'était un texte
        hideToolbar();
       
        e.preventDefault(); // Empêche le retour arrière du navigateur
    }
});
 
window.addEventListener("mousemove", (e) => {
    // RESIZE
    if (resizing) {
        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;
        resizing.style.width = `${Math.max(30, startW + dx)}px`;
        resizing.style.height = `${Math.max(30, startH + dy)}px`;
        return;
    }
 
    // ROTATION
    if (rotating) {
        const rect = rotating.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
       
        const newAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const angleDiff = (newAngle - startAngle) * (180 / Math.PI);
        const finalRotation = currentRotation + angleDiff;
       
        rotating.style.transform = `rotate(${finalRotation}deg)`;
        return;
    }
 
    // DRAG
   if (dragging) {
    const slideRect = slide.getBoundingClientRect();
    let newLeft = e.clientX - slideRect.left - offsetX;
    let newTop  = e.clientY - slideRect.top  - offsetY;

    const elW = dragging.offsetWidth;
    const elH = dragging.offsetHeight;

    newLeft = clamp(newLeft, 0, slideRect.width - elW);
    newTop  = clamp(newTop,  0, slideRect.height - elH);

    dragging.style.left = `${newLeft}px`;
    dragging.style.top  = `${newTop}px`;

    if (dragging === activeTextBox) showToolbar(dragging);
}

});
 
 
window.addEventListener("mouseup", () => {
    if (rotating) {
        saveState();
    }
    dragging = null;
    resizing = null;
    rotating = null;
});
 
// --- SUPPRESSION ---
function setupDeleteBtn(box) {
  const btn = box.querySelector(".delete-btn");
  btn.onclick = (ev) => {
    ev.stopPropagation();
    saveState();
    box.remove();

    // 🔑 renuméroter après suppression
    renumberBubbles();

    if (activeItem === box) activeItem = null;
  };
}

 
// --- ÉDITION TEXTE ---
slide.addEventListener("dblclick", (e) => {
    const content = e.target.closest(".content");
    if (content) {
        const parentBox = content.closest(".text-box");
        activateTextBox(parentBox, content);
    }
});
 
function activateTextBox(box, content) {
    if (activeTextBox && activeTextBox !== box) {
        activeTextBox.querySelector(".content").contentEditable = "false";
    }
    activeTextBox = box;
    content.contentEditable = "true";
    content.focus();
    showToolbar(box);
}
 
function showToolbar(box) {
    const boxRect = box.getBoundingClientRect();
    const workspaceRect = document.querySelector(".workspace").getBoundingClientRect();
    floatingToolbar.style.left = `${boxRect.left - workspaceRect.left}px`;
    floatingToolbar.style.top = `${boxRect.top - workspaceRect.top - 60}px`;
    floatingToolbar.classList.add("visible");
}
 
function hideToolbar() {
    floatingToolbar.classList.remove("visible");
    if (activeTextBox) {
        activeTextBox.querySelector(".content").contentEditable = "false";
        activeTextBox = null;
    }
}
 
// Fermer toolbar
document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".text-box") && !e.target.closest(".floating-toolbar") && !e.target.closest(".top-toolbar")) {
        hideToolbar();
    }
});
 
// --- BACKGROUNDS ---
bgColorPicker.addEventListener("input", (e) => {
    saveState();
    slide.style.backgroundImage = "none";
    slide.style.backgroundColor = e.target.value;
});
 
bgImageBtn.addEventListener("click", () => bgImageInput.click());
bgImageInput.addEventListener("change", () => {
    const file = bgImageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        saveState();
        slide.style.backgroundImage = `url(${reader.result})`;
        slide.style.backgroundSize = "cover";
    };
    reader.readAsDataURL(file);
});
 
// --- FORMATAGE (Simplifié) ---
function formatText(cmd, val = null) {
    if (activeItem && activeItem.classList.contains("shape-box") && cmd === "foreColor") {
        saveState();
        activeItem.querySelector(".shape-content").style.backgroundColor = val;
    } else {
        saveState();
        document.execCommand(cmd, false, val);
    }
}
 
document.getElementById("topTextColor").addEventListener("input", (e) => formatText("foreColor", e.target.value));
document.getElementById("topBoldBtn").onclick = () => formatText("bold");
 
// --- HISTORIQUE (Save state) ---
function saveState() {
    historyStack.push({
        innerHTML: slide.innerHTML,
        bg: slide.style.backgroundColor,
        img: slide.style.backgroundImage
    });
}
let historyStack = [];
 
// Initialisation
reattachEventListeners();
function reattachEventListeners() {
    document.querySelectorAll(".text-box, .image-box, .shape-box, .bubble-box").forEach(setupDeleteBtn);

}