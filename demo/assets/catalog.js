// Client-side search, filters and sorting for the static catalogue page.
(function () {
  const grid = document.getElementById("catalog-grid");
  if (!grid) return;
  const cards = Array.from(grid.children);
  const form = document.getElementById("catalog-filters");
  const count = document.getElementById("catalog-count");
  const empty = document.getElementById("catalog-empty");
  const heading = document.getElementById("catalog-heading");
  const fields = ["q", "category", "level", "price", "rating", "sort"];
  const control = (name) => form.elements.namedItem(name);

  // Start from the URL, so links such as ?category=design or ?q=sql work.
  const params = new URLSearchParams(window.location.search);
  for (const name of fields) {
    const value = params.get(name);
    if (value !== null && control(name)) control(name).value = value;
  }

  const sorters = {
    popular: (a, b) => b.dataset.students - a.dataset.students || b.dataset.rating - a.dataset.rating,
    rating: (a, b) => b.dataset.rating - a.dataset.rating || b.dataset.reviews - a.dataset.reviews,
    newest: (a, b) => b.dataset.published - a.dataset.published,
    "price-asc": (a, b) => a.dataset.price - b.dataset.price,
    "price-desc": (a, b) => b.dataset.price - a.dataset.price,
  };

  function apply() {
    const q = control("q").value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const category = control("category").value;
    const level = control("level").value;
    const price = control("price").value;
    const rating = Number(control("rating").value || 0);
    const sort = control("sort").value;

    let shown = 0;
    for (const card of cards) {
      const d = card.dataset;
      const ok =
        terms.every((t) => d.text.includes(t)) &&
        (!category || d.category === category) &&
        (!level || d.level === level) &&
        (!price || (price === "free" ? d.price === "0" : d.price !== "0")) &&
        (!rating || Number(d.rating) >= rating);
      card.hidden = !ok;
      if (ok) shown++;
    }
    cards.slice().sort(sorters[sort] || sorters.popular).forEach((card) => grid.appendChild(card));

    count.textContent = shown === 1 ? "1 course" : shown + " courses";
    empty.hidden = shown !== 0;
    grid.hidden = shown === 0;
    const selected = control("category").selectedOptions[0];
    heading.textContent = q ? "Results for “" + control("q").value.trim() + "”" : category ? selected.textContent + " courses" : "All courses";

    const next = new URLSearchParams();
    for (const name of fields) {
      const value = control(name).value.trim();
      if (value && !(name === "sort" && value === "popular")) next.set(name, value);
    }
    const qs = next.toString();
    history.replaceState(null, "", qs ? "?" + qs : window.location.pathname);
  }

  form.addEventListener("input", apply);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
  });
  document.getElementById("catalog-clear").addEventListener("click", () => {
    form.reset();
    apply();
  });
  apply();
})();
