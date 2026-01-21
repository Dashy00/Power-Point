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
    
    // Charger le contenu
    const data = state.slidesContent[slideId] || { html: "", bg: "#ffffff", bgImg: "", slideNum: "" };
    slide.innerHTML = data.html;
    slide.style.backgroundColor = data.bg;
    slide.style.backgroundImage = data.bgImg || "";
    bgColorPicker.value = data.bg || "#ffffff";
    if(document.getElementById("slideNumber")) document.getElementById("slideNumber").value = data.slideNum || "";
    
    reattachEventListeners();
    editorOverlay.style.display = "flex";
}

document.getElementById('btn-close-editor').onclick = () => {
    if (state.currentEditingId) {
        state.slidesContent[state.currentEditingId] = {
            html: slide.innerHTML,
            bg: slide.style.backgroundColor,
            bgImg: slide.style.backgroundImage,
            slideNum: document.getElementById("slideNumber") ? document.getElementById("slideNumber").value : ""
        };
        
        if(window.updateNodePreview) window.updateNodePreview(state.currentEditingId);
        
        const slideNode = document.getElementById(state.currentEditingId);
        if (slide.innerHTML.trim() !== "" && slideNode) slideNode.style.border = "2px solid #2ecc71";
    }
    editorOverlay.style.display = 'none';
    state.currentEditingId = null;
};

// --- OUTILS ---
addTextBtn.addEventListener("click", () => {
    createItem(`<div class="content" contenteditable="true">Texte...</div>`, "text-box");
});

addImageBtn.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => createImageBox(reader.result);
    reader.readAsDataURL(file);
});

function createImageBox(src) {
    createItem(`<img src="${src}"><div class="resize-handle"></div><div class="delete-btn">✕</div><div class="rotate-handle">↻</div>`, "image-box", 260, 180);
}

function addEditorShape(type) {
    let content = `<div class="shape-content" style="background:#3498db; width:100%; height:100%;"></div>`;
    if(type==='circle') content = `<div class="shape-content" style="background:#e74c3c; width:100%; height:100%; border-radius:50%;"></div>`;
    if(type==='triangle') content = `<div class="shape-content" style="background:#2ecc71; width:100%; height:100%; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div>`;
    createItem(content, `shape-box ${type}`, 100, 100);
}

// --- LOGIQUE ITEMS ---
function createItem(html, className, w=150, h=50) {
    const div = document.createElement("div");
    div.className = `item-box ${className}`;
    div.style.width = w + "px"; div.style.height = h + "px";
    div.style.left = "50px"; div.style.top = "50px";
    div.innerHTML = html + (className.includes('link-button') ? '' : `<div class="resize-handle"></div><div class="delete-btn">✕</div><div class="rotate-handle">↻</div>`);
    slide.appendChild(div);
    attachItemEvents(div);
}

// --- SETUP DES ÉVÉNEMENTS ---
function setupDeleteBtn(box) {
  const btn = box.querySelector(".delete-btn");
  if(btn) {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        
        // >>> MODIFICATION : GESTION DE LA SUPPRESSION DE LIEN <<<
        if(box.classList.contains('link-button')) {
            handleLinkDelete(box);
        }
        
        saveState();
        box.remove();
        renumberBubbles();
        if (state.activeItem === box) state.activeItem = null;
      };
  }
}

function attachItemEvents(div) {
    setupDeleteBtn(div);
    
    // GESTION DOUBLE CLIC BOUTON LIEN
    if (div.classList.contains('link-button')) {
        div.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            saveState();
            if (div.classList.contains('square')) div.classList.replace('square', 'round');
            else div.classList.replace('round', 'square');
        });
    }

    // DRAG
    div.onmousedown = (e) => {
        if(e.target.getAttribute("contenteditable")) return;
        e.stopPropagation();
        
        document.querySelectorAll(".item-box").forEach(i => i.classList.remove("selected"));
        div.classList.add("selected");
        state.activeItem = div;

        const startX = e.clientX; const startY = e.clientY;
        const startW = div.offsetWidth; const startH = div.offsetHeight;
        const startL = div.offsetLeft; const startT = div.offsetTop;

        // Resize
        if(e.target.classList.contains("resize-handle")) {
            function onMove(ev) {
                const dx = (ev.clientX - startX) / editorZoom;
                const dy = (ev.clientY - startY) / editorZoom;
                div.style.width = Math.max(30, startW + dx) + "px";
                div.style.height = Math.max(30, startH + dy) + "px";
            }
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", () => window.removeEventListener("mousemove", onMove), {once:true});
            return;
        }
        
        // Drag
        function onDrag(ev) {
            const dx = (ev.clientX - startX) / editorZoom;
            const dy = (ev.clientY - startY) / editorZoom;
            div.style.left = (startL + dx) + "px";
            div.style.top = (startT + dy) + "px";
        }
        window.addEventListener("mousemove", onDrag);
        window.addEventListener("mouseup", () => window.removeEventListener("mousemove", onDrag), {once:true});
    };
}

function reattachEventListeners() {
    document.querySelectorAll(".text-box, .image-box, .shape-box, .bubble-box, .link-button").forEach(attachItemEvents);
}

// --- DOUBLE CLIC (BULLES & TEXTE) ---
slide.addEventListener("dblclick", (e) => {
  const bubble = e.target.closest(".bubble-box");
  if (bubble) {
      e.stopPropagation();
      const current = bubble.dataset.desc || "";
      const next = prompt("Modifier le texte de la bulle :", current);
      if (next !== null) {
          saveState();
          bubble.dataset.desc = next.trim();
      }
      return;
  }
  const content = e.target.closest(".content");
  if (content) {
      const parentBox = content.closest(".text-box");
      activateTextBox(parentBox, content);
  }
});

const addBubbleBtn = document.getElementById("addBubbleBtn");
let addBubbleMode = false;

addBubbleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  addBubbleMode = !addBubbleMode;
  addBubbleBtn.classList.toggle("active", addBubbleMode);
  addBubbleBtn.textContent = addBubbleMode ? "Cliquez sur la slide..." : "Ajouter une bulle";
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
  const num = document.createElement("span");
  num.className = "bubble-num";
  num.textContent = "?";
  const del = document.createElement("div");
  del.className = "delete-btn";
  del.textContent = "✕";
  bubble.appendChild(num);
  bubble.appendChild(del);
  bubble.style.left = `${x - 18}px`;
  bubble.style.top  = `${y - 18}px`;
  slide.appendChild(bubble);
  attachItemEvents(bubble);
  renumberBubbles();
  state.activeItem = bubble;
}

function renumberBubbles() {
  const bubbles = slide.querySelectorAll(".bubble-box");
  bubbles.forEach((bubble, index) => {
    const num = bubble.querySelector(".bubble-num");
    if (num) num.textContent = index + 1;
  });
}

// --- VARIABLES GLOBALES ---
let addMode = false;
let activeTextBox = null;
let dragging = null;
let resizing = null;
let rotating = null;
let offsetX = 0, offsetY = 0;
let startW = 0, startH = 0;
let startMouseX = 0, startMouseY = 0;
let startAngle = 0;
let currentRotation = 0;
 
slide.addEventListener("click", (e) => {
    const obj = e.target.closest(".text-box, .image-box, .shape-box, .bubble-box, .link-button");
    document.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
    if (obj) {
        state.activeItem = obj;
        obj.classList.add("selected");
        if (!obj.classList.contains("text-box")) slide.appendChild(obj);
        return;
    }
    state.activeItem = null;
    
    // Création
    if (addBubbleMode && e.target === slide) {
        const rect = slide.getBoundingClientRect();
        createBubble((e.clientX - rect.left) / editorZoom, (e.clientY - rect.top) / editorZoom);
        addBubbleMode = false;
        addBubbleBtn.classList.remove("active");
        addBubbleBtn.textContent = "Ajouter une bulle";
        return;
    }
    if (addMode && e.target === slide) {
        saveState();
        const rect = slide.getBoundingClientRect();
        const box = document.createElement("div");
        box.className = "text-box";
        box.innerHTML = `<div class="content" contenteditable="false">Double-cliquez pour modifier</div><div class="delete-btn">✕</div><div class="rotate-handle">↻</div>`;
        box.style.left = `${(e.clientX - rect.left) / editorZoom - 75}px`;
        box.style.top = `${(e.clientY - rect.top) / editorZoom - 20}px`;
        slide.appendChild(box);
        attachItemEvents(box);
        state.activeItem = box;
        addMode = false;
        addTextBtn.textContent = "Ajouter un texte";
        addTextBtn.classList.remove("active");
    }
});

// --- SUPPRESSION CLAVIER ---
window.addEventListener("keydown", (e) => {
    if (!state.activeItem) return;
    if (e.key === "Delete" || e.key === "Backspace") {
        const isEditing = document.activeElement && document.activeElement.classList.contains("content") && document.activeElement.isContentEditable;
        if (isEditing) return;
 
        // >>> MODIFICATION : GESTION LIEN CLAVIER <<<
        if(state.activeItem.classList.contains('link-button')) {
            handleLinkDelete(state.activeItem);
        }

        saveState();
        state.activeItem.remove();
        renumberBubbles();
        state.activeItem = null;
        hideToolbar();
        e.preventDefault();
    }
});

// ... (Le reste du code drag/resize/formatage reste inchangé) ...
slide.addEventListener("mousedown", (e) => {
    // RESIZE
    const handle = e.target.closest(".resize-handle");
    if (handle) {
        resizing = handle.parentElement;
        const rect = resizing.getBoundingClientRect();
        startW = rect.width / editorZoom;
        startH = rect.height / editorZoom;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        e.preventDefault();
        return;
    }
 
    // ROTATION
    const rotateHandle = e.target.closest(".rotate-handle");
    if (rotateHandle) {
        rotating = rotateHandle.parentElement;
        state.activeItem = rotating;
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
 
    // DRAG
    const target = e.target.closest(".text-box, .image-box, .shape-box, .bubble-box, .link-button");
    if (!target || (e.target.classList.contains("content") && e.target.isContentEditable)) return;
 
    dragging = target;
    state.activeItem = target;
    const rect = dragging.getBoundingClientRect();
    offsetX = (e.clientX - rect.left) / editorZoom;
    offsetY = (e.clientY - rect.top) / editorZoom;
    e.preventDefault();
});

window.addEventListener("mousemove", (e) => {
    if (resizing) {
        const dx = (e.clientX - startMouseX) / editorZoom;
        const dy = (e.clientY - startMouseY) / editorZoom;
        resizing.style.width = `${Math.max(30, startW + dx)}px`;
        resizing.style.height = `${Math.max(30, startH + dy)}px`;
        return;
    }
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
    if (dragging) {
        const slideRect = slide.getBoundingClientRect();
        let newLeft = (e.clientX - slideRect.left) / editorZoom - offsetX;
        let newTop = (e.clientY - slideRect.top) / editorZoom - offsetY;
        dragging.style.left = `${newLeft}px`;
        dragging.style.top = `${newTop}px`;
        if (dragging === activeTextBox) showToolbar(dragging);
    }
});
window.addEventListener("mouseup", () => {
    if (rotating || resizing || dragging) saveState();
    dragging = null; resizing = null; rotating = null;
});

function activateTextBox(box, content) {
    if (activeTextBox && activeTextBox !== box) activeTextBox.querySelector(".content").contentEditable = "false";
    activeTextBox = box;
    content.contentEditable = "true";
    content.focus();
    showToolbar(box);
}
function showToolbar(box) {
    if (!floatingToolbar) return;
    const boxRect = box.getBoundingClientRect();
    const workspaceRect = document.querySelector(".overlay-workspace").getBoundingClientRect();
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
document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".text-box") && !e.target.closest(".floating-toolbar") && !e.target.closest(".top-toolbar")) hideToolbar();
});
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
    reader.onload = () => { saveState(); slide.style.backgroundImage = `url(${reader.result})`; slide.style.backgroundSize = "cover"; };
    reader.readAsDataURL(file);
});
function formatText(cmd, val = null) {
    if (state.activeItem && state.activeItem.classList.contains("shape-box") && cmd === "foreColor") {
        saveState();
        state.activeItem.querySelector(".shape-content").style.backgroundColor = val;
    } else {
        saveState();
        document.execCommand(cmd, false, val);
    }
}
document.getElementById("topTextColor").addEventListener("input", (e) => {
    if (state.activeItem && state.activeItem.classList.contains("shape-box")) {
        saveState();
        state.activeItem.querySelector(".shape-content").style.backgroundColor = e.target.value;
    } else if (state.activeItem && state.activeItem.classList.contains("bubble-box")) {
        saveState();
        state.activeItem.style.backgroundColor = e.target.value;
    } else {
        formatText("foreColor", e.target.value);
    }
});
document.getElementById("topBoldBtn").onclick = () => formatText("bold");
document.getElementById("topItalicBtn").onclick = () => formatText("italic");
document.getElementById("topUnderlineBtn").onclick = () => formatText("underline");
document.getElementById("topHighlightColor").addEventListener("input", (e) => { document.getElementById("highlightColor").value = e.target.value; });
document.getElementById("topHighlightBtn").onclick = () => formatText("hiliteColor", document.getElementById("topHighlightColor").value);
document.getElementById("topFontFamily").addEventListener("change", (e) => {
    if (state.activeItem && state.activeItem.classList.contains("text-box")) {
        saveState();
        state.activeItem.querySelector(".content").style.fontFamily = e.target.value;
    } else {
        formatText("fontName", e.target.value);
    }
});
document.getElementById("topFontSize").addEventListener("change", (e) => {
    if (state.activeItem && state.activeItem.classList.contains("text-box")) {
        saveState();
        state.activeItem.querySelector(".content").style.fontSize = e.target.value;
    } else {
        document.execCommand("fontSize", false, "7");
        const fontElements = document.querySelectorAll("font[size='7']");
        fontElements.forEach(el => { el.removeAttribute("size"); el.style.fontSize = e.target.value; });
    }
});
if (boldBtn) boldBtn.onclick = () => formatText("bold");
if (italicBtn) italicBtn.onclick = () => formatText("italic");
if (underlineBtn) underlineBtn.onclick = () => formatText("underline");
if (highlightBtn) highlightBtn.onclick = () => formatText("hiliteColor", highlightColor ? highlightColor.value : "#ffff00");
if (fontFamily) fontFamily.addEventListener("change", (e) => { if (activeTextBox) activeTextBox.querySelector(".content").style.fontFamily = e.target.value; });
if (fontSize) fontSize.addEventListener("change", (e) => { if (activeTextBox) activeTextBox.querySelector(".content").style.fontSize = e.target.value; });
if (textColor) textColor.addEventListener("input", (e) => formatText("foreColor", e.target.value));
function addEditorShape(type) { addShape(type); }
let historyStack = []; let redoStack = [];
function saveState() { historyStack.push({ innerHTML: slide.innerHTML, bg: slide.style.backgroundColor, img: slide.style.backgroundImage }); redoStack = []; }
function undo() { if (historyStack.length === 0) return; redoStack.push({ innerHTML: slide.innerHTML, bg: slide.style.backgroundColor, img: slide.style.backgroundImage }); const s = historyStack.pop(); slide.innerHTML = s.innerHTML; slide.style.backgroundColor = s.bg; slide.style.backgroundImage = s.img; reattachEventListeners(); }
function redo() { if (redoStack.length === 0) return; historyStack.push({ innerHTML: slide.innerHTML, bg: slide.style.backgroundColor, img: slide.style.backgroundImage }); const s = redoStack.pop(); slide.innerHTML = s.innerHTML; slide.style.backgroundColor = s.bg; slide.style.backgroundImage = s.img; reattachEventListeners(); }
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
});
let editorZoom = 1; const MIN_ZOOM = 0.3; const MAX_ZOOM = 3;
const overlayWorkspace = document.querySelector(".overlay-workspace");
const slideZoomWrapper = document.getElementById("slideZoomWrapper");
function applyZoom() { if (slideZoomWrapper) slideZoomWrapper.style.transform = `scale(${editorZoom})`; updateZoomDisplay(); }
if (overlayWorkspace) { overlayWorkspace.addEventListener("wheel", (e) => { if (e.ctrlKey) { e.preventDefault(); editorZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, editorZoom + (e.deltaY > 0 ? -0.1 : 0.1))); applyZoom(); } }, { passive: false }); }
function zoomIn() { editorZoom = Math.min(MAX_ZOOM, editorZoom + 0.1); applyZoom(); }
function zoomOut() { editorZoom = Math.max(MIN_ZOOM, editorZoom - 0.1); applyZoom(); }
function resetZoom() { editorZoom = 1; applyZoom(); }
function updateZoomDisplay() { const z = document.getElementById("editor-zoom-text"); if(z) z.textContent = Math.round(editorZoom*100)+"%"; }

// --- NOUVELLE FONCTION : GESTION SYNCHRO SUPPRESSION ---
function handleLinkDelete(btn) {
    const targetId = btn.dataset.target;
    const myId = state.currentEditingId;

    // Trouver la connexion associée dans le graphe
    const connIndex = state.connections.findIndex(c => 
        (c.fromId === myId && c.toId === targetId) || 
        (c.fromId === targetId && c.toId === myId)
    );

    if (connIndex === -1) return;

    const conn = state.connections[connIndex];

    // CAS 1 : Je suis le départ (A -> B), je supprime le lien vers B
    if (conn.fromId === myId && conn.toId === targetId) {
        if (conn.type === 'double') {
            // C'était double, ça devient simple (sens inverse B->A reste)
            conn.line.removeAttribute('marker-end'); // Retire flèche bout
            conn.type = 'simple';
        } else {
            // C'était simple, tout disparaît
            conn.line.remove();
            state.connections.splice(connIndex, 1);
        }
    }
    // CAS 2 : Je suis l'arrivée (B -> A), je supprime le bouton retour
    else if (conn.fromId === targetId && conn.toId === myId && conn.type === 'double') {
        // C'était double, ça devient simple (sens aller A->B reste)
        conn.line.removeAttribute('marker-start'); // Retire flèche début
        conn.type = 'simple';
    }
}

// Init
reattachEventListeners();