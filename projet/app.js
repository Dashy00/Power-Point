// =================================================================
// GESTION DU GRAPHE (ZOOM, PAN, SLIDES, FLÈCHES)
// =================================================================

// --- 1. ZOOM & PAN ---
function setTransform() {
    canvas.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
    zoomText.innerText = Math.round(state.scale * 100) + ' %';
}
document.getElementById('btn-zoom-in').onclick = () => { state.scale = Math.min(state.scale + 0.1, 3); setTransform(); };
document.getElementById('btn-zoom-out').onclick = () => { state.scale = Math.max(state.scale - 0.1, 0.2); setTransform(); };
document.getElementById('btn-reset').onclick = () => { state.scale = 1; state.pointX = 0; state.pointY = 0; setTransform(); };

viewport.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.slide') && !e.target.closest('.port') && e.target.tagName !== 'line') {
        deselectAll();
        state.panning = true;
        state.startX = e.clientX - state.pointX;
        state.startY = e.clientY - state.pointY;
        viewport.style.cursor = 'grabbing';
    }
});

viewport.addEventListener('mousemove', (e) => {
    e.preventDefault();
    // Pan
    if (state.panning) {
        state.pointX = e.clientX - state.startX;
        state.pointY = e.clientY - state.startY;
        setTransform();
    }
    // Drag Slide
    if (state.isDraggingSlide && state.selectedSlide) {
        const x = (e.clientX - canvas.getBoundingClientRect().left) / state.scale - state.dragOffset.x;
        const y = (e.clientY - canvas.getBoundingClientRect().top) / state.scale - state.dragOffset.y;
        state.selectedSlide.style.left = x + 'px';
        state.selectedSlide.style.top = y + 'px';
        updateConnections();
    }
    // Création Flèche
    if (state.isConnecting && state.tempLine) {
        const rect = canvas.getBoundingClientRect();
        // Coordonnées relatives au canvas (qui fait 5000px)
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
    if(state.isConnecting && state.tempLine) {
        if (!event.target.classList.contains('port')) state.tempLine.remove();
        state.isConnecting = false;
        state.tempLine = null;
    }
});

// --- 2. SLIDES ---
function createSlide(type) {
    state.slideCount++;
    const id = `slide-${state.slideCount}`;
    state.slidesContent[id] = { html: "", bg: "#ffffff" }; 

    const slide = document.createElement('div');
    slide.className = `slide ${type}`;
    slide.id = id;
    slide.innerHTML = getTypeLabel(type) + ' ' + state.slideCount;
    
    // --- CORRECTION DU CENTRAGE ---
    // Le canvas fait 5000x5000. Son centre est à 2500,2500.
    // On veut placer la slide au centre VISUEL de l'écran.
    // Formule : CentreAbsolu - (DécalagePan / Zoom)
    const centerX = 2500 - (state.pointX / state.scale);
    const centerY = 2500 - (state.pointY / state.scale);
    
    slide.style.left = (centerX - 75) + 'px'; // -75 pour centrer la largeur
    slide.style.top = (centerY - 40) + 'px'; // -40 pour centrer la hauteur

    // Drag
    slide.addEventListener('mousedown', (e) => {
        if(e.target.classList.contains('port')) return;
        e.stopPropagation();
        selectSlide(slide);
        state.isDraggingSlide = true;
        state.dragOffset.x = e.offsetX;
        state.dragOffset.y = e.offsetY;
    });

    // Ouvrir éditeur
    slide.addEventListener('dblclick', (e) => { 
        e.stopPropagation(); 
        if(typeof openEditor === "function") openEditor(id);
    });

    // Ports
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

// --- 3. CONNEXIONS ---
function startConnection(e, id, port) {
    e.stopPropagation();
    state.isConnecting = true;
    state.connectionStart = { id, port };
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5,5');
    line.setAttribute('marker-end', 'url(#arrow-end)');
    
    const start = getPortCenter(port);
    line.setAttribute('x1', start.x); line.setAttribute('y1', start.y);
    line.setAttribute('x2', start.x); line.setAttribute('y2', start.y);
    
    connectionsLayer.appendChild(line);
    state.tempLine = line;
}

function endConnection(e, id, port) {
    e.stopPropagation();
    if(state.isConnecting && state.tempLine) {
        if(state.connectionStart.id !== id) {
            state.tempLine.removeAttribute('stroke-dasharray');
            const end = getPortCenter(port);
            state.tempLine.setAttribute('x2', end.x);
            state.tempLine.setAttribute('y2', end.y);
            
            const connObj = { line: state.tempLine, fromPort: state.connectionStart.port, toPort: port, fromId: state.connectionStart.id, toId: id };
            
            // Events Flèche
            state.tempLine.addEventListener('click', (evt) => { evt.stopPropagation(); selectConnection(connObj); });
            state.tempLine.addEventListener('dblclick', (evt) => {
                evt.stopPropagation();
                const start = state.tempLine.getAttribute('marker-start');
                state.tempLine.setAttribute('marker-start', start ? '' : 'url(#arrow-start)');
            });

            state.connections.push(connObj);
            state.tempLine = null;
        } else { state.tempLine.remove(); }
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
        conn.line.setAttribute('x1', start.x); conn.line.setAttribute('y1', start.y);
        conn.line.setAttribute('x2', end.x); conn.line.setAttribute('y2', end.y);
    });
}

// --- SELECTION ---
function selectSlide(slide) {
    deselectAll();
    state.selectedSlide = slide;
    slide.classList.add('selected');
}
function selectConnection(conn) {
    deselectAll();
    state.selectedConnection = conn;
    conn.line.classList.add('selected');
    conn.line.setAttribute('stroke', '#e74c3c');
}
function deselectAll() {
    if(state.selectedSlide) { state.selectedSlide.classList.remove('selected'); state.selectedSlide = null; }
    if(state.selectedConnection) { 
        state.selectedConnection.line.classList.remove('selected'); 
        state.selectedConnection.line.setAttribute('stroke', '#2c3e50');
        state.selectedConnection = null; 
    }
}

// BOUTONS
document.getElementById('btn-new-slide').onclick = () => createSlide('default');
document.getElementById('btn-info-bulle').onclick = () => createSlide('info');
document.getElementById('btn-condition').onclick = () => createSlide('condition');
document.getElementById('btn-bloc-fin').onclick = () => createSlide('fin');
document.getElementById('btn-delete').onclick = () => {
    if(state.selectedSlide) {
        state.connections = state.connections.filter(c => {
            if(c.fromId === state.selectedSlide.id || c.toId === state.selectedSlide.id) { c.line.remove(); return false; }
            return true;
        });
        state.selectedSlide.remove(); state.selectedSlide = null;
    } else if(state.selectedConnection) {
        state.selectedConnection.line.remove();
        state.connections = state.connections.filter(c => c !== state.selectedConnection);
        state.selectedConnection = null;
    }
};

// Init
setTransform();