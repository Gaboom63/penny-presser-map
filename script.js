const map = L.map('map').setView([39.5, -98.35], 4); // Center USA

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Made By Henry Stiehr :)'
}).addTo(map);

// Marker icons
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const completedIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const hoverIcon = (baseIconUrl) => L.icon({
  iconUrl: baseIconUrl,
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [30, 48],
  iconAnchor: [15, 48],
  popupAnchor: [1, -38],
  shadowSize: [41, 41]
});

// UI container
const uiContainer = document.createElement('div');
uiContainer.style.position = 'absolute';
uiContainer.style.top = '10px';
uiContainer.style.left = '10px';
uiContainer.style.backgroundColor = 'white';
uiContainer.style.padding = '8px 12px';
uiContainer.style.borderRadius = '8px';
uiContainer.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
uiContainer.style.zIndex = '1000';
uiContainer.style.minWidth = '220px';
uiContainer.innerHTML = `
  <input id="searchInput" type="search" placeholder="Search locations..." style="width: 100%; padding: 4px 6px; margin-bottom: 8px; box-sizing: border-box;">
  <select id="stateFilter" style="width: 100%; padding: 4px 6px; margin-bottom: 8px;">
    <option value="">Filter by state (All)</option>
  </select>
  <div id="progressText">Loading...</div>
  <button id="resetBtn" style="margin-top: 5px; width: 100%;">Reset All</button>
`;
document.body.appendChild(uiContainer);

const progressTextEl = document.getElementById('progressText');
const searchInput = document.getElementById('searchInput');
const stateFilter = document.getElementById('stateFilter');

let markers = [];

const updateProgress = () => {
  let completed = markers.filter(m => localStorage.getItem(m.key) === 'true').length;
  progressTextEl.textContent = `Completed ${completed} of ${markers.length}`;
};

// All 50 state file names
const stateFiles = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
  "Montana", "Nebraska", "Nevada", "New_Hampshire", "New_Jersey", "New_Mexico",
  "New_York", "North_Carolina", "North_Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode_Island", "South_Carolina", "South_Dakota", "Tennessee",
  "Texas", "Utah", "Vermont", "Virginia", "Washington", "West_Virginia",
  "Wisconsin", "Wyoming"
];

// Load all JSON files
Promise.all(
  stateFiles.map(state =>
    fetch(`data/USA_States/${state}.json`)
      .then(res => res.json())
      .catch(err => {
        console.error(`Error loading ${state}.json`, err);
        return [];
      })
  )
).then(results => {
  const locations = results.flat();

  // Populate state filter dropdown
  const uniqueStates = [...new Set(locations.map(l => l.state))].sort();
  uniqueStates.forEach(state => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    stateFilter.appendChild(option);
  });

locations.forEach(loc => {
  // Skip invalid locations
  if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
    console.warn('Skipping invalid location (missing lat/lng):', loc);
    return;
  }

  const key = `penny_complete_${loc.lat}_${loc.lng}`;
  const isComplete = localStorage.getItem(key) === 'true';

  const marker = L.marker([loc.lat, loc.lng], {
    icon: isComplete ? completedIcon : defaultIcon
  }).addTo(map);

    const imageHTML = loc.photo ? `<img src="${loc.photo}" alt="${loc.name}" width="200"><br>` : '';
    const checkboxHTML = `
      <label>
        <input type="checkbox" ${isComplete ? 'checked' : ''} id="check_${key}">
        Completed
      </label>
    `;
    const popupHTML = `
      <strong>${loc.name}</strong><br>
      ${imageHTML}
      ${loc.description}<br>
      ${checkboxHTML}
    `;

    marker.bindPopup(popupHTML);

    marker.on('click', () => {
      map.setView([loc.lat, loc.lng], 14);
    });

    marker.on('popupopen', () => {
      const checkbox = document.getElementById(`check_${key}`);
      checkbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        localStorage.setItem(key, checked);
        marker.setIcon(checked ? completedIcon : defaultIcon);
        updateProgress();
      });
    });

    marker.on('mouseover', () => {
      const iconUrl = isComplete
        ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png'
        : 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
      marker.setIcon(hoverIcon(iconUrl));
    });

    marker.on('mouseout', () => {
      const isChecked = localStorage.getItem(key) === 'true';
      marker.setIcon(isChecked ? completedIcon : defaultIcon);
    });

    markers.push({ marker, loc, key });
  });

  updateProgress();

  // Reset all completions
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm("Are you sure you want to reset all completed locations?")) {
      markers.forEach(({ key, marker }) => {
        localStorage.removeItem(key);
        marker.setIcon(defaultIcon);
        const cb = document.getElementById(`check_${key}`);
        if (cb) cb.checked = false;
      });
      updateProgress();
    }
  });

  // Search & state filter
  const applyFilters = () => {
    const query = searchInput.value.toLowerCase();
    const selectedState = stateFilter.value;

    markers.forEach(({ marker, loc }) => {
      const nameMatch = loc.name.toLowerCase().includes(query);
      const tagsMatch = (loc.tags || []).some(tag => tag.toLowerCase().includes(query));
      const stateMatch = !selectedState || loc.state === selectedState;
      const show = (query === '' || nameMatch || tagsMatch) && stateMatch;

      if (show) {
        if (!map.hasLayer(marker)) map.addLayer(marker);
      } else {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
    });
  };

  searchInput.addEventListener('input', applyFilters);
  stateFilter.addEventListener('change', applyFilters);
});

// Show user location marker without zoom
if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(position => {
    const { latitude, longitude } = position.coords;
    const userIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    L.marker([latitude, longitude], { icon: userIcon })
      .addTo(map)
      .bindPopup("You are here!")
      .openPopup();
  }, error => {
    console.warn("Geolocation failed:", error.message);
  });
} else {
  console.warn("Geolocation not supported in this browser.");
}
