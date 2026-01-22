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
const opacityPicker = document.getElementById("opacityPicker");

const editorLinesLayer = document.getElementById("editor-lines-layer");

// Variables d'état
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

// État global pour les lignes pointillées
let showLinkLines = true; 

// --- GESTION DE L'UNICITÉ DES NUMÉROS (Feedback Visuel) ---
if (slideNumberInput) {
    const checkDuplicate = (val) => {
        const currentId = state.currentEditingId;
        return Object.entries(state.slidesContent).some(([id, data]) => {
            return id !== currentId && 
                   data.type !== 'condition' && 
                   String(data.slideNum) === String(val);
        });
    };

    slideNumberInput.addEventListener('input', (e) => {
        const newNum = e.target.value.trim();
        
        if (newNum && checkDuplicate(newNum)) {
            e.target.style.color = "red";
            e.target.style.borderColor = "red";
            e.target.style.backgroundColor = "#fff0f0";
            e.target.title = "Ce numéro est déjà choisi !";
        } else {
            e.target.style.color = "#4e342e";
            e.target.style.borderColor = "#dcd7c9";
            e.target.style.backgroundColor = "#fdfbf7";
            e.target.title = "Numéro de la diapositive";
        }
    });
}

// --- ZOOM : UNIQUEMENT LA PAGE (DIAPO) ---
let slideZoomWrapper = null;
const overlayWorkspace = document.querySelector(".overlay-workspace") || slide?.parentElement || document.body;

function clampZoom(z) {
  return Math.max(0.3, Math.min(3, z));
}

function initSlideZoomWrapper() {
  if (!slide) return;

  if (slide.parentElement && slide.parentElement.id === "slideZoomWrapper") {
    slideZoomWrapper = slide.parentElement;
  } else {
    slideZoomWrapper = document.createElement("div");
    slideZoomWrapper.id = "slideZoomWrapper";
    slideZoomWrapper.style.display = "inline-block";
    slideZoomWrapper.style.transformOrigin = "top left";
    slideZoomWrapper.style.position = "relative";

    const parent = slide.parentElement;
    if (parent) {
      parent.insertBefore(slideZoomWrapper, slide);
      slideZoomWrapper.appendChild(slide);
    }
  }

  if (overlayWorkspace) {
    const wsStyle = window.getComputedStyle(overlayWorkspace);
    if (wsStyle.overflow === "visible") {
      overlayWorkspace.style.overflow = "auto";
    }
    overlayWorkspace.addEventListener("scroll", drawEditorLines);
  }

  applyZoom(false);
}

function attachWheelZoom() {
  if (!overlayWorkspace) return;

  overlayWorkspace.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
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

function applyZoom(keepPoint = false, anchor = null) {
  if (!slideZoomWrapper) return;

  let before = null;
  if (keepPoint && anchor && overlayWorkspace) {
    const wsRect = overlayWorkspace.getBoundingClientRect();
    const xInWs = anchor.clientX - wsRect.left + overlayWorkspace.scrollLeft;
    const yInWs = anchor.clientY - wsRect.top + overlayWorkspace.scrollTop;

    before = { xInWs, yInWs, prevZoom: anchor.prevZoom || editorZoom };
  }

  slideZoomWrapper.style.transform = `scale(${editorZoom})`;

  const z = document.getElementById("editor-zoom-text");
  if (z) z.textContent = Math.round(editorZoom * 100) + "%";

  if (before && overlayWorkspace) {
    const ratio = editorZoom / before.prevZoom;
    overlayWorkspace.scrollLeft = before.xInWs * ratio - (anchor.clientX - overlayWorkspace.getBoundingClientRect().left);
    overlayWorkspace.scrollTop = before.yInWs * ratio - (anchor.clientY - overlayWorkspace.getBoundingClientRect().top);
  }

  drawEditorLines();
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

const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetZoomBtn = document.getElementById("resetZoomBtn");
if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn);
if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);
if (resetZoomBtn) resetZoomBtn.addEventListener("click", resetZoom);

initSlideZoomWrapper();
attachWheelZoom();

// --- COPY / PASTE ---
let itemClipboard = null; 
const PASTE_OFFSET = 20;

function isEditingText() {
  const ae = document.activeElement;
  if (!ae) return false;
  if (ae.isContentEditable) return true;
  const tag = ae.tagName ? ae.tagName.toLowerCase() : "";
  return tag === "input" || tag === "textarea";
}

function ensureHandlesIfNeeded(div) {
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
  const opacity = el.style.opacity || "1";

  const dataset = {};
  Object.keys(el.dataset || {}).forEach((k) => (dataset[k] = el.dataset[k]));

  return {
    className: el.className,
    innerHTML: el.innerHTML,
    style: { left, top, width, height, transform, opacity },
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
  div.style.opacity = snapshot.style.opacity;

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

  document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
  div.classList.add("selected");
  state.activeItem = div;
  renumberBubbles();

  if (div.classList.contains("link-button")) drawEditorLines();
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
  if (historyStack.length > 40) historyStack.shift();
  redoStack = [];
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
  drawEditorLines();
}

// --- FONCTION DE SAUVEGARDE DE LA DIAPO COURANTE ---
function saveCurrentSlide() {
  if (!state.currentEditingId) return;

  // Vérifier si le numéro est valide (pas rouge)
  let finalNum = slideNumberInput ? slideNumberInput.value : "";
  if (slideNumberInput && slideNumberInput.style.color === "red") {
      const originalData = state.slidesContent[state.currentEditingId];
      finalNum = originalData ? originalData.slideNum : "";
  }

  // Sauvegarde des données
  state.slidesContent[state.currentEditingId] = {
    html: slide.innerHTML,
    bg: slide.style.backgroundColor,
    bgImg: slide.style.backgroundImage,
    slideNum: finalNum,
  };
  
  // Mise à jour visuelle du noeud dans le graphe
  const slideElement = document.getElementById(state.currentEditingId);
  if (slideElement) {
    const infoOverlay = slideElement.querySelector(".slide-info-overlay");
    if (infoOverlay) {
      const type = slideElement.className.includes("condition") ? "condition" : 
                   slideElement.className.includes("fin") ? "fin" : "normal";
      
      if (type === "condition") {
        infoOverlay.innerHTML = `<span style="font-size:24px;">❓</span>`;
      } else if (type === "fin") {
        infoOverlay.innerHTML = "🏁 " + finalNum;
      } else {
        infoOverlay.innerHTML = finalNum;
      }
    }
  }
  
  // Mise à jour de l'aperçu
  if (window.updateNodePreview) window.updateNodePreview(state.currentEditingId);
}

// --- OUVERTURE / FERMETURE ---
function openEditor(slideId) {
  state.currentEditingId = slideId;
  const data = state.slidesContent[slideId] || { html: "", bg: "#ffffff", bgImg: "", slideNum: "" };
  slide.innerHTML = data.html;
  slide.style.backgroundColor = data.bg;
  slide.style.backgroundImage = data.bgImg || "";
  bgColorPicker.value = data.bg || "#ffffff";
  if (slideNumberInput) {
      slideNumberInput.value = data.slideNum || "";
      slideNumberInput.style.color = "#4e342e";
      slideNumberInput.style.borderColor = "#dcd7c9";
      slideNumberInput.style.backgroundColor = "#fdfbf7";
      slideNumberInput.title = "Numéro de la diapositive";
  }

  historyStack = [];
  redoStack = [];

  reattachEventListeners();
  initSlideZoomWrapper();
  editorOverlay.style.display = "flex";
  
  if (typeof updateLinkedList === 'function') updateLinkedList();
  setTimeout(drawEditorLines, 100); 
}

document.getElementById("btn-close-editor").onclick = () => {
  // Sauvegarder avant de quitter
  saveCurrentSlide();
  
  editorOverlay.style.display = "none";
  state.currentEditingId = null;
  if(editorLinesLayer) editorLinesLayer.innerHTML = '';
};

// --- LISTE DES DIAPOS LIEES (PANNEAU DROIT) ---

function resolveRealTarget(startNodeId, comingFromId) {
    const nodeData = state.slidesContent[startNodeId];
    if (!nodeData) return { id: startNodeId, isThroughCond: false };

    if (nodeData.type === 'condition') {
        const nextConn = state.connections.find(c => 
            (c.fromId === startNodeId || c.toId === startNodeId) && 
            (c.fromId === startNodeId ? c.toId : c.fromId) !== comingFromId
        );
        if (nextConn) {
            const nextId = (nextConn.fromId === startNodeId) ? nextConn.toId : nextConn.fromId;
            const result = resolveRealTarget(nextId, startNodeId);
            return { id: result.id, isThroughCond: true };
        }
    }
    return { id: startNodeId, isThroughCond: false };
}

function getLinkedSlideIds(slideId) {
    if (typeof state === 'undefined' || !state.connections) return { outgoing: [], incoming: [] };
    const outgoing = state.connections.filter(c => c.fromId === slideId);
    const incoming = state.connections.filter(c => c.toId === slideId);
    return { outgoing, incoming };
}

function renderLinkedSlidesPanel() {
    const panel = document.getElementById('linkedSlidesPanel');
    if (!panel) return;
    
    panel.innerHTML = `
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #3e2723;">Chemins & Logique</h3>
        <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666;">
             <input type="checkbox" id="sidebarToggleLines" ${showLinkLines ? "checked" : ""} style="cursor: pointer;">
             <label for="sidebarToggleLines" style="cursor: pointer; user-select: none;">Afficher pointillés</label>
        </div>
        <hr style="border: 0; border-top: 1px solid #dcd7c9; margin-bottom: 20px;">
    `;

    const chk = document.getElementById('sidebarToggleLines');
    if (chk) {
        chk.addEventListener('change', (e) => {
            showLinkLines = e.target.checked;
            drawEditorLines();
        });
    }

    const cur = state.currentEditingId;
    if (!cur) return;

    const links = getLinkedSlideIds(cur);

    const createLinkCard = (connection, isOutgoing) => {
        const immediateId = isOutgoing ? connection.toId : connection.fromId;
        const originId = isOutgoing ? connection.fromId : connection.toId;
        
        const resolved = resolveRealTarget(immediateId, originId);
        const targetData = state.slidesContent[resolved.id] || {};
        
        const displayNum = targetData.slideNum || resolved.id.split('-')[1];
        const isThroughCond = resolved.isThroughCond || (state.slidesContent[immediateId]?.type === 'condition');
        
        const typeLabel = targetData.type === 'fin' ? "Bloc Fin" : "Diapositive";
        const descLabel = isThroughCond ? "Liaison avec Condition" : (connection.type === 'double' ? 'Liaison Aller-Retour' : 'Liaison Simple');
        const icon = isThroughCond ? "⚡" : (targetData.type === 'fin' ? "🏁" : "📄");

        const card = document.createElement('div');
        card.className = 'link-card';
        if(isOutgoing) card.dataset.targetId = immediateId;

        card.innerHTML = `
            <div class="link-card-icon">${icon}</div>
            <div class="link-card-info">
                <span class="link-card-title">${isOutgoing ? 'Vers' : 'De'} ${typeLabel} ${displayNum}</span>
                <span class="link-card-desc">${descLabel}</span>
            </div>
        `;

        card.addEventListener('click', (e) => {
            e.stopPropagation();
            saveCurrentSlide(); // <--- SAUVEGARDE AVANT CHANGEMENT
            openEditor(resolved.id);
        });
        
        return card;
    };

    if (links.outgoing.length > 0) {
        const titleOut = document.createElement('div');
        titleOut.className = 'sidebar-section-title';
        titleOut.textContent = 'Connexions Sortantes';
        panel.appendChild(titleOut);
        links.outgoing.forEach(conn => panel.appendChild(createLinkCard(conn, true)));
    }

    if (links.incoming.length > 0) {
        const titleIn = document.createElement('div');
        titleIn.className = 'sidebar-section-title';
        titleIn.style.marginTop = "20px";
        titleIn.textContent = 'Connexions Entrantes';
        panel.appendChild(titleIn);
        links.incoming.forEach(conn => panel.appendChild(createLinkCard(conn, false)));
    }

    if (links.outgoing.length === 0 && links.incoming.length === 0) {
        const empty = document.createElement('div');
        empty.style.padding = "20px";
        empty.style.textAlign = "center";
        empty.style.border = "2px dashed #dcd7c9";
        empty.style.borderRadius = "8px";
        empty.style.color = "#8d6e63";
        empty.innerHTML = `
            <span style="font-size: 24px; display:block; margin-bottom:5px;">🔗</span>
            <span style="font-size: 13px;">Aucune connexion.</span>
        `;
        panel.appendChild(empty);
    }

    setTimeout(drawEditorLines, 50);
}

window.updateLinkedList = renderLinkedSlidesPanel;

// --- DESSIN DES LIGNES POINTILLÉES (SVG) ---
function drawEditorLines() {
    if (!editorLinesLayer) return;
    editorLinesLayer.innerHTML = ''; 

    if (!showLinkLines) return;

    const linkButtons = slide.querySelectorAll('.link-button');
    if (linkButtons.length === 0) return;

    const svgRect = editorLinesLayer.getBoundingClientRect();

    linkButtons.forEach(btn => {
        const targetId = btn.dataset.target;
        const targetCard = document.querySelector(`.link-card[data-target-id="${targetId}"]`);

        if (targetCard) {
            const btnRect = btn.getBoundingClientRect();
            const x1 = btnRect.right - svgRect.left;
            const y1 = btnRect.top + (btnRect.height / 2) - svgRect.top;

            const cardRect = targetCard.getBoundingClientRect();
            const x2 = cardRect.left - svgRect.left;
            const y2 = cardRect.top + (cardRect.height / 2) - svgRect.top;

            const dist = Math.abs(x2 - x1) / 2;
            const cp1x = x1 + dist; 
            const cp1y = y1;
            const cp2x = x2 - dist; 
            const cp2y = y2;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`);
            path.setAttribute("class", "editor-line");

            editorLinesLayer.appendChild(path);
        }
    });
}

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

// --- ÉVÉNEMENTS SOURIS ---
slide.addEventListener("mousedown", (e) => {
  const item = e.target.closest(".item-box, .text-box, .image-box, .shape-box, .bubble-box, .link-button");
  const handle = e.target.closest(".resize-handle, .rotate-handle");

  if (!item && !handle) {
    document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
    state.activeItem = null;
    return;
  }

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

    if (opacityPicker) opacityPicker.value = item.style.opacity || 1;

    e.preventDefault();
  }
});

window.addEventListener("mousemove", (e) => {
  if (resizing) {
    const dx = (e.clientX - startMouseX) / editorZoom;
    const dy = (e.clientY - startMouseY) / editorZoom;
    resizing.style.width = `${Math.max(30, startW + dx)}px`;
    resizing.style.height = `${Math.max(30, startH + dy)}px`;
    
    if (resizing.classList.contains('link-button')) drawEditorLines();

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
    
    if (dragging.classList.contains('link-button')) drawEditorLines();
  }
});

window.addEventListener("mouseup", () => {
  dragging = null;
  resizing = null;
  rotating = null;
});

// --- CORRECTION : Suppression du lien SVG ---
function handleLinkDelete(div) {
  if (!state.currentEditingId) return;
  const targetId = div.dataset.target;

  const connsToDelete = state.connections.filter(c => 
    c.fromId === state.currentEditingId && c.toId === targetId
  );

  connsToDelete.forEach(conn => {
    if (conn.line) conn.line.remove();
  });

  state.connections = state.connections.filter(c => 
    !(c.fromId === state.currentEditingId && c.toId === targetId)
  );

  if (typeof updateLinkedList === 'function') updateLinkedList();
}

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
      drawEditorLines();
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
  if (left + floatingToolbar.offsetWidth > slideRect.width) left = slideRect.width - floatingToolbar.offsetWidth - 10;
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

document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".text-box") && !e.target.closest(".floating-toolbar") && !e.target.closest(".resize-handle") && !e.target.closest(".rotate-handle")) {
      hideToolbar();
    }
}, true);

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
    if (n) n.textContent = i + 1;
  });
}

// --- FORMATAGE ---
textColor.addEventListener("input", (e) => {
  if (!activeTextBox) return;
  saveState();
  const content = activeTextBox.querySelector(".content");
  if (content) content.style.color = e.target.value;
});

fontFamily.addEventListener("change", (e) => {
  if (!activeTextBox) return;
  saveState();
  const content = activeTextBox.querySelector(".content");
  if (content) content.style.fontFamily = e.target.value;
});

fontSize.addEventListener("change", (e) => {
  if (!activeTextBox) return;
  saveState();
  const content = activeTextBox.querySelector(".content");
  if (content) content.style.fontSize = e.target.value;
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

// --- Z-INDEX ---
function bringToFront() {
  if (!state.activeItem) return;
  saveState();
  const allItems = slide.querySelectorAll(".item-box, .text-box, .image-box, .shape-box, .bubble-box, .link-button");
  let maxZ = 0;
  allItems.forEach(item => {
    const z = parseInt(window.getComputedStyle(item).zIndex) || 0;
    maxZ = Math.max(maxZ, z);
  });
  state.activeItem.style.zIndex = maxZ + 1;
}

function sendToBack() {
  if (!state.activeItem) return;
  saveState();
  state.activeItem.style.zIndex = 0;
}

const bringToFrontBtn = document.getElementById("bringToFrontBtn");
const sendToBackBtn = document.getElementById("sendToBackBtn");
if (bringToFrontBtn) bringToFrontBtn.addEventListener("click", bringToFront);
if (sendToBackBtn) sendToBackBtn.addEventListener("click", sendToBack);

if (shapeColorPicker) {
  shapeColorPicker.addEventListener("input", (e) => {
    saveState();
    if (state.activeItem) {
      const shapeContent = state.activeItem.querySelector(".shape-content");
      if (shapeContent) {
        shapeContent.style.backgroundColor = e.target.value;
      } else {
        state.activeItem.style.backgroundColor = e.target.value;
      }
    }
  });
}

if (opacityPicker) {
  opacityPicker.addEventListener("input", (e) => {
    if (state.activeItem) {
      saveState();
      state.activeItem.style.opacity = e.target.value;
    }
  });
}

// --- BOUTONS DIVERS ---
addImageBtn.addEventListener("click", () => imageInput.click());
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
  bgImageInput.value = "";
});

document.getElementById("undoBtn").onclick = undo;
document.getElementById("redoBtn").onclick = redo;

window.addEventListener("keydown", (e) => {
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
      drawEditorLines();
      return;
    }
  }

  if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
    if (itemClipboard) {
      e.preventDefault();
      pasteSnapshot(itemClipboard);
      return;
    }
  }

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
    drawEditorLines();
  }

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