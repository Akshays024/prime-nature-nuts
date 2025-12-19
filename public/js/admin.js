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
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.8
};

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
  if (!preview.dataset.imageData) return showNotification('Image required', 'error');

  const product = {
    name: document.getElementById('product-name').value.trim(),
    category: document.getElementById('product-category').value,
    price: document.getElementById('product-price').value || null,
    description: document.getElementById('product-description').value,
    status: document.getElementById('product-status').value,
    image_url: preview.dataset.imageData
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
  displayAdminProducts(data);
}

function displayAdminProducts(products) {
  document.getElementById('products-table-body').innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image_url}" style="width:50px"></td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>${p.price ?? 'N/A'}</td>
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
    price: document.getElementById('edit-product-price').value || null,
    description: document.getElementById('edit-product-description').value,
    status: document.getElementById('edit-product-status').value
  };

  if (preview.dataset.imageData) update.image_url = preview.dataset.imageData;

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
// UPLOADED IMAGES
// =====================
async function loadUploadedImages() {
  const { data } = await sb.from('products').select('name,image_url').not('image_url', 'is', null);
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
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
  const reader = new FileReader();
  reader.onload = e => {
    preview.dataset.imageData = e.target.result;
    preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%">`;
  };
  reader.readAsDataURL(compressed);
}

function clearImagePreview() {
  const p = document.getElementById('image-preview');
  p.innerHTML = '';
  delete p.dataset.imageData;
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
