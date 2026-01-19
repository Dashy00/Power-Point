const addTextBtn = document.getElementById("addTextBtn");
const addImageBtn = document.getElementById("addImageBtn");
const imageInput  = document.getElementById("imageInput");
const slide       = document.getElementById("slide");

let addMode = false;

// élément actif (texte ou image) pour suppression via Entrée
let activeItem = null;

// drag
let dragging = null;
let offsetX = 0, offsetY = 0;

// resize image
let resizing = null;
let startW = 0, startH = 0;
let startMouseX = 0, startMouseY = 0;

// -----------------------------
// MODE AJOUT TEXTE
// -----------------------------
addTextBtn.addEventListener("click", () => {
  addMode = !addMode;
  addTextBtn.classList.toggle("active", addMode);
  addTextBtn.textContent = addMode ? "Cliquez sur la slide..." : "Ajouter un texte";
});

// -----------------------------
// AJOUT IMAGE (ouvre l'input file)
// -----------------------------
addImageBtn.addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
  const box = document.createElement("div");
  box.className = "image-box";

  // Taille initiale (si vous avez le resize)
  box.style.width = "260px";
  box.style.height = "180px";

  const img = document.createElement("img");
  img.src = reader.result;

  // Poignée resize si vous l'utilisez
  const handle = document.createElement("div");
  handle.className = "resize-handle";

  // ✅ Croix suppression (même classe que texte)
  const del = document.createElement("div");
  del.className = "delete-btn";
  del.textContent = "✕";

  del.addEventListener("click", (ev) => {
    ev.stopPropagation();
    box.remove();
    if (activeItem === box) activeItem = null;
  });

  box.appendChild(img);
  box.appendChild(handle);
  box.appendChild(del);

  // Position initiale (sans translate pour éviter les bugs de drag/resize)
  const slideRect = slide.getBoundingClientRect();
  box.style.left = `${(slideRect.width - 260) / 2}px`;
  box.style.top  = `${(slideRect.height - 180) / 2}px`;

  slide.appendChild(box);

  // ✅ comme le texte : l’objet devient actif
  activeItem = box;
};


  reader.readAsDataURL(file);
  imageInput.value = "";
});

// -----------------------------
// CLICK SUR SLIDE :
// - clic sur un objet => actif
// - clic sur vide + addMode => crée texte
// -----------------------------
slide.addEventListener("click", (e) => {
  const obj = e.target.closest(".text-box, .image-box");

  // Clic sur objet => il devient actif
  if (obj) {
    activeItem = obj;
    return;
  }

  // Clic dans le vide => aucun actif
  activeItem = null;

  // Si pas en mode ajout => rien
  if (!addMode) return;

  // Créer texte si clic direct sur la slide
  if (e.target !== slide) return;

  const rect = slide.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = "text-box";

  box.innerHTML = `
    <div class="content" contenteditable="false">Double-cliquez pour modifier</div>
    <div class="delete-btn">✕</div>
  `;

  box.style.left = `${e.clientX - rect.left - 75}px`;
  box.style.top  = `${e.clientY - rect.top - 20}px`;

  // Supprimer via la croix (optionnel)
  box.querySelector(".delete-btn").addEventListener("click", (ev) => {
    ev.stopPropagation();
    box.remove();
    if (activeItem === box) activeItem = null;
  });

  slide.appendChild(box);

  activeItem = box;
  addMode = false;
  addTextBtn.textContent = "Ajouter un texte";
  addTextBtn.classList.remove("active");
});

// -----------------------------
// DOUBLE-CLIC : édition du texte (seulement sur .content)
// -----------------------------
slide.addEventListener("dblclick", (e) => {
  const content = e.target.closest(".content");
  if (!content) return;

  const parentBox = content.closest(".text-box");
  if (!parentBox) return;

  activeItem = parentBox;

  content.contentEditable = "true";
  content.focus();
});

// sortir du mode édition quand on clique ailleurs
slide.addEventListener("focusout", (e) => {
  if (!e.target.classList.contains("content")) return;
  e.target.contentEditable = "false";
});

// -----------------------------
// SUPPRESSION : Entrée
// - si texte en édition => Entrée normale
// - sinon => supprime l'objet actif (texte ou image)
// -----------------------------
window.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (!activeItem) return;

  // si on est en train d'éditer un texte => ne pas supprimer
  const editing = document.activeElement?.classList?.contains("content")
    && document.activeElement.isContentEditable;

  if (editing) return;

  e.preventDefault();
  activeItem.remove();
  activeItem = null;
});

// -----------------------------
// MOUSEDOWN :
// - si poignée resize => resize image
// - sinon drag texte/image
// -----------------------------
slide.addEventListener("mousedown", (e) => {

  // 1) RESIZE
  const handle = e.target.closest(".resize-handle");
  if (handle) {
    resizing = handle.parentElement;
    activeItem = resizing;

    const rect = resizing.getBoundingClientRect();
    startW = rect.width;
    startH = rect.height;
    startMouseX = e.clientX;
    startMouseY = e.clientY;

    e.preventDefault();
    return;
  }

  // 2) DRAG
  const target = e.target.closest(".text-box, .image-box");
  if (!target) return;

  // Si texte en édition (on clique dans le content) => pas de drag
  if (e.target.classList.contains("content") && e.target.isContentEditable) return;

  dragging = target;
  activeItem = target;

  const rect = dragging.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;

  e.preventDefault();
});

// -----------------------------
// MOUSEMOVE : resize ou drag
// -----------------------------
window.addEventListener("mousemove", (e) => {

  // RESIZE IMAGE
  if (resizing) {
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    // limites min/max
    const newW = Math.max(80, Math.min(900, startW + dx));
    const newH = Math.max(60, Math.min(506, startH + dy));

    resizing.style.width = `${newW}px`;
    resizing.style.height = `${newH}px`;
    return;
  }

  // DRAG OBJET
  if (!dragging) return;

  const slideRect = slide.getBoundingClientRect();

  let newLeft = e.clientX - slideRect.left - offsetX;
  let newTop  = e.clientY - slideRect.top  - offsetY;

  // Empêcher de sortir de la slide
  const elW = dragging.offsetWidth;
  const elH = dragging.offsetHeight;

  newLeft = Math.max(0, Math.min(newLeft, slideRect.width - elW));
  newTop  = Math.max(0, Math.min(newTop,  slideRect.height - elH));

  dragging.style.left = `${newLeft}px`;
  dragging.style.top  = `${newTop}px`;
});

// -----------------------------
// MOUSEUP : fin drag / resize
// -----------------------------    
window.addEventListener("mouseup", () => {
  dragging = null;
  resizing = null;
});
