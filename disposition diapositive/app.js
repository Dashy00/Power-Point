// ========================================
// APP.JS - Tout le code en un seul fichier
// ========================================

const viewport = document.getElementById("viewport");
const canvas = document.getElementById("canvas");
const addSlideBtn = document.getElementById("addSlideBtn");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const resetZoomBtn = document.getElementById("resetZoom");
const zoomPercentSpan = document.getElementById("zoomPercent");

// État global
let state = {
    offsetX: -2000,
    offsetY: -2000,
    scale: 1,
    isPanning: false,
    slideCounter: 0,
    selectedSlide: null,
    isDraggingSlide: false,
    dragOffsetX: 0,
    dragOffsetY: 0
};

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const ZOOM_FACTOR = 1.05;

let panStartX = 0;
let panStartY = 0;

// ========== FONCTIONS UTILITAIRES ==========

function applyTransform() {
    canvas.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
}

function updateZoomPercent() {
    zoomPercentSpan.textContent = Math.round(state.scale * 100) + "%";
}

// ========== ZOOM ==========

function zoomIn() {
    let newScale = state.scale * ZOOM_FACTOR;
    newScale = Math.min(MAX_SCALE, newScale);
    
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    
    const canvasX = (centerX - state.offsetX) / state.scale;
    const canvasY = (centerY - state.offsetY) / state.scale;
    
    state.offsetX = centerX - canvasX * newScale;
    state.offsetY = centerY - canvasY * newScale;
    state.scale = newScale;
    
    applyTransform();
    updateZoomPercent();
}

function zoomOut() {
    let newScale = state.scale / ZOOM_FACTOR;
    newScale = Math.max(MIN_SCALE, newScale);
    
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    
    const canvasX = (centerX - state.offsetX) / state.scale;
    const canvasY = (centerY - state.offsetY) / state.scale;
    
    state.offsetX = centerX - canvasX * newScale;
    state.offsetY = centerY - canvasY * newScale;
    state.scale = newScale;
    
    applyTransform();
    updateZoomPercent();
}

function resetZoom() {
    state.offsetX = -2000;
    state.offsetY = -2000;
    state.scale = 1;
    applyTransform();
    updateZoomPercent();
}

// ========== SLIDES ==========

function createSlide() {
    state.slideCounter++;

    const slide = document.createElement("div");
    slide.className = "slide";
    slide.id = `slide-${state.slideCounter}`;
    slide.textContent = `Slide ${state.slideCounter}`;

    const centerX = (viewport.clientWidth / 2 - state.offsetX) / state.scale;
    const centerY = (viewport.clientHeight / 2 - state.offsetY) / state.scale;

    slide.style.left = (centerX - 125) + "px";
    slide.style.top = (centerY - 90) + "px";

    canvas.appendChild(slide);
    console.log(`✓ Slide ${state.slideCounter} créée`);

    slide.addEventListener("mousedown", (e) => handleSlideMouseDown(e, slide));
}

function handleSlideMouseDown(e, slide) {
    e.stopPropagation();
    state.isDraggingSlide = true;
    selectSlide(slide);

    const rect = slide.getBoundingClientRect();
    state.dragOffsetX = e.clientX - rect.left;
    state.dragOffsetY = e.clientY - rect.top;
}

function selectSlide(slide) {
    if (state.selectedSlide) {
        state.selectedSlide.classList.remove("selected");
    }
    slide.classList.add("selected");
    state.selectedSlide = slide;
}

// ========== ÉVÉNEMENTS PAN ==========

viewport.addEventListener("mousedown", (e) => {
    state.isPanning = true;
    viewport.classList.add("panning");
    panStartX = e.clientX;
    panStartY = e.clientY;
});

viewport.addEventListener("mousemove", (e) => {
    if (state.isPanning && !state.isDraggingSlide) {
        const deltaX = e.clientX - panStartX;
        const deltaY = e.clientY - panStartY;

        state.offsetX += deltaX;
        state.offsetY += deltaY;

        panStartX = e.clientX;
        panStartY = e.clientY;

        applyTransform();
    }

    // Drag des slides
    if (state.isDraggingSlide && state.selectedSlide) {
        const viewportRect = viewport.getBoundingClientRect();

        const x = (e.clientX - viewportRect.left - state.dragOffsetX - state.offsetX) / state.scale;
        const y = (e.clientY - viewportRect.top - state.dragOffsetY - state.offsetY) / state.scale;

        state.selectedSlide.style.left = x + "px";
        state.selectedSlide.style.top = y + "px";
    }
});

viewport.addEventListener("mouseup", () => {
    state.isPanning = false;
    state.isDraggingSlide = false;
    viewport.classList.remove("panning");
});

viewport.addEventListener("mouseleave", () => {
    state.isPanning = false;
    state.isDraggingSlide = false;
    viewport.classList.remove("panning");
});

// ========== ÉVÉNEMENTS ZOOM MOLETTE ==========

viewport.addEventListener("wheel", (e) => {
    e.preventDefault();

    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasX = (mouseX - state.offsetX) / state.scale;
    const canvasY = (mouseY - state.offsetY) / state.scale;

    let newScale = e.deltaY > 0 ? state.scale / ZOOM_FACTOR : state.scale * ZOOM_FACTOR;
    newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));

    state.offsetX = mouseX - canvasX * newScale;
    state.offsetY = mouseY - canvasY * newScale;
    state.scale = newScale;

    applyTransform();
    updateZoomPercent();
}, { passive: false });

// ========== ÉVÉNEMENTS BOUTONS ==========

addSlideBtn.addEventListener("click", createSlide);
zoomInBtn.addEventListener("click", zoomIn);
zoomOutBtn.addEventListener("click", zoomOut);
resetZoomBtn.addEventListener("click", resetZoom);

// ========== DÉSÉLECTION ==========

viewport.addEventListener("click", (e) => {
    if (e.target === viewport) {
        const slides = document.querySelectorAll(".slide");
        slides.forEach(slide => slide.classList.remove("selected"));
        state.selectedSlide = null;
    }
});

// ========== INIT ==========

applyTransform();
updateZoomPercent();

console.log("✓ App.js chargé et prêt !");
// ========================================
// APP.JS - Éditeur complet
// ========================================

const viewport = document.getElementById("viewport");
const canvas = document.getElementById("canvas");
const connectionsSVG = document.getElementById("connections-svg");
const zoomPopup = document.getElementById("zoomPopup");

// État global
let state = {
    offsetX: -2000,
    offsetY: -2000,
    scale: 1,
    isPanning: false,
    slideCounter: 0,
    selectedSlide: null,
    isDraggingSlide: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    currentSlideType: "rectangle", // Type par défaut
    isConnecting: false,
    connectingFrom: null,
    connections: [] // [{ from: slideId, to: slideId }, ...]
};

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const ZOOM_FACTOR = 1.05;

let panStartX = 0;
let panStartY = 0;
let tempLine = null;

// ========== TYPES DE SLIDES ==========
const slideTypes = {
    rectangle: { width: 180, height: 100, color: "#ffffff", border: "#333" },
    circle: { width: 120, height: 120, color: "#ffffff", border: "#333" },
    condition: { width: 150, height: 150, color: "#fffacd", border: "#333" },
    bulle: { width: 140, height: 140, color: "#87ceeb", border: "#333" }
};

// ========== BARRE LATÉRALE ==========

document.getElementById("btn-powerpoint").addEventListener("click", () => {
    alert("Power-Point - gestion du projet");
});

document.getElementById("btn-new-slide").addEventListener("click", () => {
    // Cycle entre les types
    const types = Object.keys(slideTypes);
    const currentIndex = types.indexOf(state.currentSlideType);
    state.currentSlideType = types[(currentIndex + 1) % types.length];
    console.log(`Type sélectionné: ${state.currentSlideType}`);
});

document.getElementById("btn-info-bulle").addEventListener("click", () => {
    state.currentSlideType = "bulle";
    createSlide();
});

document.getElementById("btn-condition").addEventListener("click", () => {
    state.currentSlideType = "condition";
    createSlide();
});

document.getElementById("btn-bloc-fin").addEventListener("click", () => {
    state.currentSlideType = "rectangle";
    createSlide();
});

document.getElementById("btn-delete").addEventListener("click", () => {
    if (state.selectedSlide) {
        state.selectedSlide.remove();
        state.selectedSlide = null;
        redrawConnections();
    }
});

document.getElementById("btn-export").addEventListener("click", () => {
    console.log("Export:", { slides: canvas.children.length, connections: state.connections });
    alert("Export - Fonctionnalité à venir");
});

// ========== ZOOM POPUP ==========

zoomPopup.addEventListener("mouseenter", () => {
    zoomPopup.classList.add("active");
});

zoomPopup.addEventListener("mouseleave", () => {
    zoomPopup.classList.remove("active");
});

document.getElementById("zoomIn").addEventListener("click", zoomIn);
document.getElementById("zoomOut").addEventListener("click", zoomOut);
document.getElementById("resetZoom").addEventListener("click", resetZoom);

// ========== ZOOM FUNCTIONS ==========

function applyTransform() {
    canvas.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
    redrawConnections();
}

function updateZoomPercent() {
    document.getElementById("zoomPercent").textContent = Math.round(state.scale * 100) + "%";
}

function zoomIn() {
    let newScale = state.scale * ZOOM_FACTOR;
    newScale = Math.min(MAX_SCALE, newScale);
    
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    
    const canvasX = (centerX - state.offsetX) / state.scale;
    const canvasY = (centerY - state.offsetY) / state.scale;
    
    state.offsetX = centerX - canvasX * newScale;
    state.offsetY = centerY - canvasY * newScale;
    state.scale = newScale;
    
    applyTransform();
    updateZoomPercent();
}

function zoomOut() {
    let newScale = state.scale / ZOOM_FACTOR;
    newScale = Math.max(MIN_SCALE, newScale);
    
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    
    const canvasX = (centerX - state.offsetX) / state.scale;
    const canvasY = (centerY - state.offsetY) / state.scale;
    
    state.offsetX = centerX - canvasX * newScale;
    state.offsetY = centerY - canvasY * newScale;
    state.scale = newScale;
    
    applyTransform();
    updateZoomPercent();
}

function resetZoom() {
    state.offsetX = -2000;
    state.offsetY = -2000;
    state.scale = 1;
    applyTransform();
    updateZoomPercent();
}

// ========== SLIDES ==========

function createSlide() {
    state.slideCounter++;

    const type = slideTypes[state.currentSlideType];
    const slide = document.createElement("div");
    slide.className = "slide";
    slide.id = `slide-${state.slideCounter}`;
    slide.style.width = type.width + "px";
    slide.style.height = type.height + "px";
    slide.style.backgroundColor = type.color;
    slide.style.borderColor = type.border;
    
    if (state.currentSlideType === "circle") {
        slide.style.borderRadius = "50%";
    }
    
    slide.textContent = `${state.currentSlideType} ${state.slideCounter}`;

    const centerX = (viewport.clientWidth / 2 - state.offsetX) / state.scale;
    const centerY = (viewport.clientHeight / 2 - state.offsetY) / state.scale;

    slide.style.left = (centerX - type.width / 2) + "px";
    slide.style.top = (centerY - type.height / 2) + "px";

    // Ajouter les ports de connexion
    ["top", "bottom", "left", "right"].forEach(pos => {
        const port = document.createElement("div");
        port.className = `connection-port ${pos}`;
        port.addEventListener("mousedown", (e) => startConnection(e, slide, pos));
        slide.appendChild(port);
    });

    canvas.appendChild(slide);

    slide.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("connection-port")) return;
        handleSlideMouseDown(e, slide);
    });
}

function handleSlideMouseDown(e, slide) {
    e.stopPropagation();
    state.isDraggingSlide = true;
    selectSlide(slide);

    const rect = slide.getBoundingClientRect();
    state.dragOffsetX = e.clientX - rect.left;
    state.dragOffsetY = e.clientY - rect.top;
}

function selectSlide(slide) {
    if (state.selectedSlide) {
        state.selectedSlide.classList.remove("selected");
    }
    slide.classList.add("selected");
    state.selectedSlide = slide;
}

// ========== CONNEXIONS ==========

function startConnection(e, slide, port) {
    e.stopPropagation();
    state.isConnecting = true;
    state.connectingFrom = { slide, port };
    slide.classList.add("connecting");
    connectionsSVG.classList.add("drawing");
}

function redrawConnections() {
    connectionsSVG.innerHTML = "";

    state.connections.forEach(conn => {
        const fromSlide = document.getElementById(conn.from);
        const toSlide = document.getElementById(conn.to);

        if (!fromSlide || !toSlide) return;

        const fromRect = fromSlide.getBoundingClientRect();
        const toRect = toSlide.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();

        const x1 = fromRect.right - viewportRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - viewportRect.top;
        const x2 = toRect.left - viewportRect.left;
        const y2 = toRect.top + toRect.height / 2 - viewportRect.top;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", "#4CAF50");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("marker-end", "url(#arrowhead)");

        connectionsSVG.appendChild(line);
    });

    // Ajouter définition de la flèche
    if (connectionsSVG.querySelector("defs") === null) {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute("id", "arrowhead");
        marker.setAttribute("markerWidth", "10");
        marker.setAttribute("markerHeight", "10");
        marker.setAttribute("refX", "9");
        marker.setAttribute("refY", "3");
        marker.setAttribute("orient", "auto");
        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("points", "0 0, 10 3, 0 6");
        polygon.setAttribute("fill", "#4CAF50");
        marker.appendChild(polygon);
        defs.appendChild(marker);
        connectionsSVG.appendChild(defs);
    }
}

// ========== ÉVÉNEMENTS PAN ==========

viewport.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("connection-port")) return;
    state.isPanning = true;
    viewport.classList.add("panning");
    panStartX = e.clientX;
    panStartY = e.clientY;
});

viewport.addEventListener("mousemove", (e) => {
    if (state.isConnecting) {
        const viewportRect = viewport.getBoundingClientRect();
        const fromRect = state.connectingFrom.slide.getBoundingClientRect();
        
        const x1 = fromRect.right - viewportRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - viewportRect.top;
        const x2 = e.clientX - viewportRect.left;
        const y2 = e.clientY - viewportRect.top;

        if (!tempLine) {
            tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            tempLine.setAttribute("class", "temp-connection-line");
            connectionsSVG.appendChild(tempLine);
        }

        tempLine.setAttribute("x1", x1);
        tempLine.setAttribute("y1", y1);
        tempLine.setAttribute("x2", x2);
        tempLine.setAttribute("y2", y2);
        return;
    }

    if (state.isPanning && !state.isDraggingSlide) {
        const deltaX = e.clientX - panStartX;
        const deltaY = e.clientY - panStartY;

        state.offsetX += deltaX;
        state.offsetY += deltaY;

        panStartX = e.clientX;
        panStartY = e.clientY;

        applyTransform();
    }

    if (state.isDraggingSlide && state.selectedSlide) {
        const viewportRect = viewport.getBoundingClientRect();

        const x = (e.clientX - viewportRect.left - state.dragOffsetX - state.offsetX) / state.scale;
        const y = (e.clientY - viewportRect.top - state.dragOffsetY - state.offsetY) / state.scale;

        state.selectedSlide.style.left = x + "px";
        state.selectedSlide.style.top = y + "px";
        
        redrawConnections();
    }
});

viewport.addEventListener("mouseup", (e) => {
    if (state.isConnecting) {
        // Essayer de connecter à une slide
        const slides = document.querySelectorAll(".slide");
        slides.forEach(slide => {
            if (slide === state.connectingFrom.slide) return;
            const rect = slide.getBoundingClientRect();
            const distance = Math.sqrt(
                Math.pow(e.clientX - (rect.left + rect.width / 2), 2) +
                Math.pow(e.clientY - (rect.top + rect.height / 2), 2)
            );
            
            if (distance < 60) {
                // Connexion établie
                state.connections.push({
                    from: state.connectingFrom.slide.id,
                    to: slide.id
                });
                redrawConnections();
            }
        });

        if (tempLine) {
            tempLine.remove();
            tempLine = null;
        }

        state.isConnecting = false;
        state.connectingFrom.slide.classList.remove("connecting");
        state.connectingFrom = null;
        connectionsSVG.classList.remove("drawing");
        return;
    }

    state.isPanning = false;
    state.isDraggingSlide = false;
    viewport.classList.remove("panning");
});

viewport.addEventListener("mouseleave", () => {
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }
    state.isPanning = false;
    state.isDraggingSlide = false;
    state.isConnecting = false;
    if (state.connectingFrom) {
        state.connectingFrom.slide.classList.remove("connecting");
        state.connectingFrom = null;
    }
    connectionsSVG.classList.remove("drawing");
    viewport.classList.remove("panning");
});

// ========== ZOOM MOLETTE ==========

viewport.addEventListener("wheel", (e) => {
    e.preventDefault();

    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasX = (mouseX - state.offsetX) / state.scale;
    const canvasY = (mouseY - state.offsetY) / state.scale;

    let newScale = e.deltaY > 0 ? state.scale / ZOOM_FACTOR : state.scale * ZOOM_FACTOR;
    newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));

    state.offsetX = mouseX - canvasX * newScale;
    state.offsetY = mouseY - canvasY * newScale;
    state.scale = newScale;

    applyTransform();
    updateZoomPercent();
}, { passive: false });

// ========== INIT ==========

applyTransform();
updateZoomPercent();

console.log("✓ Éditeur chargé et prêt !");
