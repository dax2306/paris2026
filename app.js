
const categories = {
  all: { label: "Tutto", icon: "⌂" },
  mostre: { label: "Mostre", icon: "🖼️" },
  food: { label: "Food", icon: "🍽️" },
  vintage: { label: "Vintage", icon: "🪑" },
  arturo: { label: "Arturo", icon: "🧗" }
};

let allPlaces = [];
let activeCategory = "all";
let map;
let markerLayer;
let userMarker;

const listNode = document.getElementById("places-list");
const filtersNode = document.getElementById("filters");
const searchNode = document.getElementById("search-input");
const statusNode = document.getElementById("status");
const mapStatusNode = document.getElementById("map-status");
const titleNode = document.getElementById("results-title");
const kickerNode = document.getElementById("results-kicker");
const noteNode = document.getElementById("results-note");

async function loadData() {
  const entries = await Promise.all(
    ["mostre", "food", "vintage", "arturo"].map(async category => {
      const response = await fetch(`data/${category}.json`);
      if (!response.ok) throw new Error(`Impossibile caricare ${category}`);
      const data = await response.json();
      return data.map(item => ({ ...item, category }));
    })
  );

  allPlaces = entries.flat();
  setupMap();
  renderFilters();
  render();
}

function setupMap() {
  map = L.map("map", { scrollWheelZoom: false }).setView([48.8566, 2.3522], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function renderFilters() {
  filtersNode.innerHTML = "";
  Object.entries(categories).forEach(([key, item]) => {
    const button = document.createElement("button");
    button.className = `filter-button ${activeCategory === key ? "active" : ""}`;
    button.type = "button";
    button.textContent = `${item.icon} ${item.label}`;
    button.addEventListener("click", () => {
      activeCategory = key;
      renderFilters();
      render();
    });
    filtersNode.appendChild(button);
  });
}

function searchableText(place) {
  return [
    place.name,
    place.subtitle,
    place.description,
    ...(place.tags || [])
  ].join(" ").toLowerCase();
}

function currentPlaces() {
  const query = searchNode.value.trim().toLowerCase();
  return allPlaces.filter(place => {
    const categoryOk = activeCategory === "all" || place.category === activeCategory;
    const searchOk = !query || searchableText(place).includes(query);
    return categoryOk && searchOk;
  });
}

function render() {
  const places = currentPlaces();
  listNode.innerHTML = "";

  const categoryName = categories[activeCategory].label;
  kickerNode.textContent = activeCategory === "all" ? "Tutta la guida" : categoryName;
  titleNode.textContent = searchNode.value.trim()
    ? `Risultati per “${searchNode.value.trim()}”`
    : activeCategory === "all"
      ? "Luoghi selezionati"
      : categoryName;
  noteNode.textContent = `${places.length} luoghi disponibili`;

  places.forEach(place => listNode.appendChild(createPlace(place)));
  updateMap(places);
}

function createPlace(place) {
  const details = document.createElement("details");
  details.className = "place";

  const summary = document.createElement("summary");
  summary.innerHTML = `
    <span class="place-summary">
      <strong>
        ${place.name}
        ${place.tested ? '<span class="tested">✓ Testato da noi</span>' : ""}
      </strong>
      <small>${place.subtitle}${place.tags?.length ? " · " + place.tags.slice(0,2).join(" · ") : ""}</small>
    </span>
    <span class="chevron">⌄</span>
  `;

  const body = document.createElement("div");
  body.className = "place-body";

  const tags = (place.tags || []).map(tag => `<span class="tag">${tag}</span>`).join("");
  const links = (place.links || []).map(link => `
    <a class="link-button ${link.kind === "site" ? "secondary" : ""}"
      href="${link.url}" target="_blank" rel="noopener">
      ${link.kind === "maps" ? "Google Maps" : link.label || "Sito"}
    </a>
  `).join("");

  body.innerHTML = `
    <p>${place.description || ""}</p>
    <div class="tags">${tags}</div>
    <div class="link-row">${links}</div>
  `;

  details.append(summary, body);
  return details;
}

function pinIcon(number) {
  return L.divIcon({
    className: "",
    html: `<span class="paris-pin">${number}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16]
  });
}

function updateMap(places) {
  markerLayer.clearLayers();
  const bounds = [];
  let number = 0;

  places.forEach(place => {
    if (typeof place.lat !== "number" || typeof place.lon !== "number") return;
    number += 1;
    const marker = L.marker([place.lat, place.lon], { icon: pinIcon(number) });
    const maps = (place.links || []).find(link => link.kind === "maps")?.url || "#";
    marker.bindPopup(`
      <strong>${place.name}</strong><br>
      <small>${place.subtitle}</small><br><br>
      <a href="${maps}" target="_blank" rel="noopener">Apri in Google Maps</a>
    `);
    markerLayer.addLayer(marker);
    bounds.push([place.lat, place.lon]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    mapStatusNode.textContent = `${bounds.length} luoghi visualizzati`;
  } else {
    map.setView([48.8566, 2.3522], 12);
    mapStatusNode.textContent = "Nessun punto disponibile";
  }

  setTimeout(() => map.invalidateSize(), 100);
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = value => value * Math.PI / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showNearby(position) {
  const { latitude, longitude } = position.coords;

  allPlaces = allPlaces.map(place => ({
    ...place,
    distance: typeof place.lat === "number"
      ? distanceKm(latitude, longitude, place.lat, place.lon)
      : Infinity
  }));

  allPlaces.sort((a, b) => a.distance - b.distance);
  activeCategory = "all";
  searchNode.value = "";
  renderFilters();

  const nearest = allPlaces.filter(p => Number.isFinite(p.distance)).slice(0, 15);
  listNode.innerHTML = "";
  nearest.forEach(place => {
    const node = createPlace(place);
    const small = node.querySelector("small");
    small.textContent += ` · ${place.distance < 1
      ? Math.round(place.distance * 1000) + " m"
      : place.distance.toFixed(1) + " km"}`;
    listNode.appendChild(node);
  });

  titleNode.textContent = "Vicino a me";
  kickerNode.textContent = "Posizione attuale";
  noteNode.textContent = "I 15 luoghi più vicini";
  updateMap(nearest);

  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.circleMarker([latitude, longitude], {
    radius: 8,
    color: "#111",
    fillColor: "#fff",
    fillOpacity: 1,
    weight: 3
  }).addTo(map).bindPopup("Sei qui");

  statusNode.textContent = "Posizione usata una sola volta. Non è attivo alcun tracciamento continuo.";
  document.getElementById("results-section").scrollIntoView({ behavior: "smooth" });
}

function nearbyError(error) {
  const messages = {
    1: "Permesso posizione non concesso.",
    2: "Posizione non disponibile.",
    3: "Richiesta della posizione scaduta."
  };
  statusNode.textContent = messages[error.code] || "Non riesco a leggere la posizione.";
}

document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.section;
    searchNode.value = "";
    renderFilters();
    render();
    document.getElementById("results-section").scrollIntoView({ behavior: "smooth" });
  });
});

searchNode.addEventListener("input", render);

document.getElementById("reset-button").addEventListener("click", () => {
  activeCategory = "all";
  searchNode.value = "";
  renderFilters();
  render();
});

document.getElementById("nearby-button").addEventListener("click", () => {
  if (!navigator.geolocation) {
    statusNode.textContent = "Questo browser non supporta la geolocalizzazione.";
    return;
  }

  statusNode.textContent = "Ricerca della posizione in corso…";
  navigator.geolocation.getCurrentPosition(showNearby, nearbyError, {
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 120000
  });
});

loadData().catch(error => {
  console.error(error);
  statusNode.textContent = "Errore nel caricamento dei dati. Controlla che la cartella data sia stata caricata.";
});
