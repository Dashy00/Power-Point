const addTextBtn = document.getElementById("addTextBtn");
const slide = document.getElementById("slide");

let addMode = false;
let dragging = null;
let offsetX = 0;
let offsetY = 0;

addTextBtn.addEventListener("click", () => {
    addMode = !addMode;
    addTextBtn.textContent = addMode
        ? "Cliquez dans la page..."
        : "Ajouter un texte";
});

slide.addEventListener("click", (e) => {
    if (!addMode) return;

    const rect = slide.getBoundingClientRect();

    const box = document.createElement("div");
    box.className = "text-box";
    box.textContent = "Double-cliquez pour modifier";
    box.style.left = `${e.clientX - rect.left}px`;
    box.style.top = `${e.clientY - rect.top}px`;

    slide.appendChild(box);

    addMode = false;
    addTextBtn.textContent = "Ajouter un texte";
});

slide.addEventListener("dblclick", (e) => {
    if (!e.target.classList.contains("text-box")) return;

    e.target.contentEditable = "true";
    e.target.focus();
});

slide.addEventListener("focusout", (e) => {
    if (!e.target.classList.contains("text-box")) return;
    e.target.contentEditable = "false";
});

slide.addEventListener("mousedown", (e) => {
    if (!e.target.classList.contains("text-box")) return;
    if (e.target.isContentEditable) return;

    dragging = e.target;
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
