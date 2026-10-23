// Draggable before/after slider for the static example images (the live one in the demo is handled by main.js).
for (const box of document.querySelectorAll(".static-compare")) {
  const clip = box.querySelector(".sc-before"), handle = box.querySelector(".sc-handle");
  const set = (percent) => {
    percent = Math.min(100, Math.max(0, percent));
    clip.style.clipPath = `inset(0 ${100 - percent}% 0 0)`; handle.style.left = percent + "%"; handle.setAttribute("aria-valuenow", Math.round(percent));
  };
  let dragging = false;
  const move = (event) => { const r = box.getBoundingClientRect(); set(((event.clientX - r.left) / r.width) * 100); };
  box.addEventListener("pointerdown", (e) => { dragging = true; box.setPointerCapture(e.pointerId); move(e); });
  box.addEventListener("pointermove", (e) => dragging && move(e));
  box.addEventListener("pointerup", () => (dragging = false));
  handle.addEventListener("keydown", (e) => {
    const now = Number(handle.getAttribute("aria-valuenow"));
    if (e.key === "ArrowLeft") set(now - 5); else if (e.key === "ArrowRight") set(now + 5);
  });
}
