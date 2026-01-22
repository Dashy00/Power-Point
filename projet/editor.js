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
const shapeColorPicker = document.getElementById("shapeColorPicker");

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

// --- ZOOM : UNIQUEMENT LA PAGE (DIAPO) ---
// IMPORTANT : on va WRAPPER la slide dans un conteneur qui sera scalé,
// sans scaler toute la page/overlay.
let slideZoomWrapper = null;
const overlayWorkspace = document.querySelector(".overlay-workspace") || slide?.parentElement || document.body;

function clampZoom(z) {
  return Math.max(0.3, Math.min(3, z));
}

function initSlideZoomWrapper() {
  if (!slide) return;

  // si déjà wrappée
  if (slide.parentElement && slide.parentElement.id === "slideZoomWrapper") {
    slideZoomWrapper = slide.parentElement;
  } else {
    // créer wrapper
    slideZoomWrapper = document.createElement("div");
    slideZoomWrapper.id = "slideZoomWrapper";

    // Style inline minimal (sans toucher votre CSS)
    slideZoomWrapper.style.display = "inline-block";
    slideZoomWrapper.style.transformOrigin = "top left";
    slideZoomWrapper.style.position = "relative";

    // insérer wrapper à la place de la slide
    const parent = slide.parentElement;
    if (parent) {
      parent.insertBefore(slideZoomWrapper, slide);
      slideZoomWrapper.appendChild(slide);
    }
  }

  // s'assurer que le workspace peut scroller si on zoom
  if (overlayWorkspace) {
    const wsStyle = window.getComputedStyle(overlayWorkspace);
    if (wsStyle.overflow === "visible") {
      overlayWorkspace.style.overflow = "auto";
    }
  }

  applyZoom(false);
}



// Zoom au scroll Ctrl + molette : uniquement quand le curseur est sur l'espace diapo
function attachWheelZoom() {
  if (!overlayWorkspace) return;

  overlayWorkspace.addEventListener(
    "wheel",
    (e) => {
      // si l'utilisateur fait Ctrl+molette (ou trackpad pinch qui remonte comme ctrlKey)
      // on empêche le zoom navigateur et on zoom uniquement la slide
      if (!e.ctrlKey) return;

      // IMPORTANT : ne pas bloquer le zoom navigateur si on n'est PAS dans l'éditeur
      // (si vous avez un overlay editorOverlay, on vérifie son affichage)
      if (typeof editorOverlay !== "undefined" && editorOverlay && editorOverlay.style.display === "none") return;

      e.preventDefault();

      const prevZoom = editorZoom;
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      editorZoom = clampZoom(editorZoom + delta);

      applyZoom(true, {
        clientX: e.clientX,
        clientY: e.clientY,
        prevZoom: prevZoom,
      });
    },
    { passive: false }
  );
}

// Appliquer le zoom au wrapper (et garder le point sous la souris stable si demandé)
function applyZoom(keepPoint = false, anchor = null) {
  if (!slideZoomWrapper) return;

  // ancrage (pour garder le point stable)
  let before = null;
  if (keepPoint && anchor && overlayWorkspace) {
    const wsRect = overlayWorkspace.getBoundingClientRect();
    const xInWs = anchor.clientX - wsRect.left + overlayWorkspace.scrollLeft;
    const yInWs = anchor.clientY - wsRect.top + overlayWorkspace.scrollTop;

    before = { xInWs, yInWs, prevZoom: anchor.prevZoom || editorZoom };
  }

  slideZoomWrapper.style.transform = `scale(${editorZoom})`;

  // mise à jour du texte %
  const z = document.getElementById("editor-zoom-text");
  if (z) z.textContent = Math.round(editorZoom * 100) + "%";

  // garder le point sous la souris stable
  if (before && overlayWorkspace) {
    const ratio = editorZoom / before.prevZoom;
    overlayWorkspace.scrollLeft = before.xInWs * ratio - (anchor.clientX - overlayWorkspace.getBoundingClientRect().left);
    overlayWorkspace.scrollTop = before.yInWs * ratio - (anchor.clientY - overlayWorkspace.getBoundingClientRect().top);
  }
}

function zoomIn() {
  const prevZoom = editorZoom;
  editorZoom = clampZoom(editorZoom + 0.1);
  applyZoom(false, { prevZoom });
}

function zoomOut() {
  const prevZoom = editorZoom;
  editorZoom = clampZoom(editorZoom - 0.1);
  applyZoom(false, { prevZoom });
}

function resetZoom() {
  const prevZoom = editorZoom;
  editorZoom = 1;
  applyZoom(false, { prevZoom });
}

// Hook optionnel si vous avez des boutons (ne casse rien si absents)
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetZoomBtn = document.getElementById("resetZoomBtn");
if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn);
if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);
if (resetZoomBtn) resetZoomBtn.addEventListener("click", resetZoom);

// Init wrapper + molette
initSlideZoomWrapper();
attachWheelZoom();

// --- COPY / PASTE (CTRL+C / CTRL+V / CTRL+X) ---
let itemClipboard = null; // presse-papiers interne (items)
const PASTE_OFFSET = 20;

function isEditingText() {
  const ae = document.activeElement;
  if (!ae) return false;
  if (ae.isContentEditable) return true;
  const tag = ae.tagName ? ae.tagName.toLowerCase() : "";
  return tag === "input" || tag === "textarea";
}

function ensureHandlesIfNeeded(div) {
  // Les link-button n'ont volontairement pas de handles chez vous
  if (div.classList.contains("link-button")) return;

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
  const style = window.getComputedStyle(el);

  const left = el.style.left || style.left || "0px";
  const top = el.style.top || style.top || "0px";
  const width = el.style.width || style.width || "150px";
  const height = el.style.height || style.height || "50px";
  const transform = el.style.transform || style.transform || "";

  const dataset = {};
  Object.keys(el.dataset || {}).forEach((k) => (dataset[k] = el.dataset[k]));

  return {
    className: el.className, // "item-box ..." etc.
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
  div.innerHTML = snapshot.innerHTML;

  div.style.width = snapshot.style.width;
  div.style.height = snapshot.style.height;
  div.style.transform = snapshot.style.transform;

  const leftNum = parseFloat(snapshot.style.left) || 0;
  const topNum = parseFloat(snapshot.style.top) || 0;
  div.style.left = `${leftNum + PASTE_OFFSET}px`;
  div.style.top = `${topNum + PASTE_OFFSET}px`;

  Object.keys(snapshot.dataset || {}).forEach((k) => {
    div.dataset[k] = snapshot.dataset[k];
  });

  ensureHandlesIfNeeded(div);

  slide.appendChild(div);
  attachItemEvents(div);

  // sélectionner l'item collé
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

  // IMPORTANT : wrapper zoom au moment où l'éditeur s'ouvre
  initSlideZoomWrapper();
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
  floatingToolbar.classList.add("visible");

  const boxRect = box.getBoundingClientRect();
  const slideRect = document.querySelector(".overlay-workspace").getBoundingClientRect();

  let left = boxRect.left - slideRect.left;
  let top = boxRect.top - slideRect.top - 50;

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
    if (n) n.textContent = i + 1; // correction (i + + 1 => bug)
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

// Gestionnaire pour la couleur des formes dans la barre latérale
if (shapeColorPicker) {
  shapeColorPicker.addEventListener("input", (e) => {
    saveState();

    if (state.activeItem) {
      const shapeContent = state.activeItem.querySelector(".shape-content");
      if (shapeContent) {
        shapeContent.style.backgroundColor = e.target.value;
      } else if (state.activeItem.classList.contains("bubble-box")) {
        state.activeItem.style.backgroundColor = e.target.value;
      }
    }
  });
}

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
  bgImageInput.value = "";
});

document.getElementById("undoBtn").onclick = undo;
document.getElementById("redoBtn").onclick = redo;

window.addEventListener("keydown", (e) => {
  // --- COPY / PASTE ITEMS ---
  if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
    if (!isEditingText() && state.activeItem) {
      e.preventDefault();
      itemClipboard = getItemSnapshot(state.activeItem);
      return;
    }
  }

  if (e.ctrlKey && (e.key === "x" || e.key === "X")) {
    if (!isEditingText() && state.activeItem) {
      e.preventDefault();
      itemClipboard = getItemSnapshot(state.activeItem);
      saveState();
      if (state.activeItem.classList.contains("link-button")) handleLinkDelete(state.activeItem);
      state.activeItem.remove();
      state.activeItem = null;
      renumberBubbles();
      return;
    }
  }

  // Ctrl+V : si un item est en clipboard, on le colle en priorité (même si un texte est actif)
  if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
    if (itemClipboard) {
      e.preventDefault();
      pasteSnapshot(itemClipboard);
      return;
    }
    // sinon collage normal (zones texte)
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
    if (document.activeElement && document.activeElement.isContentEditable) return;
    saveState();
    if (state.activeItem.classList.contains("link-button")) handleLinkDelete(state.activeItem);
    state.activeItem.remove();
    state.activeItem = null;
    renumberBubbles();
  }

  // Optionnel : Ctrl + + / Ctrl + - pour zoom slide (sans zoom navigateur) quand éditeur ouvert
  if (e.ctrlKey && (e.key === "+" || e.key === "=")) {
    if (typeof editorOverlay !== "undefined" && editorOverlay && editorOverlay.style.display === "flex") {
      e.preventDefault();
      zoomIn();
    }
  }
  if (e.ctrlKey && (e.key === "-" || e.key === "_")) {
    if (typeof editorOverlay !== "undefined" && editorOverlay && editorOverlay.style.display === "flex") {
      e.preventDefault();
      zoomOut();
    }
  }
  if (e.ctrlKey && (e.key === "0")) {
    if (typeof editorOverlay !== "undefined" && editorOverlay && editorOverlay.style.display === "flex") {
      e.preventDefault();
      resetZoom();
    }
  }
});



