const viewport = document.getElementById('viewport');
const canvas = document.getElementById('canvas');
const connectionsLayer = document.getElementById('connections-layer');
const zoomText = document.getElementById('zoom-text');

// --- ÉTAT GLOBAL ---
let state = {
    scale: 1,
    panning: false,
    pointX: 0,
    pointY: 0,
    startX: 0,
    startY: 0,
    slideCount: 0,
    selectedSlide: null,
    isDraggingSlide: false,
    dragOffset: { x: 0, y: 0 },
    isConnecting: false,
    connectionStart: null,
    tempLine: null,
    connections: []
};

// --- GESTION ZOOM & TRANSFORMATION ---

function setTransform() {
    canvas.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
    zoomText.innerText = Math.round(state.scale * 100) + ' %';
}

// Boutons Zoom (Nouveau)
document.getElementById('btn-zoom-in').onclick = () => {
    state.scale *= 1.2;
    setTransform();
};

document.getElementById('btn-zoom-out').onclick = () => {
    state.scale /= 1.2;
    setTransform();
};

document.getElementById('btn-reset').onclick = () => {
    state.scale = 1;
    state.pointX = 0;
    state.pointY = 0;
    setTransform();
};

// Zoom molette
viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const xs = (e.clientX - state.pointX) / state.scale;
    const ys = (e.clientY - state.pointY) / state.scale;
    const delta = -e.deltaY;
    
    (delta > 0) ? (state.scale *= 1.1) : (state.scale /= 1.1);
    
    state.pointX = e.clientX - xs * state.scale;
    state.pointY = e.clientY - ys * state.scale;
    setTransform();
});

// Panoramique (déplacement fond)
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

    // Drag Slide
    if (state.isDraggingSlide && state.selectedSlide) {
        const rect = canvas.getBoundingClientRect();
        // Correction précise prenant en compte le scale
        const x = (e.clientX - rect.left) / state.scale - state.dragOffset.x;
        const y = (e.clientY - rect.top) / state.scale - state.dragOffset.y;
        
        state.selectedSlide.style.left = `${x}px`;
        state.selectedSlide.style.top = `${y}px`;
        
        updateConnections();
    }

    // Ligne temporaire connexion
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

// --- CRÉATION DE SLIDES (CORRIGÉE : AU CENTRE) ---

function createSlide(type) {
    state.slideCount++;
    const slide = document.createElement('div');
    slide.className = `slide ${type}`;
    slide.id = `slide-${state.slideCount}`;
    slide.innerHTML = getTypeLabel(type) + ' ' + state.slideCount;
    
    // --- CALCUL DU CENTRE DE L'ÉCRAN ---
    // 1. On prend la taille de la zone visible
    const viewportRect = viewport.getBoundingClientRect();
    const centerX = viewportRect.width / 2;
    const centerY = viewportRect.height / 2;

    // 2. On convertit cette position écran en position canvas
    // Formule : (PositionEcran - Translation) / Zoom
    // On ajoute +5000 car le canvas démarre à -5000px (voir CSS)
    const canvasX = (centerX - state.pointX) / state.scale + 5000;
    const canvasY = (centerY - state.pointY) / state.scale + 5000;

    // 3. On centre l'élément lui-même (largeur approx 150/2 = 75)
    slide.style.left = (canvasX - 75) + 'px';
    slide.style.top = (canvasY - 40) + 'px';

    // Events
    slide.addEventListener('mousedown', (e) => {
        if(e.target.classList.contains('port')) return;
        e.stopPropagation();
        selectSlide(slide);
        state.isDraggingSlide = true;
        state.dragOffset.x = e.offsetX;
        state.dragOffset.y = e.offsetY;
    });

    // Ports
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
        state.selectedSlide.remove();
        state.selectedSlide = null;
    }
};

// --- CONNEXIONS ---

function startConnection(e, slide, pos) {
    e.stopPropagation();
    state.isConnecting = true;
    state.connectionStart = { slide, pos };
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5,5');
    
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
        line.setAttribute('stroke-width', '2');
        
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

// Init
setTransform();