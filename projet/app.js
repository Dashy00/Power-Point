// --- INIT ---
const viewport = document.getElementById('viewport');
const canvas = document.getElementById('canvas');
const connectionsLayer = document.getElementById('connections-layer');
const zoomText = document.getElementById('zoom-text');
const editorOverlay = document.getElementById('editor-overlay');
const editableSlide = document.getElementById('editable-slide');

let state = {
    scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0,
    slideCount: 0, selectedSlide: null, isDraggingSlide: false, dragOffset: {x:0, y:0},
    isConnecting: false, connectionStart: null, tempLine: null,
    connections: [], slidesContent: {} // { id: { html: "...", bg: "..." } }
};

// =========================================================================
// PARTIE 1 : LOGIQUE DU GRAPHE
// =========================================================================

// --- ZOOM & PAN ---
function setTransform() {
    canvas.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
    zoomText.innerText = Math.round(state.scale * 100) + '%';
}
document.getElementById('btn-zoom-in').onclick = () => { state.scale = Math.min(state.scale + 0.1, 3); setTransform(); };
document.getElementById('btn-zoom-out').onclick = () => { state.scale = Math.max(state.scale - 0.1, 0.2); setTransform(); };
document.getElementById('btn-reset').onclick = () => { state.scale = 1; state.pointX = 0; state.pointY = 0; setTransform(); };

viewport.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.slide') && !e.target.closest('.port')) {
        state.panning = true;
        state.startX = e.clientX - state.pointX;
        state.startY = e.clientY - state.pointY;
        viewport.style.cursor = 'grabbing';
    }
});

viewport.addEventListener('mousemove', (e) => {
    e.preventDefault();
    // PAN
    if (state.panning) {
        state.pointX = e.clientX - state.startX;
        state.pointY = e.clientY - state.startY;
        setTransform();
    }
    // DRAG SLIDE
    if (state.isDraggingSlide && state.selectedSlide) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / state.scale - state.dragOffset.x;
        const y = (e.clientY - rect.top) / state.scale - state.dragOffset.y;
        state.selectedSlide.style.left = x + 'px';
        state.selectedSlide.style.top = y + 'px';
        updateConnections(); 
    }
    // CREATION FLECHE
    if (state.isConnecting && state.tempLine) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / state.scale;
        const mouseY = (e.clientY - rect.top) / state.scale;
        state.tempLine.setAttribute('x2', mouseX);
        state.tempLine.setAttribute('y2', mouseY);
    }
});

viewport.addEventListener('mouseup', () => {
    state.panning = false;
    state.isDraggingSlide = false;
    viewport.style.cursor = 'grab';
    // Fin connexion ratée
    if(state.isConnecting && state.tempLine) {
        if (!event.target.classList.contains('port')) {
            state.tempLine.remove();
        }
        state.isConnecting = false;
        state.tempLine = null;
    }
});

// --- SLIDES ---
function createSlide(type) {
    state.slideCount++;
    const id = `slide-${state.slideCount}`;
    state.slidesContent[id] = { html: "", bg: "#ffffff", img: "" }; // Init contenu

    const slide = document.createElement('div');
    slide.className = `slide ${type}`;
    slide.id = id;
    slide.innerHTML = getTypeLabel(type) + ' ' + state.slideCount;
    
    // Spawn au centre
    const centerX = 2500 - (state.pointX / state.scale);
    const centerY = 2500 - (state.pointY / state.scale);
    slide.style.left = (centerX - 75) + 'px';
    slide.style.top = (centerY - 40) + 'px';

    slide.addEventListener('mousedown', (e) => {
        if(e.target.classList.contains('port')) return;
        e.stopPropagation();
        selectSlide(slide);
        state.isDraggingSlide = true;
        state.dragOffset.x = e.offsetX;
        state.dragOffset.y = e.offsetY;
    });

    slide.addEventListener('dblclick', (e) => { e.stopPropagation(); openEditor(id); });

    ['top','right','bottom','left'].forEach(pos => {
        const port = document.createElement('div');
        port.className = `port ${pos}`;
        port.addEventListener('mousedown', (e) => startConnection(e, id, port));
        port.addEventListener('mouseup', (e) => endConnection(e, id, port));
        slide.appendChild(port);
    });

    canvas.appendChild(slide);
}

function getTypeLabel(type) { return (type==='info')?'ℹ️':(type==='condition')?'❓':(type==='fin')?'🏁':'📄'; }
function selectSlide(slide) {
    if(state.selectedSlide) state.selectedSlide.classList.remove('selected');
    state.selectedSlide = slide;
    slide.classList.add('selected');
}

// Boutons Graphe
document.getElementById('btn-new-slide').onclick = () => createSlide('default');
document.getElementById('btn-info-bulle').onclick = () => createSlide('info');
document.getElementById('btn-condition').onclick = () => createSlide('condition');
document.getElementById('btn-bloc-fin').onclick = () => createSlide('fin');
document.getElementById('btn-delete').onclick = () => { if(state.selectedSlide){state.selectedSlide.remove(); state.selectedSlide=null;} };

// --- CONNEXIONS ---
function startConnection(e, slideId, port) {
    e.stopPropagation();
    state.isConnecting = true;
    state.connectionStart = { id: slideId, port: port };
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5,5');
    line.setAttribute('marker-end', 'url(#arrow-end)');
    
    const start = getPortCenter(port);
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', start.x);
    line.setAttribute('y2', start.y);
    
    connectionsLayer.appendChild(line);
    state.tempLine = line;
}

function endConnection(e, slideId, port) {
    e.stopPropagation();
    if(state.isConnecting && state.tempLine) {
        if(state.connectionStart.id !== slideId) {
            state.tempLine.removeAttribute('stroke-dasharray');
            const end = getPortCenter(port);
            state.tempLine.setAttribute('x2', end.x);
            state.tempLine.setAttribute('y2', end.y);
            
            // AJOUT : Double clic sur flèche pour double sens
            state.tempLine.addEventListener('dblclick', function(evt) {
                evt.stopPropagation();
                const startMarker = this.getAttribute('marker-start');
                if (startMarker) {
                    this.removeAttribute('marker-start');
                } else {
                    this.setAttribute('marker-start', 'url(#arrow-start)');
                }
            });

            // AJOUT : Suppression flèche
            state.tempLine.addEventListener('contextmenu', function(evt) {
                evt.preventDefault();
                this.remove();
            });

            state.connections.push({ line: state.tempLine, fromPort: state.connectionStart.port, toPort: port });
            state.tempLine = null;
        } else {
            state.tempLine.remove();
        }
        state.isConnecting = false;
    }
}

function getPortCenter(port) {
    const rect = port.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
        x: (rect.left - canvasRect.left + rect.width/2) / state.scale,
        y: (rect.top - canvasRect.top + rect.height/2) / state.scale
    };
}

function updateConnections() {
    state.connections.forEach(conn => {
        const start = getPortCenter(conn.fromPort);
        const end = getPortCenter(conn.toPort);
        conn.line.setAttribute('x1', start.x);
        conn.line.setAttribute('y1', start.y);
        conn.line.setAttribute('x2', end.x);
        conn.line.setAttribute('y2', end.y);
    });
}


// =========================================================================
// PARTIE 2 : LOGIQUE DE L'ÉDITEUR INTERNE (OVERLAY)
// =========================================================================

let currentEditingId = null;
let activeItem = null;
let editorDragItem = null;
let editorResizeItem = null;
let editorRotateItem = null;
let startX=0, startY=0, startW=0, startH=0, startAngle=0, currentRotation=0;

function openEditor(id) {
    currentEditingId = id;
    const data = state.slidesContent[id];
    editableSlide.innerHTML = data.html || "";
    editableSlide.style.backgroundColor = data.bg || "#ffffff";
    editableSlide.style.backgroundImage = data.img || "none";
    editorOverlay.style.display = 'flex';
    // Réattacher les événements
    editableSlide.querySelectorAll('.item-box').forEach(attachItemEvents);
}

document.getElementById('btn-close-editor').onclick = () => {
    if(currentEditingId) {
        state.slidesContent[currentEditingId] = {
            html: editableSlide.innerHTML,
            bg: editableSlide.style.backgroundColor,
            img: editableSlide.style.backgroundImage
        };
        const slide = document.getElementById(currentEditingId);
        if(editableSlide.innerHTML.trim() !== "") slide.style.border = "2px solid #2ecc71";
    }
    editorOverlay.style.display = 'none';
    currentEditingId = null;
};

// --- AJOUTS ---
document.getElementById('addTextBtn').onclick = () => {
    createItem(`<div class="content" contenteditable="true">Texte...</div>`, 'text-box');
};

document.getElementById('addImageBtn').onclick = () => document.getElementById('imageInput').click();
document.getElementById('imageInput').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => createItem(`<img src="${evt.target.result}" style="width:100%; height:100%">`, 'image-box', 200, 150);
        reader.readAsDataURL(file);
    }
};

window.addEditorShape = (type) => {
    let content = `<div class="shape-content" style="background:#3498db; width:100%; height:100%;"></div>`;
    if(type==='circle') content = `<div class="shape-content" style="background:#e74c3c; width:100%; height:100%; border-radius:50%;"></div>`;
    if(type==='triangle') content = `<div class="shape-content" style="background:#2ecc71; width:100%; height:100%; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div>`;
    createItem(content, `shape-box ${type}`, 100, 100);
}

function createItem(html, className, w=150, h=50) {
    const div = document.createElement('div');
    div.className = `item-box ${className}`;
    div.style.width = w+'px'; div.style.height = h+'px';
    div.style.left = '50px'; div.style.top = '50px';
    div.innerHTML = html + `
        <div class="resize-handle"></div>
        <div class="delete-btn">✕</div>
        <div class="rotate-handle">↻</div>`;
    editableSlide.appendChild(div);
    attachItemEvents(div);
}

function attachItemEvents(div) {
    // Delete
    div.querySelector('.delete-btn').onclick = (e) => {
        e.stopPropagation();
        div.remove();
    };

    div.onmousedown = (e) => {
        if(e.target.classList.contains('content') && e.target.isContentEditable) return;
        e.stopPropagation();
        
        // Resize
        if(e.target.classList.contains('resize-handle')) {
            editorResizeItem = div;
            startX = e.clientX; startY = e.clientY;
            startW = div.offsetWidth; startH = div.offsetHeight;
            return;
        }
        
        // Rotate
        if(e.target.classList.contains('rotate-handle')) {
            editorRotateItem = div;
            const rect = div.getBoundingClientRect();
            const centerX = rect.left + rect.width/2;
            const centerY = rect.top + rect.height/2;
            startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
            const match = div.style.transform.match(/rotate\((-?\d+\.?\d*)deg\)/);
            currentRotation = match ? parseFloat(match[1]) : 0;
            return;
        }

        // Drag
        activeItem = div;
        editorDragItem = div;
        document.querySelectorAll('.item-box').forEach(i => i.classList.remove('selected'));
        div.classList.add('selected');
        
        const rect = div.getBoundingClientRect(); // Position relative au viewport
        // On doit calculer l'offset par rapport au conteneur 'editableSlide'
        // editableSlide est en position relative.
        // offsetLeft/Top sont par rapport au parent
        
        startX = e.clientX - div.offsetLeft;
        startY = e.clientY - div.offsetTop;
    };
}

// Global Move pour éditeur
window.addEventListener('mousemove', (e) => {
    if(editorDragItem) {
        editorDragItem.style.left = (e.clientX - startX) + 'px';
        editorDragItem.style.top = (e.clientY - startY) + 'px';
    }
    if(editorResizeItem) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        editorResizeItem.style.width = Math.max(20, startW + dx) + 'px';
        editorResizeItem.style.height = Math.max(20, startH + dy) + 'px';
    }
    if(editorRotateItem) {
        const rect = editorRotateItem.getBoundingClientRect();
        const centerX = rect.left + rect.width/2;
        const centerY = rect.top + rect.height/2;
        const newAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const deg = (newAngle - startAngle) * (180/Math.PI);
        editorRotateItem.style.transform = `rotate(${currentRotation + deg}deg)`;
    }
});

window.addEventListener('mouseup', () => {
    editorDragItem = null;
    editorResizeItem = null;
    editorRotateItem = null;
});

// Backgrounds
document.getElementById('bgColorPicker').addEventListener('input', (e) => {
    editableSlide.style.backgroundImage = 'none';
    editableSlide.style.backgroundColor = e.target.value;
});
document.getElementById('bgImageBtn').onclick = () => document.getElementById('bgImageInput').click();
document.getElementById('bgImageInput').onchange = (e) => {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            editableSlide.style.backgroundImage = `url(${evt.target.result})`;
            editableSlide.style.backgroundSize = 'cover';
        };
        reader.readAsDataURL(file);
    }
};

// Formatage Texte
function format(cmd, val=null) { document.execCommand(cmd, false, val); }
document.getElementById('topBoldBtn').onclick = () => format('bold');
document.getElementById('topItalicBtn').onclick = () => format('italic');
document.getElementById('topUnderlineBtn').onclick = () => format('underline');
document.getElementById('topTextColor').oninput = (e) => format('foreColor', e.target.value);
document.getElementById('topFontFamily').onchange = (e) => format('fontName', e.target.value);
document.getElementById('topFontSize').onchange = (e) => format('fontSize', '4'); // Simplifié

// Init
setTransform();
canvas.appendChild(connectionsLayer);