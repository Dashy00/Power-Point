// --- ÉLÉMENTS DOM PARTAGÉS ---
const viewport = document.getElementById('viewport');
const canvas = document.getElementById('canvas');
const connectionsLayer = document.getElementById('connections-layer');
const zoomText = document.getElementById('zoom-text');
const editorOverlay = document.getElementById('editor-overlay');
const editableSlide = document.getElementById('editable-slide');



// --- ÉTAT GLOBAL DE L'APPLIATION ---
const state = {
    // Graphe
    scale: 1,
    panning: false,
    pointX: 0, pointY: 0, startX: 0, startY: 0,
    
    // Slides & Connexions
    slideCount: 0,
    selectedSlide: null,
    startSlideId: null, // <--- NOUVEAU : Stocke l'ID de la slide de départ
    isDraggingSlide: false,
    dragOffset: { x: 0, y: 0 },
    
    isConnecting: false,
    connectionStart: null,
    tempLine: null,
    connections: [], 
    
    // Données Contenu
    slidesContent: {}, 
    
    // Éditeur Overlay
    currentEditingId: null,
    activeItem: null
};