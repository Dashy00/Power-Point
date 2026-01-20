const addTextBtn = document.getElementById("addTextBtn");
const addImageBtn = document.getElementById("addImageBtn");
const imageInput = document.getElementById("imageInput");
const slide = document.getElementById("editable-slide");
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
 
// --- OUVRIR / FERMER L'ÉDITEUR ---
function openEditor(slideId) {
  state.currentEditingId = slideId;
 
  // Charger le contenu sauvegardé (s'il existe)
  const data = state.slidesContent[slideId] || {
    html: "",
    bg: "#ffffff",
    bgImg: "",
    slideNum: "",
  };
  slide.innerHTML = data.html;
  slide.style.backgroundColor = data.bg;
  slide.style.backgroundImage = data.bgImg || "";
  bgColorPicker.value = data.bg || "#ffffff";
 
  // Charger le numéro de la diapositive
  document.getElementById("slideNumber").value = data.slideNum || "";
 
  // Réattacher les event listeners sur les objets
  reattachEventListeners();
 
  // Afficher l'overlay
  editorOverlay.style.display = "flex";
}
 
function closeEditor() {
  if (state.currentEditingId) {
    // Sauvegarder le contenu
    state.slidesContent[state.currentEditingId] = {
      html: slide.innerHTML,
      bg: slide.style.backgroundColor,
      bgImg: slide.style.backgroundImage,
    };
  }
 
  // Cacher l'overlay et la toolbar flottante
  editorOverlay.style.display = "none";
  if (floatingToolbar) floatingToolbar.classList.remove("visible");
 
  state.currentEditingId = null;
}
 
// Bouton retour
// --- Dans editor.js ---
 
document.getElementById("btn-close-editor").onclick = () => {
  if (state.currentEditingId) {
    // Sauvegarde des données
    state.slidesContent[state.currentEditingId] = {
      html: editableSlide.innerHTML,
      bg: editableSlide.style.backgroundColor,
      bgImg: editableSlide.style.backgroundImage,
      slideNum: document.getElementById("slideNumber").value,
    };
 
    // --- MISE A JOUR DE LA PREVIEW ---
    // On appelle la fonction créée dans app.js
    if (window.updateNodePreview) {
      window.updateNodePreview(state.currentEditingId);
    }
 
    // Feedback visuel (bordure verte)
    const slideNode = document.getElementById(state.currentEditingId);
    if (editableSlide.innerHTML.trim() !== "" && slideNode)
      slideNode.style.border = "2px solid #2ecc71";
  }
  editorOverlay.style.display = "none";
  state.currentEditingId = null;
};
 
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
 
// Dimensions fixes de la slide (sans zoom)
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
 
// Force un élément à rester dans la slide (position + taille)
// Désactivé pour permettre le dépassement des bordures
function keepInsideSlide(el) {
  // Ne fait plus rien - les éléments peuvent dépasser
  return;
}
 
// Bulles
 
const addBubbleBtn = document.getElementById("addBubbleBtn");
let addBubbleMode = false;
 
addBubbleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
 
  addBubbleMode = !addBubbleMode;
  addBubbleBtn.classList.toggle("active", addBubbleMode);
  addBubbleBtn.textContent = addBubbleMode
    ? "Cliquez sur la slide..."
    : "Ajouter une bulle";
 
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
  bubble.style.top = `${y - 18}px`;
 
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
let offsetX = 0,
  offsetY = 0;
let startW = 0,
  startH = 0;
let startMouseX = 0,
  startMouseY = 0;
let startAngle = 0;
let currentRotation = 0;
 
// --- AJOUT TEXTE ---
addTextBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  addMode = !addMode;
  addTextBtn.classList.toggle("active", addMode);
  addTextBtn.textContent = addMode
    ? "Cliquez sur la slide..."
    : "Ajouter un texte";
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
  const obj = e.target.closest(
    ".text-box, .image-box, .shape-box, .bubble-box",
  );
 
  // Retirer la bordure de l'ancien élément
  document
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));
 
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
  const target = e.target.closest(
    ".text-box, .image-box, .shape-box, .bubble-box",
  );
 
  if (
    !target ||
    (e.target.classList.contains("content") && e.target.isContentEditable)
  )
    return;
 
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
    const isEditing =
      document.activeElement &&
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
    // Diviser par le zoom pour obtenir les coordonnées réelles
    let newLeft = (e.clientX - slideRect.left) / editorZoom - offsetX;
    let newTop = (e.clientY - slideRect.top) / editorZoom - offsetY;
 
    // Pas de limite - les éléments peuvent dépasser les bordures
    dragging.style.left = `${newLeft}px`;
    dragging.style.top = `${newTop}px`;
 
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
  if (!floatingToolbar) return;
  const boxRect = box.getBoundingClientRect();
  const workspaceRect = document
    .querySelector(".overlay-workspace")
    .getBoundingClientRect();
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
  if (
    !e.target.closest(".text-box") &&
    !e.target.closest(".floating-toolbar") &&
    !e.target.closest(".top-toolbar")
  ) {
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
  if (
    activeItem &&
    activeItem.classList.contains("shape-box") &&
    cmd === "foreColor"
  ) {
    saveState();
    activeItem.querySelector(".shape-content").style.backgroundColor = val;
  } else {
    saveState();
    document.execCommand(cmd, false, val);
  }
}
 
// Event listeners pour la barre d'outils fixe
document.getElementById("topTextColor").addEventListener("input", (e) => {
  if (activeItem && activeItem.classList.contains("shape-box")) {
    saveState();
    activeItem.querySelector(".shape-content").style.backgroundColor =
      e.target.value;
  } else if (activeItem && activeItem.classList.contains("bubble-box")) {
    saveState();
    activeItem.style.backgroundColor = e.target.value;
  } else {
    formatText("foreColor", e.target.value);
  }
});
document.getElementById("topBoldBtn").onclick = () => formatText("bold");
document.getElementById("topItalicBtn").onclick = () => formatText("italic");
document.getElementById("topUnderlineBtn").onclick = () =>
  formatText("underline");
document.getElementById("topHighlightColor").addEventListener("input", (e) => {
  document.getElementById("highlightColor").value = e.target.value;
});
document.getElementById("topHighlightBtn").onclick = () =>
  formatText("hiliteColor", document.getElementById("topHighlightColor").value);
document.getElementById("topFontFamily").addEventListener("change", (e) => {
  if (activeItem && activeItem.classList.contains("text-box")) {
    saveState();
    activeItem.querySelector(".content").style.fontFamily = e.target.value;
  } else {
    formatText("fontName", e.target.value);
  }
});
document.getElementById("topFontSize").addEventListener("change", (e) => {
  if (activeItem && activeItem.classList.contains("text-box")) {
    saveState();
    activeItem.querySelector(".content").style.fontSize = e.target.value;
  } else {
    document.execCommand("fontSize", false, "7");
    const fontElements = document.querySelectorAll("font[size='7']");
    fontElements.forEach((el) => {
      el.removeAttribute("size");
      el.style.fontSize = e.target.value;
    });
  }
});
 
// Event listeners pour la barre d'outils flottante
if (boldBtn) boldBtn.onclick = () => formatText("bold");
if (italicBtn) italicBtn.onclick = () => formatText("italic");
if (underlineBtn) underlineBtn.onclick = () => formatText("underline");
if (highlightBtn)
  highlightBtn.onclick = () =>
    formatText(
      "hiliteColor",
      highlightColor ? highlightColor.value : "#ffff00",
    );
if (fontFamily)
  fontFamily.addEventListener("change", (e) => {
    if (activeTextBox) {
      activeTextBox.querySelector(".content").style.fontFamily = e.target.value;
    }
  });
if (fontSize)
  fontSize.addEventListener("change", (e) => {
    if (activeTextBox) {
      activeTextBox.querySelector(".content").style.fontSize = e.target.value;
    }
  });
if (textColor)
  textColor.addEventListener("input", (e) =>
    formatText("foreColor", e.target.value),
  );
 
// Fonction pour les formes (appelée depuis onclick dans HTML)
function addEditorShape(type) {
  addShape(type);
}
 
// --- HISTORIQUE (Undo/Redo) ---
let historyStack = [];
let redoStack = [];
 
function saveState() {
  historyStack.push({
    innerHTML: slide.innerHTML,
    bg: slide.style.backgroundColor,
    img: slide.style.backgroundImage,
  });
  redoStack = [];
}
 
function undo() {
  if (historyStack.length === 0) return;
  redoStack.push({
    innerHTML: slide.innerHTML,
    bg: slide.style.backgroundColor,
    img: slide.style.backgroundImage,
  });
  const state = historyStack.pop();
  slide.innerHTML = state.innerHTML;
  slide.style.backgroundColor = state.bg;
  slide.style.backgroundImage = state.img;
  reattachEventListeners();
}
 
function redo() {
  if (redoStack.length === 0) return;
  historyStack.push({
    innerHTML: slide.innerHTML,
    bg: slide.style.backgroundColor,
    img: slide.style.backgroundImage,
  });
  const state = redoStack.pop();
  slide.innerHTML = state.innerHTML;
  slide.style.backgroundColor = state.bg;
  slide.style.backgroundImage = state.img;
  reattachEventListeners();
}
 
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);
 
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    undo();
  }
  if (e.ctrlKey && e.key === "y") {
    e.preventDefault();
    redo();
  }
});
 
// Initialisation
reattachEventListeners();
function reattachEventListeners() {
  document
    .querySelectorAll(".text-box, .image-box, .shape-box, .bubble-box")
    .forEach(setupDeleteBtn);
}
 
// --- ZOOM DE L'ESPACE DE TRAVAIL ---
let editorZoom = 1;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
 
const overlayWorkspace = document.querySelector(".overlay-workspace");
const slideZoomWrapper = document.getElementById("slideZoomWrapper");
 
function applyZoom() {
  if (slideZoomWrapper) {
    slideZoomWrapper.style.transform = `scale(${editorZoom})`;
  }
  updateZoomDisplay();
}
 
if (overlayWorkspace) {
  overlayWorkspace.addEventListener(
    "wheel",
    (e) => {
      // Seulement si Ctrl est enfoncé (pour ne pas interférer avec le scroll normal)
      if (e.ctrlKey) {
        e.preventDefault();
 
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        editorZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, editorZoom + delta));
 
        applyZoom();
      }
    },
    { passive: false },
  );
}
 
// Fonctions de zoom accessibles globalement
function zoomIn() {
  editorZoom = Math.min(MAX_ZOOM, editorZoom + 0.1);
  applyZoom();
}
 
function zoomOut() {
  editorZoom = Math.max(MIN_ZOOM, editorZoom - 0.1);
  applyZoom();
}
 
function resetZoom() {
  editorZoom = 1;
  applyZoom();
}
 
function updateZoomDisplay() {
  const zoomIndicator = document.getElementById("editor-zoom-text");
  if (zoomIndicator) {
    zoomIndicator.textContent = Math.round(editorZoom * 100) + "%";
  }
}
 
 