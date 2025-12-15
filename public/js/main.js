// State management
let currentHostel = 'Ellora';
let openMeal = null; // null | 'breakfast' | 'lunch' | 'dinner'
let currentMealForForm = null; // Current meal type for the add item form
let menusToday = []; // Cached API result

// Camera state
let currentStream = null;
let capturedBlob = null;

async function loadTodayMenus() {
  try {
    const response = await fetch('/api/menus/today', { cache: 'no-store' });
    const result = await response.json();
    if (result.success) {
      menusToday = result.data || [];
    } else if (result.message === "No menu found") {
      menusToday = [];
    } else {
      console.error('Failed to load menus:', result.message);
      menusToday = [];
    }
  } catch (error) {
    console.error('Error loading menus:', error);
    menusToday = [];
  }
}

// Initialize user name from localStorage or prompt
function initUserName() {
  currentUserName = localStorage.getItem('currentUserName');
  if (!currentUserName) {
    currentUserName = prompt('Please enter your name:');
    if (currentUserName && currentUserName.trim()) {
      localStorage.setItem('currentUserName', currentUserName.trim());
    } else {
      // If no name provided, use a default or handle gracefully
      currentUserName = '';
      localStorage.setItem('currentUserName', currentUserName);
    }
  }
}

function renderMeals() {
  document.querySelectorAll('.meal-section').forEach((section, index) => {
    section.style.setProperty('--index', index);
    const mealType = section.dataset.meal;
    const mealContent = section.querySelector('.meal-content');

    if (openMeal === mealType) {
      // This meal is open - show content
      const mealMenu = menusToday.find(menu =>
        menu.hostel === currentHostel && menu.mealType === mealType
      );

      // Update card appearance when expanded
      section.classList.add('expanded');
      mealContent.innerHTML = '';

      if (mealMenu && mealMenu.items && Array.isArray(mealMenu.items) && mealMenu.items.length > 0) {
        // Show items list
        const itemsList = document.createElement('ul');
        itemsList.className = 'items-list';

        mealMenu.items.forEach((item, itemIndex) => {
            const li = document.createElement('li');
            li.className = 'item-entry';
            li.style.setProperty('--item-index', itemIndex);
            li.style.animationDelay = `${itemIndex * 50}ms`;

            // Item text with bullet point
            const textDiv = document.createElement('div');
            textDiv.className = 'item-text';
            textDiv.innerHTML = `
              <span class="item-bullet">•</span>
              <span class="item-name">${item.text || 'Unknown item'}</span>
            `;
            li.appendChild(textDiv);

            // Created by with user icon
            if (item.createdBy) {
              const byDiv = document.createElement('div');
              byDiv.className = 'item-by';
              byDiv.innerHTML = `
                <i class="fas fa-user-edit"></i>
                <span>${item.createdBy}</span>
              `;
              li.appendChild(byDiv);
            }

            // Date & time
            if (item.createdAt) {
              const dateDiv = document.createElement('div');
              dateDiv.className = 'item-date';
              dateDiv.innerHTML = `
                <i class="fas fa-calendar-alt"></i>
                <span>${formatCreatedAt(item.createdAt)}</span>
              `;
              li.appendChild(dateDiv);
            }

            // Delete button only if current user is the creator
            if (item.createdBy === currentUserName) {
              const deleteBtn = document.createElement('button');
              deleteBtn.className = 'item-delete-btn';
              deleteBtn.innerHTML = '🗑️';
              deleteBtn.title = 'Delete this item';
              deleteBtn.dataset.itemId = item._id;
              deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteItem(e.target.dataset.itemId);
              });
              li.appendChild(deleteBtn);
            }

            // Image with preview
            const imagePath = item.thumbPath || item.imagePath;
            if (imagePath) {
              const imgContainer = document.createElement('div');
              imgContainer.className = 'item-image-container';
              const img = document.createElement('img');
              img.className = 'item-image';
              img.src = imagePath;
              img.alt = item.text || 'Unknown item';
              img.loading = 'lazy';
              imgContainer.appendChild(img);

              // Add click to enlarge functionality
              img.addEventListener('click', () => {
                const modal = document.createElement('div');
                modal.className = 'image-modal';
                modal.innerHTML = '<div class="modal-content">' +
                  '<img src="' + imagePath + '" alt="' + (item.text || 'Unknown item') + '" />' +
                  '<button class="modal-close">' +
                  '<i class="fas fa-times"></i>' +
                  '</button>' +
                  '</div>';
                document.body.appendChild(modal);

                // Close modal on click outside or close button
                const closeModal = () => document.body.removeChild(modal);
                modal.querySelector('.modal-close').addEventListener('click', closeModal);
                modal.addEventListener('click', (e) => {
                  if (e.target === modal) closeModal();
                });
              });

              li.appendChild(imgContainer);
            }

            itemsList.appendChild(li);
          });
        mealContent.appendChild(itemsList);
      } else {
        // Show "Menu for today has not been added yet"
        const noItems = document.createElement('p');
        noItems.className = 'no-items';
        noItems.textContent = 'Menu for today has not been added yet';
        mealContent.appendChild(noItems);
      }

        // Add the "Add item" button with icon
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add-item';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Item';
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openAddItemForm(mealType);
        });
        mealContent.appendChild(addBtn);
    } else {
      // This meal is closed - show placeholder
      section.classList.remove('expanded');
      mealContent.innerHTML = '<p class="placeholder">Tap to view items</p>';
    }
  });
}

function openAddItemForm(mealType) {
  currentMealForForm = mealType;
  const overlay = document.getElementById('add-item-overlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Reset form fields
  const form = document.getElementById('add-item-form');
  form.reset();

  // Reset submit button state
  const submitBtn = document.getElementById('submit-item');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Add Item';

  // Clear status message
  hideAddStatus();

  // Reset camera state
  closeCamera();

  // Hide file preview
  document.getElementById('file-preview').style.display = 'none';

  document.getElementById('item-name').focus();
}

function closeAddItemForm() {
  const overlay = document.getElementById('add-item-overlay');
  overlay.style.display = 'none';
  document.body.style.overflow = 'auto';
  // Reset form
  document.getElementById('add-item-form').reset();
  hideAddStatus();
  // Close camera
  closeCamera();
  currentMealForForm = null;
}

async function submitNewItem(event) {
  event.preventDefault();

  const itemInput = document.querySelector('#item-name');
  const item = itemInput.value.trim();

  if (!item) {
    showAddStatus('Please enter an item name.', 'error');
    return;
  }

  const creatorInput = document.querySelector('#item-creator');
  const creatorName = creatorInput.value.trim();
  const createdBy = creatorName;

  // Generate current date & time in IST
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const formData = new FormData();
  formData.append('hostel', currentHostel);
  formData.append('mealType', currentMealForForm);
  formData.append('singleItem', item);
  formData.append('createdBy', createdBy);
  formData.append('createdAt', now);

  // Use captured image if available, else file input
  if (capturedBlob) {
    formData.append('photo', capturedBlob, 'capture.png');
  } else {
    const photoInput = document.querySelector('#item-photo');
    if (photoInput.files[0]) {
      formData.append('photo', photoInput.files[0]);
    }
  }

  const submitBtn = document.querySelector('#submit-item');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';
  hideAddStatus();

  try {
    const response = await fetch('/api/menus', {
      method: 'POST',
      body: formData,
    });

    let result;
    if (response.ok) {
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // If not JSON, treat as error
        const text = await response.text();
        console.error('Unexpected response:', text);
        throw new Error('Server returned non-JSON response');
      }
    } else {
      // Response not OK, try to get error message
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('Server error response:', text);
        throw new Error(`Upload failed (${response.status})`);
      }
    }

    if (result.success) {
      // Reset button state before closing modal
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Item';
      closeAddItemForm();
      // Refresh data and re-render
      await loadTodayMenus();
      renderMeals();
    } else {
      showAddStatus(`Error: ${result.error || 'Failed to add item'}`, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Item';
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Upload failed', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Item';
  }
}

function showAddStatus(message, type) {
  const status = document.querySelector('#add-status');
  status.textContent = message;
  status.className = `add-status ${type}`;
  status.style.display = 'block';
}

function hideAddStatus() {
  const status = document.querySelector('#add-status');
  if (status) {
    status.style.display = 'none';
  }
}

// Camera functions
async function openCamera() {
  const cameraSection = document.getElementById('camera-section');
  const video = document.getElementById('camera-preview');
  const captureBtn = document.getElementById('capture-btn');
  const previewSection = document.getElementById('preview-section');

  try {
    const constraints = {
      video: { facingMode: 'environment' } // Prefer rear camera on mobile
    };

    // Fallback to any camera if rear not available
    currentStream = await navigator.mediaDevices.getUserMedia(constraints).catch(async () => {
      return await navigator.mediaDevices.getUserMedia({ video: true });
    });

    video.srcObject = currentStream;
    cameraSection.style.display = 'block';
    captureBtn.style.display = 'inline-flex';
    previewSection.style.display = 'none';
  } catch (error) {
    console.error('Error accessing camera:', error);
    showAddStatus('Camera access not available. Please upload a photo from your device.', 'error');
  }
}

function captureImage() {
  const video = document.getElementById('camera-preview');
  const canvas = document.getElementById('capture-canvas');
  const ctx = canvas.getContext('2d');
  const previewImg = document.getElementById('captured-preview');
  const captureBtn = document.getElementById('capture-btn');
  const previewSection = document.getElementById('preview-section');

  // Set canvas size to video size
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw current video frame to canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert to blob
  canvas.toBlob((blob) => {
    capturedBlob = blob;
    const url = URL.createObjectURL(blob);
    previewImg.src = url;

    // Hide video, show preview
    video.style.display = 'none';
    captureBtn.style.display = 'none';
    previewSection.style.display = 'block';

    // Stop video stream temporarily
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  }, 'image/png');
}

function retakeImage() {
  const video = document.getElementById('camera-preview');
  const captureBtn = document.getElementById('capture-btn');
  const previewSection = document.getElementById('preview-section');
  const previewImg = document.getElementById('captured-preview');

  // Clear captured blob and preview
  if (capturedBlob) {
    URL.revokeObjectURL(previewImg.src);
    capturedBlob = null;
  }

  // Hide preview, show video again
  previewSection.style.display = 'none';
  video.style.display = 'block';
  captureBtn.style.display = 'inline-flex';

  // Restart camera
  openCamera();
}

function closeCamera() {
  const cameraSection = document.getElementById('camera-section');
  const video = document.getElementById('camera-preview');
  const previewImg = document.getElementById('captured-preview');

  // Stop stream
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }

  // Clear video and preview
  video.srcObject = null;
  if (capturedBlob) {
    URL.revokeObjectURL(previewImg.src);
    capturedBlob = null;
  }

  // Hide camera section
  cameraSection.style.display = 'none';
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  const filePreview = document.getElementById('file-preview');
  const fileName = document.getElementById('file-name');

  if (file) {
    fileName.textContent = file.name;
    filePreview.style.display = 'flex';
  } else {
    filePreview.style.display = 'none';
  }
}

function deleteSelectedFile() {
  const photoInput = document.getElementById('item-photo');
  const filePreview = document.getElementById('file-preview');

  // Clear the file input
  photoInput.value = '';
  filePreview.style.display = 'none';
}

function init() {
  // Initialize user name
  initUserName();

  // Meal section click handlers
  document.querySelectorAll('.meal-section').forEach(section => {
    section.addEventListener('click', async (e) => {
      // Don't trigger if clicking on form elements
      if (e.target.closest('.btn-add-item')) {
        return;
      }

      const mealType = section.dataset.meal;

      // If clicking the same meal that's already open, close it
      if (openMeal === mealType) {
        openMeal = null;
        closeAddItemForm();
        renderMeals();
        return;
      }

      // Open this meal
      openMeal = mealType;

      // Load menus if not loaded yet
      if (menusToday.length === 0) {
        await loadTodayMenus();
      }

      // Render the updated state
      renderMeals();
    });
  });

  // Hostel buttons
  document.querySelectorAll('.hostel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hostel = btn.dataset.hostel;
      if (hostel !== currentHostel) {
        currentHostel = hostel;
        openMeal = null; // Reset open meal when switching hostels
        document.querySelectorAll('.hostel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderMeals();
      }
    });
  });

  // Add item form
  document.getElementById('add-item-form').addEventListener('submit', submitNewItem);

  document.getElementById('cancel-add').addEventListener('click', () => {
    closeAddItemForm();
  });

  // Close modal when clicking overlay
  document.getElementById('add-item-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'add-item-overlay') {
      closeAddItemForm();
    }
  });

  // Camera button event listeners
  document.getElementById('use-camera').addEventListener('click', openCamera);
  document.getElementById('capture-btn').addEventListener('click', captureImage);
  document.getElementById('retake-btn').addEventListener('click', retakeImage);

  // Hamburger menu event listeners
  document.getElementById('hamburger-menu').addEventListener('click', toggleHamburgerMenu);
  document.getElementById('contributors-option').addEventListener('click', openContributorsModal);
  document.getElementById('report-issue-option').addEventListener('click', reportIssue);
  document.getElementById('notifications-option').addEventListener('click', openNotificationsModal);
  document.getElementById('contribute-option').addEventListener('click', contributeToProject);

  // Contributors modal event listeners
  document.getElementById('close-contributors').addEventListener('click', closeContributorsModal);
  document.getElementById('contributors-modal').addEventListener('click', (e) => {
    if (e.target.id === 'contributors-modal') {
      closeContributorsModal();
    }
  });

  // Report issue modal event listeners
  document.getElementById('report-issue-form').addEventListener('submit', submitReportIssue);
  document.getElementById('cancel-report').addEventListener('click', closeReportIssueModal);
  document.getElementById('report-issue-modal').addEventListener('click', (e) => {
    if (e.target.id === 'report-issue-modal') {
      closeReportIssueModal();
    }
  });

  // Notifications modal event listeners
  document.getElementById('post-notification').addEventListener('click', handleNotificationSubmit);
  document.getElementById('close-notifications').addEventListener('click', closeNotificationsModal);
  document.getElementById('notifications-modal').addEventListener('click', (e) => {
    if (e.target.id === 'notifications-modal') {
      closeNotificationsModal();
    }
  });

  // Close hamburger menu when clicking outside
  document.addEventListener('click', (e) => {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const dropdown = document.getElementById('hamburger-dropdown');
    if (!hamburgerMenu.contains(e.target) && !dropdown.contains(e.target)) {
      closeHamburgerMenu();
    }
  });
}

// Add toast notification function
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  
  toastMessage.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'flex';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// Delete item function
async function deleteItem(itemId) {
  if (!confirm('Do you want to delete this item?')) {
    return;
  }

  try {
    const response = await fetch(`/api/menus/item/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userName: currentUserName }),
    });

    const result = await response.json();

    if (result.success) {
      showToast('Item deleted successfully', 'success');
      // Refresh data and re-render
      await loadTodayMenus();
      renderMeals();
    } else {
      showToast(`Error: ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    showToast('Error deleting item', 'error');
  }
}

// Helper function to format createdAt string
function formatCreatedAt(createdAtStr) {
  if (!createdAtStr) return '';
  // Parse the string (assuming format like "12/6/2025, 10:45:30 AM")
  const date = new Date(createdAtStr);
  if (isNaN(date)) return createdAtStr; // Fallback to original if parsing fails

  const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr} • ${timeStr}`;
}

// Animation triggers
function animateMealOpen(section) {
  section.classList.add('meal-opening');
  setTimeout(() => section.classList.remove('meal-opening'), 300);
}

// Hamburger menu functions
function toggleHamburgerMenu() {
  const dropdown = document.getElementById('hamburger-dropdown');
  const isVisible = dropdown.style.display === 'block';
  if (isVisible) {
    closeHamburgerMenu();
  } else {
    dropdown.style.display = 'block';
  }
}

function closeHamburgerMenu() {
  const dropdown = document.getElementById('hamburger-dropdown');
  dropdown.style.display = 'none';
}

function openContributorsModal() {
  closeHamburgerMenu();
  const modal = document.getElementById('contributors-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function reportIssue() {
  closeHamburgerMenu();
  const modal = document.getElementById('report-issue-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function contributeToProject() {
  closeHamburgerMenu();
  window.open('https://github.com/sathwikre/CampusMess.git', '_blank');
}

function closeContributorsModal() {
  const modal = document.getElementById('contributors-modal');
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

function closeReportIssueModal() {
  const modal = document.getElementById('report-issue-modal');
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
  // Clear the form
  document.getElementById('report-issue-form').reset();
  hideReportStatus();
}

async function submitReportIssue(event) {
  event.preventDefault();

  const message = document.getElementById('issue-message').value.trim();
  if (!message) {
    showReportStatus('Message is required.', 'error');
    return;
  }

  const name = document.getElementById('issue-name').value.trim();
  const email = document.getElementById('issue-email').value.trim();
  const hostel = document.getElementById('issue-hostel').value;
  const type = document.getElementById('issue-type').value;

  const submitBtn = document.getElementById('submit-report');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  hideReportStatus();

  try {
    const response = await fetch('/api/report-issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, hostel, type, message }),
    });

    const result = await response.json();

    if (result.success) {
      showToast('Issue submitted successfully', 'success');
      closeReportIssueModal();
    } else {
      showReportStatus(`Error: ${result.error}`, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Issue';
    }
  } catch (error) {
    console.error('Error submitting issue:', error);
    showReportStatus('Failed to submit issue. Please try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Issue';
  }
}

function showReportStatus(message, type) {
  const status = document.getElementById('report-status');
  status.textContent = message;
  status.className = `report-status ${type}`;
  status.style.display = 'block';
}

function hideReportStatus() {
  const status = document.getElementById('report-status');
  if (status) {
    status.style.display = 'none';
  }
}

// Notifications functions
function openNotificationsModal() {
  closeHamburgerMenu();
  loadNotifications();
  const modal = document.getElementById('notifications-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('notification-message').focus();
}

function closeNotificationsModal() {
  const modal = document.getElementById('notifications-modal');
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
  document.getElementById('notification-message').value = '';
}

async function loadNotifications() {
  const notificationsList = document.getElementById('notifications-list');
  notificationsList.innerHTML = '<div class="loading-notifications">Loading notifications...</div>';

  try {
    const response = await fetch('/api/notifications');
    const result = await response.json();

    if (result.success) {
      const notifications = result.data || [];
      renderNotifications(notifications);
    } else {
      console.error('Failed to load notifications:', result.message);
      notificationsList.innerHTML = '<div class="error-notifications">Unable to load notifications</div>';
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
    notificationsList.innerHTML = '<div class="error-notifications">Unable to load notifications</div>';
  }
}

function renderNotifications(notifications) {
  const notificationsList = document.getElementById('notifications-list');
  notificationsList.innerHTML = '';

  if (notifications.length === 0) {
    notificationsList.innerHTML = '<div class="no-notifications">No notifications yet</div>';
    return;
  }

  notifications.forEach((notification, index) => {
    const notificationElement = document.createElement('div');
    notificationElement.className = 'notification-item';
    notificationElement.style.animationDelay = `${index * 0.1}s`;

    const date = new Date(notification.createdAt);
    const formattedDate = date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    notificationElement.innerHTML = `
      <div class="notification-content">${notification.message}</div>
      <div class="notification-meta">by ${notification.createdBy} • ${formattedDate} • ${formattedTime}</div>
    `;

    notificationsList.appendChild(notificationElement);
  });
}

async function handleNotificationSubmit(event) {
  event.preventDefault();

  const message = document.getElementById('notification-message').value.trim();
  if (!message) {
    showToast('Please enter a notification message', 'error');
    return;
  }

  const postBtn = document.getElementById('post-notification');
  postBtn.disabled = true;
  postBtn.textContent = 'Posting...';

  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        createdBy: currentUserName || 'Anonymous',
      }),
    });

    const result = await response.json();

    if (result.success) {
      document.getElementById('notification-message').value = '';
      // Prepend the new notification to the list
      const notificationsList = document.getElementById('notifications-list');
      const newNotification = result.data;

      // Remove loading/error messages if present
      const loadingEl = notificationsList.querySelector('.loading-notifications, .error-notifications, .no-notifications');
      if (loadingEl) {
        notificationsList.innerHTML = '';
      }

      const notificationElement = document.createElement('div');
      notificationElement.className = 'notification-item';
      notificationElement.style.animationDelay = '0s';

      const date = new Date(newNotification.createdAt);
      const formattedDate = date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const formattedTime = date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      notificationElement.innerHTML = `
        <div class="notification-content">${newNotification.message}</div>
        <div class="notification-meta">by ${newNotification.createdBy} • ${formattedDate} • ${formattedTime}</div>
      `;

      notificationsList.insertBefore(notificationElement, notificationsList.firstChild);

      showToast('Notification posted successfully', 'success');
    } else {
      showToast(`Error: ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('Error posting notification:', error);
    showToast('Failed to post notification', 'error');
  } finally {
    postBtn.disabled = false;
    postBtn.textContent = 'Post';
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
