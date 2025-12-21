// admin.js – REAL ADMIN (Supabase Auth, production-safe)

// =====================
// SUPABASE CLIENT
// =====================
const sb = window.supabaseClient;
if (!sb) throw new Error('Supabase client not found. Check script order.');

let currentUser = null;

// =====================
// IMAGE CONFIG
// =====================
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.1,
  maxWidthOrHeight: 800,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.8
};
const STORAGE_SAFETY_LIMIT_MB = 100; // Increased to 100MB
const BUCKET_NAME = 'product-images'; // CHECK THIS: Must match your Supabase Bucket Name exactly

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
  setupEventListeners();
});

// =====================
// AUTH
// =====================
async function checkAuthStatus() {
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return;

  currentUser = data.user;
  showDashboard();
  loadAdminProducts();
  loadUploadedImages();
}

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) return showNotification(error.message, 'error');

  currentUser = data.user;
  showDashboard();
  loadAdminProducts();
  loadUploadedImages();
}

async function handleLogout(e) {
  e.preventDefault();
  await sb.auth.signOut();
  location.reload();
}

// =====================
// UI
// =====================
function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  document.getElementById('user-email').textContent = currentUser.email;
}

function switchSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`${section}-section`)?.classList.add('active');
  document.getElementById('section-title').textContent =
    section === 'products'
      ? 'Products Management'
      : section === 'add-product'
      ? 'Add New Product'
      : 'Uploaded Images';
}

// =====================
// EVENT LISTENERS
// =====================
function setupEventListeners() {
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('add-product-form')?.addEventListener('submit', handleAddProduct);
  document.getElementById('edit-product-form')?.addEventListener('submit', handleEditProduct);

  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      switchSection(item.dataset.section);
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    });
  });

  setupImageUpload();
}

// =====================
// PRODUCTS
// =====================
async function handleAddProduct(e) {
  e.preventDefault();

  const preview = document.getElementById('image-preview');
  if (!preview.uploadFile) return showNotification('Image required', 'error');

  // 1. Upload Image to Supabase Storage
  const imageUrl = await uploadImageToBucket(preview.uploadFile);
  if (!imageUrl) return; // Error handled in helper

  const product = {
    name: document.getElementById('product-name').value.trim(),
    category: document.getElementById('product-category').value,
    weight: document.getElementById('product-weight').value.trim(),
    price: document.getElementById('product-price').value || null,
    description: document.getElementById('product-description').value,
    status: document.getElementById('product-status').value,
    image_url: imageUrl
  };

  const { error } = await sb.from('products').insert([product]);
  if (error) return showNotification(error.message, 'error');

  showNotification('Product added', 'success');
  e.target.reset();
  clearImagePreview();
  loadAdminProducts();
}

async function loadAdminProducts() {
  const { data, error } = await sb.from('products').select('*').order('created_at', { ascending: false });
  if (error) return;
  calculateStorageUsage(data);
  displayAdminProducts(data);
}

function displayAdminProducts(products) {
  document.getElementById('products-table-body').innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image_url}" style="width:50px"></td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>${p.weight || '-'}</td>
      <td>${p.price ? '₹' + p.price : 'N/A'}</td>
      <td>${p.status}</td>
      <td>
        <button onclick="editProduct('${p.id}')">Edit</button>
        <button onclick="deleteProduct('${p.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function editProduct(id) {
  const { data } = await sb.from('products').select('*').eq('id', id).single();

  document.getElementById('edit-product-id').value = data.id;
  document.getElementById('edit-product-name').value = data.name;
  document.getElementById('edit-product-category').value = data.category;
  document.getElementById('edit-product-weight').value = data.weight || '';
  document.getElementById('edit-product-price').value = data.price || '';
  document.getElementById('edit-product-description').value = data.description || '';
  document.getElementById('edit-product-status').value = data.status;

  document.getElementById('edit-current-image').src = data.image_url;
  document.getElementById('current-image').style.display = 'block';
  document.getElementById('edit-product-modal').style.display = 'flex';
}

async function handleEditProduct(e) {
  e.preventDefault();

  const id = document.getElementById('edit-product-id').value;
  const preview = document.getElementById('edit-image-preview');

  const update = {
    name: document.getElementById('edit-product-name').value,
    category: document.getElementById('edit-product-category').value,
    weight: document.getElementById('edit-product-weight').value,
    price: document.getElementById('edit-product-price').value || null,
    description: document.getElementById('edit-product-description').value,
    status: document.getElementById('edit-product-status').value
  };

  // If a new image was selected, upload it
  if (preview.uploadFile) {
    const imageUrl = await uploadImageToBucket(preview.uploadFile);
    if (imageUrl) update.image_url = imageUrl;
  }

  await sb.from('products').update(update).eq('id', id);

  closeEditModal();
  loadAdminProducts();
  showNotification('Product updated', 'success');
}

async function deleteProduct(id) {
  if (!confirm('Delete product?')) return;
  await sb.from('products').delete().eq('id', id);
  loadAdminProducts();
}

// =====================
// STORAGE UPLOAD HELPER
// =====================
async function uploadImageToBucket(file) {
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
  const filePath = `products/${fileName}`;
  
  const { error } = await sb.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      contentType: 'image/jpeg',
      upsert: false
    });

  if (error) {
    showNotification('Image upload failed: ' + error.message, 'error');
    return null;
  }

  const { data } = sb.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  return data.publicUrl;
}

// =====================
// STORAGE CALCULATOR
// =====================
function calculateStorageUsage(products) {
  let totalBytes = 0;
  
  // Sum up the size of all image strings
  products.forEach(p => {
    if (p.image_url) totalBytes += p.image_url.length;
  });

  // Convert to MB
  const usedMB = (totalBytes / (1024 * 1024)).toFixed(2);
  const totalMB = STORAGE_SAFETY_LIMIT_MB;
  const percent = Math.min((usedMB / totalMB) * 100, 100);

  // Update Sidebar
  const storageInfo = document.getElementById('storage-info');
  if (storageInfo) storageInfo.textContent = `Storage: ${usedMB}/${totalMB} MB used`;

  // Update Dashboard Meter
  const usedEl = document.getElementById('used-storage');
  const totalEl = document.getElementById('total-storage');
  const fillEl = document.getElementById('meter-fill');
  const percentEl = document.getElementById('storage-percentage');

  if (usedEl) usedEl.textContent = `${usedMB} MB`;
  if (totalEl) totalEl.textContent = `${totalMB} MB`;
  if (fillEl) fillEl.style.width = `${percent}%`;
  if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
}

// =====================
// UPLOADED IMAGES
// =====================
async function loadUploadedImages() {
  const { data } = await sb
    .from('products')
    .select('name,image_url')
    .not('image_url', 'is', null)
    .limit(20);
    
  document.getElementById('images-grid').innerHTML = data.map(p => `
    <div class="image-card">
      <img src="${p.image_url}">
      <div class="image-name">${p.name}</div>
    </div>
  `).join('');
}

// =====================
// IMAGE UPLOAD
// =====================
function setupImageUpload() {
  setupUploadArea('image-upload-area', 'product-image-upload', 'image-preview');
  setupUploadArea('edit-image-upload-area', 'edit-product-image-upload', 'edit-image-preview');
}

function setupUploadArea(areaId, inputId, previewId) {
  const area = document.getElementById(areaId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  area.onclick = () => input.click();
  input.onchange = e => handleImageUpload(e.target.files[0], preview);
}

async function handleImageUpload(file, preview) {
  try {
    const compressed = await resizeImage(file, COMPRESSION_OPTIONS.maxWidthOrHeight, COMPRESSION_OPTIONS.initialQuality);
    const reader = new FileReader();
    reader.onload = e => {
      preview.dataset.imageData = e.target.result;
      preview.uploadFile = compressed; // Store file for upload
      preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%">`;
    };
    reader.readAsDataURL(compressed);
  } catch (error) {
    console.error('Image processing failed:', error);
    showNotification('Failed to process image', 'error');
  }
}

function resizeImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Compression failed'));
          resolve(new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          }));
        }, 'image/jpeg', quality);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
}

function clearImagePreview() {
  const p = document.getElementById('image-preview');
  p.innerHTML = '';
  delete p.dataset.imageData;
  delete p.uploadFile;
}

function closeEditModal() {
  document.getElementById('edit-product-modal').style.display = 'none';
  document.getElementById('edit-image-preview').innerHTML = '';
}

// =====================
// NOTIFICATION
// =====================
function showNotification(msg, type) {
  alert(msg);
}

// =====================
// GLOBAL
// =====================
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.clearImagePreview = clearImagePreview;
// =====================
// MOBILE SIDEBAR FIX (ADDED)
// =====================

// Toggle sidebar on small screens
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Auto-close sidebar when section clicked (mobile only)
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        sidebar?.classList.remove('open');
      }
    });
  });
});
