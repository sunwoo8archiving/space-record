async function loadWorks() {
  const res = await fetch("data/works.json");
  const works = await res.json();
  const gallery = document.getElementById("gallery");

  gallery.innerHTML = works
    .map(
      (w) => `
        <figure class="work">
          <img src="${w.image}" alt="${w.title}" loading="lazy">
          <figcaption class="meta">
            <div>${w.title}${w.year ? ", " + w.year : ""}</div>
            ${w.medium ? `<div>${w.medium}</div>` : ""}
          </figcaption>
        </figure>
      `
    )
    .join("");
}

loadWorks();
