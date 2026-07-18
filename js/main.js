let students = [];
let currentIndex = 0;
let currentType = "spaceship";

const galleryImage = document.getElementById("gallery-image");
const viewerStudent = document.getElementById("viewer-student");
const viewerTabs = document.getElementById("viewer-tabs");
const viewerMarqueeTrack = document.getElementById("viewer-marquee-track");
const counter = document.getElementById("counter");
const dragStage = document.getElementById("drag-stage");
const views = {
  gallery: document.getElementById("view-gallery"),
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
  document.querySelectorAll(".site-nav [data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
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
  let startX = 0; // fixed at pointerdown, used only to detect a "click" (no real drag)
  let baseX = 0; // rebased every time a step is consumed, used for the visual offset
  let dragging = false;
  const dragThreshold = 60;
  const clickThreshold = 5;
  const followFactor = 0.3;
  const resistFactor = 0.3; // extra damping applied at the first/last student boundary

  // Crosses as many thresholds as the current pointer position allows (handles
  // fast flicks that jump past more than one student in a single move event),
  // rebasing baseX each time so the remaining offset is the leftover drag past
  // the last step. Stops at the first/last student instead of wrapping.
  const consumeSteps = (clientX) => {
    let delta = clientX - baseX;
    while (true) {
      const blockedForward = currentIndex === students.length - 1 && delta < 0;
      const blockedBackward = currentIndex === 0 && delta > 0;
      if (blockedForward || blockedBackward) break;

      if (delta <= -dragThreshold) {
        goTo(currentIndex + 1);
        baseX -= dragThreshold;
      } else if (delta >= dragThreshold) {
        goTo(currentIndex - 1);
        baseX += dragThreshold;
      } else {
        break;
      }
      delta = clientX - baseX;
    }
    return delta;
  };

  const applyOffset = (delta) => {
    const atBoundary =
      (currentIndex === students.length - 1 && delta < 0) || (currentIndex === 0 && delta > 0);
    const damping = atBoundary ? followFactor * resistFactor : followFactor;
    const work = getWork(currentIndex, currentType);
    galleryImage.style.transform = `translateX(${delta * damping}px) rotate(${getRotate(work)}deg)`;
  };

  const onDown = (e) => {
    dragging = true;
    startX = e.clientX;
    baseX = e.clientX;
    dragStage.classList.add("dragging");
    dragStage.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;
    applyOffset(consumeSteps(e.clientX));
  };

  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    dragStage.classList.remove("dragging");

    consumeSteps(e.clientX);
    const totalDelta = e.clientX - startX;
    const work = getWork(currentIndex, currentType);

    if (Math.abs(totalDelta) < clickThreshold) {
      galleryImage.style.transform = `rotate(${getRotate(work)}deg)`;
      openModal(work);
      return;
    }
    galleryImage.style.transform = `rotate(${getRotate(work)}deg)`;
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
    el.addEventListener("click", () => {
      const target = el.dataset.view;
      // clicking the nav button for the view already showing returns to gallery
      showView(!views[target].hidden ? "gallery" : target);
    });
  });
}

async function init() {
  const res = await fetch("data/works.json", { cache: "no-store" });
  students = await res.json();
  renderMarquee();
  renderGallery();
  setupDrag();
  setupNav();
  setupModal();
  setupViewerTabs();
  showView("gallery");
}

init();
