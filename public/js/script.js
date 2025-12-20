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
// WHATSAPP LINK (MOBILE + DESKTOP SAFE)
// =====================
function getWhatsAppLink(phone, message) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isMobile
    ? `https://wa.me/${phone}?text=${message}`
    : `https://web.whatsapp.com/send?phone=${phone}&text=${message}`;
}

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  productsContainer = document.getElementById('products-container');
  productModal = document.getElementById('product-modal');
  modalCloseBtn = document.getElementById('modal-close');

  if (productsContainer) {
    loadProducts();
    setupRealtimeUpdates();
  }

  setupCategoryFilters();

  if (modalCloseBtn && productModal) {
    modalCloseBtn.onclick = () => (productModal.style.display = 'none');
    productModal.onclick = e => {
      if (e.target === productModal) productModal.style.display = 'none';
    };
  }
});

// =====================
// LOAD PRODUCTS
// =====================
async function loadProducts() {
  productsContainer.innerHTML = `
    <div class="loading-products">
      <div class="loading-spinner"></div>
      <p>Loading products...</p>
    </div>
  `;

  const { data, error } = await sb
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    productsContainer.innerHTML = `<p>Error loading products</p>`;
    return;
  }

  allProducts = data;
  applyCategoryFilter();
}

// =====================
// CATEGORY FILTERING
// =====================
function setupCategoryFilters() {
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.onclick = () => {
      document
        .querySelectorAll('.category-btn')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      applyCategoryFilter();
    };
  });
}

function applyCategoryFilter() {
  const list =
    activeCategory === 'all'
      ? allProducts
      : allProducts.filter(p => p.category === activeCategory);

  displayProducts(list);
}

// =====================
// RENDER PRODUCTS
// =====================
function displayProducts(products) {
  if (!products.length) {
    productsContainer.innerHTML = `<p>No products found</p>`;
    return;
  }

  productsContainer.innerHTML = products
    .map(p => {
      const price = p.price ? formatINR(p.price) : 'Price on request';
      const img =
        p.image_url ||
        'https://media.istockphoto.com/id/1127742967/photo/assorted-nuts-on-white-dry-fruits-mix-nuts-almond-cashew-raisins.jpg';

      // SAFE, SHORT, GUARDED MESSAGE
      const message = encodeURIComponent(
        `Hello Prime Nature 👋\n\n` +
          `Product: ${p.name || 'Product'}\n` +
          `Category: ${p.category || 'N/A'}\n` +
          `Price: ${p.price ? formatINR(p.price) : 'Price on request'}`
      );

      const whatsappLink = getWhatsAppLink('919778757265', message);

      return `
        <div class="product-card">
          <div class="product-image">
            <img src="${img}" alt="${p.name}">
          </div>

          <div class="product-details">
            <h3>${p.name}</h3>
            <p>${p.description || ''}</p>
            <div class="product-price">${price}</div>

            <div class="product-actions">
              <button class="btn btn-secondary"
                onclick="openProductModal('${p.id}')">
                View
              </button>

              <a class="btn btn-whatsapp" target="_blank"
                 href="${whatsappLink}">
                 Order
              </a>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// =====================
// MODAL
// =====================
function openProductModal(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

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
// REALTIME UPDATES
// =====================
let productsChannel = null;

function setupRealtimeUpdates() {
  if (productsChannel) return;

  productsChannel = sb
    .channel('public-products')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      () => loadProducts()
    )
    .subscribe();
}
