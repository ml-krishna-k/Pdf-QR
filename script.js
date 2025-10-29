// script.js - Frontend Logic with Firebase Integration
// Import Firebase modules (v9+ modular SDK)
// Note: Using backend upload endpoint instead of Firebase to simplify local testing

// ============================================
// BACKEND API ENDPOINT
// ============================================
// Use relative API path so it works locally (with node server) and on Vercel
const API_BASE_URL = '';

// ============================================
// LOGO CONFIGURATION
// ============================================
// CUSTOMIZATION POINT: Replace with your actual company logo URL
const COMPANY_LOGO_URL = 'https://via.placeholder.com/150/4F46E5/ffffff?text=LOGO';

// ============================================
// DOM ELEMENTS
// ============================================
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadArea = document.getElementById('uploadArea');
const uploadSection = document.getElementById('uploadSection');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('resultsSection');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Results elements
const qrImage = document.getElementById('qrImage');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const uploadDate = document.getElementById('uploadDate');
const documentUrl = document.getElementById('documentUrl');
const downloadQrBtn = document.getElementById('downloadQrBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const viewDocumentBtn = document.getElementById('viewDocumentBtn');
const newUploadBtn = document.getElementById('newUploadBtn');

// ============================================
// STATE MANAGEMENT
// ============================================
let selectedFile = null;
let currentDownloadUrl = null;

// ============================================
// FILE SELECTION & VALIDATION
// ============================================
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  handleFileSelection(file);
});

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  
  const file = e.dataTransfer.files[0];
  handleFileSelection(file);
});

function handleFileSelection(file) {
  if (!file) return;
  
  // Validate file type
  if (file.type !== 'application/pdf') {
    showError('Please select a valid PDF file.');
    return;
  }
  
  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    showError('File size must be less than 10MB.');
    return;
  }
  
  selectedFile = file;
  uploadBtn.disabled = false;
  hideError();
  
  // Update UI to show file is selected
  const uploadLabel = uploadArea.querySelector('.upload-text');
  uploadLabel.innerHTML = `<strong>${file.name}</strong> selected`;
}

// ============================================
// UPLOAD & QR GENERATION PROCESS
// ============================================
uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  
  try {
    // Show loading state
    showLoading();

    // Step 1: Upload to server
    const downloadUrl = await uploadToServer(selectedFile);

    // Step 2: Generate QR code with logo
    const qrCodeBase64 = await generateQRCode(downloadUrl);

    // Step 3: Display results
    displayResults(selectedFile, downloadUrl, qrCodeBase64);

  } catch (error) {
    console.error('Upload error:', error);
    showError(error.message || 'An error occurred during upload. Please try again.');
    hideLoading();
  }
});

// ============================================
// FIREBASE UPLOAD
// ============================================
// Upload file and return accessible URL (Vercel Blob if available, else local Express)
async function uploadToServer(file) {
  const loadingText = loading.querySelector('p');
  if (loadingText) loadingText.textContent = 'Uploading document to server...';

  // Try Vercel Blob signed upload first
  try {
    const getUrlResp = await fetch(`/api/blob-upload-url`, { method: 'POST' });
    if (getUrlResp.ok) {
      const { uploadUrl } = await getUrlResp.json();
      const putResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/pdf' },
        body: file
      });
      if (!putResp.ok) {
        const txt = await putResp.text().catch(() => '');
        throw new Error(`Blob upload failed: ${txt || putResp.status}`);
      }
      const putData = await putResp.json();
      if (putData && putData.url) {
        return putData.url;
      }
    }
  } catch (e) {
    // Fallback below
  }

  // Fallback to local Express upload
  const form = new FormData();
  form.append('file', file);
  const resp = await fetch(`/api/upload`, { method: 'POST', body: form });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }
  const data = await resp.json();
  if (!data.success || !data.url) {
    throw new Error(data.error || 'Invalid upload response');
  }
  return data.url;
}

// ============================================
// QR CODE GENERATION
// ============================================
async function generateQRCode(url) {
  const loadingText = loading.querySelector('p');
  if (loadingText) {
    loadingText.textContent = 'Generating QR code...';
  }
  
  try {
    const response = await fetch(`/api/generate-qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        logoUrl: COMPANY_LOGO_URL
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate QR code');
    }
    
    const data = await response.json();
    
    if (!data.success || !data.qrCode) {
      throw new Error('Invalid response from server');
    }
    
    return data.qrCode;
    
  } catch (error) {
    console.error('QR generation error:', error);
    throw new Error('Failed to generate QR code: ' + error.message);
  }
}

// ============================================
// DISPLAY RESULTS
// ============================================
function displayResults(file, url, qrCode) {
  // Hide loading and upload section
  hideLoading();
  uploadSection.style.display = 'none';
  
  // Populate results
  qrImage.src = qrCode;
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  uploadDate.textContent = new Date().toLocaleString();
  documentUrl.value = url;
  viewDocumentBtn.href = url;
  
  // Store current URL for download
  currentDownloadUrl = url;
  
  // Show results section
  resultsSection.classList.add('active');
  
  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function showLoading() {
  loading.classList.add('active');
  uploadBtn.disabled = true;
}

function hideLoading() {
  loading.classList.remove('active');
  uploadBtn.disabled = false;
}

function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.add('active');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    hideError();
  }, 5000);
}

function hideError() {
  errorMessage.classList.remove('active');
}

// ============================================
// RESULT ACTIONS
// ============================================

// Download QR Code
downloadQrBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = qrImage.src;
  link.download = `QR_${fileName.textContent.replace('.pdf', '')}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Copy Link to Clipboard
copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(documentUrl.value);
    
    // Show success feedback
    const originalHTML = copyLinkBtn.innerHTML;
    copyLinkBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    copyLinkBtn.style.background = '#10B981';
    copyLinkBtn.style.color = '#fff';
    
    setTimeout(() => {
      copyLinkBtn.innerHTML = originalHTML;
      copyLinkBtn.style.background = '';
      copyLinkBtn.style.color = '';
    }, 2000);
    
  } catch (error) {
    console.error('Failed to copy:', error);
    showError('Failed to copy link to clipboard');
  }
});

// New Upload
newUploadBtn.addEventListener('click', () => {
  // Reset state
  selectedFile = null;
  currentDownloadUrl = null;
  fileInput.value = '';
  uploadBtn.disabled = true;
  
  // Reset upload label
  const uploadLabel = uploadArea.querySelector('.upload-text');
  uploadLabel.innerHTML = '<strong>Click to upload</strong> or drag and drop';
  
  // Show upload section, hide results
  uploadSection.style.display = 'block';
  resultsSection.classList.remove('active');
  
  // Scroll to top
  uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ============================================
// INITIALIZATION
// ============================================
console.log('🚀 Company QR Generator initialized');
console.log('📡 Backend API:', API_BASE_URL);

// Check backend connection
fetch(`${API_BASE_URL}/api/health`)
  .then(res => res.json())
  .then(data => console.log('✅ Backend connected:', data))
  .catch(err => console.warn('⚠️ Backend not available:', err.message));