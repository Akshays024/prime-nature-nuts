// script.js – Public website (READ-ONLY)

// =====================
// STATE
// =====================
let allProducts = [];
let activeCategory = 'all';

// =====================
// FORMAT INR
// =====================
const formatINR = amount =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);

// =====================
// SUPABASE CLIENT
// =====================
const sb = window.supabaseClient;

// =====================
// DOM ELEMENTS
// =====================
let productsContainer;
let productModal;
let modalCloseBtn;

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  // Safe year update
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  productsContainer = document.getElementById('products-container');
  productModal = document.getElementById('product-modal');
  modalCloseBtn = document.getElementById('modal-close');

  if (productsContainer) {
    loadProducts();
    setupRealtimeUpdates();
  }

  setupCategoryFilters();
  setupMobileMenu();
  setupSmoothScrolling();

  if (modalCloseBtn && productModal) {
    modalCloseBtn.addEventListener('click', () => {
      productModal.style.display = 'none';
    });

    productModal.addEventListener('click', e => {
      if (e.target === productModal) {
        productModal.style.display = 'none';
      }
    });
  }
});

// =====================
// PRODUCTS
// =====================
async function loadProducts() {
  try {
    productsContainer.innerHTML = `
      <div class="loading-products">
        <div class="loading-spinner"></div>
        <p>Loading our premium products...</p>
      </div>
    `;

    const { data, error } = await sb
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allProducts = data;
    applyCategoryFilter();

  } catch (err) {
    console.error(err);
    productsContainer.innerHTML = `
      <div class="error-loading">
        <p>Unable to load products.</p>
        <button onclick="loadProducts()" class="btn btn-primary">Retry</button>
      </div>
    `;
  }
}

// =====================
// CATEGORY FILTERING
// =====================
function setupCategoryFilters() {
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.category-btn')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      applyCategoryFilter();
    });
  });
}

function applyCategoryFilter() {
  if (activeCategory === 'all') {
    displayProducts(allProducts);
  } else {
    const filtered = allProducts.filter(
      p => p.category === activeCategory
    );
    displayProducts(filtered);
  }
}

// =====================
// RENDER PRODUCTS
// =====================
function displayProducts(products) {
  if (!products || products.length === 0) {
    productsContainer.innerHTML = `<p>No products available.</p>`;
    return;
  }

  productsContainer.innerHTML = products.map(p => {
    const price = p.price ? formatINR(p.price) : 'Price on request';
    const img =
      p.image_url ||
      'https://media.istockphoto.com/id/1127742967/photo/assorted-nuts-on-white-dry-fruits-mix-nuts-almond-cashew-raisins.jpg';

   const imageLink = p.image_url
  ? `\n\nProduct Image:\n${p.image_url}`
  : '';

const msg = encodeURIComponent(
  `Hello Prime Nature 👋\n\n` +
  `Product: ${p.name}\n` +
  `Category: ${p.category || 'N/A'}\n` +
  `Price: ${p.price ? formatINR(p.price) : 'Price on request'}` +
  imageLink
);


    return `
      <div class="product-card">
        <div class="product-image">
          <img src="${img}" alt="${p.name}">
        </div>
        <div class="product-details">
          <h3 class="product-name">${p.name}</h3>
          <p class="product-description">${p.description || ''}</p>
          <div class="product-price">${price}</div>
          <div class="product-actions">
            <button class="btn btn-secondary view-details"
              data-product='${JSON.stringify(p)}'>View</button>
            <a class="btn btn-whatsapp" target="_blank"
              href="https://wa.me/919778757265?text=${msg}">
              Order
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.view-details').forEach(btn => {
    btn.addEventListener('click', () => {
      showProductModal(JSON.parse(btn.dataset.product));
    });
  });
}

// =====================
// MODAL
// =====================
function showProductModal(product) {
  if (!productModal) return;

  document.getElementById('modal-product-image').src = product.image_url;
  document.getElementById('modal-product-name').textContent = product.name;
  document.getElementById('modal-product-description').textContent =
    product.description || '';

  const priceBox = document.getElementById('modal-price-container');
  const priceText = document.getElementById('modal-product-price');

  if (product.price) {
    priceBox.style.display = 'block';
    priceText.textContent = formatINR(product.price);
  } else {
    priceBox.style.display = 'none';
  }

  productModal.style.display = 'flex';
}

// =====================
// UI HELPERS
// =====================
function setupMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn');
  const menu = document.querySelector('.mobile-menu');
  const close = document.querySelector('.mobile-menu-close');

  if (!btn || !menu || !close) return;

  btn.addEventListener('click', () => (menu.style.display = 'flex'));
  close.addEventListener('click', () => (menu.style.display = 'none'));
}

function setupSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// =====================
// REALTIME UPDATES
// =====================
let productsChannel = null;

function setupRealtimeUpdates() {
  if (productsChannel) return;

  productsChannel = sb
    .channel('public-products-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products'
      },
      () => {
        loadProducts();
      }
    )
    .subscribe();
}
