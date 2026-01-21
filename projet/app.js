// =================================================================
// GESTION DU GRAPHE (ZOOM, PAN, SLIDES, FLÈCHES)
// =================================================================

// --- 1. ZOOM & PAN ---
function setTransform() {
  canvas.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
  zoomText.innerText = Math.round(state.scale * 100) + "%";
}
document.getElementById("btn-zoom-in").onclick = () => {
  state.scale = Math.min(state.scale + 0.1, 3);
  setTransform();
};
document.getElementById("btn-zoom-out").onclick = () => {
  state.scale = Math.max(state.scale - 0.1, 0.2);
  setTransform();
};
document.getElementById("btn-reset").onclick = () => {
  state.scale = 1;
  state.pointX = 0;
  state.pointY = 0;
  setTransform();
};

viewport.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.min(Math.max(state.scale + delta, 0.2), 3);
  const rect = viewport.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const scaleDiff = newScale - state.scale;
  state.pointX -= (mouseX * scaleDiff) / state.scale;
  state.pointY -= (mouseY * scaleDiff) / state.scale;
  state.scale = newScale;
  setTransform();
}, { passive: false });

viewport.addEventListener("mousedown", (e) => {
  if (!e.target.closest(".slide") && !e.target.closest(".port") && e.target.tagName !== 'line') {
    deselectAll();
    state.panning = true;
    state.startX = e.clientX - state.pointX;
    state.startY = e.clientY - state.pointY;
    viewport.style.cursor = "grabbing";
  }
});

viewport.addEventListener("mousemove", (e) => {
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
    state.selectedSlide.style.left = x + "px";
    state.selectedSlide.style.top = y + "px";
    updateConnections();
  }
  if (state.isConnecting && state.tempLine) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / state.scale;
    const mouseY = (e.clientY - rect.top) / state.scale;
    state.tempLine.setAttribute("x2", mouseX);
    state.tempLine.setAttribute("y2", mouseY);
  }
});

viewport.addEventListener("mouseup", () => {
  state.panning = false;
  state.isDraggingSlide = false;
  viewport.style.cursor = "grab";
  if (state.isConnecting) {
    if (state.tempLine) state.tempLine.remove();
    state.isConnecting = false;
  }
});

// --- GESTION DE LA SÉLECTION ---
function deselectAll() {
    if (state.selectedSlide) {
        state.selectedSlide.classList.remove('selected');
        state.selectedSlide = null;
    }
    if (state.selectedConnection) {
        state.selectedConnection.line.classList.remove('selected');
        state.selectedConnection = null;
    }
}

function selectSlide(slide) {
    deselectAll();
    state.selectedSlide = slide;
    slide.classList.add('selected');
}

function selectConnection(connObj) {
    deselectAll();
    state.selectedConnection = connObj;
    connObj.line.classList.add('selected');
}

// --- BOUTONS D'ACTION ---
document.getElementById("btn-new-slide").onclick = () => createSlide("default");
document.getElementById("btn-info-bulle").onclick = () => createSlide("info");
document.getElementById("btn-condition").onclick = () => createSlide("condition");
document.getElementById("btn-bloc-fin").onclick = () => createSlide("fin");

// --- SUPPRESSION INTELLIGENTE ---
document.getElementById("btn-delete").onclick = () => {
  if (state.selectedSlide) {
    // Si on supprime une slide, on supprime les connexions associées
    state.connections = state.connections.filter(c => {
        if (c.fromId === state.selectedSlide.id || c.toId === state.selectedSlide.id) {
            c.line.remove(); 
            // NOTE : Idéalement, il faudrait aussi nettoyer les boutons dans les autres slides
            // mais c'est complexe sans parcourir tout le contenu. Pour l'instant on garde ça simple.
            return false;
        }
        return true;
    });
    state.selectedSlide.remove();
    state.selectedSlide = null;
  } 
  else if (state.selectedConnection) {
    const conn = state.selectedConnection;

    // 1. Toujours supprimer le bouton de l'aller (A -> B)
    removeLinkButtonFromSlide(conn.fromId, conn.toId);

    // 2. Si c'était une flèche double, supprimer le bouton retour (B -> A)
    if (conn.type === 'double') {
        removeLinkButtonFromSlide(conn.toId, conn.fromId);
    }

    // 3. Supprimer la ligne visuelle et de la mémoire
    conn.line.remove();
    state.connections = state.connections.filter(c => c !== conn);
    state.selectedConnection = null;
  }
};

// --- SLIDES ---
function createSlide(type) {
  state.slideCount++;
  const id = `slide-${state.slideCount}`;
  state.slidesContent[id] = { html: "", bg: "#ffffff", bgImg: "none" };

  const slide = document.createElement("div");
  slide.className = `slide ${type}`;
  slide.id = id;

  const previewWrapper = document.createElement("div");
  previewWrapper.className = "slide-preview-wrapper";
  previewWrapper.id = `preview-${id}`;

  const infoOverlay = document.createElement("div");
  infoOverlay.className = "slide-info-overlay";
  infoOverlay.innerHTML = (type === "info" ? "ℹ️" : type === "condition" ? "❓" : type === "fin" ? "🏁" : "") + " " + state.slideCount;

  slide.appendChild(previewWrapper);
  slide.appendChild(infoOverlay);

  const centerX = 2500 - state.pointX / state.scale;
  const centerY = 2500 - state.pointY / state.scale;
  slide.style.left = centerX - 80 + "px";
  slide.style.top = centerY - 45 + "px";

  slide.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("port")) return;
    e.stopPropagation();
    selectSlide(slide);
    state.isDraggingSlide = true;
    state.dragOffset.x = e.offsetX;
    state.dragOffset.y = e.offsetY;
  });

  slide.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    openEditor(id);
  });

  ["top", "right", "bottom", "left"].forEach((pos) => {
    const port = document.createElement("div");
    port.className = `port ${pos}`;
    port.addEventListener("mousedown", (e) => startConnection(e, id, port));
    port.addEventListener("mouseup", (e) => endConnection(e, id, port));
    slide.appendChild(port);
  });

  canvas.appendChild(slide);
  updateNodePreview(id);
}

window.updateNodePreview = function (id) {
  const wrapper = document.getElementById(`preview-${id}`);
  const data = state.slidesContent[id];
  if (!wrapper || !data) return;
  wrapper.innerHTML = data.html || "";
  wrapper.style.backgroundColor = data.bg || "#ffffff";
  wrapper.style.backgroundImage = data.bgImg || "none";
  wrapper.style.backgroundSize = "cover";
};

// --- CONNEXIONS ---
function startConnection(e, id, port) {
  e.stopPropagation();
  state.isConnecting = true;
  state.connectionStart = { id, port };

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("stroke", "#333");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-dasharray", "5,5");
  line.setAttribute("marker-end", "url(#arrow-end)");

  const start = getPortCenter(port);
  line.setAttribute("x1", start.x);
  line.setAttribute("y1", start.y);
  line.setAttribute("x2", start.x);
  line.setAttribute("y2", start.y);

  connectionsLayer.appendChild(line);
  state.tempLine = line;
}

function endConnection(e, id, port) {
  e.stopPropagation();
  if (state.isConnecting && state.tempLine) {
    if (state.connectionStart.id !== id) {
      state.tempLine.removeAttribute("stroke-dasharray");
      const end = getPortCenter(port);
      state.tempLine.setAttribute("x2", end.x);
      state.tempLine.setAttribute("y2", end.y);

      // Objet Connexion avec TYPE (simple/double)
      const connectionObj = {
        line: state.tempLine,
        fromId: state.connectionStart.id,
        toId: id,
        fromPort: state.connectionStart.port,
        toPort: port,
        type: 'simple' // Par défaut
      };

      // Clic simple : Sélection
      state.tempLine.addEventListener("click", function(evt) {
          evt.stopPropagation();
          selectConnection(connectionObj);
      });

      // --- DOUBLE CLIC : GESTION DU DOUBLE SENS (Boutons) ---
      state.tempLine.addEventListener("dblclick", function (evt) {
        evt.stopPropagation();
        const start = this.getAttribute("marker-start");
        
        if (start) {
            // C'était double -> devient simple
            this.removeAttribute("marker-start");
            connectionObj.type = 'simple';
            // On enlève le bouton retour (B -> A)
            removeLinkButtonFromSlide(connectionObj.toId, connectionObj.fromId);
        } else {
            // C'était simple -> devient double
            this.setAttribute("marker-start", "url(#arrow-start)");
            connectionObj.type = 'double';
            // On ajoute le bouton retour (B -> A)
            addLinkButtonToSlide(connectionObj.toId, connectionObj.fromId);
        }
      });

      state.connections.push(connectionObj);
      
      // Création initiale du bouton aller (A -> B)
      addLinkButtonToSlide(state.connectionStart.id, id);
      
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
    x: (rect.left - canvasRect.left + rect.width / 2) / state.scale,
    y: (rect.top - canvasRect.top + rect.height / 2) / state.scale,
  };
}

function updateConnections() {
  state.connections.forEach((conn) => {
    const start = getPortCenter(conn.fromPort);
    const end = getPortCenter(conn.toPort);
    conn.line.setAttribute("x1", start.x);
    conn.line.setAttribute("y1", start.y);
    conn.line.setAttribute("x2", end.x);
    conn.line.setAttribute("y2", end.y);
  });
}

// --- FONCTIONS GESTION DES BOUTONS DE LIEN ---

function addLinkButtonToSlide(sourceId, targetId) {
    let slideData = state.slidesContent[sourceId];
    // Création des données si elles n'existent pas encore
    if (!slideData) {
        slideData = { html: "", bg: "#ffffff", bgImg: "", slideNum: "" };
        state.slidesContent[sourceId] = slideData;
    }

    const btnId = `link-${sourceId}-${targetId}`;
    // Vérifier si le bouton existe déjà pour éviter les doublons
    if (slideData.html.includes(btnId)) return;

    const btnHtml = `
        <div id="${btnId}" class="item-box link-button square" data-target="${targetId}" style="width:60px; height:60px; top:50px; left:50px; z-index:10;">
            ➜
            <div class="resize-handle"></div>
            <div class="delete-btn">✕</div>
            <div class="rotate-handle">↻</div>
        </div>`;

    state.slidesContent[sourceId].html += btnHtml;
    updateNodePreview(sourceId);
}

function removeLinkButtonFromSlide(sourceId, targetId) {
    let slideData = state.slidesContent[sourceId];
    if (!slideData) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = slideData.html;
    
    // Recherche par data-target
    const btn = tempDiv.querySelector(`.link-button[data-target="${targetId}"]`);
    if (btn) {
        btn.remove();
        state.slidesContent[sourceId].html = tempDiv.innerHTML;
        updateNodePreview(sourceId);
    }
}

// Init
setTransform();