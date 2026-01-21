// =================================================================
// GESTION DU GRAPHE (ZOOM, PAN, SLIDES, FLÈCHES)
// =================================================================

// --- 1. ZOOM & PAN ---
function setTransform() {
  canvas.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
  zoomText.innerText = Math.round(state.scale * 100) + "%";
}
document.getElementById("btn-zoom-in").onclick = () => { state.scale = Math.min(state.scale + 0.1, 3); setTransform(); };
document.getElementById("btn-zoom-out").onclick = () => { state.scale = Math.max(state.scale - 0.1, 0.2); setTransform(); };
document.getElementById("btn-reset").onclick = () => { state.scale = 1; state.pointX = 0; state.pointY = 0; setTransform(); };

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

// --- GESTION DU BOUTON "DÉFINIR COMME DÉBUT" ---
document.getElementById("btn-set-start").onclick = () => {
    if (!state.selectedSlide) {
        alert("Veuillez sélectionner une diapositive d'abord.");
        return;
    }
    const newStartId = state.selectedSlide.id;
    if (state.startSlideId === newStartId) return;

    if (state.startSlideId) {
        const oldStartSlide = document.getElementById(state.startSlideId);
        if (oldStartSlide) {
            oldStartSlide.classList.remove("start-node");
            const oldFlag = oldStartSlide.querySelector(".start-flag-icon");
            if (oldFlag) oldFlag.remove();
        }
    }

    state.startSlideId = newStartId;
    state.selectedSlide.classList.add("start-node");
    const flag = document.createElement("div");
    flag.className = "start-flag-icon";
    flag.innerText = "🚩";
    state.selectedSlide.appendChild(flag);
};

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

// --- SUPPRESSION INTELLIGENTE ---
document.getElementById("btn-delete").onclick = () => {
    if (state.selectedSlide) {
        const deletedId = state.selectedSlide.id;
        if (state.startSlideId === deletedId) state.startSlideId = null;

        state.connections = state.connections.filter(c => {
            if (c.fromId === deletedId || c.toId === deletedId) {
                c.line.remove(); 
                if (c.toId === deletedId) removeLinkButtonFromSlide(c.fromId, deletedId);
                if (c.fromId === deletedId && c.type === 'double') removeLinkButtonFromSlide(c.toId, deletedId);
                return false;
            }
            return true;
        });

        if (state.slidesContent[deletedId]) delete state.slidesContent[deletedId];
        state.selectedSlide.remove();
        state.selectedSlide = null;
    } 
    else if (state.selectedConnection) {
        const conn = state.selectedConnection;
        removeLinkButtonFromSlide(conn.fromId, conn.toId);
        if (conn.type === 'double') removeLinkButtonFromSlide(conn.toId, conn.fromId);
        conn.line.remove();
        state.connections = state.connections.filter(c => c !== conn);
        state.selectedConnection = null;
    }
};

function getNextAvailableNumber() {
    const existingNumbers = new Set();
    Object.values(state.slidesContent).forEach(slide => {
        if (slide.slideNum) existingNumbers.add(parseInt(slide.slideNum));
    });
    let num = 1;
    while (existingNumbers.has(num)) num++;
    return num.toString();
}

// --- SLIDES ---
function createSlide(type) {
  state.slideCount++;
  const id = `slide-${state.slideCount}`;
  const autoNum = getNextAvailableNumber();
  
  state.slidesContent[id] = { html: "", bg: "#ffffff", bgImg: "none", slideNum: autoNum };

  const slide = document.createElement("div");
  slide.className = `slide ${type}`;
  slide.id = id;

  const previewWrapper = document.createElement("div");
  previewWrapper.className = "slide-preview-wrapper";
  previewWrapper.id = `preview-${id}`;

  const infoOverlay = document.createElement("div");
  infoOverlay.className = "slide-info-overlay";
  infoOverlay.innerHTML = (type === "condition" ? "❓" : type === "fin" ? "🏁" : "") + " " + autoNum;

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

  if (state.startSlideId === null) {
      // Définir comme départ manuellement pour réutiliser la fonction visuelle
      state.startSlideId = id;
      slide.classList.add("start-node");
      const flag = document.createElement("div");
      flag.className = "start-flag-icon";
      flag.innerText = "🚩";
      slide.appendChild(flag);
  }
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
    
    const btn = tempDiv.querySelector(`.link-button[data-target="${targetId}"]`);
    if (btn) {
        btn.remove();
        state.slidesContent[sourceId].html = tempDiv.innerHTML;
        updateNodePreview(sourceId);
    }
}

// =================================================================
// --- LOGIQUE DU LECTEUR (MODE AFFICHER & GÉNÉRER) ---
// =================================================================

const playerOverlay = document.getElementById('presentation-overlay');
const playerStage = document.getElementById('player-stage');
const btnClosePlayer = document.getElementById('btn-close-player');

// -----------------------------------------------------------------
// 1. FONCTION "AFFICHER" (Lecture dans le navigateur)
// -----------------------------------------------------------------
document.getElementById('btn-play').onclick = () => {
    if (!state.startSlideId) {
        alert("Veuillez définir une diapositive de départ (drapeau 🚩).");
        return;
    }
    
    // Charger la slide
    loadSlideInPlayer(state.startSlideId);
    
    // Afficher l'overlay
    playerOverlay.style.display = 'flex';

    // Demander le plein écran
    if (playerOverlay.requestFullscreen) {
        playerOverlay.requestFullscreen();
    } else if (playerOverlay.webkitRequestFullscreen) { /* Safari */
        playerOverlay.webkitRequestFullscreen();
    } else if (playerOverlay.msRequestFullscreen) { /* IE11 */
        playerOverlay.msRequestFullscreen();
    }
    
    // Adapter la taille (Fit to screen)
    fitStageToScreen();
};

// Gestion de la sortie du plein écran via la touche Echap
document.addEventListener('fullscreenchange', exitHandler);
document.addEventListener('webkitfullscreenchange', exitHandler);
document.addEventListener('mozfullscreenchange', exitHandler);
document.addEventListener('MSFullscreenChange', exitHandler);

function exitHandler() {
    if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
        // Si on quitte le plein écran, on cache l'overlay
        playerOverlay.style.display = 'none';
        playerStage.innerHTML = '';
        playerStage.style.transform = 'scale(1)';
    }
}

// Bouton Quitter (X)
btnClosePlayer.onclick = () => {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else {
        // Fallback si pas en plein écran
        playerOverlay.style.display = 'none';
        playerStage.innerHTML = '';
    }
};

function fitStageToScreen() {
    // Calcul pour adapter le 960x540 à l'écran de l'utilisateur
    const margin = 40;
    const availableWidth = window.innerWidth - margin;
    const availableHeight = window.innerHeight - margin;
    
    const scaleX = availableWidth / 960;
    const scaleY = availableHeight / 540;
    const scale = Math.min(scaleX, scaleY, 1.5); // Max zoom 1.5x pour ne pas flouter
    
    playerStage.style.transform = `scale(${scale})`;
}

// Re-calculer l'échelle si on redimensionne la fenêtre
window.addEventListener('resize', () => {
    if(playerOverlay.style.display === 'flex') fitStageToScreen();
});

// Fonction interne de chargement (utilisée pour "Afficher")
function loadSlideInPlayer(slideId) {
    const data = state.slidesContent[slideId];
    if (!data) return;

    playerStage.innerHTML = data.html;
    playerStage.style.backgroundColor = data.bg || '#ffffff';
    playerStage.style.backgroundImage = data.bgImg || 'none';
    playerStage.style.backgroundSize = 'cover';

    // Rendre les boutons interactifs
    const links = playerStage.querySelectorAll('.link-button');
    links.forEach(link => {
        link.onclick = (e) => {
            e.stopPropagation();
            const targetId = link.dataset.target;
            // Transition simple
            playerStage.style.opacity = 0;
            setTimeout(() => {
                loadSlideInPlayer(targetId);
                playerStage.style.opacity = 1;
            }, 100);
        };
    });
}

// -----------------------------------------------------------------
// 2. FONCTION "GÉNÉRER" (Téléchargement du fichier autonome)
// -----------------------------------------------------------------
document.getElementById('btn-generate').onclick = () => {
    if (!state.startSlideId) {
        alert("Impossible de générer : aucune diapositive de départ définie.");
        return;
    }

    const htmlContent = generateStandaloneHTML();
    downloadFile("presentation.html", htmlContent);
};

function generateStandaloneHTML() {
    // On convertit l'objet slidesContent en JSON string pour l'intégrer au fichier
    const slidesData = JSON.stringify(state.slidesContent);
    const startId = state.startSlideId;

    // Le template HTML du fichier exporté
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Présentation NodeFlow</title>
    <style>
        body { margin: 0; padding: 0; background-color: #000; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Segoe UI', sans-serif; }
        #stage { width: 960px; height: 540px; background: white; position: relative; overflow: hidden; box-shadow: 0 0 50px rgba(0,0,0,0.5); transform-origin: center center; transition: opacity 0.15s ease; }
        
        /* Styles des éléments (copie simplifiée de style.css) */
        .text-box, .image-box, .shape-box, .bubble-box, .link-button { position: absolute; }
        .text-box { z-index: 3; } .image-box { z-index: 1; } .shape-box { z-index: 2; }
        .image-box img { width: 100%; height: 100%; display: block; }
        .shape-content { width: 100%; height: 100%; box-sizing: border-box; }
        .circle .shape-content { border-radius: 50%; }
        .triangle .shape-content { clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }
        .bubble-box { width: 36px; height: 36px; border-radius: 50%; background: #a1887f; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; z-index: 4; }
        .bubble-box:hover::after { content: attr(data-desc); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.9); color: white; padding: 10px; border-radius: 5px; width: max-content; max-width: 300px; margin-bottom: 10px; }
        
        /* Boutons de lien */
        .link-button { background-color: #8d6e63; color: white; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 24px; z-index: 10; cursor: pointer; transition: transform 0.1s; border: 2px solid #a1887f; }
        .link-button:hover { transform: scale(1.1); filter: brightness(1.1); }
        .link-button:active { transform: scale(0.95); }
        .link-button.square { border-radius: 4px; } .link-button.round { border-radius: 50%; }

        /* Cacher les outils d'édition qui auraient pu être copiés */
        .resize-handle, .delete-btn, .rotate-handle { display: none !important; }
        .content { outline: none; }
    </style>
</head>
<body>
    <div id="stage"></div>

    <script>
        // DONNÉES DE LA PRÉSENTATION
        const slides = ${slidesData};
        const startId = "${startId}";
        const stage = document.getElementById('stage');

        // FONCTION DE NAVIGATION
        function goToSlide(id) {
            const data = slides[id];
            if (!data) return;

            stage.style.opacity = 0;
            
            setTimeout(() => {
                stage.innerHTML = data.html;
                stage.style.backgroundColor = data.bg || '#ffffff';
                stage.style.backgroundImage = data.bgImg || 'none';
                stage.style.backgroundSize = 'cover';

                // Réactiver les liens
                const links = stage.querySelectorAll('.link-button');
                links.forEach(link => {
                    link.onclick = (e) => {
                        const target = link.dataset.target;
                        goToSlide(target);
                    };
                });

                stage.style.opacity = 1;
            }, 150);
        }

        // ADAPTATION ÉCRAN (RESPONSIVE)
        function resize() {
            const margin = 20;
            const ratio = Math.min(
                (window.innerWidth - margin) / 960,
                (window.innerHeight - margin) / 540
            );
            stage.style.transform = 'scale(' + ratio + ')';
        }
        window.onresize = resize;
        resize();

        // Lancement
        goToSlide(startId);
    <\/script>
</body>
</html>`;
}

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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