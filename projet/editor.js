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
let dragging = null, resizing = null, rotating = null;
let offsetX = 0, offsetY = 0;
let startW = 0, startH = 0;
let startMouseX = 0, startMouseY = 0;
let startAngle = 0, currentRotation = 0;
let editorZoom = 1;
let addMode = false;
let addBubbleMode = false;
let activeTextBox = null;

// --- SYSTÈME UNDO / REDO ---
let historyStack = [];
let redoStack = [];

function saveState() {
    // On enregistre l'état actuel avant modification
    historyStack.push({
        innerHTML: slide.innerHTML,
        bg: slide.style.backgroundColor,
        img: slide.style.backgroundImage
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
        img: slide.style.backgroundImage
    });
    const stateData = historyStack.pop();
    applyState(stateData);
}

function redo() {
    if (redoStack.length === 0) return;
    historyStack.push({
        innerHTML: slide.innerHTML,
        bg: slide.style.backgroundColor,
        img: slide.style.backgroundImage
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

document.getElementById('btn-close-editor').onclick = () => {
    if (state.currentEditingId) {
        state.slidesContent[state.currentEditingId] = {
            html: slide.innerHTML,
            bg: slide.style.backgroundColor,
            bgImg: slide.style.backgroundImage,
            slideNum: slideNumberInput ? slideNumberInput.value : ""
        };
        if (window.updateNodePreview) window.updateNodePreview(state.currentEditingId);
    }
    editorOverlay.style.display = 'none';
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
    div.innerHTML = html + (className.includes('link-button') ? '' : `<div class="resize-handle"></div><div class="delete-btn">✕</div><div class="rotate-handle">↻</div>`);
    slide.appendChild(div);
    attachItemEvents(div);
}

function addEditorShape(type) {
    let content = "";
    if (type === 'square') content = `<div class="shape-content" style="background:#8d6e63; width:100%; height:100%;"></div>`;
    else if (type === 'circle') content = `<div class="shape-content" style="background:#8d6e63; width:100%; height:100%; border-radius:50%;"></div>`;
    else if (type === 'triangle') content = `<div class="shape-content" style="background:#8d6e63; width:100%; height:100%; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div>`;
    else if (type === 'arrow') content = `<div class="shape-content" style="background:#8d6e63; width:100%; height:100%; clip-path: polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%);"></div>`;
    
    createItem(content, `shape-box ${type}`, 100, 100);
}

// --- ÉVÉNEMENTS SOURIS (DRAG, RESIZE, ROTATE) ---
slide.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".item-box, .text-box, .image-box, .shape-box, .bubble-box, .link-button");
    const handle = e.target.closest(".resize-handle, .rotate-handle");

    if (!item && !handle) {
        document.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
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
        document.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
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
    dragging = null; resizing = null; rotating = null;
});

// --- ATTACHEMENT DES ÉVÉNEMENTS AUX BOXES ---
function attachItemEvents(div) {
    const delBtn = div.querySelector(".delete-btn");
    if (delBtn) {
        delBtn.onclick = (e) => {
            e.stopPropagation();
            saveState();
            if (div.classList.contains('link-button')) handleLinkDelete(div);
            div.remove();
            renumberBubbles();
            state.activeItem = null;
        };
    }

    if (div.classList.contains('link-button')) {
        div.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            saveState();
            div.classList.toggle('square');
            div.classList.toggle('round');
        });
    }
}

function reattachEventListeners() {
    slide.querySelectorAll(".item-box, .text-box, .image-box, .shape-box, .bubble-box, .link-button").forEach(attachItemEvents);
}

// --- TEXTE ET BULLES ---
addTextBtn.addEventListener("click", () => createItem(`<div class="content" contenteditable="true">Texte...</div>`, "text-box"));

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
    if (!state.activeItem) return;
    saveState();
    if (state.activeItem.classList.contains("text-box")) {
        state.activeItem.querySelector(".content").style.color = e.target.value;
    } else if (state.activeItem.querySelector(".shape-content")) {
        state.activeItem.querySelector(".shape-content").style.backgroundColor = e.target.value;
    } else if (state.activeItem.classList.contains("bubble-box")) {
        state.activeItem.style.backgroundColor = e.target.value;
    }
});

// --- RACCOURCIS ET BOUTONS ---
document.getElementById("undoBtn").onclick = undo;
document.getElementById("redoBtn").onclick = redo;

window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
    if ((e.key === "Delete" || e.key === "Backspace") && state.activeItem) {
        if (document.activeElement.isContentEditable) return;
        saveState();
        if (state.activeItem.classList.contains('link-button')) handleLinkDelete(state.activeItem);
        state.activeItem.remove();
        state.activeItem = null;
    }
});

// --- ZOOM ---
function applyZoom() { 
    if (slideZoomWrapper) slideZoomWrapper.style.transform = `scale(${editorZoom})`; 
    const z = document.getElementById("editor-zoom-text");
    if(z) z.textContent = Math.round(editorZoom*100)+"%";
}
function zoomIn() { editorZoom = Math.min(3, editorZoom + 0.1); applyZoom(); }
function zoomOut() { editorZoom = Math.max(0.3, editorZoom - 0.1); applyZoom(); }
function resetZoom() { editorZoom = 1; applyZoom(); }