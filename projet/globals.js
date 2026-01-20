// --- ÉLÉMENTS DOM PARTAGÉS ---
const viewport = document.getElementById('viewport');
const canvas = document.getElementById('canvas');
const connectionsLayer = document.getElementById('connections-layer');
const zoomText = document.getElementById('zoom-text');
const editorOverlay = document.getElementById('editor-overlay');
const editableSlide = document.getElementById('editable-slide');

// --- ÉTAT GLOBAL DE L'APPLICATION ---
const state = {
    // Graphe
    scale: 1,
    panning: false,
    pointX: 0, pointY: 0, startX: 0, startY: 0,
    
    // Slides & Connexions
    slideCount: 0,
    selectedSlide: null,
    isDraggingSlide: false,
    dragOffset: { x: 0, y: 0 },
    
    isConnecting: false,
    connectionStart: null,
    tempLine: null,
    connections: [], // Liste des liens
    
    // Données Contenu
    slidesContent: {}, // { "slide-1": { html: "...", bg: "..." } }
    
    // Éditeur Overlay
    currentEditingId: null,
    activeItem: null
};