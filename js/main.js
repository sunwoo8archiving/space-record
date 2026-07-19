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

const siteSearch = document.getElementById("site-search");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

function pad(n) {
  return String(n).padStart(2, "0");
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
  document.querySelectorAll(".site-nav [data-view]").forEach((btn) => {
    const isActive = btn.dataset.view === name;
    btn.classList.toggle("active", isActive);
    btn.textContent = isActive ? "Close" : btn.dataset.label;
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

function openModal(student) {
  if (!student) return;
  const spaceship = student.spaceship;
  const spacesuit = student.spacesuit;
  modalImage1.src = spaceship ? spaceship.image : "images/placeholder.svg";
  modalImage1.alt = "우주선";
  modalImage2.src = spacesuit ? spacesuit.image : "images/placeholder.svg";
  modalImage2.alt = "우주복";
  modalText.textContent = student.text || "";
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
  let baseX = 0; // rebased every time a step is consumed
  let dragging = false;
  const dragThreshold = 60;
  const clickThreshold = 5;

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

  const onDown = (e) => {
    dragging = true;
    startX = e.clientX;
    baseX = e.clientX;
    dragStage.classList.add("dragging");
    dragStage.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;
    consumeSteps(e.clientX);
  };

  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    dragStage.classList.remove("dragging");

    consumeSteps(e.clientX);
    const totalDelta = e.clientX - startX;

    if (Math.abs(totalDelta) < clickThreshold) {
      openModal(students[currentIndex]);
    }
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

function findSnippet(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + query.length + 20);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function runSearch(query) {
  const q = query.trim();
  if (!q) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }

  const matches = students
    .map((s, i) => ({ index: i, snippet: findSnippet(s.text || "", q) }))
    .filter((m) => m.snippet !== null);

  searchResults.innerHTML = matches.length
    ? matches
        .map(
          (m) => `
            <button type="button" data-index="${m.index}">
              <span class="result-name">${escapeHtml(studentLabel(m.index))}</span>
              <span class="result-snippet">${escapeHtml(m.snippet)}</span>
            </button>
          `
        )
        .join("")
    : `<div class="result-empty">검색 결과가 없습니다</div>`;

  searchResults.querySelectorAll("button[data-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      showView("gallery");
      goTo(index);
      openModal(students[index]);
      searchResults.hidden = true;
      searchInput.value = "";
    });
  });

  searchResults.hidden = false;
}

function setupSearch() {
  searchInput.addEventListener("input", (e) => runSearch(e.target.value));
  searchInput.addEventListener("focus", (e) => {
    if (e.target.value.trim()) searchResults.hidden = false;
  });
  document.addEventListener("click", (e) => {
    if (!siteSearch.contains(e.target)) searchResults.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") searchResults.hidden = true;
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
  document.getElementById("info-close").addEventListener("click", () => showView("gallery"));
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
  setupSearch();
  showView("gallery");
}

init();
