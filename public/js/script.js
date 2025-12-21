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
  setupThemeToggle();

  if (modalCloseBtn && productModal) {
    modalCloseBtn.onclick = () => (productModal.style.display = 'none');
    productModal.onclick = e => {
      if (e.target === productModal) productModal.style.display = 'none';
    };
  }
});

// =====================
// THEME TOGGLE
// =====================
function setupThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  const mobileToggleBtn = document.getElementById('mobile-theme-toggle');
  const icon = toggleBtn ? toggleBtn.querySelector('i') : null;
  const mobileIcon = mobileToggleBtn ? mobileToggleBtn.querySelector('i') : null;

  // Check saved preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (icon) icon.className = 'fas fa-sun';
    if (mobileIcon) mobileIcon.className = 'fas fa-sun';
  }

  const toggleTheme = (e) => {
    if (e) e.preventDefault();
    
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update Icons
    const newIconClass = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    if (icon) icon.className = newIconClass;
    if (mobileIcon) mobileIcon.className = newIconClass;
  };

  if (toggleBtn) toggleBtn.addEventListener('click', toggleTheme);
  if (mobileToggleBtn) mobileToggleBtn.addEventListener('click', toggleTheme);
}

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
      const img = getProductImage(p);

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
            ${p.weight ? `<div class="product-weight">${p.weight}</div>` : ''}
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
  const product = allProducts.find(p => p.id == id);
  if (!product) return;

  // Get all images (if multiple)
  const images = getProductImagesArray(product);
  const mainImage = images[0];

  // Ensure modal container exists (Self-healing if HTML is missing)
  if (!productModal) {
    productModal = document.getElementById('product-modal');
    if (!productModal) {
      productModal = document.createElement('div');
      productModal.id = 'product-modal';
      productModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: none; justify-content: center; align-items: center;';
      document.body.appendChild(productModal);
      productModal.onclick = e => {
        if (e.target === productModal) productModal.style.display = 'none';
      };
    }
  }

  // QUANTITY SELECTOR LOGIC
  const baseGrams = parseWeightToGrams(product.weight);
  const hasSelector = baseGrams && product.price;
  let selectorHtml = '';

  if (hasSelector) {
    const pricePerGram = product.price / baseGrams;
    const options = [100, 250, 500, 1000]; // Standard sizes
    
    selectorHtml = `
      <div style="margin: 15px 0; text-align: left;">
        <label style="font-size: 0.9rem; color: #666; font-weight: 600; margin-bottom: 5px; display: block;">Select Quantity</label>
        <select id="modal-weight-select" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; background: #f9f9f9; cursor: pointer;">
          ${options.map(g => {
            const p = Math.ceil(pricePerGram * g);
            const lbl = g >= 1000 ? (g/1000)+'kg' : g+'g';
            // Select 1kg by default if available, otherwise select the base weight if it matches
            const selected = (g === baseGrams) ? 'selected' : ''; 
            return `<option value="${g}" data-price="${p}" data-label="${lbl}" ${selected}>${lbl} - ${formatINR(p)}</option>`;
          }).join('')}
        </select>
      </div>
    `;
  }

  // Dynamic Content Generation to ensure order: Image -> Name -> Price/Weight -> Description
  const priceInfo = product.price
    ? `<div id="modal-price-display" style="font-size: 1.2rem; color: var(--primary-color); margin: 10px 0; font-weight: bold;">
         ${formatINR(product.price)} 
         ${product.weight ? `<span style="font-size: 0.9rem; color: #666; font-weight: normal;">/ ${product.weight}</span>` : ''}
       </div>`
    : '';

  const description = product.description 
    ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; text-align: left;">
         <strong style="display: block; margin-bottom: 5px;">Description:</strong>
         <p style="white-space: pre-wrap; color: #444; margin: 0;">${product.description}</p>
       </div>`
    : '';

  // WhatsApp Message
  const message = encodeURIComponent(
    `Hello Prime Nature 👋\n\nI am interested in: ${product.name}\nPrice: ${product.price ? formatINR(product.price) : 'N/A'}`
  );
  const whatsappLink = getWhatsAppLink('919778757265', message);

  productModal.innerHTML = `
    <div class="modal-content" style="background: white; padding: 20px; border-radius: 12px; max-width: 500px; width: 95%; position: relative; max-height: 90vh; overflow-y: auto;">
      <button id="dynamic-modal-close" style="position: absolute; right: 15px; top: 10px; background: none; border: none; font-size: 28px; cursor: pointer; color: #666;">&times;</button>
      
      <div style="text-align: center;">
        <img src="${mainImage}" alt="${product.name}" style="max-width: 100%; height: auto; max-height: 300px; border-radius: 8px; margin-bottom: 15px;">
        
        ${images.length > 1 ? `
          <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px; overflow-x: auto;">
            ${images.map(img => `
              <img src="${img}" onclick="this.parentElement.previousElementSibling.src='${img}'" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid #ddd;">
            `).join('')}
          </div>
        ` : ''}

        <h2 style="margin: 0 0 5px 0; color: #333;">${product.name}</h2>
        <div style="color: #666; font-size: 0.9rem; margin-bottom: 10px;">${product.category}</div>
        ${selectorHtml}
        ${priceInfo}
        
        ${description}

        <div style="margin-top: 20px;">
          <a id="modal-order-btn" href="${whatsappLink}" target="_blank" class="btn btn-whatsapp" style="width: 100%; text-align: center; display: block;">
            Order Now
          </a>
        </div>
      </div>
    </div>
  `;

  productModal.style.display = 'flex';
  productModal.style.justifyContent = 'center';
  productModal.style.alignItems = 'center';

  // Attach Close Event
  document.getElementById('dynamic-modal-close').onclick = () => {
    productModal.style.display = 'none';
  };

  // Attach Event Listener for Quantity Change
  if (hasSelector) {
    const select = document.getElementById('modal-weight-select');
    const priceDisplay = document.getElementById('modal-price-display');
    const orderBtn = document.getElementById('modal-order-btn');

    const updateState = () => {
      const opt = select.options[select.selectedIndex];
      const price = opt.dataset.price;
      const weightLabel = opt.dataset.label;

      // Update Price UI
      priceDisplay.innerHTML = `${formatINR(price)} <span style="font-size: 0.9rem; color: #666; font-weight: normal;">/ ${weightLabel}</span>`;

      // Update WhatsApp Link
      const msg = encodeURIComponent(`Hello Prime Nature 👋\n\nI am interested in: ${product.name}\nQuantity: ${weightLabel}\nPrice: ${formatINR(price)}`);
      orderBtn.href = getWhatsAppLink('919778757265', msg);
    };

    select.addEventListener('change', updateState);
    // Initialize with default selection (in case base weight isn't the first option)
    updateState();
  }
}

// Expose to window for HTML onclick
window.openProductModal = openProductModal;

// =====================
// HELPERS
// =====================
function getProductImage(p) {
  if (!p.image_url) return 'https://media.istockphoto.com/id/1127742967/photo/assorted-nuts-on-white-dry-fruits-mix-nuts-almond-cashew-raisins.jpg';
  
  if (p.image_url.startsWith('[')) {
    try {
      const imgs = JSON.parse(p.image_url);
      return imgs[0];
    } catch (e) { return p.image_url; }
  }
  return p.image_url;
}

function getProductImagesArray(p) {
  if (!p.image_url) return ['https://media.istockphoto.com/id/1127742967/photo/assorted-nuts-on-white-dry-fruits-mix-nuts-almond-cashew-raisins.jpg'];
  if (p.image_url.startsWith('[')) {
    try { return JSON.parse(p.image_url); } catch (e) { return [p.image_url]; }
  }
  return [p.image_url];
}

function parseWeightToGrams(str) {
  if (!str) return null;
  // Normalize: "1 kg" -> "1kg", "500 g" -> "500g"
  const clean = str.toLowerCase().replace(/[^0-9.kg]/g, '');
  
  if (clean.includes('kg')) {
    return parseFloat(clean) * 1000;
  } else if (clean.includes('g')) {
    return parseFloat(clean);
  }
  return null;
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
  const navLinks = document.querySelectorAll('a[href^="#"]:not(#mobile-theme-toggle)');
  const sections = document.querySelectorAll('section[id]');

  function navigateTo(targetId) {
    const viewAllBtn = document.getElementById('view-all-products-btn');

    // Logic: Home shows ALL, others show ONLY target
    if (targetId === 'home') {
      sections.forEach(sec => sec.style.display = 'block');
      
      // Reset to limited view on Home
      if (productsContainer) productsContainer.classList.add('limited-view');
      if (viewAllBtn) viewAllBtn.style.display = 'inline-flex';
    } else {
      sections.forEach(sec => {
        sec.style.display = (sec.id === targetId) ? 'block' : 'none';
      });

      // Expand products if viewing Products section
      if (targetId === 'products') {
        if (productsContainer) productsContainer.classList.remove('limited-view');
        if (viewAllBtn) viewAllBtn.style.display = 'none';
      }
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
