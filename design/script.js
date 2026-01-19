document.addEventListener('DOMContentLoaded', () => {
    
    const slideArea = document.getElementById('slide-area');
    let selectedElement = null; // L'élément actuellement sélectionné (texte, image, etc.)
    let savedStyle = null; // Pour "Copier le style"

    // ==========================================
    // 1. GESTION DU DRAG & DROP (UNIVERSEL)
    // ==========================================
    function makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        element.addEventListener('mousedown', (e) => {
            // Si on clique pour éditer du texte, on ne veut pas forcément glisser tout de suite
            // Sauf si on clique sur le bord. Ici, on simplifie : le clic active le drag.
            
            // Sélectionner l'élément visuellement
            selectElement(element);

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Positions actuelles
            initialLeft = element.offsetLeft;
            initialTop = element.offsetTop;

            // Curseur
            element.style.cursor = 'grabbing';
            e.stopPropagation(); // Empêche de sélectionner la slide derrière
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault(); // Important pour ne pas sélectionner du texte ailleurs

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            element.style.left = `${initialLeft + dx}px`;
            element.style.top = `${initialTop + dy}px`;
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
            }
        });
    }

    // Appliquer le drag sur les éléments existants (Ronds et Texte par défaut)
    document.querySelectorAll('.dot, .draggable-item').forEach(makeDraggable);


    // ==========================================
    // 2. SÉLECTION ET SIDEBAR (Ronds vs Contenu)
    // ==========================================
    function selectElement(el) {
        // Enlever la sélection précédente
        document.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
        selectedElement = el;
        el.classList.add('selected');

        // Gestion spécifique des ronds (synchronisation avec sidebar gauche)
        if (el.classList.contains('dot')) {
            const id = el.getAttribute('data-id');
            // Reset sidebar
            document.querySelectorAll('.context-box').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
            
            el.classList.add('active');
            const box = document.getElementById(`box-${id}`);
            if(box) box.classList.add('active');
        }
    }

    // Clic sur la slide vide = désélectionner
    slideArea.addEventListener('click', (e) => {
        if (e.target === slideArea) {
            document.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
            selectedElement = null;
        }
    });

    // Clic sur sidebar (active le rond correspondant)
    document.querySelectorAll('.context-box').forEach(box => {
        box.addEventListener('click', () => {
            const id = box.getAttribute('data-target');
            const dot = document.getElementById(`dot-${id}`);
            if (dot) selectElement(dot);
        });
    });


    // ==========================================
    // 3. AJOUT DE CONTENU (Texte, Image, Vidéo)
    // ==========================================
    
    // --- Ajouter Texte ---
    document.getElementById('btn-add-text').addEventListener('click', () => {
        const div = document.createElement('div');
        div.contentEditable = true;
        div.className = 'draggable-item text-element';
        div.innerText = 'Nouveau texte';
        div.style.left = '50px';
        div.style.top = '50px';
        
        slideArea.appendChild(div);
        makeDraggable(div);
        selectElement(div);
        div.focus(); // Focus direct pour écrire
    });

    // --- Ajouter Image ---
    const fileImgInput = document.getElementById('file-image');
    document.getElementById('btn-add-image').addEventListener('click', () => fileImgInput.click());
    
    fileImgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.className = 'draggable-item image-element';
                img.style.left = '100px';
                img.style.top = '100px';
                
                slideArea.appendChild(img);
                makeDraggable(img);
                selectElement(img);
            };
            reader.readAsDataURL(file);
        }
        fileImgInput.value = ''; // Reset pour pouvoir remettre la même image
    });

    // --- Ajouter Vidéo ---
    const fileVidInput = document.getElementById('file-video');
    document.getElementById('btn-add-video').addEventListener('click', () => fileVidInput.click());

    fileVidInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.controls = true;
            video.className = 'draggable-item video-element';
            video.style.left = '150px';
            video.style.top = '150px';
            
            slideArea.appendChild(video);
            makeDraggable(video);
            selectElement(video);
        }
        fileVidInput.value = '';
    });


    // ==========================================
    // 4. FORMATAGE DU TEXTE
    // ==========================================
    
    // Fonction helper pour execCommand
    function format(command, value = null) {
        document.execCommand(command, false, value);
        // On remet le focus sur l'élément éditable pour voir le changement
        if (selectedElement) selectedElement.focus(); 
    }

    document.getElementById('btn-bold').onclick = () => format('bold');
    document.getElementById('btn-italic').onclick = () => format('italic');
    document.getElementById('btn-underline').onclick = () => format('underline');
    
    // Surligner (background jaune par défaut)
    document.getElementById('btn-highlight').onclick = () => format('hiliteColor', 'yellow');

    // Couleur
    const colorPicker = document.getElementById('color-picker');
    colorPicker.addEventListener('input', (e) => {
        format('foreColor', e.target.value);
    });

    // ==========================================
    // 5. COPIER / COLLER STYLE
    // ==========================================
    document.getElementById('btn-copy-style').addEventListener('click', () => {
        if (!selectedElement) {
            alert("Sélectionnez d'abord un élément !");
            return;
        }

        // Si aucun style n'est sauvegardé, on copie le style actuel
        if (!savedStyle) {
            const computed = window.getComputedStyle(selectedElement);
            savedStyle = {
                color: computed.color,
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                fontStyle: computed.fontStyle,
                textDecoration: computed.textDecoration,
                backgroundColor: computed.backgroundColor
            };
            document.getElementById('btn-copy-style').innerText = "Coller Style";
            document.getElementById('btn-copy-style').style.background = "#d1e7dd";
        } 
        // Si un style est déjà en mémoire, on l'applique
        else {
            if (selectedElement) {
                // Application manuelle du style
                selectedElement.style.color = savedStyle.color;
                selectedElement.style.fontSize = savedStyle.fontSize;
                selectedElement.style.fontWeight = savedStyle.fontWeight;
                selectedElement.style.fontStyle = savedStyle.fontStyle;
                selectedElement.style.textDecoration = savedStyle.textDecoration;
                // Attention, le surlignage via execCommand est différent du style background CSS direct
                // Ici on applique du CSS brut sur le bloc
                selectedElement.style.backgroundColor = savedStyle.backgroundColor;
            }
            
            // Reset
            savedStyle = null;
            document.getElementById('btn-copy-style').innerText = "Copier Style";
            document.getElementById('btn-copy-style').style.background = "";
        }
    });

});