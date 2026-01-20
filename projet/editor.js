// --- FONCTIONS DE L'ÉDITEUR ---

function openEditor(id) {
    state.currentEditingId = id;
    const data = state.slidesContent[id];
    editableSlide.innerHTML = data.html || "";
    editableSlide.style.backgroundColor = data.bg || "#ffffff";
    editableSlide.style.backgroundImage = data.img || "none";
    editorOverlay.style.display = 'flex';
    
    // Réattacher les événements aux objets chargés
    editableSlide.querySelectorAll('.item-box').forEach(attachItemEvents);
}

document.getElementById('btn-close-editor').onclick = () => {
    if (state.currentEditingId) {
        state.slidesContent[state.currentEditingId] = {
            html: editableSlide.innerHTML,
            bg: editableSlide.style.backgroundColor,
            img: editableSlide.style.backgroundImage
        };
        // Feedback visuel sur le graphe
        const slide = document.getElementById(state.currentEditingId);
        if (editableSlide.innerHTML.trim() !== "") slide.style.border = "2px solid #2ecc71";
    }
    editorOverlay.style.display = 'none';
    state.currentEditingId = null;
};

// Outils
document.getElementById('addTextBtn').onclick = () => createItem(`<div class="content-editable" contenteditable="true">Texte...</div>`, 'text-box');

document.getElementById('addImageBtn').onclick = () => document.getElementById('imageInput').click();
document.getElementById('imageInput').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => createItem(`<img src="${evt.target.result}" style="width:100%; height:100%; pointer-events:none;">`, 'image-box', 200, 150);
        reader.readAsDataURL(file);
    }
};

window.addEditorShape = (type) => {
    let content = `<div class="shape-content" style="background:#3498db; width:100%; height:100%;"></div>`;
    if (type === 'circle') content = `<div class="shape-content" style="background:#e74c3c; width:100%; height:100%; border-radius:50%;"></div>`;
    if (type === 'triangle') content = `<div class="shape-content" style="background:#2ecc71; width:100%; height:100%; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div>`;
    createItem(content, `shape-box ${type}`, 100, 100);
}

// Création d'objets (Interne)
function createItem(html, className, w = 150, h = 50) {
    const div = document.createElement('div');
    div.className = `item-box ${className}`;
    div.style.width = w + 'px'; div.style.height = h + 'px';
    div.style.left = '50px'; div.style.top = '50px';
    div.innerHTML = html + `
        <div class="resize-handle"></div>
        <div class="delete-btn">✕</div>
        <div class="rotate-handle">↻</div>`;
    editableSlide.appendChild(div);
    attachItemEvents(div);
}

function attachItemEvents(div) {
    div.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); div.remove(); };
    
    div.onmousedown = (e) => {
        if (e.target.getAttribute('contenteditable')) return;
        e.stopPropagation();
        
        // Sélection
        document.querySelectorAll('.item-box').forEach(i => i.classList.remove('selected'));
        div.classList.add('selected');
        state.activeItem = div;

        const startX = e.clientX; const startY = e.clientY;
        const startLeft = div.offsetLeft; const startTop = div.offsetTop;
        const startW = div.offsetWidth; const startH = div.offsetHeight;

        // Resize ?
        if (e.target.classList.contains('resize-handle')) {
            function doResize(ev) {
                div.style.width = Math.max(20, startW + (ev.clientX - startX)) + 'px';
                div.style.height = Math.max(20, startH + (ev.clientY - startY)) + 'px';
            }
            window.addEventListener('mousemove', doResize);
            window.addEventListener('mouseup', () => window.removeEventListener('mousemove', doResize), {once:true});
            return;
        }

        // Drag ?
        function doDrag(ev) {
            div.style.left = (startLeft + (ev.clientX - startX)) + 'px';
            div.style.top = (startTop + (ev.clientY - startY)) + 'px';
        }
        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', () => window.removeEventListener('mousemove', doDrag), {once:true});
    };
}

// Background & Formatage
document.getElementById('bgColorPicker').addEventListener('input', (e) => {
    editableSlide.style.backgroundImage = 'none';
    editableSlide.style.backgroundColor = e.target.value;
});
document.getElementById('bgImageBtn').onclick = () => document.getElementById('bgImageInput').click();
document.getElementById('bgImageInput').onchange = (e) => {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = (evt) => { editableSlide.style.backgroundImage = `url(${evt.target.result})`; editableSlide.style.backgroundSize = 'cover'; };
        reader.readAsDataURL(file);
    }
};
const format = (cmd, val) => document.execCommand(cmd, false, val);
document.getElementById('topBoldBtn').onclick = () => format('bold');
document.getElementById('topItalicBtn').onclick = () => format('italic');
document.getElementById('topUnderlineBtn').onclick = () => format('underline');
document.getElementById('topTextColor').oninput = (e) => format('foreColor', e.target.value);