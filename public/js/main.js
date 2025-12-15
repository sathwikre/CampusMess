// ================= STATE =================
let currentHostel = 'Ellora';
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

// ================= RENDER =================
function renderMeals() {
  document.querySelectorAll('.meal-section').forEach(section => {
    const mealType = section.dataset.meal; // breakfast | lunch | dinner
    const content = section.querySelector('.meal-content');

    // Reset UI
    content.innerHTML = '';
    section.classList.remove('expanded');

    // If this meal is not open
    if (openMeal !== mealType) {
      content.innerHTML = '<p class="placeholder">Tap to view items</p>';
      return;
    }

    section.classList.add('expanded');

    // 🔴 IMPORTANT FIX: normalize hostel & mealType
    const menu = menusToday.find(m =>
      m.hostel?.toLowerCase() === currentHostel.toLowerCase() &&
      m.mealType?.toLowerCase() === mealType.toLowerCase()
    );

    // No menu or no items
    if (!menu || !Array.isArray(menu.items) || menu.items.length === 0) {
      content.innerHTML = '<p class="no-items">Menu not added yet</p>';
    } else {
      const ul = document.createElement('ul');
      ul.className = 'items-list';

      menu.items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'item-entry';

        li.innerHTML = `
          <div class="item-text">• ${item.text || 'Unknown item'}</div>
          ${item.createdBy ? `<div class="item-by">by ${item.createdBy}</div>` : ''}
          ${
            item.imagePath
              ? `<img src="${item.imagePath}" class="item-image" loading="lazy">`
              : ''
          }
        `;

        ul.appendChild(li);
      });

      content.appendChild(ul);
    }

    // Add Item button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-item';
    addBtn.textContent = 'Add Item';
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      openAddItemForm(mealType);
    });

    content.appendChild(addBtn);
  });
}

// ================= ADD ITEM FORM =================
function openAddItemForm(mealType) {
  currentMealForForm = mealType;
  document.getElementById('add-item-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('add-item-form').reset();
}

function closeAddItemForm() {
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

    const result = await res.json();
    if (!result.success) throw new Error(result.error);

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

// ================= INIT =================
function init() {
  initUserName();
  loadTodayMenus().then(renderMeals);

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
}

window.addEventListener('DOMContentLoaded', init);

// ================= TOAST =================
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = msg;
  toast.className = `toast ${type}`;
  toast.style.display = 'flex';
  setTimeout(() => (toast.style.display = 'none'), 3000);
}
