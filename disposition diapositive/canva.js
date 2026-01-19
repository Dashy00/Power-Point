const viewport = document.getElementById("viewport");
const canvas = document.getElementById("canvas");

let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let offsetX = -2000;
let offsetY = -2000;

function updateCanvasPosition() {
    canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    console.log(`Offset: ${offsetX}, ${offsetY}`);
}

updateCanvasPosition();

viewport.addEventListener("mousedown", (e) => {
    console.log("mousedown - isPanning = true");
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
});

viewport.addEventListener("mousemove", (e) => {
    if (!isPanning) {
        return;
    }

    const deltaX = e.clientX - panStartX;
    const deltaY = e.clientY - panStartY;

    offsetX += deltaX;
    offsetY += deltaY;

    panStartX = e.clientX;
    panStartY = e.clientY;

    updateCanvasPosition();
});

viewport.addEventListener("mouseup", (e) => {
    console.log("mouseup - isPanning = false");
    isPanning = false;
});

viewport.addEventListener("mouseleave", (e) => {
    console.log("mouseleave - isPanning = false");
    isPanning = false;
});
