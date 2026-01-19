const addTextBtn = document.getElementById("addTextBtn");
const slide = document.getElementById("slide");

let addMode = false;
let dragging = null;
let offsetX, offsetY;

// Activer le mode ajout
addTextBtn.addEventListener("click", () => {
    addMode = !addMode;
    addTextBtn.textContent = addMode ? "Cliquez sur la slide..." : "Ajouter un texte";
    addTextBtn.classList.toggle("active", addMode);
});

// Créer un bloc
slide.addEventListener("click", (e) => {
    if (!addMode || e.target !== slide) return;

    const rect = slide.getBoundingClientRect();
    const box = document.createElement("div");
    box.className = "text-box";
    
    box.innerHTML = `
        <div class="content" contenteditable="false">Cliquez pour éditer</div>
        <div class="delete-btn">✕</div>
    `;

    box.style.left = `${e.clientX - rect.left - 75}px`;
    box.style.top = `${e.clientY - rect.top - 20}px`;

    // Suppression
    box.querySelector(".delete-btn").onclick = (ev) => {
        ev.stopPropagation();
        box.remove();
    };

    // Cliquer sur le texte pour l'éditer directement
    const content = box.querySelector(".content");
    content.addEventListener("click", (ev) => {
        ev.stopPropagation(); 
        content.contentEditable = "true";
        content.focus();
    });

    slide.appendChild(box);
    addMode = false;
    addTextBtn.textContent = "Ajouter un texte";
    addTextBtn.classList.remove("active");
});

// Gestion du déplacement (Drag)
slide.addEventListener("mousedown", (e) => {
    const box = e.target.closest(".text-box");
    if (!box || e.target.classList.contains("delete-btn")) return;
    
    // Si on est déjà en train d'écrire, on ne déplace pas
    if (e.target.contentEditable === "true") return;

    dragging = box;
    const rect = dragging.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
});

window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const slideRect = slide.getBoundingClientRect();
    dragging.style.left = `${e.clientX - slideRect.left - offsetX}px`;
    dragging.style.top = `${e.clientY - slideRect.top - offsetY}px`;
});

window.addEventListener("mouseup", () => {
    dragging = null;
});

// Désactiver l'édition quand on clique ailleurs
slide.addEventListener("focusout", (e) => {
    if (e.target.classList.contains("content")) {
        e.target.contentEditable = "false";
    }
});