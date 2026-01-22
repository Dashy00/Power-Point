// =================================================================
// 1. GESTION DU GRAPHE (ZOOM, PAN, SELECTION)
// =================================================================

// --- ZOOM & PAN ---
function setTransform() {
  canvas.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
  if (zoomText) zoomText.innerText = Math.round(state.scale * 100) + "%";
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

// --- DÉFINIR LE DÉBUT ---
document.getElementById("btn-set-start").onclick = () => {
    if (!state.selectedSlide) {
        alert("Veuillez sélectionner une diapositive d'abord.");
        return;
    }
    setAsStartNode(state.selectedSlide.id);
};

function setAsStartNode(id) {
    if (state.startSlideId) {
        const oldStart = document.getElementById(state.startSlideId);
        if (oldStart) {
            oldStart.classList.remove("start-node");
            const oldFlag = oldStart.querySelector(".start-flag-icon");
            if (oldFlag) oldFlag.remove();
        }
    }
    state.startSlideId = id;
    const newStart = document.getElementById(id);
    if(newStart) {
        newStart.classList.add("start-node");
        const flag = document.createElement("div");
        flag.className = "start-flag-icon";
        flag.innerText = "🚩";
        newStart.appendChild(flag);
    }
}

// =================================================================
// 2. CRÉATION ET GESTION DES SLIDES & CONNEXIONS
// =================================================================

// --- CRÉATION ---
document.getElementById("btn-new-slide").onclick = () => createSlide("default");
document.getElementById("btn-condition").onclick = () => createSlide("condition");
document.getElementById("btn-bloc-fin").onclick = () => createSlide("fin");

function getNextAvailableNumber() {
    const existingNumbers = new Set();
    Object.values(state.slidesContent).forEach(slide => {
        if (slide.slideNum) existingNumbers.add(parseInt(slide.slideNum));
    });
    let num = 1;
    while (existingNumbers.has(num)) num++;
    return num.toString();
}

function createSlide(type, savedId = null, savedPos = null, savedNum = null) {
  if(!savedId) state.slideCount++;
  
  const id = savedId || `slide-${state.slideCount}`;
  const autoNum = savedNum || getNextAvailableNumber();
  
  if (!state.slidesContent[id]) {
      state.slidesContent[id] = { 
          html: "", 
          bg: "#ffffff", 
          bgImg: "none", 
          slideNum: autoNum,
          requiredSlides: [],
          type: type 
      };
  } else {
      state.slidesContent[id].type = type; 
  }

  const slide = document.createElement("div");
  slide.className = `slide ${type}`;
  slide.id = id;

  const previewWrapper = document.createElement("div");
  previewWrapper.className = "slide-preview-wrapper";
  previewWrapper.id = `preview-${id}`;

  const infoOverlay = document.createElement("div");
  infoOverlay.className = "slide-info-overlay";
  
  if(type === "condition") {
      infoOverlay.innerHTML = `<span style="font-size:24px;">❓</span><br><span>${autoNum}</span>`;
  } else if(type === "fin") {
      infoOverlay.innerHTML = "🏁 " + autoNum;
  } else {
      infoOverlay.innerHTML = autoNum;
  }

  slide.appendChild(previewWrapper);
  slide.appendChild(infoOverlay);
  
  if (savedPos) {
      slide.style.left = savedPos.left;
      slide.style.top = savedPos.top;
  } else {
      const centerX = 2500 - state.pointX / state.scale;
      const centerY = 2500 - state.pointY / state.scale;
      slide.style.left = centerX - 80 + "px";
      slide.style.top = centerY - 45 + "px";
  }

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
    if (slide.classList.contains("condition")) {
        openConditionModal(id);
    } else {
        openEditor(id);
    }
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

  if (state.startSlideId === null && type !== 'condition' && !savedId) {
      setAsStartNode(id);
  }
}

window.updateNodePreview = function (id) {
  const wrapper = document.getElementById(`preview-${id}`);
  const data = state.slidesContent[id];
  if (!wrapper || !data) return;
  
  if (data.type === 'condition') {
      wrapper.innerHTML = "";
      return;
  }
  
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

      createConnectionObject(state.tempLine, state.connectionStart.id, id, state.connectionStart.port, port, 'simple');
      addLinkButtonToSlide(state.connectionStart.id, id);
      state.tempLine = null;
    } else {
      state.tempLine.remove();
    }
    state.isConnecting = false;
  }
}

function createConnectionObject(lineElement, fromId, toId, fromPort, toPort, type) {
    const connectionObj = {
        line: lineElement,
        fromId: fromId,
        toId: toId,
        fromPort: fromPort,
        toPort: toPort,
        type: type
    };

    lineElement.addEventListener("click", function(evt) {
        evt.stopPropagation();
        selectConnection(connectionObj);
    });

    // Double-clic pour changer le type de flèche (Aller-Retour)
    lineElement.addEventListener("dblclick", function (evt) {
        evt.stopPropagation();
        const start = this.getAttribute("marker-start");
        
        if (start) {
            // Devient Simple
            this.removeAttribute("marker-start");
            connectionObj.type = 'simple';
            removeLinkButtonFromSlide(connectionObj.toId, connectionObj.fromId);
            if (window.updateLinkedList) window.updateLinkedList();
        } else {
            // Devient Double
            this.setAttribute("marker-start", "url(#arrow-start)");
            connectionObj.type = 'double';
            addLinkButtonToSlide(connectionObj.toId, connectionObj.fromId);
            if (window.updateLinkedList) window.updateLinkedList();
        }
    });

    state.connections.push(connectionObj);
    if (window.updateLinkedList) window.updateLinkedList();
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

// --- BOUTONS LIEN ---
function addLinkButtonToSlide(sourceId, targetId) {
    let slideData = state.slidesContent[sourceId];
    if (!slideData) {
        slideData = { html: "", bg: "#ffffff", bgImg: "", slideNum: "", requiredSlides: [] };
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

// --- SUPPRESSION ---
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

        if (window.updateLinkedList) window.updateLinkedList();

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
        if (window.updateLinkedList) window.updateLinkedList();
    }
};

// =================================================================
// 3. CONFIGURATION DES CONDITIONS (MODALE)
// =================================================================

const conditionOverlay = document.getElementById('condition-overlay');
const conditionList = document.getElementById('condition-list');
const timeSlideSelect = document.getElementById('time-slide-select'); 
const timeDurationInput = document.getElementById('time-duration-input');
const chkOneTime = document.getElementById('chk-one-time'); // Passage unique
let currentConditionId = null;

function openConditionModal(slideId) {
    currentConditionId = slideId;
    conditionList.innerHTML = ""; 
    timeSlideSelect.innerHTML = '<option value="">-- Aucune contrainte de temps --</option>'; 
    
    const data = state.slidesContent[slideId] || {};
    const savedReqs = data.requiredSlides || [];
    const savedTime = data.timeCondition || { slideId: "", duration: 0 }; 
    const isOneTime = data.oneTimeOnly || false;

    // Réinitialiser la checkbox passage unique
    if(chkOneTime) chkOneTime.checked = isOneTime;

    // Création de la liste des slides disponibles
    Object.keys(state.slidesContent).forEach(otherId => {
        if (otherId === slideId) return;

        const otherData = state.slidesContent[otherId];
        const labelText = `Diapo ${otherData.slideNum || "?"}`; 

        // 1. Visites
        const div = document.createElement("div");
        div.className = "condition-item";
        div.innerHTML = `
            <label for="chk-${otherId}">${labelText}</label>
            <input type="checkbox" id="chk-${otherId}" value="${otherId}" ${savedReqs.includes(otherId) ? "checked" : ""}>
        `;
        conditionList.appendChild(div);

        // 2. Temps
        const option = document.createElement("option");
        option.value = otherId;
        option.innerText = labelText;
        if (savedTime.slideId === otherId) option.selected = true;
        timeSlideSelect.appendChild(option);
    });

    timeDurationInput.value = savedTime.duration > 0 ? savedTime.duration : "";
    if(conditionOverlay) conditionOverlay.style.display = "flex";
}

const btnCancelCondition = document.getElementById('btn-cancel-condition');
if(btnCancelCondition) {
    btnCancelCondition.onclick = () => {
        conditionOverlay.style.display = "none";
        currentConditionId = null;
    };
}

const btnSaveCondition = document.getElementById('btn-save-condition');
if(btnSaveCondition) {
    btnSaveCondition.onclick = () => {
        if (!currentConditionId) return;
        
        // 1. Visites
        const checkboxes = conditionList.querySelectorAll('input[type="checkbox"]:checked');
        const requiredIds = Array.from(checkboxes).map(cb => cb.value);
        
        // 2. Temps
        const timeTarget = timeSlideSelect.value;
        const timeDuration = parseInt(timeDurationInput.value) || 0;

        // 3. Passage Unique
        const isOneTime = chkOneTime ? chkOneTime.checked : false;

        if (!state.slidesContent[currentConditionId]) {
            state.slidesContent[currentConditionId] = {};
        }
        
        state.slidesContent[currentConditionId].requiredSlides = requiredIds;
        state.slidesContent[currentConditionId].oneTimeOnly = isOneTime;
        
        if (timeTarget && timeDuration > 0) {
            state.slidesContent[currentConditionId].timeCondition = {
                slideId: timeTarget,
                duration: timeDuration
            };
        } else {
            delete state.slidesContent[currentConditionId].timeCondition;
        }
        
        // Mise à jour visuelle (Label sur le graphe)
        const slideNode = document.getElementById(currentConditionId);
        if(slideNode) {
            const info = slideNode.querySelector('.slide-info-overlay');
            let label = `❓ ${state.slidesContent[currentConditionId].slideNum}`;
            if (requiredIds.length > 0) label += ` (V:${requiredIds.length})`;
            if (timeTarget && timeDuration > 0) label += ` (⏱️)`;
            if (isOneTime) label += ` (1️⃣)`; 
            
            if(info) info.innerHTML = `<span style="font-size:18px;">${label}</span>`;
        }

        conditionOverlay.style.display = "none";
        currentConditionId = null;
    };
}

// =================================================================
// 4. SAUVEGARDE ET CHARGEMENT
// =================================================================

document.getElementById('btn-load').onclick = () => {
    document.getElementById('file-upload').click();
};

document.getElementById('file-upload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        loadProjectFromHTML(event.target.result);
    };
    reader.readAsText(file);
    e.target.value = ''; 
};

function loadProjectFromHTML(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const script = doc.getElementById('project-data');

    if (!script) {
        alert("Fichier projet invalide.");
        return;
    }

    try {
        const projectData = JSON.parse(script.textContent);
        
        document.querySelectorAll('.slide').forEach(el => el.remove());
        while (connectionsLayer.lastChild) {
            if (connectionsLayer.lastChild.tagName === 'line') connectionsLayer.lastChild.remove();
            else break; 
        }
        state.connections = [];
        state.startSlideId = null;
        if (window.updateLinkedList) window.updateLinkedList();

        state.slidesContent = projectData.slides;
        state.slideCount = projectData.slideCount;
        state.startSlideId = projectData.startId;

        Object.keys(projectData.positions).forEach(id => {
            const pos = projectData.positions[id];
            const content = state.slidesContent[id];
            const type = content.type || (content.html.includes("❓") ? "condition" : "default");
            
            createSlide(type, id, pos, content.slideNum);
        });

        setTimeout(() => {
            projectData.connections.forEach(conn => {
                const fromSlide = document.getElementById(conn.from);
                const toSlide = document.getElementById(conn.to);
                
                if (fromSlide && toSlide) {
                    const fromPort = fromSlide.querySelector('.port.right') || fromSlide.querySelector('.port');
                    const toPort = toSlide.querySelector('.port.left') || toSlide.querySelector('.port');

                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("stroke", "#333");
                    line.setAttribute("stroke-width", "2");
                    line.setAttribute("marker-end", "url(#arrow-end)");
                    if(conn.type === 'double') line.setAttribute("marker-start", "url(#arrow-start)");

                    const start = getPortCenter(fromPort);
                    const end = getPortCenter(toPort);
                    line.setAttribute("x1", start.x);
                    line.setAttribute("y1", start.y);
                    line.setAttribute("x2", end.x);
                    line.setAttribute("y2", end.y);

                    connectionsLayer.appendChild(line);
                    createConnectionObject(line, conn.from, conn.to, fromPort, toPort, conn.type);
                }
            });

            if(state.startSlideId) setAsStartNode(state.startSlideId);

        }, 50);

        alert("Projet chargé !");

    } catch (e) {
        console.error(e);
        alert("Erreur de chargement.");
    }
}

// =================================================================
// 5. LECTEUR (PLAYER ENGINE)
// =================================================================

const playerOverlay = document.getElementById('presentation-overlay');
const playerStage = document.getElementById('player-stage');
const btnClosePlayer = document.getElementById('btn-close-player');

// Variables de session de jeu
let visitedSlides = new Set(); 
let visitedDurations = {}; 
let currentSlideStartTime = 0;
let currentPlayingSlideId = null;

// --- DÉMARRER ---
document.getElementById('btn-play').onclick = () => {
    if (!state.startSlideId) {
        alert("Veuillez définir une diapositive de départ (drapeau 🚩).");
        return;
    }
    
    // Reset session
    visitedSlides.clear();
    visitedDurations = {};
    
    playerOverlay.style.display = 'flex';
    loadSlideInPlayer(state.startSlideId);
    
    if (playerOverlay.requestFullscreen) playerOverlay.requestFullscreen();
    fitStageToScreen();
};

// --- UTILITAIRES PLAYER ---
function fitStageToScreen() {
    const stageWidth = 960;
    const stageHeight = 540;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scale = Math.min(windowWidth / stageWidth, windowHeight / stageHeight);
    playerStage.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', () => {
    if (playerOverlay.style.display === 'flex') fitStageToScreen();
});

if (btnClosePlayer) {
    btnClosePlayer.onclick = () => {
        playerOverlay.style.display = 'none';
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }
        currentPlayingSlideId = null;
    };
}

document.addEventListener('fullscreenchange', exitHandler);
document.addEventListener('webkitfullscreenchange', exitHandler);
document.addEventListener('mozfullscreenchange', exitHandler);
document.addEventListener('MSFullscreenChange', exitHandler);

function exitHandler() {
    // Actions à la sortie du plein écran si nécessaire
}

// --- NOTIFICATION VISUELLE INTERNE ---
function showPlayerNotification(msg) {
    const notif = document.createElement('div');
    notif.style.position = 'absolute';
    notif.style.top = '20px';
    notif.style.left = '50%';
    notif.style.transform = 'translateX(-50%)';
    notif.style.background = 'rgba(192, 57, 43, 0.95)'; // Rouge alerte
    notif.style.color = '#fff';
    notif.style.padding = '10px 20px';
    notif.style.borderRadius = '5px';
    notif.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
    notif.style.zIndex = '9999';
    notif.style.fontWeight = 'bold';
    notif.style.fontSize = '16px';
    notif.style.pointerEvents = 'none';
    notif.innerHTML = msg.replace(/\n/g, '<br>');

    playerStage.appendChild(notif);

    setTimeout(() => {
        notif.style.transition = "opacity 0.5s";
        notif.style.opacity = "0";
        setTimeout(() => notif.remove(), 500);
    }, 3000);
}

// --- LOGIQUE PRINCIPALE DU JEU ---
function loadSlideInPlayer(slideId) {
    const data = state.slidesContent[slideId];
    if (!data) return;

    currentPlayingSlideId = slideId;
    currentSlideStartTime = Date.now();
    
    visitedSlides.add(slideId);
    if (!visitedDurations[slideId]) visitedDurations[slideId] = 0;

    // Rendu
    playerStage.innerHTML = data.html;
    playerStage.style.backgroundColor = data.bg || '#ffffff';
    playerStage.style.backgroundImage = data.bgImg || 'none';
    playerStage.style.backgroundSize = 'cover';

    const links = playerStage.querySelectorAll('.link-button');
    links.forEach(link => {
        const targetId = link.dataset.target;
        const targetData = state.slidesContent[targetId];

        // --- GESTION PASSAGE UNIQUE (Masquer bouton si déjà utilisé) ---
        if (targetData && targetData.type === 'condition' && targetData.oneTimeOnly) {
            // Trouver la sortie de cette condition
            const outgoingConn = state.connections.find(c => {
                const isConnected = (c.fromId === targetId || c.toId === targetId);
                const otherEnd = (c.fromId === targetId) ? c.toId : c.fromId;
                return isConnected && otherEnd !== slideId;
            });

            // Si la destination a déjà été visitée, on cache le bouton
            if (outgoingConn) {
                const destId = (outgoingConn.fromId === targetId) ? outgoingConn.toId : outgoingConn.fromId;
                if (visitedSlides.has(destId)) {
                    link.style.display = 'none';
                }
            }
        }
        // ----------------------------------------------------------------

        link.onclick = (e) => {
            e.stopPropagation();
            
            // Calcul du temps passé
            const now = Date.now();
            const timeSpentSeconds = (now - currentSlideStartTime) / 1000;
            if (currentPlayingSlideId) {
                visitedDurations[currentPlayingSlideId] += timeSpentSeconds;
                currentSlideStartTime = now;
            }

            const targetNodeElement = document.getElementById(targetId);

            // CAS 1 : CIBLE = CONDITION
            if (targetNodeElement && targetNodeElement.classList.contains('condition')) {
                
                let errors = [];

                // A. Visites Requises
                const requiredIds = targetData.requiredSlides || [];
                const missingVisits = requiredIds.filter(reqId => !visitedSlides.has(reqId));
                if (missingVisits.length > 0) {
                   missingVisits.forEach(id => {
                       const num = state.slidesContent[id].slideNum || "?";
                       errors.push(`❌ Visiter la diapositive N° ${num}`);
                   });
                }

                // B. Temps Requis
                const timeCond = targetData.timeCondition;
                if (timeCond && timeCond.slideId && timeCond.duration > 0) {
                    const timeSpent = visitedDurations[timeCond.slideId] || 0;
                    if (timeSpent < timeCond.duration) {
                        const remaining = Math.ceil(timeCond.duration - timeSpent);
                        const slideNum = state.slidesContent[timeCond.slideId].slideNum || "?";
                        errors.push(`⏳ Rester encore ${remaining}s sur la diapo N° ${slideNum}`);
                    }
                }

                // C. Vérification
                if (errors.length > 0) {
                    showPlayerNotification("Accès refusé :<br>" + errors.join("<br>"));
                    return; 
                } else {
                    // SUCCÈS : ROUTAGE INTELLIGENT (Support Double Flèche & Aller-Retour)
                    const nextConnection = state.connections.find(c => {
                        // Connexion reliée à la condition...
                        const isConnectedToCondition = (c.fromId === targetId || c.toId === targetId);
                        // ... dont l'autre bout n'est PAS là d'où je viens
                        const otherEnd = (c.fromId === targetId) ? c.toId : c.fromId;
                        return isConnectedToCondition && otherEnd !== currentPlayingSlideId;
                    });

                    if (nextConnection) {
                        const destId = (nextConnection.fromId === targetId) ? nextConnection.toId : nextConnection.fromId;
                        goToSlideWithTransition(destId);
                    } else {
                        showPlayerNotification("Impasse : Aucune autre destination détectée.");
                    }
                    return;
                }
            }

            // CAS 2 : CIBLE = SLIDE NORMALE
            goToSlideWithTransition(targetId);
        };
    });
}

function goToSlideWithTransition(targetId) {
    playerStage.style.opacity = 0;
    setTimeout(() => {
        loadSlideInPlayer(targetId);
        playerStage.style.opacity = 1;
    }, 150);
}

// =================================================================
// 6. EXPORT (GÉNÉRER HTML)
// =================================================================

document.getElementById('btn-generate').onclick = () => {
    if (!state.startSlideId) {
        alert("Impossible de générer : aucune diapositive de départ définie.");
        return;
    }
    const htmlContent = generateStandaloneHTML();
    downloadFile("presentation.html", htmlContent);
};

function generateStandaloneHTML() {
    const nodePositions = {};
    document.querySelectorAll('.slide').forEach(slide => {
        nodePositions[slide.id] = { left: slide.style.left, top: slide.style.top };
    });

    const appState = {
        version: "1.1",
        slides: state.slidesContent,
        connections: state.connections.map(c => ({ from: c.fromId, to: c.toId, type: c.type })),
        positions: nodePositions,
        startId: state.startSlideId,
        slideCount: state.slideCount
    };

    const slidesDataJSON = JSON.stringify(state.slidesContent);
    const connectionsJSON = JSON.stringify(appState.connections);
    const startId = state.startSlideId;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Présentation NodeFlow</title>
    <style>
        body { margin: 0; padding: 0; background-color: #000; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Segoe UI', sans-serif; }
        #stage { width: 960px; height: 540px; background: white; position: relative; overflow: hidden; box-shadow: 0 0 0 100vw black; transform-origin: center center; transition: opacity 0.15s ease; }
        
        .text-box, .image-box, .shape-box, .bubble-box, .link-button { position: absolute; cursor: default; }
        .text-box { z-index: 3; } .image-box { z-index: 1; } .shape-box { z-index: 2; }
        .image-box img { width: 100%; height: 100%; display: block; }
        .shape-content { width: 100%; height: 100%; box-sizing: border-box; }
        .circle .shape-content { border-radius: 50%; }
        .triangle .shape-content { clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }
        .bubble-box { width: 36px; height: 36px; border-radius: 50%; background: #a1887f; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; z-index: 4; }
        .bubble-box:hover::after { content: attr(data-desc); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.9); color: white; padding: 10px; border-radius: 5px; width: max-content; max-width: 300px; margin-bottom: 10px; }
        
        .link-button { background-color: #8d6e63; color: white; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 24px; z-index: 10; cursor: pointer; transition: transform 0.1s; border: 2px solid #a1887f; }
        .link-button:hover { transform: scale(1.1); filter: brightness(1.1); }
        .link-button:active { transform: scale(0.95); }
        .link-button.square { border-radius: 4px; } .link-button.round { border-radius: 50%; }
        
        .resize-handle, .delete-btn, .rotate-handle { display: none !important; }
        .content { outline: none; }
        
        .player-notif { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(192, 57, 43, 0.95); color: #fff; padding: 10px 20px; border-radius: 5px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 9999; font-weight: bold; pointer-events: none; transition: opacity 0.5s; }
    </style>
</head>
<body>
    <div id="stage"></div>
    <script id="project-data" type="application/json">
        ${JSON.stringify(appState)}
    <\/script>
    <script>
        const slides = ${slidesDataJSON};
        const connections = ${connectionsJSON};
        const startId = "${startId}";
        const stage = document.getElementById('stage');
        let visited = new Set();
        let currentId = null; 

        function showNotif(msg) {
            const notif = document.createElement('div');
            notif.className = 'player-notif';
            notif.innerHTML = msg;
            stage.appendChild(notif);
            setTimeout(() => { notif.style.opacity = '0'; setTimeout(() => notif.remove(), 500); }, 3000);
        }

        function goToSlide(id) {
            const data = slides[id];
            if (!data) return;
            
            visited.add(id);
            currentId = id;

            stage.style.opacity = 0;
            setTimeout(() => {
                stage.innerHTML = data.html;
                stage.style.backgroundColor = data.bg || '#ffffff';
                stage.style.backgroundImage = data.bgImg || 'none';
                stage.style.backgroundSize = 'cover';

                // DESACTIVER L'EDITION
                stage.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
                stage.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

                const links = stage.querySelectorAll('.link-button');
                links.forEach(link => {
                    const targetId = link.dataset.target;
                    const targetData = slides[targetId];

                    // Passage unique (Version Export)
                    if (targetData && targetData.type === 'condition' && targetData.oneTimeOnly) {
                         const outgoingConn = connections.find(c => {
                            const isConnected = (c.from === targetId || c.to === targetId);
                            const otherEnd = (c.from === targetId) ? c.to : c.from;
                            return isConnected && otherEnd !== currentId;
                        });
                        if (outgoingConn) {
                             const destId = (outgoingConn.from === targetId) ? outgoingConn.to : outgoingConn.from;
                             if (visited.has(destId)) link.style.display = 'none';
                        }
                    }

                    link.onclick = (e) => {
                        e.stopPropagation();

                        if (targetData && targetData.type === 'condition') {
                            const requiredIds = targetData.requiredSlides || [];
                            const missing = requiredIds.filter(reqId => !visited.has(reqId));
                            
                            if (missing.length > 0) {
                                showNotif("❌ Vous n'avez pas visité toutes les diapositives requises.");
                                return;
                            }

                            // Routage intelligent Export
                            const outgoingConn = connections.find(c => {
                                const isConnected = (c.from === targetId || c.to === targetId);
                                const otherEnd = (c.from === targetId) ? c.to : c.from;
                                return isConnected && otherEnd !== currentId;
                            });
                            
                            if (outgoingConn) {
                                const destId = (outgoingConn.from === targetId) ? outgoingConn.to : outgoingConn.from;
                                goToSlide(destId); 
                            }
                            return;
                        }
                        goToSlide(targetId);
                    };
                });
                stage.style.opacity = 1;
            }, 150);
        }

        function resize() {
            const ratio = Math.min(window.innerWidth / 960, window.innerHeight / 540);
            stage.style.transform = 'scale(' + ratio + ')';
        }
        window.onresize = resize;
        resize();

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

// --- RACCOURCIS ---
window.addEventListener("keydown", (e) => {
    if (document.getElementById("editor-overlay").style.display === "flex") return;
    if (e.key === "Delete" || e.key === "Backspace") {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        document.getElementById("btn-delete").click();
    }
});

// Init
setTransform();