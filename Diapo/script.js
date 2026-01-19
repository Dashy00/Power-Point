const addTextBtn = document.getElementById("addTextBtn");
const addImageBtn = document.getElementById("addImageBtn");
const imageInput = document.getElementById("imageInput");
const slide = document.getElementById("slide");
const bgColorPicker = document.getElementById("bgColorPicker");
const bgImageBtn = document.getElementById("bgImageBtn");
const bgImageInput = document.getElementById("bgImageInput");
const floatingToolbar = document.getElementById("floatingToolbar");

// Éléments de formatage (barre flottante)
const fontFamily = document.getElementById("fontFamily");
const fontSize = document.getElementById("fontSize");
const textColor = document.getElementById("textColor");
const highlightColor = document.getElementById("highlightColor");
const boldBtn = document.getElementById("boldBtn");
const italicBtn = document.getElementById("italicBtn");
const underlineBtn = document.getElementById("underlineBtn");
const highlightBtn = document.getElementById("highlightBtn");

let addMode = false;

// élément actif (texte ou image) pour suppression via Entrée
let activeItem = null;
let activeTextBox = null;

// drag
let dragging = null;
let offsetX = 0,
  offsetY = 0;

// resize image
let resizing = null;
let startW = 0,
  startH = 0;
let startMouseX = 0,
  startMouseY = 0;

// rotation texte
let rotating = null;
let startAngle = 0;
let currentRotation = 0;

// -----------------------------
// MODE AJOUT TEXTE
// -----------------------------
addTextBtn.addEventListener("click", () => {
  addMode = !addMode;
  addTextBtn.classList.toggle("active", addMode);
  addTextBtn.textContent = addMode
    ? "Cliquez sur la slide..."
    : "Ajouter un texte";
});

// -----------------------------
// AJOUT IMAGE (ouvre l'input file)
// -----------------------------
addImageBtn.addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    const box = document.createElement("div");
    box.className = "image-box";

    // Taille initiale (si vous avez le resize)
    box.style.width = "260px";
    box.style.height = "180px";

    const img = document.createElement("img");
    img.src = reader.result;

    // Poignée resize si vous l'utilisez
    const handle = document.createElement("div");
    handle.className = "resize-handle";

    // ✅ Croix suppression (même classe que texte)
    const del = document.createElement("div");
    del.className = "delete-btn";
    del.textContent = "✕";

    del.addEventListener("click", (ev) => {
      ev.stopPropagation();
      saveState();
      box.remove();
      if (activeItem === box) activeItem = null;
    });

    box.appendChild(img);
    box.appendChild(handle);
    box.appendChild(del);

    // Position initiale (sans translate pour éviter les bugs de drag/resize)
    const slideRect = slide.getBoundingClientRect();
    box.style.left = `${(slideRect.width - 260) / 2}px`;
    box.style.top = `${(slideRect.height - 180) / 2}px`;
    saveState();
    slide.appendChild(box);

    // ✅ comme le texte : l’objet devient actif
    activeItem = box;
  };

  reader.readAsDataURL(file);
  imageInput.value = "";
});

// -----------------------------
// CLICK SUR SLIDE :
// - clic sur un objet => actif
// - clic sur vide + addMode => crée texte
// -----------------------------
slide.addEventListener("click", (e) => {
  const obj = e.target.closest(".text-box, .image-box");

  // Clic sur objet => il devient actif
  if (obj) {
    activeItem = obj;
    return;
  }

  // Clic dans le vide => aucun actif
  activeItem = null;

  // Si pas en mode ajout => rien
  if (!addMode) return;

  // Créer texte si clic direct sur la slide
  if (e.target !== slide) return;

  const rect = slide.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = "text-box";

  box.innerHTML = `
    <div class="content" contenteditable="false">Double-cliquez pour modifier</div>
    <div class="delete-btn">✕</div>
    <div class="rotate-handle" title="Rotation">↻</div>
  `;

  box.style.left = `${e.clientX - rect.left - 75}px`;
  box.style.top = `${e.clientY - rect.top - 20}px`;

  // Supprimer via la croix (optionnel)
  box.querySelector(".delete-btn").addEventListener("click", (ev) => {
    ev.stopPropagation();
    saveState();
    box.remove();
    if (activeItem === box) activeItem = null;
  });

  saveState();
  slide.appendChild(box);

  activeItem = box;
  addMode = false;
  addTextBtn.textContent = "Ajouter un texte";
  addTextBtn.classList.remove("active");
});

// -----------------------------
// DOUBLE-CLIC : édition du texte (seulement sur .content)
// -----------------------------
slide.addEventListener("dblclick", (e) => {
  const content = e.target.closest(".content");
  if (!content) return;

  const parentBox = content.closest(".text-box");
  if (!parentBox) return;

  activateTextBox(parentBox, content);
});

// sortir du mode édition quand on clique ailleurs
slide.addEventListener("focusout", (e) => {
  if (!e.target.classList.contains("content")) return;
  // Ne pas désactiver immédiatement pour permettre l'utilisation des toolbars
});

// -----------------------------
// SUPPRESSION : Entrée
// - si texte en édition => Entrée normale
// - sinon => supprime l'objet actif (texte ou image)
// -----------------------------
window.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (!activeItem) return;

  // si on est en train d'éditer un texte => ne pas supprimer
  const editing =
    document.activeElement?.classList?.contains("content") &&
    document.activeElement.isContentEditable;

  if (editing) return;

  e.preventDefault();
  activeItem.remove();
  activeItem = null;
});

// -----------------------------
// MOUSEDOWN :
// - si poignée resize => resize image
// - si poignée rotate => rotation texte
// - sinon drag texte/image
// -----------------------------
slide.addEventListener("mousedown", (e) => {
  // 1) RESIZE
  const handle = e.target.closest(".resize-handle");
  if (handle) {
    resizing = handle.parentElement;
    activeItem = resizing;

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

    // Angle initial de la souris par rapport au centre
    startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    // Rotation actuelle de l'élément
    const transform = rotating.style.transform;
    const match = transform.match(/rotate\((-?\d+\.?\d*)deg\)/);
    currentRotation = match ? parseFloat(match[1]) : 0;

    e.preventDefault();
    return;
  }

  // 3) DRAG
  const target = e.target.closest(".text-box, .image-box");
  if (!target) return;

  // Si c'est un text-box en mode édition, ne pas drag pour permettre la sélection
  if (target.classList.contains("text-box")) {
    const content = target.querySelector(".content");
    if (content && content.isContentEditable) {
      // Ne pas déclencher le drag si on est en mode édition
      return;
    }
  }

  // Si on clique directement sur le content (même non éditable),
  // on laisse le double-clic activer l'édition
  if (e.target.classList.contains("content")) {
    return;
  }

  dragging = target;
  activeItem = target;

  const rect = dragging.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;

  e.preventDefault();
});

// -----------------------------
// MOUSEMOVE : resize, rotation ou drag
// -----------------------------
window.addEventListener("mousemove", (e) => {
  // RESIZE IMAGE
  if (resizing) {
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    // limites min/max
    const newW = Math.max(80, Math.min(900, startW + dx));
    const newH = Math.max(60, Math.min(506, startH + dy));

    resizing.style.width = `${newW}px`;
    resizing.style.height = `${newH}px`;
    return;
  }

  // ROTATION TEXTE
  if (rotating) {
    const rect = rotating.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Nouvel angle de la souris
    const newAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    // Différence d'angle en degrés
    const angleDiff = (newAngle - startAngle) * (180 / Math.PI);

    // Appliquer la rotation
    const finalRotation = currentRotation + angleDiff;
    rotating.style.transform = `rotate(${finalRotation}deg)`;
    return;
  }

  // DRAG OBJET
  if (!dragging) return;

  const slideRect = slide.getBoundingClientRect();

  let newLeft = e.clientX - slideRect.left - offsetX;
  let newTop = e.clientY - slideRect.top - offsetY;

  // Empêcher de sortir de la slide
  const elW = dragging.offsetWidth;
  const elH = dragging.offsetHeight;

  newLeft = Math.max(0, Math.min(newLeft, slideRect.width - elW));
  newTop = Math.max(0, Math.min(newTop, slideRect.height - elH));

  dragging.style.left = `${newLeft}px`;
  dragging.style.top = `${newTop}px`;

  // Mettre à jour la position de la toolbar si on déplace le bloc actif
  if (dragging === activeTextBox) {
    showToolbar(dragging);
  }
});

// -----------------------------
// MOUSEUP : fin drag / resize
// -----------------------------
window.addEventListener("mouseup", () => {
  if (rotating) {
    saveState();
  }
  dragging = null;
  resizing = null;
  rotating = null;
});
// -----------------------------
// CHANGEMENT COULEUR DE FOND
// -----------------------------
bgColorPicker.addEventListener("input", (e) => {
  saveState();
  slide.style.backgroundImage = "none"; // Enlever l'image si on choisit une couleur
  slide.style.backgroundColor = e.target.value;
});

// -----------------------------
// IMAGE DE FOND (Wallpaper)
// -----------------------------
bgImageBtn.addEventListener("click", () => {
  bgImageInput.click();
});

bgImageInput.addEventListener("change", () => {
  const file = bgImageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    saveState();
    // Appliquer l'image au style de la slide
    slide.style.backgroundColor = "transparent";
    slide.style.backgroundImage = `url(${reader.result})`;
    slide.style.backgroundSize = "cover";
    slide.style.backgroundPosition = "center";
    slide.style.backgroundRepeat = "no-repeat";
  };
  reader.readAsDataURL(file);
  bgImageInput.value = ""; // Reset pour pouvoir réimporter la même image
});

// ============= FORMATAGE TEXTE =============

// Activer une zone de texte et afficher la toolbar flottante
function activateTextBox(box, content) {
  if (activeTextBox && activeTextBox !== box) {
    activeTextBox.classList.remove("editing");
    activeTextBox.querySelector(".content").contentEditable = "false";
  }

  activeTextBox = box;
  activeItem = box;
  box.classList.add("editing");
  content.contentEditable = "true";
  content.focus();

  showToolbar(box);
}

// Afficher la toolbar au-dessus du bloc
function showToolbar(box) {
  const boxRect = box.getBoundingClientRect();
  const workspaceRect = document
    .querySelector(".workspace")
    .getBoundingClientRect();

  floatingToolbar.style.left = `${boxRect.left - workspaceRect.left}px`;
  floatingToolbar.style.top = `${boxRect.top - workspaceRect.top - 50}px`;
  floatingToolbar.classList.add("visible");
}

// Cacher la toolbar
function hideToolbar() {
  floatingToolbar.classList.remove("visible");
  if (activeTextBox) {
    activeTextBox.classList.remove("editing");
    activeTextBox.querySelector(".content").contentEditable = "false";
    activeTextBox = null;
  }
}

// Cliquer ailleurs pour fermer
document.addEventListener("click", (e) => {
  if (
    !e.target.closest(".text-box") &&
    !e.target.closest(".floating-toolbar") &&
    !e.target.closest(".top-toolbar")
  ) {
    hideToolbar();
  }
});

// Fonction pour appliquer le formatage (barre flottante)
function applyFormat(command, value = null) {
  saveState();
  document.execCommand(command, false, value);
  if (activeTextBox) {
    activeTextBox.querySelector(".content").focus();
  }
}

// Police (barre flottante)
fontFamily.addEventListener("change", () => {
  applyFormat("fontName", fontFamily.value);
});

// Taille (barre flottante)
fontSize.addEventListener("change", () => {
  applyFormat("fontSize", "7");
  document.querySelectorAll('font[size="7"]').forEach((el) => {
    el.removeAttribute("size");
    el.style.fontSize = fontSize.value;
  });
});

// Couleur du texte (barre flottante)
textColor.addEventListener("input", () => {
  applyFormat("foreColor", textColor.value);
});

// Gras (barre flottante)
boldBtn.addEventListener("click", () => {
  applyFormat("bold");
  boldBtn.classList.toggle("active");
});

// Italique (barre flottante)
italicBtn.addEventListener("click", () => {
  applyFormat("italic");
  italicBtn.classList.toggle("active");
});

// Souligné (barre flottante)
underlineBtn.addEventListener("click", () => {
  applyFormat("underline");
  underlineBtn.classList.toggle("active");
});

// Surligner (barre flottante)
highlightBtn.addEventListener("click", () => {
  applyFormat("hiliteColor", highlightColor.value);
});

// ============= MENU FIXE EN HAUT =============

const topToolbar = document.querySelector(".top-toolbar");
let savedRange = null;

// Sauvegarder la sélection quand on sélectionne du texte
document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && activeTextBox) {
    const range = sel.getRangeAt(0);
    if (activeTextBox.contains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
    }
  }
});

// Empêcher la perte de sélection quand on clique sur la toolbar
topToolbar.addEventListener("mousedown", (e) => {
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && savedRange) {
    // Garder la sélection actuelle
  } else if (sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }

  if (e.target.tagName !== "SELECT" && e.target.tagName !== "OPTION") {
    e.preventDefault();
  }
});

// Sauvegarder quand on focus sur les selects
document.getElementById("topFontFamily").addEventListener("focus", () => {
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && activeTextBox) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }
});

document.getElementById("topFontSize").addEventListener("focus", () => {
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && activeTextBox) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }
});

// Fonction pour appliquer le formatage (barre fixe)
function formatText(command, value = null) {
  if (!savedRange || !activeTextBox) return;

  saveState();
  const content = activeTextBox.querySelector(".content");
  content.focus();

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);

  document.execCommand(command, false, value);

  if (sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }
}

// Police (barre fixe)
document
  .getElementById("topFontFamily")
  .addEventListener("change", function () {
    formatText("fontName", this.value);
  });

// Taille (barre fixe)
document.getElementById("topFontSize").addEventListener("change", function () {
  formatText("fontSize", "7");
  document.querySelectorAll('font[size="7"]').forEach((el) => {
    el.removeAttribute("size");
    el.style.fontSize = this.value;
  });
});

// Couleur du texte (barre fixe)
document.getElementById("topTextColor").addEventListener("input", function () {
  formatText("foreColor", this.value);
});

// Gras (barre fixe)
document.getElementById("topBoldBtn").addEventListener("click", () => {
  formatText("bold");
});

// Italique (barre fixe)
document.getElementById("topItalicBtn").addEventListener("click", () => {
  formatText("italic");
});

// Souligné (barre fixe)
document.getElementById("topUnderlineBtn").addEventListener("click", () => {
  formatText("underline");
});

// Surligner (barre fixe)
document.getElementById("topHighlightBtn").addEventListener("click", () => {
  formatText("hiliteColor", document.getElementById("topHighlightColor").value);
});

// ============= ANNULER / RÉTABLIR =============

// Historique des états de la slide
let historyStack = [];
let redoStack = [];
const maxHistory = 50;

// Sauvegarder l'état actuel
function saveState() {
  const state = {
    innerHTML: slide.innerHTML,
    backgroundColor: slide.style.backgroundColor,
    backgroundImage: slide.style.backgroundImage,
    backgroundSize: slide.style.backgroundSize,
    backgroundPosition: slide.style.backgroundPosition,
    backgroundRepeat: slide.style.backgroundRepeat,
  };
  const stateString = JSON.stringify(state);
  // Éviter les doublons consécutifs
  if (
    historyStack.length === 0 ||
    JSON.stringify(historyStack[historyStack.length - 1]) !== stateString
  ) {
    historyStack.push(state);
    if (historyStack.length > maxHistory) {
      historyStack.shift();
    }
    // Vider le redo quand on fait une nouvelle action
    redoStack = [];
  }
}

// Annuler
function undo() {
  if (historyStack.length > 0) {
    const currentState = {
      innerHTML: slide.innerHTML,
      backgroundColor: slide.style.backgroundColor,
      backgroundImage: slide.style.backgroundImage,
      backgroundSize: slide.style.backgroundSize,
      backgroundPosition: slide.style.backgroundPosition,
      backgroundRepeat: slide.style.backgroundRepeat,
    };
    redoStack.push(currentState);
    const previousState = historyStack.pop();
    restoreState(previousState);
  }
}

// Rétablir
function redo() {
  if (redoStack.length > 0) {
    const currentState = {
      innerHTML: slide.innerHTML,
      backgroundColor: slide.style.backgroundColor,
      backgroundImage: slide.style.backgroundImage,
      backgroundSize: slide.style.backgroundSize,
      backgroundPosition: slide.style.backgroundPosition,
      backgroundRepeat: slide.style.backgroundRepeat,
    };
    historyStack.push(currentState);
    const nextState = redoStack.pop();
    restoreState(nextState);
  }
}

// Restaurer un état complet
function restoreState(state) {
  slide.innerHTML = state.innerHTML;
  slide.style.backgroundColor = state.backgroundColor || "";
  slide.style.backgroundImage = state.backgroundImage || "";
  slide.style.backgroundSize = state.backgroundSize || "";
  slide.style.backgroundPosition = state.backgroundPosition || "";
  slide.style.backgroundRepeat = state.backgroundRepeat || "";

  // Mettre à jour le color picker
  if (state.backgroundColor && state.backgroundColor !== "transparent") {
    bgColorPicker.value = rgbToHex(state.backgroundColor);
  }

  reattachEventListeners();
}

// Convertir RGB en HEX pour le color picker
function rgbToHex(rgb) {
  if (!rgb || rgb === "transparent") return "#ffffff";
  if (rgb.startsWith("#")) return rgb;

  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return "#ffffff";

  return (
    "#" +
    result
      .slice(0, 3)
      .map((x) => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

// Réattacher les événements après restauration
function reattachEventListeners() {
  hideToolbar();
  activeItem = null;
  activeTextBox = null;

  // Réattacher les événements de suppression sur les croix
  document.querySelectorAll(".text-box .delete-btn").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      saveState();
      btn.parentElement.remove();
    });
  });

  document.querySelectorAll(".image-box .delete-btn").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      saveState();
      btn.parentElement.remove();
    });
  });
}

// Boutons Annuler/Rétablir
document.getElementById("undoBtn").addEventListener("click", () => {
  undo();
});

document.getElementById("redoBtn").addEventListener("click", () => {
  redo();
});

// Raccourcis clavier Ctrl+Z et Ctrl+Y
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

// Sauvegarder l'état initial
saveState();
