/* ============================================
   Expense & Budget Visualizer — app.js
   ============================================ */
'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY    = 'expense_transactions';
const THEME_KEY      = 'expense_theme';
const LIMIT_KEY      = 'expense_limit';
const CUSTOM_CAT_KEY = 'expense_custom_categories';

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
const CAT_ICON = {
  Food:      '<i class="fa-solid fa-utensils"></i>',
  Transport: '<i class="fa-solid fa-bus"></i>',
  Fun:       '<i class="fa-solid fa-gamepad"></i>',
};
const CATEGORY_COLORS = {
  Food: '#f97316', Transport: '#3b82f6', Fun: '#a855f7',
};
const EXTRA_COLORS = [
  '#10b981','#ef4444','#f59e0b','#ec4899','#06b6d4','#84cc16','#6366f1','#14b8a6',
];

// ─── State ────────────────────────────────────────────────────────────────────
let transactions     = [];
let customCategories = [];
let spendingLimit    = 0;
let chartInstance    = null;
let displayedBalance = 0;
let tickerTimer      = null;

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const form             = document.getElementById('transaction-form');
const itemNameInput    = document.getElementById('item-name');
const amountInput      = document.getElementById('amount');
const limitInput       = document.getElementById('spending-limit');
const saveLimitBtn     = document.getElementById('save-limit-btn');
const limitCurrent     = document.getElementById('limit-current');
const limitVal         = document.getElementById('limit-val');
const transactionList  = document.getElementById('transaction-list');
const totalBalanceEl   = document.getElementById('total-balance');
const txCountEl        = document.getElementById('tx-count');
const txMonthEl        = document.getElementById('tx-month');
const catDotsEl        = document.getElementById('cat-dots');
const limitProgressWrap= document.getElementById('limit-progress-wrap');
const limitProgressBar = document.getElementById('limit-progress-bar');
const limitProgressText= document.getElementById('limit-progress-text');
const themeToggleBtn   = document.getElementById('theme-toggle');
const themeIcon        = document.getElementById('theme-icon');
const themeLabel       = document.getElementById('theme-label');
const sortSelect       = document.getElementById('sort-select');
const filterSelect     = document.getElementById('filter-select');
const searchInput      = document.getElementById('search-input');
const limitBanner      = document.getElementById('limit-banner');
const limitDisplay     = document.getElementById('limit-display');
const chartCanvas      = document.getElementById('expense-chart');
const chartEmpty       = document.getElementById('chart-empty');
const monthlySummaryEl = document.getElementById('monthly-summary');
const addCategoryBtn   = document.getElementById('add-category-btn');
const errName          = document.getElementById('err-name');
const errAmount        = document.getElementById('err-amount');
const errCategory      = document.getElementById('err-category');
const listCount        = document.getElementById('list-count');
const toastContainer   = document.getElementById('toast-container');
const submitBtn        = document.getElementById('submit-btn');

// Main custom select
const categoryInput       = document.getElementById('category');
const categoryTrigger     = document.getElementById('category-trigger');
const categoryTriggerText = document.getElementById('category-trigger-text');
const categoryList        = document.getElementById('category-list');

// Edit modal
const editModalOverlay        = document.getElementById('edit-modal-overlay');
const editIdInput             = document.getElementById('edit-id');
const editNameInput           = document.getElementById('edit-name');
const editAmountInput         = document.getElementById('edit-amount');
const editCategoryInput       = document.getElementById('edit-category');
const editCategoryTrigger     = document.getElementById('edit-category-trigger');
const editCategoryTriggerText = document.getElementById('edit-category-trigger-text');
const editCategoryList        = document.getElementById('edit-category-list');
const editModalConfirm        = document.getElementById('edit-modal-confirm');
const editModalCancel         = document.getElementById('edit-modal-cancel');
const errEditName             = document.getElementById('err-edit-name');
const errEditAmount           = document.getElementById('err-edit-amount');
const errEditCategory         = document.getElementById('err-edit-category');

// Manage categories modal
const modalOverlay        = document.getElementById('modal-overlay');
const modalCancelBtn      = document.getElementById('modal-cancel');
const modalConfirmBtn     = document.getElementById('modal-confirm');
const customCategoryInput = document.getElementById('custom-category-input');
const errCustomCat        = document.getElementById('err-custom-cat');
const catManageList       = document.getElementById('cat-manage-list');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRupiah(n) { return 'Rp ' + Math.abs(n).toLocaleString('id-ID'); }

function getCategoryColor(cat) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  const all = [...DEFAULT_CATEGORIES, ...customCategories];
  return EXTRA_COLORS[all.indexOf(cat) % EXTRA_COLORS.length] || '#6b7280';
}

function getAllCategories() { return [...DEFAULT_CATEGORIES, ...customCategories]; }

function toMonthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatMonthLabel(key) {
  const [y,m] = key.split('-');
  return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ─── LocalStorage ─────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY,    JSON.stringify(transactions));
  localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(customCategories));
  localStorage.setItem(LIMIT_KEY,      String(spendingLimit));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const cats= localStorage.getItem(CUSTOM_CAT_KEY);
  const lim = localStorage.getItem(LIMIT_KEY);
  transactions     = raw  ? JSON.parse(raw)  : [];
  customCategories = cats ? JSON.parse(cats) : [];
  spendingLimit    = lim  ? Number(lim)      : 0;
  if (spendingLimit > 0) limitInput.value = spendingLimit;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type='info', duration=3200) {
  const icons = {
    success:'<i class="fa-solid fa-circle-check"></i>',
    error:  '<i class="fa-solid fa-circle-xmark"></i>',
    info:   '<i class="fa-solid fa-circle-info"></i>',
    warn:   '<i class="fa-solid fa-triangle-exclamation"></i>',
  };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.setAttribute('role','status');
  t.innerHTML = `<span class="toast-icon">${icons[type]}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="toast-dismiss" aria-label="Dismiss">✕</button>`;
  const dismiss = () => {
    t.classList.add('leaving');
    t.addEventListener('animationend', () => t.remove(), {once:true});
  };
  t.querySelector('.toast-dismiss').addEventListener('click', dismiss);
  toastContainer.appendChild(t);
  if (duration > 0) setTimeout(dismiss, duration);
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.body.classList.remove('light','dark');
  document.body.classList.add(theme);
  const dark = theme === 'dark';
  themeToggleBtn.classList.toggle('is-dark', dark);
  themeToggleBtn.setAttribute('aria-checked', dark ? 'true':'false');
  themeIcon.innerHTML  = dark ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
  themeLabel.textContent = dark ? 'Dark' : 'Light';
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const dark = document.body.classList.contains('dark');
  applyTheme(dark ? 'light':'dark');
  renderChart();
  showToast(dark ? 'Switched to light mode':'Switched to dark mode','info',2000);
}

// ─── Balance Ticker ───────────────────────────────────────────────────────────
function animateBalance(target) {
  if (tickerTimer) cancelAnimationFrame(tickerTimer);
  if (target === 0) { totalBalanceEl.textContent = 'No spending yet'; displayedBalance = 0; return; }
  const start = displayedBalance, diff = target - start, dur = 500, t0 = performance.now();
  function tick(now) {
    const p = Math.min((now-t0)/dur, 1), e = 1-Math.pow(1-p,3);
    totalBalanceEl.textContent = formatRupiah(Math.round(start + diff*e));
    if (p < 1) tickerTimer = requestAnimationFrame(tick);
    else displayedBalance = target;
  }
  tickerTimer = requestAnimationFrame(tick);
}

// ─── Custom Select ────────────────────────────────────────────────────────────
function buildCustomSelect(list, trigger, triggerText, hiddenInput, categories, currentVal) {
  list.innerHTML = '';

  // Placeholder option
  const ph = document.createElement('li');
  ph.className = 'custom-select-option opt-placeholder';
  ph.setAttribute('role','option');
  ph.setAttribute('aria-selected', currentVal==='' ? 'true':'false');
  ph.dataset.value = '';
  ph.textContent = '— Select category —';
  ph.addEventListener('click', () => pickOption(list,trigger,triggerText,hiddenInput,''));
  list.appendChild(ph);

  categories.forEach(cat => {
    const color = getCategoryColor(cat);
    const icon  = CAT_ICON[cat] || '<i class="fa-solid fa-tag"></i>';
    const li = document.createElement('li');
    li.className = 'custom-select-option';
    li.setAttribute('role','option');
    li.setAttribute('aria-selected', cat===currentVal ? 'true':'false');
    li.dataset.value = cat;
    li.innerHTML = `<span class="opt-icon" style="background:${color}22;color:${color}">${icon}</span>${escapeHtml(cat)}`;
    li.addEventListener('click', () => pickOption(list,trigger,triggerText,hiddenInput,cat));
    list.appendChild(li);
  });

  updateTriggerDisplay(triggerText, currentVal);
}

function updateTriggerDisplay(triggerText, value) {
  if (value) {
    const color = getCategoryColor(value);
    const icon  = CAT_ICON[value] || '<i class="fa-solid fa-tag"></i>';
    triggerText.innerHTML = `<span class="custom-select-trigger-icon" style="color:${color}">${icon}</span> ${escapeHtml(value)}`;
  } else {
    triggerText.innerHTML = '<span class="opt-placeholder">— Select category —</span>';
  }
}

function pickOption(list, trigger, triggerText, hiddenInput, value) {
  hiddenInput.value = value;
  list.querySelectorAll('.custom-select-option').forEach(li =>
    li.setAttribute('aria-selected', li.dataset.value===value ? 'true':'false')
  );
  updateTriggerDisplay(triggerText, value);
  closeAllCustomSelects();
  trigger.classList.remove('input-error');
}

function openCustomSelect(list, trigger) {
  list.classList.add('open');
  trigger.classList.add('open');
  trigger.setAttribute('aria-expanded','true');
}

function closeCustomSelect(list, trigger) {
  list.classList.remove('open');
  trigger.classList.remove('open');
  trigger.setAttribute('aria-expanded','false');
}

function closeAllCustomSelects() {
  closeCustomSelect(categoryList, categoryTrigger);
  closeCustomSelect(editCategoryList, editCategoryTrigger);
}

function refreshCategoryDropdowns() {
  const all = getAllCategories();
  buildCustomSelect(categoryList, categoryTrigger, categoryTriggerText, categoryInput, all, categoryInput.value);
  buildCustomSelect(editCategoryList, editCategoryTrigger, editCategoryTriggerText, editCategoryInput, all, editCategoryInput.value);

  const filterVal = filterSelect.value;
  filterSelect.innerHTML = '<option value="all">All</option>';
  all.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    filterSelect.appendChild(opt);
  });
  filterSelect.value = filterVal || 'all';
}

// ─── Validation ───────────────────────────────────────────────────────────────
function clearErrors() {
  [errName, errAmount, errCategory].forEach(el => el.textContent='');
  [itemNameInput, amountInput].forEach(el => el.classList.remove('input-error'));
  categoryTrigger.classList.remove('input-error');
}

function validateForm() {
  clearErrors();
  let ok = true;
  if (!itemNameInput.value.trim()) {
    errName.textContent = 'Item name is required.';
    itemNameInput.classList.add('input-error'); ok = false;
  }
  const amt = parseFloat(amountInput.value);
  if (!amountInput.value || isNaN(amt) || amt <= 0) {
    errAmount.textContent = 'Enter a valid amount greater than 0.';
    amountInput.classList.add('input-error'); ok = false;
  }
  if (!categoryInput.value) {
    errCategory.textContent = 'Please select a category.';
    categoryTrigger.classList.add('input-error'); ok = false;
  }
  return ok;
}

// ─── Add Transaction ──────────────────────────────────────────────────────────
function addTransaction(e) {
  e.preventDefault();
  if (!validateForm()) return;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding…';

  setTimeout(() => {
    const newItem = {
      id: Date.now(), name: itemNameInput.value.trim(),
      amount: parseFloat(amountInput.value), category: categoryInput.value, timestamp: Date.now(),
    };
    const totalBefore = transactions.reduce((s,t)=>s+t.amount,0);
    const wasOver = spendingLimit>0 && totalBefore>spendingLimit;
    transactions.unshift(newItem);
    save();
    itemNameInput.value=''; amountInput.value='';
    // Reset custom select to placeholder
    categoryInput.value='';
    updateTriggerDisplay(categoryTriggerText,'');
    categoryList.querySelectorAll('.custom-select-option').forEach(li=>li.setAttribute('aria-selected','false'));
    clearErrors();
    submitBtn.disabled=false;
    submitBtn.innerHTML='<i class="fa-solid fa-plus"></i> Add Transaction';
    renderAll();

    const totalAfter = transactions.reduce((s,t)=>s+t.amount,0);
    const nowOver = spendingLimit>0 && totalAfter>spendingLimit;
    if (spendingLimit>0 && newItem.amount>spendingLimit)
      showToast(`"${newItem.name}" exceeds your limit of ${formatRupiah(spendingLimit)}!`,'warn',4000);
    else
      showToast(`"${newItem.name}" added — ${formatRupiah(newItem.amount)}`,'success');
    if (!wasOver && nowOver) showToast('Total spending is now over your limit!','error',5000);

    const card = document.querySelector('.balance-card');
    card.style.transform='scale(1.025)';
    setTimeout(()=>card.style.transform='',280);
  }, 300);
}

// ─── Delete (confirm) ─────────────────────────────────────────────────────────
function requestDelete(id, itemEl) {
  if (itemEl.dataset.confirming==='true') return;
  itemEl.dataset.confirming='true';
  itemEl.classList.add('shake');
  itemEl.addEventListener('animationend',()=>itemEl.classList.remove('shake'),{once:true});
  const right=itemEl.querySelector('.transaction-right');
  const orig=right.innerHTML;
  right.innerHTML=`<div class="confirm-row"><span>Delete?</span>
    <button class="confirm-yes">Yes</button><button class="confirm-no">No</button></div>`;
  right.querySelector('.confirm-yes').addEventListener('click',()=>confirmDelete(id,itemEl));
  right.querySelector('.confirm-no').addEventListener('click',()=>{
    itemEl.dataset.confirming='false'; right.innerHTML=orig;
    right.querySelector('.edit-btn')?.addEventListener('click',()=>openEditModal(id));
    right.querySelector('.delete-btn')?.addEventListener('click',()=>requestDelete(id,itemEl));
  });
}

function confirmDelete(id, el) {
  const item = transactions.find(t=>t.id===id);
  if (el) {
    el.classList.add('removing');
    el.addEventListener('animationend',()=>{
      transactions=transactions.filter(t=>t.id!==id); save(); renderAll();
      if (item) showToast(`"${item.name}" deleted`,'error',2500);
    },{once:true});
  } else {
    transactions=transactions.filter(t=>t.id!==id); save(); renderAll();
  }
}

// ─── Edit Transaction ─────────────────────────────────────────────────────────
function openEditModal(id) {
  const item = transactions.find(t=>t.id===id);
  if (!item) return;
  editIdInput.value=id; editNameInput.value=item.name; editAmountInput.value=item.amount;
  [errEditName,errEditAmount,errEditCategory].forEach(el=>el.textContent='');
  [editNameInput,editAmountInput].forEach(el=>el.classList.remove('input-error'));
  refreshCategoryDropdowns();
  // Set edit select value
  editCategoryInput.value = item.category;
  buildCustomSelect(editCategoryList,editCategoryTrigger,editCategoryTriggerText,editCategoryInput,getAllCategories(),item.category);
  editModalOverlay.classList.remove('hidden');
  requestAnimationFrame(()=>editNameInput.focus());
}

function closeEditModal() { editModalOverlay.classList.add('hidden'); }

function saveEdit() {
  [errEditName,errEditAmount,errEditCategory].forEach(el=>el.textContent='');
  let ok=true;
  if (!editNameInput.value.trim()) {
    errEditName.textContent='Name is required.'; editNameInput.classList.add('input-error'); ok=false;
  } else editNameInput.classList.remove('input-error');
  const amt=parseFloat(editAmountInput.value);
  if (!editAmountInput.value||isNaN(amt)||amt<=0) {
    errEditAmount.textContent='Enter a valid amount.'; editAmountInput.classList.add('input-error'); ok=false;
  } else editAmountInput.classList.remove('input-error');
  if (!editCategoryInput.value) { errEditCategory.textContent='Select a category.'; ok=false; }
  if (!ok) return;
  const id=Number(editIdInput.value), idx=transactions.findIndex(t=>t.id===id);
  if (idx===-1) return;
  transactions[idx]={...transactions[idx],name:editNameInput.value.trim(),amount:amt,category:editCategoryInput.value};
  save(); closeEditModal(); renderAll();
  showToast(`"${transactions[idx].name}" updated`,'success',2500);
}

// ─── Sort / Filter / Search ───────────────────────────────────────────────────
function getSortedFiltered() {
  const fv=filterSelect.value, sv=sortSelect.value, q=searchInput.value.trim().toLowerCase();
  let list = fv==='all' ? [...transactions] : transactions.filter(t=>t.category===fv);
  if (q) list=list.filter(t=>t.name.toLowerCase().includes(q));
  switch(sv) {
    case 'newest':      list.sort((a,b)=>b.timestamp-a.timestamp); break;
    case 'oldest':      list.sort((a,b)=>a.timestamp-b.timestamp); break;
    case 'amount-high': list.sort((a,b)=>b.amount-a.amount);       break;
    case 'amount-low':  list.sort((a,b)=>a.amount-b.amount);       break;
    case 'category':    list.sort((a,b)=>a.category.localeCompare(b.category)); break;
  }
  return list;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRupiah(n) { return 'Rp ' + Math.abs(n).toLocaleString('id-ID'); }
function getAllCategories() { return [...DEFAULT_CATEGORIES, ...customCategories]; }

function getCategoryColor(cat) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  const all = getAllCategories();
  return EXTRA_COLORS[all.indexOf(cat) % EXTRA_COLORS.length] || '#6b7280';
}

function toMonthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatMonthLabel(key) {
  const [y,m] = key.split('-');
  return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ─── LocalStorage ─────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY,    JSON.stringify(transactions));
  localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(customCategories));
  localStorage.setItem(LIMIT_KEY,      String(spendingLimit));
}

function load() {
  const raw=localStorage.getItem(STORAGE_KEY);
  const cats=localStorage.getItem(CUSTOM_CAT_KEY);
  const lim=localStorage.getItem(LIMIT_KEY);
  transactions     = raw  ? JSON.parse(raw)  : [];
  customCategories = cats ? JSON.parse(cats) : [];
  spendingLimit    = lim  ? Number(lim)      : 0;
  if (spendingLimit > 0) limitInput.value = spendingLimit;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type='info', dur=3200) {
  const icons = {
    success:'<i class="fa-solid fa-circle-check"></i>',
    error:  '<i class="fa-solid fa-circle-xmark"></i>',
    info:   '<i class="fa-solid fa-circle-info"></i>',
    warn:   '<i class="fa-solid fa-triangle-exclamation"></i>',
  };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role','status');
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span>
    <span class="toast-msg">${escapeHtml(msg)}</span>
    <button class="toast-dismiss" aria-label="Dismiss">✕</button>`;
  const dismiss = () => {
    el.classList.add('leaving');
    el.addEventListener('animationend',()=>el.remove(),{once:true});
  };
  el.querySelector('.toast-dismiss').addEventListener('click', dismiss);
  toastContainer.appendChild(el);
  if (dur > 0) setTimeout(dismiss, dur);
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.body.classList.remove('light','dark');
  document.body.classList.add(theme);
  const dark = theme === 'dark';
  themeToggleBtn.classList.toggle('is-dark', dark);
  themeToggleBtn.setAttribute('aria-checked', dark ? 'true':'false');
  themeIcon.innerHTML    = dark ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
  themeLabel.textContent = dark ? 'Dark' : 'Light';
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const dark = document.body.classList.contains('dark');
  applyTheme(dark ? 'light':'dark');
  renderChart();
  showToast(dark ? 'Switched to light mode':'Switched to dark mode','info',2000);
}

// ─── Balance Ticker ───────────────────────────────────────────────────────────
function animateBalance(target) {
  if (tickerTimer) cancelAnimationFrame(tickerTimer);
  if (target === 0) {
    totalBalanceEl.textContent = 'No spending yet';
    displayedBalance = 0; return;
  }
  const start=displayedBalance, diff=target-start, t0=performance.now();
  function tick(now) {
    const p=Math.min((now-t0)/500,1), e=1-Math.pow(1-p,3);
    totalBalanceEl.textContent = '−' + formatRupiah(Math.round(start+diff*e));
    if (p<1) tickerTimer = requestAnimationFrame(tick);
    else displayedBalance = target;
  }
  tickerTimer = requestAnimationFrame(tick);
}

// ─── Custom Select ────────────────────────────────────────────────────────────
function updateTriggerDisplay(triggerText, value) {
  if (value) {
    const color = getCategoryColor(value);
    const icon  = CAT_ICON[value] || '<i class="fa-solid fa-tag"></i>';
    triggerText.innerHTML = `<span class="custom-select-trigger-icon" style="color:${color}">${icon}</span> ${escapeHtml(value)}`;
  } else {
    triggerText.innerHTML = '<span class="opt-placeholder">— Select category —</span>';
  }
}

function buildCustomSelect(list, trigger, triggerText, hiddenInput, categories, currentVal) {
  list.innerHTML = '';
  const ph = document.createElement('li');
  ph.className = 'custom-select-option opt-placeholder';
  ph.setAttribute('role','option');
  ph.setAttribute('aria-selected', currentVal==='' ? 'true':'false');
  ph.dataset.value = '';
  ph.textContent = '— Select category —';
  ph.addEventListener('click', ()=>pickOption(list,trigger,triggerText,hiddenInput,''));
  list.appendChild(ph);

  categories.forEach(cat => {
    const color = getCategoryColor(cat);
    const icon  = CAT_ICON[cat] || '<i class="fa-solid fa-tag"></i>';
    const li = document.createElement('li');
    li.className = 'custom-select-option';
    li.setAttribute('role','option');
    li.setAttribute('aria-selected', cat===currentVal ? 'true':'false');
    li.dataset.value = cat;
    li.innerHTML = `<span class="opt-icon" style="background:${color}22;color:${color}">${icon}</span>${escapeHtml(cat)}`;
    li.addEventListener('click', ()=>pickOption(list,trigger,triggerText,hiddenInput,cat));
    list.appendChild(li);
  });

  updateTriggerDisplay(triggerText, currentVal);
}

function pickOption(list, trigger, triggerText, hiddenInput, value) {
  hiddenInput.value = value;
  list.querySelectorAll('.custom-select-option').forEach(li =>
    li.setAttribute('aria-selected', li.dataset.value===value ? 'true':'false')
  );
  updateTriggerDisplay(triggerText, value);
  closeAllCustomSelects();
  trigger.classList.remove('input-error');
}

function openCustomSelect(list, trigger) {
  list.classList.add('open'); trigger.classList.add('open');
  trigger.setAttribute('aria-expanded','true');
}

function closeCustomSelect(list, trigger) {
  list.classList.remove('open'); trigger.classList.remove('open');
  trigger.setAttribute('aria-expanded','false');
}

function closeAllCustomSelects() {
  closeCustomSelect(categoryList, categoryTrigger);
  closeCustomSelect(editCategoryList, editCategoryTrigger);
}

function refreshCategoryDropdowns() {
  const all = getAllCategories();
  buildCustomSelect(categoryList, categoryTrigger, categoryTriggerText, categoryInput, all, categoryInput.value);
  buildCustomSelect(editCategoryList, editCategoryTrigger, editCategoryTriggerText, editCategoryInput, all, editCategoryInput.value);

  const fv = filterSelect.value;
  filterSelect.innerHTML = '<option value="all">All</option>';
  all.forEach(cat => {
    const o = document.createElement('option');
    o.value = cat; o.textContent = cat;
    filterSelect.appendChild(o);
  });
  filterSelect.value = fv || 'all';
}

// ─── Validation ───────────────────────────────────────────────────────────────
function clearErrors() {
  [errName, errAmount, errCategory].forEach(el => el.textContent='');
  [itemNameInput, amountInput].forEach(el => el.classList.remove('input-error'));
  categoryTrigger.classList.remove('input-error');
}

function validateForm() {
  clearErrors(); let ok = true;
  if (!itemNameInput.value.trim()) {
    errName.textContent = 'Item name is required.';
    itemNameInput.classList.add('input-error'); ok = false;
  }
  const amt = parseFloat(amountInput.value);
  if (!amountInput.value || isNaN(amt) || amt <= 0) {
    errAmount.textContent = 'Enter a valid amount greater than 0.';
    amountInput.classList.add('input-error'); ok = false;
  }
  if (!categoryInput.value) {
    errCategory.textContent = 'Please select a category.';
    categoryTrigger.classList.add('input-error'); ok = false;
  }
  return ok;
}

// ─── Add Transaction ──────────────────────────────────────────────────────────
function addTransaction(e) {
  e.preventDefault();
  if (!validateForm()) return;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding…';
  setTimeout(() => {
    const newItem = {
      id: Date.now(), name: itemNameInput.value.trim(),
      amount: parseFloat(amountInput.value), category: categoryInput.value, timestamp: Date.now(),
    };
    const totalBefore = transactions.reduce((s,t)=>s+t.amount,0);
    const wasOver = spendingLimit>0 && totalBefore>spendingLimit;
    transactions.unshift(newItem); save();

    itemNameInput.value=''; amountInput.value='';
    categoryInput.value='';
    updateTriggerDisplay(categoryTriggerText, '');
    categoryList.querySelectorAll('.custom-select-option')
      .forEach(li => li.setAttribute('aria-selected','false'));
    clearErrors();
    submitBtn.disabled=false;
    submitBtn.innerHTML='<i class="fa-solid fa-plus"></i> Add Transaction';
    renderAll();

    const totalAfter = transactions.reduce((s,t)=>s+t.amount,0);
    const nowOver = spendingLimit>0 && totalAfter>spendingLimit;
    if (spendingLimit>0 && newItem.amount>spendingLimit)
      showToast(`"${newItem.name}" exceeds your limit of ${formatRupiah(spendingLimit)}!`,'warn',4000);
    else
      showToast(`"${newItem.name}" added — ${formatRupiah(newItem.amount)}`,'success');
    if (!wasOver && nowOver) showToast('Total spending is now over your limit!','error',5000);
    const card = document.querySelector('.balance-card');
    card.style.transform='scale(1.025)';
    setTimeout(()=>card.style.transform='',280);
  }, 300);
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function requestDelete(id, itemEl) {
  if (itemEl.dataset.confirming==='true') return;
  itemEl.dataset.confirming='true';
  itemEl.classList.add('shake');
  itemEl.addEventListener('animationend',()=>itemEl.classList.remove('shake'),{once:true});
  const right=itemEl.querySelector('.transaction-right'), orig=right.innerHTML;
  right.innerHTML=`<div class="confirm-row"><span>Delete?</span>
    <button class="confirm-yes">Yes</button><button class="confirm-no">No</button></div>`;
  right.querySelector('.confirm-yes').addEventListener('click',()=>confirmDelete(id,itemEl));
  right.querySelector('.confirm-no').addEventListener('click',()=>{
    itemEl.dataset.confirming='false'; right.innerHTML=orig;
    right.querySelector('.edit-btn')?.addEventListener('click',()=>openEditModal(id));
    right.querySelector('.delete-btn')?.addEventListener('click',()=>requestDelete(id,itemEl));
  });
}

function confirmDelete(id, el) {
  const item = transactions.find(t=>t.id===id);
  if (el) {
    el.classList.add('removing');
    el.addEventListener('animationend',()=>{
      transactions=transactions.filter(t=>t.id!==id); save(); renderAll();
      if (item) showToast(`"${item.name}" deleted`,'error',2500);
    },{once:true});
  } else { transactions=transactions.filter(t=>t.id!==id); save(); renderAll(); }
}

// ─── Edit Transaction ─────────────────────────────────────────────────────────
function openEditModal(id) {
  const item = transactions.find(t=>t.id===id);
  if (!item) return;
  editIdInput.value=id; editNameInput.value=item.name; editAmountInput.value=item.amount;
  [errEditName,errEditAmount,errEditCategory].forEach(el=>el.textContent='');
  [editNameInput,editAmountInput].forEach(el=>el.classList.remove('input-error'));
  editCategoryInput.value = item.category;
  refreshCategoryDropdowns();
  editModalOverlay.classList.remove('hidden');
  requestAnimationFrame(()=>editNameInput.focus());
}

function closeEditModal() { editModalOverlay.classList.add('hidden'); }

function saveEdit() {
  [errEditName,errEditAmount,errEditCategory].forEach(el=>el.textContent='');
  let ok=true;
  if (!editNameInput.value.trim()) {
    errEditName.textContent='Name is required.';
    editNameInput.classList.add('input-error'); ok=false;
  } else editNameInput.classList.remove('input-error');
  const amt=parseFloat(editAmountInput.value);
  if (!editAmountInput.value||isNaN(amt)||amt<=0) {
    errEditAmount.textContent='Enter a valid amount.';
    editAmountInput.classList.add('input-error'); ok=false;
  } else editAmountInput.classList.remove('input-error');
  if (!editCategoryInput.value) { errEditCategory.textContent='Select a category.'; ok=false; }
  if (!ok) return;
  const id=Number(editIdInput.value), idx=transactions.findIndex(t=>t.id===id);
  if (idx===-1) return;
  transactions[idx]={...transactions[idx],name:editNameInput.value.trim(),amount:amt,category:editCategoryInput.value};
  save(); closeEditModal(); renderAll();
  showToast(`"${transactions[idx].name}" updated`,'success',2500);
}

// ─── Sort / Filter / Search ───────────────────────────────────────────────────
function getSortedFiltered() {
  const fv=filterSelect.value, sv=sortSelect.value, q=searchInput.value.trim().toLowerCase();
  let list = fv==='all' ? [...transactions] : transactions.filter(t=>t.category===fv);
  if (q) list=list.filter(t=>t.name.toLowerCase().includes(q));
  switch(sv) {
    case 'newest':      list.sort((a,b)=>b.timestamp-a.timestamp); break;
    case 'oldest':      list.sort((a,b)=>a.timestamp-b.timestamp); break;
    case 'amount-high': list.sort((a,b)=>b.amount-a.amount);       break;
    case 'amount-low':  list.sort((a,b)=>a.amount-b.amount);       break;
    case 'category':    list.sort((a,b)=>a.category.localeCompare(b.category)); break;
  }
  return list;
}

// ─── Render: Transaction List ─────────────────────────────────────────────────
function renderTransactions() {
  const list = getSortedFiltered();
  transactionList.innerHTML = '';
  if (list.length===0) {
    const el=document.createElement('div'); el.className='empty-state';
    const q=searchInput.value.trim();
    el.innerHTML = q
      ? `<span class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></span>No results for "<strong>${escapeHtml(q)}</strong>"`
      : '<span class="empty-icon"><i class="fa-solid fa-receipt"></i></span>No transactions yet. Add one above!';
    transactionList.appendChild(el);
    listCount.textContent=''; return;
  }
  listCount.textContent=`${list.length} item${list.length!==1?'s':''}`;
  list.forEach((item,i)=>{
    const over=spendingLimit>0&&item.amount>spendingLimit;
    const color=getCategoryColor(item.category);
    const icon=CAT_ICON[item.category]||'<i class="fa-solid fa-tag"></i>';
    const date=new Date(item.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const div=document.createElement('div');
    div.className='transaction-item'+(over?' over-limit':'');
    div.dataset.id=item.id; div.dataset.confirming='false';
    div.style.animationDelay=`${i*0.04}s`;
    div.innerHTML=`
      <div class="cat-dot" style="background:${color}22;color:${color}">${icon}</div>
      <div class="transaction-info">
        <div class="transaction-name">${escapeHtml(item.name)}</div>
        <div class="transaction-meta">
          <span class="category-badge" style="background:${color}">${escapeHtml(item.category)}</span>
          <span>${date}</span>
          ${over?'<span class="over-tag"><i class="fa-solid fa-triangle-exclamation"></i> Over limit</span>':''}
        </div>
      </div>
      <div class="transaction-right">
        <span class="transaction-amount">${formatRupiah(item.amount)}</span>
        <div class="item-actions">
          <button class="edit-btn" aria-label="Edit ${escapeHtml(item.name)}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="delete-btn" aria-label="Delete ${escapeHtml(item.name)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
    div.querySelector('.edit-btn').addEventListener('click',()=>openEditModal(item.id));
    div.querySelector('.delete-btn').addEventListener('click',()=>requestDelete(item.id,div));
    transactionList.appendChild(div);
  });
}

// ─── Render: Balance ──────────────────────────────────────────────────────────
function renderBalance() {
  const total = transactions.reduce((s,t)=>s+t.amount,0);
  animateBalance(total);
  txCountEl.textContent = transactions.length;
  const thisMonth=toMonthKey(Date.now());
  const mc=transactions.filter(t=>toMonthKey(t.timestamp)===thisMonth).length;
  txMonthEl.textContent=`${mc} this month`;

  if (spendingLimit>0&&total>spendingLimit) {
    limitDisplay.textContent=formatRupiah(spendingLimit);
    limitBanner.classList.remove('hidden');
  } else { limitBanner.classList.add('hidden'); }

  if (spendingLimit>0) {
    const pct=Math.min((total/spendingLimit)*100,100);
    limitProgressWrap.classList.remove('hidden');
    limitProgressBar.style.width=pct+'%';
    limitProgressText.textContent=`${formatRupiah(total)} / ${formatRupiah(spendingLimit)}`;
    limitProgressBar.className='limit-progress-bar'+(pct>=100?' over':pct>=75?' warn':'');
  } else { limitProgressWrap.classList.add('hidden'); }

  const totals={};
  transactions.forEach(t=>{ totals[t.category]=(totals[t.category]||0)+t.amount; });
  const sorted=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,4);
  catDotsEl.innerHTML=sorted.map(([cat])=>{
    const color=getCategoryColor(cat);
    const icon=CAT_ICON[cat]||'<i class="fa-solid fa-tag"></i>';
    return `<div class="cat-dot-item"><div class="cat-dot-circle" style="background:${color}"></div>${icon} ${escapeHtml(cat)}</div>`;
  }).join('');
}

// ─── Render: Chart ────────────────────────────────────────────────────────────
function renderChart() {
  const totals={};
  transactions.forEach(t=>{ totals[t.category]=(totals[t.category]||0)+t.amount; });
  const labels=Object.keys(totals), data=Object.values(totals), colors=labels.map(getCategoryColor);
  if (!labels.length) {
    chartEmpty.classList.remove('hidden'); chartCanvas.classList.add('hidden');
    if (chartInstance) { chartInstance.destroy(); chartInstance=null; } return;
  }
  chartEmpty.classList.add('hidden'); chartCanvas.classList.remove('hidden');
  if (chartInstance) chartInstance.destroy();
  const surf=getComputedStyle(document.body).getPropertyValue('--surface').trim();
  const txt =getComputedStyle(document.body).getPropertyValue('--text').trim();
  chartInstance=new Chart(chartCanvas,{
    type:'doughnut',
    data:{labels,datasets:[{data,backgroundColor:colors.map(c=>c+'dd'),borderColor:surf||'#0e1a16',borderWidth:4,hoverOffset:12,hoverBorderWidth:0}]},
    options:{responsive:true,cutout:'58%',animation:{animateScale:true,duration:600},
      plugins:{
        legend:{position:'bottom',labels:{color:txt||'#e8f5f0',padding:14,font:{size:12,weight:'600'},usePointStyle:true,pointStyleWidth:10}},
        tooltip:{callbacks:{label:ctx=>{
          const pct=((ctx.raw/data.reduce((a,b)=>a+b,0))*100).toFixed(1);
          return `  ${ctx.label}: ${formatRupiah(ctx.raw)} (${pct}%)`;
        }}},
      }},
  });
}

// ─── Render: Monthly Summary ──────────────────────────────────────────────────
function renderMonthlySummary() {
  if (!transactions.length) {
    monthlySummaryEl.innerHTML='<div class="empty-state"><span class="empty-icon"><i class="fa-regular fa-calendar-xmark"></i></span>No data yet.</div>'; return;
  }
  const monthly={};
  transactions.forEach(t=>{ const k=toMonthKey(t.timestamp); monthly[k]=(monthly[k]||0)+t.amount; });
  const sorted=Object.keys(monthly).sort((a,b)=>b.localeCompare(a));
  monthlySummaryEl.innerHTML=sorted.map(key=>`
    <div class="month-row">
      <span class="month-label"><i class="fa-regular fa-calendar"></i> ${formatMonthLabel(key)}</span>
      <span class="month-amount">${formatRupiah(monthly[key])}</span>
    </div>`).join('');
}

function renderAll() {
  renderBalance(); renderTransactions(); renderChart(); renderMonthlySummary();
}

// ─── Spending Limit ───────────────────────────────────────────────────────────
function updateLimitDisplay() {
  if (spendingLimit>0) { limitVal.textContent=formatRupiah(spendingLimit); limitCurrent.classList.remove('hidden'); }
  else limitCurrent.classList.add('hidden');
}

function saveSpendingLimit() {
  const val=parseFloat(limitInput.value);
  if (!isNaN(val)&&val>0) {
    spendingLimit=val; save(); updateLimitDisplay(); renderAll();
    showToast(`Spending limit set to ${formatRupiah(val)}`,'success');
  } else if (limitInput.value==='') {
    spendingLimit=0; save(); updateLimitDisplay(); renderAll();
    showToast('Spending limit cleared','info',2000);
  } else { showToast('Enter a valid amount greater than 0','error',2500); }
}

// ─── Manage Categories Modal ──────────────────────────────────────────────────
function openModal() {
  customCategoryInput.value=''; errCustomCat.textContent='';
  renderCatManageList();
  modalOverlay.classList.remove('hidden');
  requestAnimationFrame(()=>customCategoryInput.focus());
}

function closeModal() { modalOverlay.classList.add('hidden'); }

function renderCatManageList() {
  catManageList.innerHTML='';

  // Default (read-only)
  DEFAULT_CATEGORIES.forEach(cat=>{
    const color=getCategoryColor(cat);
    const icon=CAT_ICON[cat]||'<i class="fa-solid fa-tag"></i>';
    const row=document.createElement('div');
    row.className='cat-manage-item';
    row.innerHTML=`
      <div class="cat-manage-dot" style="background:${color}"></div>
      <span class="opt-icon" style="color:${color};background:${color}22;border-radius:6px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:0.75rem">${icon}</span>
      <span class="cat-manage-name">${escapeHtml(cat)}</span>
      <span class="cat-default-badge">default</span>`;
    catManageList.appendChild(row);
  });

  // Custom (editable/deletable)
  customCategories.forEach((cat,idx)=>{
    const color=getCategoryColor(cat);
    const row=document.createElement('div');
    row.className='cat-manage-item';
    row.dataset.idx=idx;
    row.innerHTML=`
      <div class="cat-manage-dot" style="background:${color}"></div>
      <span class="cat-manage-name" id="cat-name-${idx}">${escapeHtml(cat)}</span>
      <div class="cat-actions">
        <button class="cat-btn edit" title="Rename"><i class="fa-solid fa-pen"></i></button>
        <button class="cat-btn del" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>`;

    row.querySelector('.cat-btn.edit').addEventListener('click',()=>startRenameCategory(row,idx));
    row.querySelector('.cat-btn.del').addEventListener('click', ()=>deleteCategory(idx));
    catManageList.appendChild(row);
  });

  if (!customCategories.length) {
    const p=document.createElement('p');
    p.style.cssText='font-size:0.8rem;color:var(--text-3);text-align:center;padding:0.5rem 0';
    p.textContent='No custom categories yet.';
    catManageList.appendChild(p);
  }
}

function startRenameCategory(row, idx) {
  const nameSpan = row.querySelector('.cat-manage-name');
  const current  = customCategories[idx];
  const actions  = row.querySelector('.cat-actions');
  nameSpan.innerHTML = `<input type="text" value="${escapeHtml(current)}" maxlength="30" />`;
  const input = nameSpan.querySelector('input');
  input.focus(); input.select();

  actions.innerHTML = `
    <button class="cat-btn save" title="Save"><i class="fa-solid fa-check"></i></button>
    <button class="cat-btn del" title="Cancel"><i class="fa-solid fa-xmark"></i></button>`;

  actions.querySelector('.cat-btn.save').addEventListener('click',()=>saveRenameCategory(idx, input.value.trim()));
  actions.querySelector('.cat-btn.del').addEventListener('click',()=>renderCatManageList());
  input.addEventListener('keydown',e=>{
    if (e.key==='Enter') { e.preventDefault(); saveRenameCategory(idx, input.value.trim()); }
    if (e.key==='Escape') renderCatManageList();
  });
}

function saveRenameCategory(idx, newName) {
  if (!newName) { showToast('Name cannot be empty','error',2000); return; }
  const all = getAllCategories().map(c=>c.toLowerCase());
  // Exclude the current name from duplicate check
  const others = all.filter((_,i)=>i !== DEFAULT_CATEGORIES.length+idx);
  if (others.includes(newName.toLowerCase())) { showToast('Category already exists','error',2000); return; }

  const old = customCategories[idx];
  customCategories[idx] = newName;
  // Update existing transactions that used the old name
  transactions.forEach(t=>{ if (t.category===old) t.category=newName; });
  save(); refreshCategoryDropdowns(); renderAll(); renderCatManageList();
  showToast(`Renamed "${old}" to "${newName}"`,'success',2500);
}

function deleteCategory(idx) {
  const name = customCategories[idx];
  const inUse = transactions.some(t=>t.category===name);
  if (inUse) { showToast(`"${name}" is used by transactions — reassign them first`,'warn',4000); return; }
  customCategories.splice(idx,1);
  save(); refreshCategoryDropdowns(); renderAll(); renderCatManageList();
  showToast(`Category "${name}" deleted`,'error',2500);
}

function confirmCustomCategory() {
  const name=customCategoryInput.value.trim();
  errCustomCat.textContent='';
  if (!name) { errCustomCat.textContent='Category name cannot be empty.'; return; }
  const all=getAllCategories().map(c=>c.toLowerCase());
  if (all.includes(name.toLowerCase())) { errCustomCat.textContent='This category already exists.'; return; }
  customCategories.push(name);
  save(); refreshCategoryDropdowns(); renderAll();
  customCategoryInput.value='';
  renderCatManageList();
  showToast(`Category "${name}" added!`,'success',2500);
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
form.addEventListener('submit', addTransaction);
themeToggleBtn.addEventListener('click', toggleTheme);
sortSelect.addEventListener('change', renderTransactions);
filterSelect.addEventListener('change', renderTransactions);
searchInput.addEventListener('input', renderTransactions);
addCategoryBtn.addEventListener('click', openModal);
modalCancelBtn.addEventListener('click', closeModal);
modalConfirmBtn.addEventListener('click', confirmCustomCategory);
saveLimitBtn.addEventListener('click', saveSpendingLimit);
editModalConfirm.addEventListener('click', saveEdit);
editModalCancel.addEventListener('click', closeEditModal);

// Custom select toggles
categoryTrigger.addEventListener('click', ()=>{
  const isOpen=categoryList.classList.contains('open');
  closeAllCustomSelects();
  if (!isOpen) openCustomSelect(categoryList,categoryTrigger);
});

editCategoryTrigger.addEventListener('click', ()=>{
  const isOpen=editCategoryList.classList.contains('open');
  closeAllCustomSelects();
  if (!isOpen) openCustomSelect(editCategoryList,editCategoryTrigger);
});

// Close selects when clicking outside
document.addEventListener('click', e=>{
  if (!e.target.closest('#category-select-wrap')) closeCustomSelect(categoryList,categoryTrigger);
  if (!e.target.closest('#edit-category-select-wrap')) closeCustomSelect(editCategoryList,editCategoryTrigger);
});

modalOverlay.addEventListener('click',e=>{ if(e.target===modalOverlay) closeModal(); });
editModalOverlay.addEventListener('click',e=>{ if(e.target===editModalOverlay) closeEditModal(); });

document.addEventListener('keydown',e=>{
  if (e.key==='Escape') { closeModal(); closeEditModal(); closeAllCustomSelects(); }
});

customCategoryInput.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();confirmCustomCategory();} });
editNameInput.addEventListener('keydown',  e=>{ if(e.key==='Enter'){e.preventDefault();saveEdit();} });
editAmountInput.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();saveEdit();} });
limitInput.addEventListener('keydown',     e=>{ if(e.key==='Enter'){e.preventDefault();saveSpendingLimit();} });

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  const theme=localStorage.getItem(THEME_KEY)||'dark';
  applyTheme(theme);
  load();
  refreshCategoryDropdowns();
  renderAll();
  updateLimitDisplay();
})();
