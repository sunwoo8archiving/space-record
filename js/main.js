const TYPE_LABELS = { spaceship: "우주선", spacesuit: "우주복" };

let students = [];
let currentIndex = 0;
let currentType = "spaceship";

const galleryImage = document.getElementById("gallery-image");
const viewerStudent = document.getElementById("viewer-student");
const viewerTabs = document.getElementById("viewer-tabs");
const viewerMarqueeTrack = document.getElementById("viewer-marquee-track");
const counter = document.getElementById("counter");
const dragStage = document.getElementById("drag-stage");
const indexGrid = document.getElementById("index-grid");
const indexTabs = document.getElementById("index-tabs");
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
  if (name === "index") renderIndexGrid();
  if (name === "gallery") renderGallery();
}

function getWork(index, type) {
  const student = students[index];
  return student ? student[type] : null;
}

function getRotate(work) {
  return work && work.rotate ? work.rotate : 0;
}

function studentLabel(index) {
  const student = students[index];
  const name = student ? student.student : "";
  return name && name !== "학생 이름 입력" ? name : pad(index + 1);
}

function renderGallery() {
  const student = students[currentIndex];
  const work = getWork(currentIndex, currentType);

  galleryImage.src = work ? work.image : "images/placeholder.svg";
  galleryImage.alt = work ? work.title : "";
  galleryImage.style.transform = `rotate(${getRotate(work)}deg)`;
  viewerStudent.textContent = student ? student.student : "";
  counter.textContent = `${pad(currentIndex + 1)} / ${pad(students.length)}`;

  viewerTabs.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === currentType);
  });

  viewerMarqueeTrack.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.index) === currentIndex);
  });
}

function renderMarquee() {
  const items = students
    .map((_, i) => `<button data-index="${i}" type="button">${studentLabel(i)}</button>`)
    .join("");
  // duplicated so the -50% translateX loop is seamless
  viewerMarqueeTrack.innerHTML = items + items;

  viewerMarqueeTrack.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => goTo(Number(btn.dataset.index)));
  });
}

function goTo(index) {
  currentIndex = Math.max(0, Math.min(students.length - 1, index));
  renderGallery();
}

function setType(type) {
  currentType = type;
  renderGallery();
}

function openViewerAt(type, index) {
  currentType = type;
  goTo(index);
}

function renderIndexGrid() {
  indexGrid.innerHTML = students
    .map((s, i) => {
      const work = s[currentType];
      const submitted = work && work.submitted;
      return `
        <button class="index-item${submitted ? "" : " unsubmitted"}" data-index="${i}" type="button">
          <img src="${work ? work.image : "images/placeholder.svg"}" alt="${s.student}" loading="lazy">
          <span class="meta">${pad(i + 1)} — ${s.student}${submitted ? "" : " (미제출)"}</span>
        </button>
      `;
    })
    .join("");

  indexGrid.querySelectorAll(".index-item").forEach((el) => {
    el.addEventListener("click", () => {
      openViewerAt(currentType, Number(el.dataset.index));
      showView("gallery");
    });
  });

  indexTabs.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === currentType);
  });
}

function setupIndexTabs() {
  indexTabs.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentType = btn.dataset.type;
      renderIndexGrid();
    });
  });
}

function setupViewerTabs() {
  viewerTabs.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setType(btn.dataset.type));
  });
}

function openModal(work) {
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
    const work = getWork(currentIndex, currentType);
    const rotate = getRotate(work);
    galleryImage.style.transform = `translateX(${delta * 0.3}px) rotate(${rotate}deg)`;
  };

  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    dragStage.classList.remove("dragging");

    const delta = e.clientX - startX;
    const work = getWork(currentIndex, currentType);

    if (Math.abs(delta) < clickThreshold) {
      galleryImage.style.transform = `rotate(${getRotate(work)}deg)`;
      openModal(work);
      return;
    }
    if (delta <= -dragThreshold) goTo(currentIndex + 1);
    else if (delta >= dragThreshold) goTo(currentIndex - 1);
    else galleryImage.style.transform = `rotate(${getRotate(work)}deg)`;
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
  students = await res.json();
  renderMarquee();
  renderGallery();
  renderIndexGrid();
  setupDrag();
  setupNav();
  setupModal();
  setupIndexTabs();
  setupViewerTabs();
  showView("gallery");
}

init();
