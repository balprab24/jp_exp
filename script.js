// Load inventory data and render all sections
document.addEventListener('DOMContentLoaded', () => {
  fetch('data/inventory.json')
    .then(res => res.json())
    .then(data => {
      renderHotItems(data.hotItems);
      renderNewListings(data.newListings);
      renderDeals(data.deals);
      renderInventory(data.fullInventory);
      renderStoreInfo(data.storeInfo);
      setupSearch(data.fullInventory);
      setupFilters(data.fullInventory);
    });

  setupMobileNav();
});

// -- Hot Items --
function renderHotItems(items) {
  const grid = document.getElementById('hot-items-grid');
  grid.innerHTML = items.map(item => `
    <div class="product-card">
      <img src="${item.image}" alt="${item.name}" class="product-card-image" loading="lazy" />
      ${item.tag ? `<span class="product-card-tag">${item.tag}</span>` : ''}
      <div class="product-card-body">
        <p class="product-card-category">${item.category}</p>
        <h3 class="product-card-name">${item.name}</h3>
        <p class="product-card-price">$${item.price.toFixed(2)}</p>
      </div>
    </div>
  `).join('');
}

// -- New Listings --
function renderNewListings(items) {
  const grid = document.getElementById('new-listings-grid');
  grid.innerHTML = items.map(item => `
    <div class="product-card">
      <img src="${item.image}" alt="${item.name}" class="product-card-image" loading="lazy" />
      <div class="product-card-body">
        <p class="product-card-category">${item.category}</p>
        <h3 class="product-card-name">${item.name}</h3>
        <p class="product-card-price">$${item.price.toFixed(2)}</p>
        <p class="product-card-date">Added ${formatDate(item.dateAdded)}</p>
      </div>
    </div>
  `).join('');
}

// -- Deals --
function renderDeals(items) {
  const grid = document.getElementById('deals-grid');
  grid.innerHTML = items.map(item => `
    <div class="product-card">
      <img src="${item.image}" alt="${item.name}" class="product-card-image" loading="lazy" />
      <span class="product-card-discount">${item.discount}</span>
      <div class="product-card-body">
        <p class="product-card-category">${item.category}</p>
        <h3 class="product-card-name">${item.name}</h3>
        <p>
          <span class="product-card-original-price">$${item.originalPrice.toFixed(2)}</span>
          <span class="product-card-sale-price">$${item.salePrice.toFixed(2)}</span>
        </p>
      </div>
    </div>
  `).join('');
}

// -- Full Inventory Table --
function renderInventory(items) {
  const tbody = document.getElementById('inventory-body');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="inventory-empty">No products found.</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(item => `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td class="category-cell">${item.category}</td>
      <td>${item.size}</td>
      <td class="price-cell">$${item.price.toFixed(2)}</td>
    </tr>
  `).join('');
}

// -- Store Info --
function renderStoreInfo(info) {
  const container = document.getElementById('store-info');
  const hoursHtml = Object.entries(info.hours).map(([day, time]) => `
    <div class="findus-hour-row">
      <span class="day">${day}</span>
      <span class="time">${time}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <h3>${info.name}</h3>
    <div class="findus-item">
      <p class="findus-item-label">Address</p>
      <p class="findus-item-value">${info.address}</p>
    </div>
    <div class="findus-item">
      <p class="findus-item-label">Phone</p>
      <p class="findus-item-value">${info.phone}</p>
    </div>
    <div class="findus-item">
      <p class="findus-item-label">Hours</p>
      <div class="findus-hours">${hoursHtml}</div>
    </div>
  `;

  document.getElementById('store-map').src = info.mapEmbedUrl;
}

// -- Search --
function setupSearch(allItems) {
  const input = document.getElementById('search-input');
  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const filtered = allItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
      const matchesFilter = activeFilter === 'all' || item.category === activeFilter;
      return matchesSearch && matchesFilter;
    });
    renderInventory(filtered);
  });
}

// -- Category Filters --
function setupFilters(allItems) {
  const container = document.getElementById('filter-buttons');
  const categories = [...new Set(allItems.map(i => i.category))];

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = cat;
    btn.textContent = cat;
    container.appendChild(btn);
  });

  container.addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-btn')) return;

    container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const filter = e.target.dataset.filter;
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const filtered = allItems.filter(item => {
      const matchesFilter = filter === 'all' || item.category === filter;
      const matchesSearch = item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
    renderInventory(filtered);
  });
}

// -- Mobile Nav Toggle --
function setupMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });

  // Close menu when a link is clicked
  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
    });
  });
}

// -- Helpers --
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
