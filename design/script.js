document.addEventListener('DOMContentLoaded', () => {
    
    const dots = document.querySelectorAll('.dot');
    const boxes = document.querySelectorAll('.context-box');
    const container = document.getElementById('slide-area');

    // --- 1. FONCTION DE SÉLECTION COMMUNE ---
    function selectItem(id) {
        // Désactiver tout le monde
        dots.forEach(d => d.classList.remove('active'));
        boxes.forEach(b => b.classList.remove('active'));

        // Activer le rond correspondant
        const targetDot = document.getElementById(`dot-${id}`);
        if (targetDot) targetDot.classList.add('active');

        // Activer la boîte correspondante
        const targetBox = document.getElementById(`box-${id}`);
        if (targetBox) targetBox.classList.add('active');
    }

    // --- 2. GESTION DU CLIC SUR LES BOÎTES (GAUCHE) ---
    boxes.forEach(box => {
        box.addEventListener('click', () => {
            const id = box.getAttribute('data-target');
            selectItem(id);
        });
    });

    // --- 3. GESTION DU DRAG & DROP DES RONDS ---
    let activeDot = null;
    let offsetX = 0;
    let offsetY = 0;

    dots.forEach(dot => {
        dot.addEventListener('mousedown', (e) => {
            // A. Sélectionner le rond au clic
            const id = dot.getAttribute('data-id');
            selectItem(id);

            // B. Préparer le déplacement
            activeDot = dot;
            
            // Calculer la position de la souris par rapport au coin haut-gauche du rond
            // Cela évite que le rond "saute" sous la souris
            const rect = dot.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            // Curseur en mode "grabbing"
            dot.style.cursor = 'grabbing';
        });
    });

    // Écouteur sur tout le document pour suivre la souris même si on sort un peu vite du rond
    document.addEventListener('mousemove', (e) => {
        if (!activeDot) return;

        // Empêcher la sélection de texte par défaut du navigateur
        e.preventDefault();

        // Récupérer les infos du conteneur (le cadre violet)
        const containerRect = container.getBoundingClientRect();

        // Calculer la nouvelle position relative au conteneur
        let newX = e.clientX - containerRect.left - offsetX;
        let newY = e.clientY - containerRect.top - offsetY;

        // --- CONTRAT DE LIMITES (Pour ne pas sortir du cadre) ---
        // Largeur/Hauteur dispo = taille conteneur - taille rond
        const maxX = containerRect.width - activeDot.offsetWidth;
        const maxY = containerRect.height - activeDot.offsetHeight;

        // On borne X et Y entre 0 et le max
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        // Appliquer la position
        activeDot.style.left = `${newX}px`;
        activeDot.style.top = `${newY}px`;
    });

    // Arrêter le déplacement quand on relâche la souris n'importe où
    document.addEventListener('mouseup', () => {
        if (activeDot) {
            activeDot.style.cursor = 'grab'; // Remettre le curseur normal
            activeDot = null;
        }
    });
});