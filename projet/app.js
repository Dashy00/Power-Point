// --- ZOOM & PAN ---
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

// --- ZOOM avec la molette de la souris ---
viewport.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.min(Math.max(state.scale + delta, 0.2), 3);
  
  // Zoom centré sur la position de la souris
  const rect = viewport.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Ajuster le point de translation pour zoomer vers la souris
  const scaleDiff = newScale - state.scale;
  state.pointX -= mouseX * scaleDiff / state.scale;
  state.pointY -= mouseY * scaleDiff / state.scale;
  
  state.scale = newScale;
  setTransform();
}, { passive: false });

viewport.addEventListener("mousedown", (e) => {
  // Désélectionner si on clique dans le vide (ni slide, ni port, ni ligne)
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

// BOUTON SUPPRIMER (Gère Slides ET Flèches)
document.getElementById("btn-delete").onclick = () => {
  if (state.selectedSlide) {
    // 1. Supprimer les connexions liées à cette slide
    state.connections = state.connections.filter(c => {
        if (c.fromId === state.selectedSlide.id || c.toId === state.selectedSlide.id) {
            c.line.remove(); // Supprime du DOM SVG
            return false;    // Retire du tableau
        }
        return true;
    });
    // 2. Supprimer la slide
    state.selectedSlide.remove();
    state.selectedSlide = null;
  } 
  else if (state.selectedConnection) {
    // 1. Supprimer la flèche sélectionnée
    state.selectedConnection.line.remove();
    // 2. Retirer du tableau global
    state.connections = state.connections.filter(c => c !== state.selectedConnection);
    state.selectedConnection = null;
  }
};

// --- SLIDES ---
function createSlide(type) {
  state.slideCount++;
  const id = `slide-${state.slideCount}`;
  // Initialisation des données
  state.slidesContent[id] = { html: "", bg: "#ffffff", bgImg: "none" };

  const slide = document.createElement("div");
  slide.className = `slide ${type}`;
  slide.id = id;

  // 1. Création du conteneur de prévisualisation
  const previewWrapper = document.createElement("div");
  previewWrapper.className = "slide-preview-wrapper";
  previewWrapper.id = `preview-${id}`;

  // 2. Création de l'info (Icone + ID)
  const infoOverlay = document.createElement("div");
  infoOverlay.className = "slide-info-overlay";
  infoOverlay.innerHTML =
    (type === "info" ? "ℹ️" : type === "condition" ? "❓" : type === "fin" ? "🏁" : "") +
    " " + state.slideCount;

  slide.appendChild(previewWrapper);
  slide.appendChild(infoOverlay);

  const centerX = 2500 - state.pointX / state.scale;
  const centerY = 2500 - state.pointY / state.scale;
  slide.style.left = centerX - 80 + "px"; // Ajusté pour la largeur 160
  slide.style.top = centerY - 45 + "px"; // Ajusté pour la hauteur 90

  slide.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("port")) return;
    e.stopPropagation();
    selectSlide(slide); // Utilise la fonction centralisée
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

  // Initialisation visuelle
  updateNodePreview(id);
}

// --- FONCTION DE MISE A JOUR VISUELLE ---
window.updateNodePreview = function (id) {
  const wrapper = document.getElementById(`preview-${id}`);
  const data = state.slidesContent[id];

  if (!wrapper || !data) return;

  // On copie le HTML brut
  wrapper.innerHTML = data.html || "";

  // On applique le fond
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

      // Création de l'objet connexion
      const connectionObj = {
        line: state.tempLine,
        fromId: state.connectionStart.id,
        toId: id,
        fromPort: state.connectionStart.port,
        toPort: port,
      };

      // 1. Clic Simple : Sélectionner la flèche
      state.tempLine.addEventListener("click", function(evt) {
          evt.stopPropagation();
          selectConnection(connectionObj);
      });

      // 2. Double Clic : Double Sens
      state.tempLine.addEventListener("dblclick", function (evt) {
        evt.stopPropagation();
        const start = this.getAttribute("marker-start");
        this.setAttribute("marker-start", start ? "" : "url(#arrow-start)");
      });

      // 3. Clic Droit (Backup)
      state.tempLine.addEventListener("contextmenu", function (evt) {
        evt.preventDefault();
        // Si on veut supprimer direct au clic droit :
        this.remove();
        state.connections = state.connections.filter(c => c !== connectionObj);
      });

      state.connections.push(connectionObj);
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

// Init
setTransform();