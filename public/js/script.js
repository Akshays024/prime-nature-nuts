// =====================
// STATE
// =====================
let allProducts = [];
let activeCategory = 'all';
let searchQuery = '';

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
  setupSearch();

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
  applyFilters();
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
      applyFilters();
    };
  });
}

function setupSearch() {
  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      applyFilters();
    });
  }
}

function applyFilters() {
  let filtered = allProducts;

  // 1. Filter by Category
  if (activeCategory !== 'all') {
    filtered = filtered.filter(p => p.category === activeCategory);
  }

  // 2. Filter by Search Query
  if (searchQuery) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery));
  }

  displayProducts(filtered);
}

// =====================
// RENDER PRODUCTS
// =====================
function displayProducts(products) {
  if (!products.length) {
    // Check if it's a search result (store has items, but filter found none)
    if (allProducts.length > 0) {
      productsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
          <p style="color: var(--text-light); font-size: 1.1rem;">No products match your search.</p>
        </div>`;
    } else {
      productsContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
          <i class="fas fa-leaf" style="font-size: 3rem; color: var(--primary-light); margin-bottom: 15px; opacity: 0.7;"></i>
          <h3 style="color: var(--primary-color); margin-bottom: 10px;">Coming Soon</h3>
          <p style="color: var(--text-light); max-width: 400px; margin: 0 auto;">
            We are currently stocking our shelves with the finest premium nuts and dry fruits. 
            Please check back shortly!
          </p>
        </div>`;
    }
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
          (p.weight ? `Weight: ${p.weight}\n` : '') +
          `Price: ${p.price ? formatINR(p.price) : 'Price on request'}`
      );

      const whatsappLink = getWhatsAppLink('919778757265', message);

      return `
        <div class="product-card">
          <div class="product-image">
            <img src="${img}" alt="${p.name}" loading="lazy" decoding="async">
          </div>

          <div class="product-details">
            <h3>${p.name}</h3>
            <p>${p.description || ''}</p>
            ${p.weight ? `<div class="product-weight" style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 5px;">${p.weight}</div>` : ''}
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
    priceText.textContent = product.weight 
      ? `${formatINR(product.price)} / ${product.weight}`
      : formatINR(product.price);
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

// =====================
// SPA NAVIGATION & MOBILE MENU
// =====================
document.addEventListener('DOMContentLoaded', () => {
  // Mobile Menu Elements
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileMenuClose = document.querySelector('.mobile-menu-close');
  
  // Toggle Mobile Menu
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.style.display = 'flex';
    });
  }
  if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', () => {
      mobileMenu.style.display = 'none';
    });
  }

  // SPA Navigation Logic
  const navLinks = document.querySelectorAll('a[href^="#"]');
  const sections = document.querySelectorAll('section[id]');

  function navigateTo(targetId) {
    // Logic: Home shows ALL, others show ONLY target
    if (targetId === 'home') {
      sections.forEach(sec => sec.style.display = 'block');
    } else {
      sections.forEach(sec => {
        sec.style.display = (sec.id === targetId) ? 'block' : 'none';
      });
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Update Active Link
    navLinks.forEach(link => {
      if (link.getAttribute('href') === '#' + targetId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Close Mobile Menu
    if (mobileMenu) mobileMenu.style.display = 'none';
  }

  // Attach Listeners
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      navigateTo(targetId);
    });
  });

  // Handle Initial Hash
  const hash = window.location.hash.substring(1);
  if (hash && document.getElementById(hash)) {
    navigateTo(hash);
  }
});

// =====================
// SEASONAL ANIMATIONS
// =====================
function initSeasonalAnimations() {
  const container = document.createElement('div');
  container.className = 'seasonal-container';
  document.body.appendChild(container);

  const date = new Date();
  const month = date.getMonth(); // 0 = Jan, 11 = Dec
  
  // Default: Nature Leaves (Matches your brand)
  let icon = '🍃'; 

  // December/January (Festive/Winter Season)
  if (month === 11 || month === 0) {
    icon = '❄️';
  } 
  // October/November (Autumn)
  else if (month === 9 || month === 10) {
    icon = '🍂';
  }

  // Create 15 falling particles
  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');
    el.className = 'seasonal-element';
    el.textContent = icon;
    
    // Randomize positioning and timing for natural look
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (Math.random() * 8 + 8) + 's'; // 8-16s duration
    el.style.animationDelay = (Math.random() * 5) + 's';
    el.style.fontSize = (Math.random() * 10 + 15) + 'px'; // 15-25px size
    
    container.appendChild(el);
  }
}

document.addEventListener('DOMContentLoaded', initSeasonalAnimations);
