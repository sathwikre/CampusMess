// ================= STATE =================
let currentHostel = 'ellora'; // Store in lowercase for consistency
let openMeal = null; // breakfast | lunch | dinner
let currentMealForForm = null;
let menusToday = [];
let currentUserName = '';

// Camera state
let currentStream = null;
let capturedBlob = null;

// ================= LOAD MENUS =================
async function loadTodayMenus() {
  try {
    const res = await fetch('/api/menus/today', { cache: 'no-store' });
    const result = await res.json();
    menusToday = result?.success && Array.isArray(result.data) ? result.data : [];
  } catch (err) {
    console.error('Failed to load menus:', err);
    menusToday = [];
  }
}

// ================= USER =================
function initUserName() {
  currentUserName = localStorage.getItem('currentUserName');
  if (!currentUserName) {
    currentUserName = prompt('Enter your name:')?.trim() || 'Anonymous';
    localStorage.setItem('currentUserName', currentUserName);
  }
}

// ================= UTILITY FUNCTIONS =================
function formatDateTime(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    // Get current date for comparison
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Format time (12-hour format with AM/PM)
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    const timeStr = `${displayHours}:${displayMinutes} ${ampm}`;
    
    // Check if it's today
    if (itemDate.getTime() === today.getTime()) {
      return `Today, ${timeStr}`;
    }
    
    // Check if it's yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (itemDate.getTime() === yesterday.getTime()) {
      return `Yesterday, ${timeStr}`;
    }
    
    // Otherwise show date and time
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    return `${month} ${day}, ${timeStr}`;
  } catch (err) {
    console.error('Error formatting date:', err);
    return '';
  }
}

// ================= RENDER =================
function renderMeals() {
  document.querySelectorAll('.meal-section').forEach(section => {
    const mealType = section.dataset.meal.toLowerCase();
    const content = section.querySelector('.meal-content');
    content.innerHTML = '';

    if (openMeal !== mealType) {
      content.innerHTML = '<p class="placeholder">Tap to view items</p>';
      section.classList.remove('expanded');
      return;
    }

    section.classList.add('expanded');

    const menu = menusToday.find(m => 
      m.hostel && m.mealType && 
      m.hostel.toLowerCase() === currentHostel &&
      m.mealType.toLowerCase() === mealType
    );

    if (!menu || !Array.isArray(menu.items) || menu.items.length === 0) {
      content.innerHTML = '<p class="no-items">Menu not added yet</p>';
    } else {
      const ul = document.createElement('ul');
      ul.className = 'items-list';

      menu.items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'item-entry';

        // Check if current user created this item
        const isOwner = item.createdBy && item.createdBy === currentUserName;
        
        // Format the timestamp if available
        const timestampHtml = item.createdAt ? `<div class="item-date">${formatDateTime(item.createdAt)}</div>` : '';
        
        li.innerHTML = `
          <div class="item-text">• ${item.text || 'Unnamed item'}</div>
          ${item.createdBy ? `<div class="item-by">${item.createdBy}</div>` : ''}
          ${item.imagePath ? `<img src="${item.imagePath}" class="item-image">` : ''}
          ${isOwner ? `<button class="item-delete-btn" data-item-id="${item._id}" title="Delete this item">×</button>` : ''}
          ${timestampHtml}
        `;

        // Add delete handler if this is the owner's item
        if (isOwner) {
          const deleteBtn = li.querySelector('.item-delete-btn');
          if (deleteBtn) {
            // Get the actual item ID - handle both ObjectId and string
            let itemId;
            if (item._id) {
              if (typeof item._id === 'string') {
                itemId = item._id;
              } else if (item._id.toString) {
                itemId = item._id.toString();
              } else if (item._id.$oid) {
                itemId = item._id.$oid; // MongoDB extended JSON format
              } else {
                itemId = String(item._id);
              }
            }
            console.log('🔘 Delete button created for item:', { 
              itemId, 
              itemIdType: typeof itemId,
              rawId: item._id,
              rawIdType: typeof item._id,
              item 
            });
            
            deleteBtn.onclick = async (e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('🔘 Delete button clicked for item:', itemId, 'Type:', typeof itemId);
              if (confirm('Are you sure you want to delete this item?')) {
                if (!itemId) {
                  console.error('❌ No item ID found!');
                  showToast('Error: Item ID not found', 'error');
                  return;
                }
                await deleteMenuItem(itemId);
              }
            };
          } else {
            console.error('❌ Delete button not found in DOM');
          }
        }

        ul.appendChild(li);
      });

      content.appendChild(ul);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-item';
    addBtn.textContent = 'Add Item';
    addBtn.onclick = e => {
      e.stopPropagation();
      openAddItemForm(mealType);
    };
    content.appendChild(addBtn);
  });
}

// ================= CAMERA FUNCTIONS =================
async function startCamera() {
  try {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Camera is not supported in this browser.', 'error');
      return;
    }

    // Stop any existing stream first
    stopCamera();

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment', // Use back camera on mobile devices
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    
    currentStream = stream;
    const video = document.getElementById('camera-preview');
    if (!video) return;
    
    video.srcObject = stream;
    
    // Show camera section, hide file input preview
    document.getElementById('camera-section').style.display = 'block';
    document.getElementById('file-preview').style.display = 'none';
    document.getElementById('preview-section').style.display = 'none';
    
    // Clear file input
    document.getElementById('item-photo').value = '';
  } catch (err) {
    console.error('Error accessing camera:', err);
    let errorMsg = 'Could not access camera.';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMsg = 'Camera permission denied. Please allow camera access.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg = 'No camera found on this device.';
    }
    showToast(errorMsg, 'error');
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  
  const video = document.getElementById('camera-preview');
  if (video) {
    video.srcObject = null;
  }
}

function captureImage() {
  const video = document.getElementById('camera-preview');
  const canvas = document.getElementById('capture-canvas');
  const previewSection = document.getElementById('preview-section');
  const capturedPreview = document.getElementById('captured-preview');
  
  if (!video || !canvas || !previewSection || !capturedPreview) return;
  
  // Check if video is ready
  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    showToast('Camera is not ready. Please wait a moment.', 'error');
    return;
  }
  
  // Set canvas dimensions to match video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // Draw video frame to canvas
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  // Convert canvas to blob
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast('Failed to capture image. Please try again.', 'error');
      return;
    }
    
    capturedBlob = blob;
    
    // Create object URL for preview
    const imageUrl = URL.createObjectURL(blob);
    capturedPreview.src = imageUrl;
    
    // Show preview section, hide video
    previewSection.style.display = 'block';
    video.style.display = 'none';
    
    // Convert blob to File and set it to the file input
    const file = new File([blob], 'captured-image.jpg', { type: 'image/jpeg' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    document.getElementById('item-photo').files = dataTransfer.files;
    
    // Stop camera stream
    stopCamera();
  }, 'image/jpeg', 0.9);
}

function retakePhoto() {
  // Reset preview
  const previewSection = document.getElementById('preview-section');
  const capturedPreview = document.getElementById('captured-preview');
  const video = document.getElementById('camera-preview');
  
  if (capturedPreview && capturedPreview.src) {
    const imageUrl = capturedPreview.src;
    if (imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
    capturedPreview.src = '';
  }
  
  if (previewSection) previewSection.style.display = 'none';
  if (video) video.style.display = 'block';
  
  // Clear captured blob and file input
  capturedBlob = null;
  const photoInput = document.getElementById('item-photo');
  if (photoInput) photoInput.value = '';
  
  // Restart camera
  startCamera();
}

// ================= ADD ITEM FORM =================
function openAddItemForm(mealType) {
  currentMealForForm = mealType;
  document.getElementById('add-item-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('add-item-form').reset();
  
  // Reset camera state
  stopCamera();
  capturedBlob = null;
  document.getElementById('camera-section').style.display = 'none';
  document.getElementById('file-preview').style.display = 'none';
  document.getElementById('preview-section').style.display = 'none';
  
  // Reset video display
  const video = document.getElementById('camera-preview');
  if (video) {
    video.style.display = 'block';
  }
}

function closeAddItemForm() {
  stopCamera();
  capturedBlob = null;
  
  // Clean up blob URLs
  const capturedPreview = document.getElementById('captured-preview');
  if (capturedPreview && capturedPreview.src.startsWith('blob:')) {
    URL.revokeObjectURL(capturedPreview.src);
  }
  
  document.getElementById('add-item-overlay').style.display = 'none';
  document.body.style.overflow = 'auto';
  currentMealForForm = null;
}

// ✅ FIXED SUBMIT FUNCTION
async function submitNewItem(e) {
  e.preventDefault();

  if (!currentMealForForm) {
    alert('Select a meal first');
    return;
  }

  const itemText = document.getElementById('item-name').value.trim();
  if (!itemText) {
    alert('Item name required');
    return;
  }

  const formData = new FormData();
  formData.append('hostel', currentHostel);
  formData.append('mealType', currentMealForForm);
  formData.append('singleItem', itemText);
  formData.append('createdBy', currentUserName);

  const photoInput = document.getElementById('item-photo');
  if (photoInput.files[0]) {
    formData.append('photo', photoInput.files[0]);
  }

  try {
    const res = await fetch('/api/menus', {
  method: 'POST',
  body: formData
});

const text = await res.text();

let result;
try {
  result = JSON.parse(text);
} catch {
  throw new Error("Server error (response is not JSON)");
}

if (!res.ok || !result.success) {
  throw new Error(result?.error || "Failed to add item");
}



    await loadTodayMenus();
    openMeal = currentMealForForm;
    closeAddItemForm();
    renderMeals();
    showToast('Item added');
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

// ================= DELETE MENU ITEM =================
async function deleteMenuItem(itemId) {
  try {
    console.log('🗑️ Deleting item:', itemId, 'by user:', currentUserName);
    
    const res = await fetch(`/api/menus/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ createdBy: currentUserName }),
    });

    console.log('📥 Delete response status:', res.status);

    let result;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      result = await res.json();
    } else {
      const text = await res.text();
      console.error('❌ Response is not JSON:', text);
      throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}`);
    }

    console.log('📥 Delete response:', result);

    if (!res.ok || !result.success) {
      throw new Error(result.error || 'Failed to delete item');
    }

    // Reload menus and re-render
    await loadTodayMenus();
    renderMeals();
    showToast('Item deleted successfully', 'success');
  } catch (err) {
    console.error('❌ Error deleting item:', err);
    showToast(err.message || 'Failed to delete item', 'error');
  }
}

// ================= HOSTEL SWITCHING =================
function switchHostel(hostel) {
  currentHostel = hostel.toLowerCase();
  openMeal = null;

  // ✅ FIX: update active button UI
  document.querySelectorAll('.hostel-btn')
    .forEach(b => b.classList.remove('active'));

  const activeBtn = document.querySelector(
    `.hostel-btn[data-hostel="${hostel}"]`
  );
  if (activeBtn) activeBtn.classList.add('active');

  loadTodayMenus().then(renderMeals);
}

// ================= INIT =================
function init() {
  initUserName();
  loadTodayMenus().then(renderMeals);
  
  // Set up hostel buttons
  document.querySelectorAll('.hostel-btn').forEach(btn => {
    btn.onclick = () => switchHostel(btn.dataset.hostel);
  });

  document.querySelectorAll('.meal-section').forEach(section => {
    section.onclick = async () => {
      const meal = section.dataset.meal;
      openMeal = openMeal === meal ? null : meal;
      if (openMeal) await loadTodayMenus();
      renderMeals();
    };
  });

  document.getElementById('add-item-form')
    .addEventListener('submit', submitNewItem);

  document.getElementById('cancel-add')
    .onclick = closeAddItemForm;
  
  // File upload button - show coming soon
  const fileUploadBtn = document.getElementById('file-upload-btn');
  if (fileUploadBtn) {
    fileUploadBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openComingSoonModal();
    });
  }
  
  // Camera button event listeners - show coming soon
  const useCameraBtn = document.getElementById('use-camera');
  const captureBtn = document.getElementById('capture-btn');
  const retakeBtn = document.getElementById('retake-btn');
  
  if (useCameraBtn) {
    useCameraBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openComingSoonModal();
    });
  }
  
  if (captureBtn) {
    captureBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openComingSoonModal();
    });
  }
  
  if (retakeBtn) {
    retakeBtn.addEventListener('click', retakePhoto);
  }
  
  // Hide file input and prevent direct access
  const photoInput = document.getElementById('item-photo');
  if (photoInput) {
    // Prevent any direct interaction with file input
    photoInput.style.pointerEvents = 'none';
    photoInput.disabled = true;
  }
  
  // Close coming soon modal button
  const closeComingSoonBtn = document.getElementById('close-coming-soon');
  if (closeComingSoonBtn) {
    closeComingSoonBtn.addEventListener('click', closeComingSoonModal);
  }
  
  // Close coming soon modal when clicking outside
  const comingSoonModal = document.getElementById('coming-soon-modal');
  if (comingSoonModal) {
    comingSoonModal.addEventListener('click', function(e) {
      if (e.target === comingSoonModal) {
        closeComingSoonModal();
      }
    });
  }
  
  // Notifications form
  const sendNotificationForm = document.getElementById('send-notification-form');
  if (sendNotificationForm) {
    console.log('✅ Notification form found, attaching event listener');
    sendNotificationForm.addEventListener('submit', sendNotification);
  } else {
    console.error('❌ Notification form not found!');
  }
  
  // Report issue form
  const reportIssueForm = document.getElementById('report-issue-form');
  if (reportIssueForm) {
    reportIssueForm.addEventListener('submit', submitReportIssue);
  }
  
  // Report issue submit button (outside form, so we need a separate handler)
  const reportSubmitBtn = document.querySelector('#report-issue-modal .btn-submit');
  if (reportSubmitBtn) {
    reportSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Trigger form submission
      if (reportIssueForm) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        reportIssueForm.dispatchEvent(submitEvent);
      }
    });
  }
  
  // Handle delete file button
  const deleteFileBtn = document.getElementById('delete-file');
  if (deleteFileBtn) {
    deleteFileBtn.addEventListener('click', function() {
      const photoInput = document.getElementById('item-photo');
      const filePreview = document.getElementById('file-preview');
      
      photoInput.value = '';
      filePreview.style.display = 'none';
      capturedBlob = null;
      
      // Clean up blob URLs
      const capturedPreview = document.getElementById('captured-preview');
      if (capturedPreview && capturedPreview.src.startsWith('blob:')) {
        URL.revokeObjectURL(capturedPreview.src);
        capturedPreview.src = '';
      }
      document.getElementById('preview-section').style.display = 'none';
    });
  }
}

// ================= MODAL MANAGEMENT =================
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  document.body.style.overflow = 'auto';
  document.documentElement.style.overflow = 'auto';
}

// ================= NOTIFICATIONS =================
async function loadNotifications() {
  try {
    const res = await fetch('/api/notifications', { cache: 'no-store' });
    const result = await res.json();
    
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    
    if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
      notificationsList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #94a3b8;">
          <p style="margin: 0; font-size: 1rem;">No notifications yet. Be the first to send a message!</p>
        </div>
      `;
      return;
    }
    
    notificationsList.innerHTML = result.data.map((notif, index) => {
      const date = new Date(notif.createdAt);
      const timeStr = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `
        <div class="notification-item" style="animation-delay: ${index * 0.1}s">
          <div class="notification-content">${escapeHtml(notif.message)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #64748b;">
            <span style="font-weight: 600; color: #667eea;">${escapeHtml(notif.createdBy)}</span>
            <span>${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load notifications:', err);
    const notificationsList = document.getElementById('notifications-list');
    if (notificationsList) {
      notificationsList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ef4444;">
          <p style="margin: 0;">Failed to load notifications. Please try again.</p>
        </div>
      `;
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function sendNotification(e) {
  e.preventDefault();
  console.log('📝 sendNotification called');
  
  const messageInput = document.getElementById('notification-message');
  const senderInput = document.getElementById('notification-sender');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  if (!messageInput || !submitBtn) {
    console.error('❌ Form elements not found');
    showToast('Form error. Please refresh the page.', 'error');
    return;
  }
  
  const message = messageInput.value.trim();
  const createdBy = senderInput ? senderInput.value.trim() : '';
  const finalSender = createdBy || currentUserName || 'Anonymous';
  
  if (!message) {
    showToast('Please enter a message', 'error');
    return;
  }
  
  // Disable button
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  
  try {
    console.log('📤 Sending notification:', { message, createdBy: finalSender });
    
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, createdBy: finalSender }),
    });
    
    console.log('📥 Response status:', res.status);
    
    const contentType = res.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await res.json();
    } else {
      const text = await res.text();
      console.error('❌ Response is not JSON:', text);
      throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}`);
    }
    
    console.log('📥 Response data:', result);
    
    if (!res.ok || !result.success) {
      throw new Error(result.error || 'Failed to send notification');
    }
    
    // Clear form
    messageInput.value = '';
    if (senderInput) senderInput.value = '';
    
    // Reload notifications
    await loadNotifications();
    
    showToast('Message sent successfully!', 'success');
  } catch (err) {
    console.error('❌ Error sending notification:', err);
    showToast(err.message || 'Failed to send message', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Specific modal functions
function openNotificationsModal() {
  closeHamburgerMenu();
  loadNotifications();
  openModal('notifications-modal');
}

function closeNotificationsModal() {
  closeModal('notifications-modal');
}

function openContributorsModal() {
  closeHamburgerMenu();
  openModal('contributors-modal');
}

function closeContributorsModal() {
  closeModal('contributors-modal');
}

function openReportIssueModal() {
  closeHamburgerMenu();
  openModal('report-issue-modal');
}

function closeReportIssueModal() {
  closeModal('report-issue-modal');
}

// ================= REPORT ISSUE =================
async function submitReportIssue(e) {
  e.preventDefault();
  
  const nameInput = document.getElementById('issue-name');
  const emailInput = document.getElementById('issue-email');
  const hostelInput = document.getElementById('issue-hostel');
  const typeInput = document.getElementById('issue-type');
  const messageInput = document.getElementById('issue-message');
  const statusDiv = document.getElementById('report-status');
  const submitBtn = document.querySelector('#report-issue-modal .btn-submit');
  
  if (!hostelInput || !typeInput || !messageInput) {
    showToast('Form error. Please refresh the page.', 'error');
    return;
  }
  
  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const hostel = hostelInput.value.trim();
  const type = typeInput.value.trim();
  const message = messageInput.value.trim();
  
  // Validate required fields
  if (!hostel || !type || !message) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  // Disable submit button
  const originalText = submitBtn ? submitBtn.textContent : 'Submit';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }
  
  try {
      const res = await fetch('/api/report-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name || currentUserName || 'Anonymous',
          email,
          hostel,
          type,
          message,
        }),
      });
      
      const result = await res.json();
      
      if (!res.ok || !result.success) {
        throw new Error('Failed to submit report');
      }
      
      // Show success message
      if (statusDiv) {
        statusDiv.textContent = 'Report submitted successfully!';
        statusDiv.className = 'report-status success';
        statusDiv.style.display = 'block';
      }
      
      showToast('Report submitted successfully!', 'success');
      
      // Clear form
      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      hostelInput.value = '';
      typeInput.value = '';
      messageInput.value = '';
      
      // Close modal after a delay
      setTimeout(() => {
        closeReportIssueModal();
        if (statusDiv) {
          statusDiv.style.display = 'none';
        }
      }, 2000);
    } catch (err) {
      console.error('Error submitting report:', err);
      if (statusDiv) {
        statusDiv.textContent = 'Failed to submit report. Please try again.';
        statusDiv.className = 'report-status error';
        statusDiv.style.display = 'block';
      }
      showToast(err.message || 'Failed to submit report', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
}

function contributeToProject() {
  closeHamburgerMenu();
  window.open('https://github.com/sathwikre/CampusMess', '_blank');
}

function openComingSoonModal() {
  openModal('coming-soon-modal');
}

function closeComingSoonModal() {
  closeModal('coming-soon-modal');
}

// ================= HAMBURGER MENU =================
function toggleHamburgerMenu(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('hamburger-dropdown');
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';
}

function closeHamburgerMenu() {
  const dropdown = document.getElementById('hamburger-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

// Initialize hamburger menu functionality
function initHamburgerMenu() {
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const dropdown = document.getElementById('hamburger-dropdown');
  
  if (!hamburgerMenu || !dropdown) return;
  
  // Toggle dropdown on hamburger click
  hamburgerMenu.addEventListener('click', toggleHamburgerMenu);
  
  // Prevent dropdown from closing when clicking inside it
  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Setup dropdown item click handlers
  const menuHandlers = {
    'contributors-option': openContributorsModal,
    'report-issue-option': openReportIssueModal,
    'notifications-option': openNotificationsModal,
    'contribute-option': contributeToProject
  };
  
  Object.entries(menuHandlers).forEach(([id, handler]) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        handler();
      });
    }
  });
  
  // Setup modal close buttons
  const closeButtons = {
    'close-contributors': closeContributorsModal,
    'close-notifications': closeNotificationsModal,
    'close-report-issue': closeReportIssueModal,
    'cancel-report': closeReportIssueModal
  };
  
  Object.entries(closeButtons).forEach(([id, handler]) => {
    const element = document.getElementById(id);
    if (element) {
      element.onclick = (e) => {
        e.stopPropagation();
        handler();
      };
    }
  });
  
  // Close modals when clicking outside content
  const modals = ['contributors-modal', 'report-issue-modal', 'notifications-modal'];
  modals.forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          closeModal(modalId);
        }
      };
    }
  });
  
  // Global click handler for hamburger menu
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('hamburger-menu');
    const dropdown = document.getElementById('hamburger-dropdown');
    const isModalOpen = Array.from(document.querySelectorAll('.modal, .overlay'))
      .some(el => window.getComputedStyle(el).display !== 'none');
    
    if (!isModalOpen && !menu.contains(e.target) && !(dropdown && dropdown.contains(e.target))) {
      closeHamburgerMenu();
    }
  });
}

// Initialize the app when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  init();
  initHamburgerMenu();
  
  // Ensure all modals are hidden on initial load
  ['contributors-modal', 'report-issue-modal', 'notifications-modal', 'coming-soon-modal'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  });
});

// ================= TOAST =================
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = msg;
  toast.className = `toast ${type}`;
  toast.style.display = 'flex';
  setTimeout(() => (toast.style.display = 'none'), 3000);
}
