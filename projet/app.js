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
document.getElementById("btn-condition").onclick = () => createSlide("condition");
document.getElementById("btn-bloc-fin").onclick = () => createSlide("fin");

// --- SUPPRESSION INTELLIGENTE (BOUTONS VERTS + LIGNES) ---
document.getElementById("btn-delete").onclick = () => {
    // ---------------------------------------------------------
    // CAS 1 : SUPPRESSION D'UNE DIAPOSITIVE (SLIDE)
    // ---------------------------------------------------------
    if (state.selectedSlide) {
        const deletedId = state.selectedSlide.id;

        // 1. Gestion du "Début" : Si c'était la slide de départ, on reset la variable
        if (state.startSlideId === deletedId) {
            state.startSlideId = null;
        }

        // 2. Nettoyage des connexions (Lignes et Boutons)
        state.connections = state.connections.filter(c => {
            // Vérifie si la connexion touche la slide supprimée (départ ou arrivée)
            if (c.fromId === deletedId || c.toId === deletedId) {
                
                // A. Supprimer la ligne SVG visuelle
                c.line.remove(); 
                
                // B. Supprimer les boutons verts dans les AUTRES slides
                
                // Scénario : Une autre slide (A) pointait vers celle supprimée (Deleted).
                // On va dans A (fromId) et on retire le bouton qui ciblait Deleted.
                if (c.toId === deletedId) {
                    removeLinkButtonFromSlide(c.fromId, deletedId);
                }
                
                // Scénario : La slide supprimée (Deleted) avait une liaison DOUBLE vers B.
                // Il faut aller dans B (toId) et retirer le bouton "retour" vers Deleted.
                if (c.fromId === deletedId && c.type === 'double') {
                    removeLinkButtonFromSlide(c.toId, deletedId);
                }

                return false; // On retire cette connexion de la liste state.connections
            }
            return true; // On garde les connexions qui n'ont rien à voir
        });

        // 3. Nettoyage des données de contenu (Mémoire)
        if (state.slidesContent[deletedId]) {
            delete state.slidesContent[deletedId];
        }

        // 4. Suppression visuelle de la slide
        state.selectedSlide.remove();
        state.selectedSlide = null;
    } 
    
    // ---------------------------------------------------------
    // CAS 2 : SUPPRESSION D'UNE CONNEXION SEULE (FLÈCHE)
    // ---------------------------------------------------------
    else if (state.selectedConnection) {
        const conn = state.selectedConnection;

        // 1. Supprimer le bouton aller (Source -> Cible)
        removeLinkButtonFromSlide(conn.fromId, conn.toId);

        // 2. Si c'était une liaison double, supprimer le bouton retour (Cible -> Source)
        if (conn.type === 'double') {
            removeLinkButtonFromSlide(conn.toId, conn.fromId);
        }

        // 3. Supprimer la ligne SVG
        conn.line.remove();

        // 4. Mettre à jour la liste des connexions
        state.connections = state.connections.filter(c => c !== conn);
        state.selectedConnection = null;
    }
};

function getNextAvailableNumber() {
    const existingNumbers = new Set();
    
    // On récupère tous les numéros actuellement utilisés
    Object.values(state.slidesContent).forEach(slide => {
        if (slide.slideNum) existingNumbers.add(parseInt(slide.slideNum));
    });

    // On cherche le premier entier positif (1, 2, 3...) qui n'est pas dans la liste
    let num = 1;
    while (existingNumbers.has(num)) {
        num++;
    }
    return num.toString();
}

// --- SLIDES ---
function createSlide(type) {
  state.slideCount++;
  const id = `slide-${state.slideCount}`;
  
  // >>> MODIFICATION ICI : On calcule le numéro automatiquement
  const autoNum = getNextAvailableNumber();
  
  // On l'enregistre tout de suite dans les données
  state.slidesContent[id] = { html: "", bg: "#ffffff", bgImg: "none", slideNum: autoNum };

  const slide = document.createElement("div");
  slide.className = `slide ${type}`;
  slide.id = id;

  const previewWrapper = document.createElement("div");
  previewWrapper.className = "slide-preview-wrapper";
  previewWrapper.id = `preview-${id}`;

  const infoOverlay = document.createElement("div");
  infoOverlay.className = "slide-info-overlay";
  
  // >>> MODIFICATION ICI : On affiche le numéro calculé (autoNum) au lieu de state.slideCount
  infoOverlay.innerHTML = (type === "condition" ? "❓" : type === "fin" ? "🏁" : "") + " " + autoNum;

  // ... (Le reste de la fonction createSlide reste inchangé : positions, événements, etc.)
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
  
  // ... (Suite du code createSlide avec les ports...)
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

      const connectionObj = {
        line: state.tempLine,
        fromId: state.connectionStart.id,
        toId: id,
        fromPort: state.connectionStart.port,
        toPort: port,
        type: 'simple'
      };

      state.tempLine.addEventListener("click", function(evt) {
          evt.stopPropagation();
          selectConnection(connectionObj);
      });

      state.tempLine.addEventListener("dblclick", function (evt) {
        evt.stopPropagation();
        const start = this.getAttribute("marker-start");
        
        if (start) {
            this.removeAttribute("marker-start");
            connectionObj.type = 'simple';
            removeLinkButtonFromSlide(connectionObj.toId, connectionObj.fromId);
        } else {
            this.setAttribute("marker-start", "url(#arrow-start)");
            connectionObj.type = 'double';
            addLinkButtonToSlide(connectionObj.toId, connectionObj.fromId);
        }
      });

      state.connections.push(connectionObj);
      addLinkButtonToSlide(state.connectionStart.id, id);
      state.tempLine = null;
    } else {
      state.tempLine.remove();
    }
    state.isConnecting = false;
  }
}

// --- GESTION DU BOUTON "DÉFINIR COMME DÉBUT" ---
document.getElementById("btn-set-start").onclick = () => {
    // 1. Vérifier qu'une slide est bien sélectionnée
    if (!state.selectedSlide) {
        alert("Veuillez sélectionner une diapositive d'abord.");
        return;
    }

    const newStartId = state.selectedSlide.id;

    // 2. Si c'est déjà la slide de début, on ne fait rien
    if (state.startSlideId === newStartId) return;

    // --- NETTOYAGE DE L'ANCIEN DÉBUT (Unicité) ---
    // Si une slide de début existait déjà, on lui retire son statut
    if (state.startSlideId) {
        const oldStartSlide = document.getElementById(state.startSlideId);
        if (oldStartSlide) {
            // On retire la classe CSS
            oldStartSlide.classList.remove("start-node");
            // On retire le petit drapeau visuel s'il existe
            const oldFlag = oldStartSlide.querySelector(".start-flag-icon");
            if (oldFlag) oldFlag.remove();
        }
    }

    // --- ATTRIBUTION DU NOUVEAU DÉBUT ---
    // 1. Mettre à jour l'état global
    state.startSlideId = newStartId;

    // 2. Ajouter la classe CSS à la nouvelle slide
    state.selectedSlide.classList.add("start-node");

    // 3. Ajouter le petit drapeau visuel
    const flag = document.createElement("div");
    flag.className = "start-flag-icon";
    flag.innerText = "🚩"; // Le drapeau
    state.selectedSlide.appendChild(flag);
};

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
    if (!slideData) {
        slideData = { html: "", bg: "#ffffff", bgImg: "", slideNum: "" };
        state.slidesContent[sourceId] = slideData;
    }

    const btnId = `link-${sourceId}-${targetId}`;
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
    
    // On cherche le bouton qui pointe vers targetId
    const btn = tempDiv.querySelector(`.link-button[data-target="${targetId}"]`);
    if (btn) {
        btn.remove();
        state.slidesContent[sourceId].html = tempDiv.innerHTML;
        updateNodePreview(sourceId);
    }
}

// --- RACCOURCI CLAVIER : SUPPRESSION DANS LE GRAPHE ---
window.addEventListener("keydown", (e) => {
    if (document.getElementById("editor-overlay").style.display === "flex") return;

    if (e.key === "Delete" || e.key === "Backspace") {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        document.getElementById("btn-delete").click();
    }
});

// Init
setTransform();