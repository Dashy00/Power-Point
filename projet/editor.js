// --- VARIABLES ET ÉLÉMENTS ---
const addTextBtn = document.getElementById("addTextBtn");
const addImageBtn = document.getElementById("addImageBtn");
const imageInput = document.getElementById("imageInput");
const slide = document.getElementById("editable-slide");
const bgColorPicker = document.getElementById("bgColorPicker");
const bgImageBtn = document.getElementById("bgImageBtn");
const bgImageInput = document.getElementById("bgImageInput");
const floatingToolbar = document.getElementById("floatingToolbar");
const slideNumberInput = document.getElementById("slideNumber");

const fontFamily = document.getElementById("fontFamily");
const fontSize = document.getElementById("fontSize");
const textColor = document.getElementById("textColor");
const highlightColor = document.getElementById("highlightColor");
const boldBtn = document.getElementById("boldBtn");
const italicBtn = document.getElementById("italicBtn");
const underlineBtn = document.getElementById("underlineBtn");
const highlightBtn = document.getElementById("highlightBtn");

// Variables d'état pour les manipulations
let dragging = null,
  resizing = null,
  rotating = null;
let offsetX = 0,
  offsetY = 0;
let startW = 0,
  startH = 0;
let startMouseX = 0,
  startMouseY = 0;
let startAngle = 0,
  currentRotation = 0;
let editorZoom = 1;
let addMode = false;
let addBubbleMode = false;
let activeTextBox = null;
let addBubbleBtn = document.getElementById("addBubbleBtn");

// --- AJOUT : COPY / PASTE (CTRL+C / CTRL+V) ---
let itemClipboard = null; // mémoire locale
const PASTE_OFFSET = 20;

function isEditingText() {
  // Si on est en train d’éditer du texte (contenteditable / input / textarea), on ne doit pas intercepter
  const ae = document.activeElement;
  if (!ae) return false;
  if (ae.isContentEditable) return true;
  const tag = ae.tagName ? ae.tagName.toLowerCase() : "";
  return tag === "input" || tag === "textarea";
}

function ensureHandlesIfNeeded(div) {
  // votre createItem n’ajoute pas de handles aux link-button
  if (div.classList.contains("link-button")) return;

  // Si l'élément collé n'a pas les poignées (au cas où), on les ajoute
  if (!div.querySelector(".resize-handle")) {
    const rh = document.createElement("div");
    rh.className = "resize-handle";
    div.appendChild(rh);
  }
  if (!div.querySelector(".delete-btn")) {
    const db = document.createElement("div");
    db.className = "delete-btn";
    db.textContent = "✕";
    div.appendChild(db);
  }
  if (!div.querySelector(".rotate-handle")) {
    const rot = document.createElement("div");
    rot.className = "rotate-handle";
    rot.textContent = "↻";
    div.appendChild(rot);
  }
}

function getItemSnapshot(el) {
  // on capture ce qu'il faut pour reconstruire l'élément
  const style = window.getComputedStyle(el);

  // on privilégie les styles inline si présents, sinon computed
  const left = el.style.left || style.left || "0px";
  const top = el.style.top || style.top || "0px";
  const width = el.style.width || style.width || "150px";
  const height = el.style.height || style.height || "50px";
  const transform = el.style.transform || style.transform || "";

  // dataset (bulle etc.)
  const dataset = {};
  Object.keys(el.dataset || {}).forEach((k) => (dataset[k] = el.dataset[k]));

  return {
    className: el.className, // inclut item-box + type
    innerHTML: el.innerHTML,
    style: { left, top, width, height, transform },
    dataset,
  };
}

function pasteSnapshot(snapshot) {
  if (!snapshot) return;

  saveState();

  const div = document.createElement("div");
  div.className = snapshot.className;

  // Reconstitue le contenu
  div.innerHTML = snapshot.innerHTML;

  // Styles
  div.style.width = snapshot.style.width;
  div.style.height = snapshot.style.height;
  div.style.transform = snapshot.style.transform;

  // Position (décalage)
  const leftNum = parseFloat(snapshot.style.left) || 0;
  const topNum = parseFloat(snapshot.style.top) || 0;
  div.style.left = `${leftNum + PASTE_OFFSET}px`;
  div.style.top = `${topNum + PASTE_OFFSET}px`;

  // Dataset
  Object.keys(snapshot.dataset || {}).forEach((k) => {
    div.dataset[k] = snapshot.dataset[k];
  });

  // Au cas où (handles manquants)
  ensureHandlesIfNeeded(div);

  slide.appendChild(div);
  attachItemEvents(div);

  // Sélectionner l'élément collé
  document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
  div.classList.add("selected");
  state.activeItem = div;

  renumberBubbles();
}

// --- SYSTÈME UNDO / REDO ---
let historyStack = [];
let redoStack = [];

function saveState() {
  // On enregistre l'état actuel avant modification
  historyStack.push({
    innerHTML: slide.innerHTML,
    bg: slide.style.backgroundColor,
    img: slide.style.backgroundImage,
  });
  // Limite l'historique pour les performances
  if (historyStack.length > 40) historyStack.shift();
  redoStack = []; // On vide le redo car une nouvelle action est faite
}

function undo() {
  if (historyStack.length === 0) return;
  redoStack.push({
    innerHTML: slide.innerHTML,
    bg: slide.style.backgroundColor,
    img: slide.style.backgroundImage,
  });
  const stateData = historyStack.pop();
  applyState(stateData);
}

function redo() {
  if (redoStack.length === 0) return;
  historyStack.push({
    innerHTML: slide.innerHTML,
    bg: slide.style.backgroundColor,
    img: slide.style.backgroundImage,
  });
  const stateData = redoStack.pop();
  applyState(stateData);
}

function applyState(stateData) {
  slide.innerHTML = stateData.innerHTML;
  slide.style.backgroundColor = stateData.bg;
  slide.style.backgroundImage = stateData.img;
  reattachEventListeners();
  renumberBubbles();
}

// --- OUVERTURE / FERMETURE ---
function openEditor(slideId) {
  state.currentEditingId = slideId;
  const data = state.slidesContent[slideId] || { html: "", bg: "#ffffff", bgImg: "", slideNum: "" };
  slide.innerHTML = data.html;
  slide.style.backgroundColor = data.bg;
  slide.style.backgroundImage = data.bgImg || "";
  bgColorPicker.value = data.bg || "#ffffff";
  if (slideNumberInput) slideNumberInput.value = data.slideNum || "";

  historyStack = []; // Reset l'historique pour cette slide
  redoStack = [];

  reattachEventListeners();
  editorOverlay.style.display = "flex";
}

document.getElementById("btn-close-editor").onclick = () => {
  if (state.currentEditingId) {
    state.slidesContent[state.currentEditingId] = {
      html: slide.innerHTML,
      bg: slide.style.backgroundColor,
      bgImg: slide.style.backgroundImage,
      slideNum: slideNumberInput ? slideNumberInput.value : "",
    };
    if (window.updateNodePreview) window.updateNodePreview(state.currentEditingId);
  }
  editorOverlay.style.display = "none";
  state.currentEditingId = null;
};

// --- GESTION DES ITEMS ---
function createItem(html, className, w = 150, h = 50) {
  saveState();
  const div = document.createElement("div");
  div.className = `item-box ${className}`;
  div.style.width = w + "px";
  div.style.height = h + "px";
  div.style.left = "50px";
  div.style.top = "50px";
  div.innerHTML =
    html +
    (className.includes("link-button")
      ? ""
      : `<div class="resize-handle"></div><div class="delete-btn">✕</div><div class="rotate-handle">↻</div>`);
  slide.appendChild(div);
  attachItemEvents(div);
}

function addEditorShape(type) {
  let content = "";
  if (type === "square")
    content = `<div class="shape-content" style="background:#8d6e63; width:100%; height:100%;"></div>`;
  else if (type === "circle")
    content = `<div class="shape-content" style="background:#8d6e63; width:100%; height:100%; border-radius:50%;"></div>`;
  else if (type === "triangle")
    content = `<div class="shape-content" style="background:#8d6e63; width:100%; height:100%; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div>`;
  else if (type === "arrow")
    content = `<div class="shape-content" style="background:#8d6e63; width:100%; height:100%; clip-path: polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%);"></div>`;

  createItem(content, `shape-box ${type}`, 100, 100);
}

// --- ÉVÉNEMENTS SOURIS (DRAG, RESIZE, ROTATE) ---
slide.addEventListener("mousedown", (e) => {
  const item = e.target.closest(".item-box, .text-box, .image-box, .shape-box, .bubble-box, .link-button");
  const handle = e.target.closest(".resize-handle, .rotate-handle");

  if (!item && !handle) {
    document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
    state.activeItem = null;
    return;
  }

  // SAUVEGARDE AVANT TOUTE ACTION
  saveState();

  if (e.target.classList.contains("resize-handle")) {
    resizing = item;
    const rect = resizing.getBoundingClientRect();
    startW = rect.width / editorZoom;
    startH = rect.height / editorZoom;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    e.preventDefault();
  } else if (e.target.classList.contains("rotate-handle")) {
    rotating = item;
    const rect = rotating.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const transform = rotating.style.transform;
    const match = transform.match(/rotate\((-?\d+\.?\d*)deg\)/);
    currentRotation = match ? parseFloat(match[1]) : 0;
    e.preventDefault();
  } else if (item) {
    if (e.target.classList.contains("content") && e.target.isContentEditable) return;
    dragging = item;
    state.activeItem = item;
    document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
    item.classList.add("selected");
    const rect = dragging.getBoundingClientRect();
    offsetX = (e.clientX - rect.left) / editorZoom;
    offsetY = (e.clientY - rect.top) / editorZoom;
    e.preventDefault();
  }
});

window.addEventListener("mousemove", (e) => {
  if (resizing) {
    const dx = (e.clientX - startMouseX) / editorZoom;
    const dy = (e.clientY - startMouseY) / editorZoom;
    resizing.style.width = `${Math.max(30, startW + dx)}px`;
    resizing.style.height = `${Math.max(30, startH + dy)}px`;
  } else if (rotating) {
    const rect = rotating.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const newAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const angleDiff = (newAngle - startAngle) * (180 / Math.PI);
    rotating.style.transform = `rotate(${currentRotation + angleDiff}deg)`;
  } else if (dragging) {
    const slideRect = slide.getBoundingClientRect();
    dragging.style.left = `${(e.clientX - slideRect.left) / editorZoom - offsetX}px`;
    dragging.style.top = `${(e.clientY - slideRect.top) / editorZoom - offsetY}px`;
    if (dragging === activeTextBox) showToolbar(dragging);
  }
});

window.addEventListener("mouseup", () => {
  dragging = null;
  resizing = null;
  rotating = null;
});

// --- ATTACHEMENT DES ÉVÉNEMENTS AUX BOXES ---
function attachItemEvents(div) {
  const delBtn = div.querySelector(".delete-btn");
  if (delBtn) {
    delBtn.onclick = (e) => {
      e.stopPropagation();
      saveState();
      if (div.classList.contains("link-button")) handleLinkDelete(div);
      div.remove();
      renumberBubbles();
      state.activeItem = null;
    };
  }

  if (div.classList.contains("link-button")) {
    div.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      saveState();
      div.classList.toggle("square");
      div.classList.toggle("round");
    });
  }
}

function reattachEventListeners() {
  slide
    .querySelectorAll(".item-box, .text-box, .image-box, .shape-box, .bubble-box, .link-button")
    .forEach(attachItemEvents);
}

// --- TEXTE ET BULLES ---
addTextBtn.addEventListener("click", () =>
  createItem(`<div class="content" contenteditable="true">Texte...</div>`, "text-box")
);

// Gestion du double-clic sur le texte pour afficher la barre d'outils
slide.addEventListener("dblclick", (e) => {
  const textBox = e.target.closest(".text-box");
  if (textBox) {
    const content = textBox.querySelector(".content");
    if (content) {
      activateTextBox(textBox, content);
      e.stopPropagation();
    }
  }
});

function activateTextBox(box, content) {
  if (activeTextBox && activeTextBox !== box) {
    activeTextBox.querySelector(".content").contentEditable = "false";
  }
  activeTextBox = box;
  state.activeItem = box;
  content.contentEditable = "true";
  content.focus();
  showToolbar(box);
}

function showToolbar(box) {
  // Afficher la barre d'outils
  floatingToolbar.classList.add("visible");

  // Positionner la barre relative à la zone de travail
  const boxRect = box.getBoundingClientRect();
  const slideRect = document.querySelector(".overlay-workspace").getBoundingClientRect();

  let left = boxRect.left - slideRect.left;
  let top = boxRect.top - slideRect.top - 50;

  // Vérifier que la barre n'est pas hors limites
  if (left + floatingToolbar.offsetWidth > slideRect.width) {
    left = slideRect.width - floatingToolbar.offsetWidth - 10;
  }
  if (left < 0) left = 10;
  if (top < 0) top = boxRect.top - slideRect.top + boxRect.height + 10;

  floatingToolbar.style.left = `${left}px`;
  floatingToolbar.style.top = `${top}px`;
}

function hideToolbar() {
  floatingToolbar.classList.remove("visible");
  if (activeTextBox) {
    activeTextBox.querySelector(".content").contentEditable = "false";
    activeTextBox = null;
  }
}

// Fermer la barre d'outils quand on clique ailleurs
document.addEventListener(
  "mousedown",
  (e) => {
    // Ne pas fermer si on clique sur la barre d'outils, une boîte texte, ou les poignées
    if (
      !e.target.closest(".text-box") &&
      !e.target.closest(".floating-toolbar") &&
      !e.target.closest(".resize-handle") &&
      !e.target.closest(".rotate-handle")
    ) {
      hideToolbar();
    }
  },
  true
);

addBubbleBtn.addEventListener("click", () => {
  addBubbleMode = !addBubbleMode;
  addBubbleBtn.classList.toggle("active", addBubbleMode);
});

slide.addEventListener("click", (e) => {
  if (addBubbleMode && e.target === slide) {
    const rect = slide.getBoundingClientRect();
    createBubble((e.clientX - rect.left) / editorZoom, (e.clientY - rect.top) / editorZoom);
    addBubbleMode = false;
    addBubbleBtn.classList.remove("active");
  }
  // Fermer la barre d'outils si on clique en dehors d'une boîte texte
  if (!e.target.closest(".text-box") && !e.target.closest(".floating-toolbar")) {
    hideToolbar();
  }
});

function createBubble(x, y) {
  saveState();
  const desc = prompt("Texte de la bulle :") || "";
  const bubble = document.createElement("div");
  bubble.className = "item-box bubble-box";
  bubble.dataset.desc = desc;
  bubble.innerHTML = `<span class="bubble-num">?</span><div class="delete-btn">✕</div><div class="rotate-handle">↻</div>`;
  bubble.style.left = `${x - 18}px`;
  bubble.style.top = `${y - 18}px`;
  slide.appendChild(bubble);
  attachItemEvents(bubble);
  renumberBubbles();
}

function renumberBubbles() {
  slide.querySelectorAll(".bubble-box").forEach((b, i) => {
    const n = b.querySelector(".bubble-num");
    if (n) n.textContent = i + 1;
  });
}

// --- FORMATAGE ET COULEURS ---
textColor.addEventListener("input", (e) => {
  if (!activeTextBox) return;
  saveState();
  const content = activeTextBox.querySelector(".content");
  if (content) {
    content.style.color = e.target.value;
  }
});

fontFamily.addEventListener("change", (e) => {
  if (!activeTextBox) return;
  saveState();
  const content = activeTextBox.querySelector(".content");
  if (content) {
    content.style.fontFamily = e.target.value;
  }
});

fontSize.addEventListener("change", (e) => {
  if (!activeTextBox) return;
  saveState();
  const content = activeTextBox.querySelector(".content");
  if (content) {
    content.style.fontSize = e.target.value;
  }
});

boldBtn.addEventListener("click", () => {
  if (!activeTextBox) return;
  saveState();
  document.execCommand("bold", false);
  boldBtn.classList.toggle("active");
});

italicBtn.addEventListener("click", () => {
  if (!activeTextBox) return;
  saveState();
  document.execCommand("italic", false);
  italicBtn.classList.toggle("active");
});

underlineBtn.addEventListener("click", () => {
  if (!activeTextBox) return;
  saveState();
  document.execCommand("underline", false);
  underlineBtn.classList.toggle("active");
});

highlightBtn.addEventListener("click", () => {
  if (!activeTextBox) return;
  saveState();
  document.execCommand("backColor", false, highlightColor.value);
});

highlightColor.addEventListener("input", () => {
  if (!activeTextBox) return;
  saveState();
  document.execCommand("backColor", false, highlightColor.value);
});

// Utiliser la couleur du texte depuis le top toolbar
document.getElementById("topTextColor").addEventListener("input", (e) => {
  if (!activeTextBox) return;
  saveState();
  const content = activeTextBox.querySelector(".content");
  if (content) {
    content.style.color = e.target.value;
  }
});

// --- RACCOURCIS ET BOUTONS ---

// Gérer l'ajout d'images
addImageBtn.addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.src = event.target.result;
      createItem(img.outerHTML, "image-box", 150, 150);
    };
    reader.readAsDataURL(file);
  }
  // Réinitialiser l'input pour permettre de sélectionner le même fichier à nouveau
  imageInput.value = "";
});

// --- GESTION DU FOND (ARRIÈRE-PLAN) ---
bgColorPicker.addEventListener("input", (e) => {
  saveState();
  slide.style.backgroundImage = "none";
  slide.style.backgroundColor = e.target.value;
});

bgImageBtn.addEventListener("click", () => {
  bgImageInput.click();
});

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
  // Réinitialiser l'input pour permettre de sélectionner le même fichier à nouveau
  bgImageInput.value = "";
});

document.getElementById("undoBtn").onclick = undo;
document.getElementById("redoBtn").onclick = redo;

window.addEventListener("keydown", (e) => {
  // --- AJOUT : CTRL+C / CTRL+V / CTRL+X pour les items ---
  // On ne touche pas au copier/coller normal si on est en train d’éditer du texte
  if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
    if (!isEditingText() && state.activeItem) {
      e.preventDefault();
      itemClipboard = getItemSnapshot(state.activeItem);
    }
  }

 if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
  // Si on a un item en clipboard, on colle l'item en priorité
  if (itemClipboard) {
    e.preventDefault(); // empêche de coller le texte (ex: code) dans la zone texte
    pasteSnapshot(itemClipboard);
    return;
  }
  // Sinon, on laisse le collage normal (dans une zone texte notamment)
}



  // Optionnel mais pratique : Ctrl+X coupe (copie + supprime)
  if (e.ctrlKey && (e.key === "x" || e.key === "X")) {
    if (!isEditingText() && state.activeItem) {
      e.preventDefault();
      itemClipboard = getItemSnapshot(state.activeItem);
      saveState();
      if (state.activeItem.classList.contains("link-button")) handleLinkDelete(state.activeItem);
      state.activeItem.remove();
      state.activeItem = null;
      renumberBubbles();
    }
  }

  // --- vos raccourcis existants ---
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    undo();
  }
  if (e.ctrlKey && e.key === "y") {
    e.preventDefault();
    redo();
  }
  if ((e.key === "Delete" || e.key === "Backspace") && state.activeItem) {
    if (document.activeElement.isContentEditable) return;
    saveState();
    if (state.activeItem.classList.contains("link-button")) handleLinkDelete(state.activeItem);
    state.activeItem.remove();
    state.activeItem = null;
    renumberBubbles();
  }
});

// --- ZOOM ---
function applyZoom() {
  if (slideZoomWrapper) slideZoomWrapper.style.transform = `scale(${editorZoom})`;
  const z = document.getElementById("editor-zoom-text");
  if (z) z.textContent = Math.round(editorZoom * 100) + "%";
}
function zoomIn() {
  editorZoom = Math.min(3, editorZoom + 0.1);
  applyZoom();
}
function zoomOut() {
  editorZoom = Math.max(0.3, editorZoom - 0.1);
  applyZoom();
}
function resetZoom() {
  editorZoom = 1;
  applyZoom();
}
