let works = [];
let currentIndex = 0;

const galleryImage = document.getElementById("gallery-image");
const counter = document.getElementById("counter");
const dragStage = document.getElementById("drag-stage");
const indexGrid = document.getElementById("index-grid");
const views = {
  gallery: document.getElementById("view-gallery"),
  index: document.getElementById("view-index"),
  info: document.getElementById("view-info"),
};

const modalOverlay = document.getElementById("modal-overlay");
const modalClose = document.getElementById("modal-close");
const modalImage1 = document.getElementById("modal-image-1");
const modalImage2 = document.getElementById("modal-image-2");
const modalText = document.getElementById("modal-text");

function pad(n) {
  return String(n).padStart(2, "0");
}

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

function getRotate(index) {
  const work = works[index];
  return work && work.rotate ? work.rotate : 0;
}

function renderGallery() {
  const work = works[currentIndex];
  if (!work) return;
  galleryImage.src = work.image;
  galleryImage.alt = work.title;
  galleryImage.style.transform = `rotate(${getRotate(currentIndex)}deg)`;
  counter.textContent = `${pad(currentIndex + 1)} / ${pad(works.length)}`;
}

function goTo(index) {
  currentIndex = Math.max(0, Math.min(works.length - 1, index));
  renderGallery();
}

function renderIndexGrid() {
  indexGrid.innerHTML = works
    .map(
      (w, i) => `
        <button class="index-item" data-index="${i}" type="button">
          <img src="${w.image}" alt="${w.title}" loading="lazy">
          <span class="meta">${pad(i + 1)} — ${w.title}${w.year ? ", " + w.year : ""}</span>
        </button>
      `
    )
    .join("");

  indexGrid.querySelectorAll(".index-item").forEach((el) => {
    el.addEventListener("click", () => {
      goTo(Number(el.dataset.index));
      showView("gallery");
    });
  });
}

function openModal(index) {
  const work = works[index];
  if (!work) return;
  const [img1, img2] =
    work.detailImages && work.detailImages.length ? work.detailImages : [work.image, work.image];
  modalImage1.src = img1;
  modalImage1.alt = work.title;
  modalImage2.src = img2;
  modalImage2.alt = work.title;
  modalText.textContent = work.text || work.description || "";
  modalOverlay.hidden = false;
}

function closeModal() {
  modalOverlay.hidden = true;
}

function setupModal() {
  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
  });
}

function setupDrag() {
  let startX = 0;
  let dragging = false;
  const dragThreshold = 60;
  const clickThreshold = 5;

  const onDown = (e) => {
    dragging = true;
    startX = e.clientX;
    dragStage.classList.add("dragging");
    dragStage.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const rotate = getRotate(currentIndex);
    galleryImage.style.transform = `translateX(${delta * 0.3}px) rotate(${rotate}deg)`;
  };

  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    dragStage.classList.remove("dragging");

    const delta = e.clientX - startX;
    if (Math.abs(delta) < clickThreshold) {
      galleryImage.style.transform = `rotate(${getRotate(currentIndex)}deg)`;
      openModal(currentIndex);
      return;
    }
    if (delta <= -dragThreshold) goTo(currentIndex + 1);
    else if (delta >= dragThreshold) goTo(currentIndex - 1);
    else galleryImage.style.transform = `rotate(${getRotate(currentIndex)}deg)`;
  };

  dragStage.addEventListener("pointerdown", onDown);
  dragStage.addEventListener("pointermove", onMove);
  dragStage.addEventListener("pointerup", onUp);
  dragStage.addEventListener("pointercancel", onUp);

  document.addEventListener("keydown", (e) => {
    if (views.gallery.hidden) return;
    if (e.key === "ArrowRight") goTo(currentIndex + 1);
    if (e.key === "ArrowLeft") goTo(currentIndex - 1);
  });
}

function setupNav() {
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.addEventListener("click", () => showView(el.dataset.view));
  });
}

async function init() {
  const res = await fetch("data/works.json", { cache: "no-store" });
  works = await res.json();
  renderGallery();
  renderIndexGrid();
  setupDrag();
  setupNav();
  setupModal();
  showView("gallery");
}

init();
