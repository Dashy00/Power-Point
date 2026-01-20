const viewport = document.getElementById('viewport');
const canvas = document.getElementById('canvas');
const connectionsLayer = document.getElementById('connections-layer');
const zoomText = document.getElementById('zoom-text');

// Éléments de l'éditeur de page
const editorOverlay = document.getElementById('slide-editor');
const closeEditorBtn = document.getElementById('btn-close-editor');
const titleInput = document.getElementById('slide-title-input');
const bodyInput = document.getElementById('slide-body-input');

let state = {
    scale: 1,
    panning: false,
    pointX: 0, pointY: 0, startX: 0, startY: 0,
    slideCount: 0,
    selectedSlide: null,
    isDraggingSlide: false,
    dragOffset: { x: 0, y: 0 },
    isConnecting: false,
    connectionStart: null,
    tempLine: null,
    connections: [],
    
    // NOUVEAU : Stockage du contenu des slides
    slideContents: {}, // { "slide-1": { title: "Intro", body: "Texte..." } }
    currentEditingId: null // ID de la slide en cours d'édition
};

// --- ZOOM & PAN (Inchangé) ---
function setTransform() {
    canvas.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
    zoomText.innerText = Math.round(state.scale * 100) + ' %';
}
document.getElementById('btn-zoom-in').onclick = () => { state.scale *= 1.2; setTransform(); };
document.getElementById('btn-zoom-out').onclick = () => { state.scale /= 1.2; setTransform(); };
document.getElementById('btn-reset').onclick = () => { state.scale = 1; state.pointX = 0; state.pointY = 0; setTransform(); };

viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const xs = (e.clientX - state.pointX) / state.scale;
    const ys = (e.clientY - state.pointY) / state.scale;
    state.scale *= (e.deltaY > 0) ? 0.9 : 1.1;
    state.pointX = e.clientX - xs * state.scale;
    state.pointY = e.clientY - ys * state.scale;
    setTransform();
});

viewport.addEventListener('mousedown', (e) => {
    if (e.target === viewport || e.target === canvas || e.target === connectionsLayer) {
        state.panning = true;
        state.startX = e.clientX - state.pointX;
        state.startY = e.clientY - state.pointY;
        viewport.style.cursor = 'grabbing';
    }
});

viewport.addEventListener('mousemove', (e) => {
    e.preventDefault();
    if (state.panning) {
        state.pointX = e.clientX - state.startX;
        state.pointY = e.clientY - state.startY;
        setTransform();
    }
    if (state.isDraggingSlide && state.selectedSlide) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / state.scale - state.dragOffset.x;
        const y = (e.clientY - rect.top) / state.scale - state.dragOffset.y;
        state.selectedSlide.style.left = `${x}px`;
        state.selectedSlide.style.top = `${y}px`;
        updateConnections();
    }
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
    if (state.isConnecting) {
        if (state.tempLine) state.tempLine.remove();
        state.isConnecting = false;
        state.tempLine = null;
    }
});

// --- GESTION DES SLIDES ---

function createSlide(type) {
    state.slideCount++;
    const slideId = `slide-${state.slideCount}`;
    const defaultTitle = getTypeLabel(type) + ' ' + state.slideCount;
    
    // Initialisation des données de la page
    state.slideContents[slideId] = {
        title: defaultTitle,
        body: ""
    };

    const slide = document.createElement('div');
    slide.className = `slide ${type}`;
    slide.id = slideId;
    
    // Structure HTML interne de la slide (pour mettre à jour le titre facilement)
    slide.innerHTML = `<span class="slide-label">${defaultTitle}</span>`;
    
    const viewportRect = viewport.getBoundingClientRect();
    const centerX = viewportRect.width / 2;
    const centerY = viewportRect.height / 2;
    const canvasX = (centerX - state.pointX) / state.scale + 5000;
    const canvasY = (centerY - state.pointY) / state.scale + 5000;

    slide.style.left = (canvasX - 75) + 'px';
    slide.style.top = (canvasY - 40) + 'px';

    // Click Simple : Sélection / Drag
    slide.addEventListener('mousedown', (e) => {
        if(e.target.classList.contains('port')) return;
        e.stopPropagation();
        selectSlide(slide);
        state.isDraggingSlide = true;
        state.dragOffset.x = e.offsetX;
        state.dragOffset.y = e.offsetY;
    });

    // --- NOUVEAU : DOUBLE CLIC POUR OUVRIR LA PAGE ---
    slide.addEventListener('dblclick', (e) => {
        e.stopPropagation(); // Empêche le zoom du canvas
        openSlideEditor(slideId);
    });

    ['top', 'right', 'bottom', 'left'].forEach(pos => {
        const port = document.createElement('div');
        port.className = `port ${pos}`;
        port.dataset.pos = pos;
        port.addEventListener('mousedown', (e) => startConnection(e, slide, pos));
        port.addEventListener('mouseup', (e) => endConnection(e, slide, pos));
        slide.appendChild(port);
    });

    canvas.appendChild(slide);
}

function getTypeLabel(type) {
    switch(type) {
        case 'info': return 'Info';
        case 'condition': return 'Cond.';
        case 'fin': return 'Fin';
        default: return 'Diapo';
    }
}

function selectSlide(slide) {
    if (state.selectedSlide) state.selectedSlide.classList.remove('selected');
    state.selectedSlide = slide;
    slide.classList.add('selected');
}

// --- LOGIQUE DE L'ÉDITEUR DE PAGE ---

function openSlideEditor(slideId) {
    state.currentEditingId = slideId;
    const data = state.slideContents[slideId];
    
    // Remplir les champs
    titleInput.value = data.title;
    bodyInput.value = data.body || ""; // Vide si pas de contenu
    
    // Afficher l'overlay
    editorOverlay.classList.add('active');
}

function closeSlideEditor() {
    editorOverlay.classList.remove('active');
    state.currentEditingId = null;
}

// Sauvegarde automatique quand on tape
titleInput.addEventListener('input', () => {
    if (state.currentEditingId) {
        const newTitle = titleInput.value;
        state.slideContents[state.currentEditingId].title = newTitle;
        
        // Mettre à jour le texte sur la slide dans le graphe
        const slideEl = document.getElementById(state.currentEditingId);
        const labelEl = slideEl.querySelector('.slide-label');
        if (labelEl) labelEl.textContent = newTitle;
    }
});

bodyInput.addEventListener('input', () => {
    if (state.currentEditingId) {
        state.slideContents[state.currentEditingId].body = bodyInput.value;
    }
});

// Bouton fermer
closeEditorBtn.onclick = closeSlideEditor;


// --- BOUTONS SIDEBAR ---
document.getElementById('btn-new-slide').onclick = () => createSlide('default');
document.getElementById('btn-info-bulle').onclick = () => createSlide('info');
document.getElementById('btn-condition').onclick = () => createSlide('condition');
document.getElementById('btn-bloc-fin').onclick = () => createSlide('fin');

document.getElementById('btn-delete').onclick = () => {
    if (state.selectedSlide) {
        state.connections = state.connections.filter(conn => {
            if (conn.from === state.selectedSlide || conn.to === state.selectedSlide) {
                conn.lineElement.remove();
                return false;
            }
            return true;
        });
        
        // Supprimer aussi les données de contenu
        delete state.slideContents[state.selectedSlide.id];
        
        state.selectedSlide.remove();
        state.selectedSlide = null;
    }
};

// --- CONNEXIONS (Inchangé) ---

function startConnection(e, slide, pos) {
    e.stopPropagation();
    state.isConnecting = true;
    state.connectionStart = { slide, pos };
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5,5');
    line.setAttribute('marker-end', 'url(#arrow-end)'); 
    
    const coords = getPortCoordinates(slide, pos);
    line.setAttribute('x1', coords.x);
    line.setAttribute('y1', coords.y);
    line.setAttribute('x2', coords.x);
    line.setAttribute('y2', coords.y);
    
    connectionsLayer.appendChild(line);
    state.tempLine = line;
}

function endConnection(e, slide, pos) {
    e.stopPropagation();
    if (state.isConnecting && state.connectionStart.slide !== slide) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', '#2c3e50');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('marker-end', 'url(#arrow-end)');
        
        line.addEventListener('dblclick', (evt) => {
            evt.stopPropagation();
            toggleDoubleArrow(line);
        });

        line.addEventListener('contextmenu', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            if(confirm("Supprimer cette flèche ?")) {
                line.remove();
                state.connections = state.connections.filter(c => c.lineElement !== line);
            }
        });

        state.connections.push({
            from: state.connectionStart.slide,
            fromPort: state.connectionStart.pos,
            to: slide,
            toPort: pos,
            lineElement: line
        });
        
        connectionsLayer.appendChild(line);
        updateConnections();
    }
    
    if (state.tempLine) state.tempLine.remove();
    state.isConnecting = false;
    state.tempLine = null;
}

function toggleDoubleArrow(line) {
    const startMarker = line.getAttribute('marker-start');
    if (startMarker) {
        line.removeAttribute('marker-start');
    } else {
        line.setAttribute('marker-start', 'url(#arrow-start)');
    }
}

function getPortCoordinates(slide, pos) {
    const w = slide.offsetWidth;
    const h = slide.offsetHeight;
    const x = slide.offsetLeft;
    const y = slide.offsetTop;

    switch(pos) {
        case 'top': return { x: x + w/2, y: y };
        case 'bottom': return { x: x + w/2, y: y + h };
        case 'left': return { x: x, y: y + h/2 };
        case 'right': return { x: x + w, y: y + h/2 };
    }
}

function updateConnections() {
    state.connections.forEach(conn => {
        const start = getPortCoordinates(conn.from, conn.fromPort);
        const end = getPortCoordinates(conn.to, conn.toPort);
        
        conn.lineElement.setAttribute('x1', start.x);
        conn.lineElement.setAttribute('y1', start.y);
        conn.lineElement.setAttribute('x2', end.x);
        conn.lineElement.setAttribute('y2', end.y);
    });
}

setTransform();