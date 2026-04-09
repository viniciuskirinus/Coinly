import { getConfig, getCategories, getTransactions, getPaymentMethods, putCacheEntry, invalidateCache } from '../modules/data-service.js';
import { dispatch } from '../modules/github-api.js';
import { formatCurrency, formatDate, getCurrentYearMonth } from '../modules/format.js';
import { getState, setState, addPendingSync, resolvePendingSync } from '../modules/state.js';
import { showAlert, showConfirm } from '../app.js';

let viewState = {
  yearMonth: getCurrentYearMonth(),
  allTransactions: [],
  filtered: [],
  selectedIds: new Set(),
  config: null,
  categories: null,
  paymentMethods: null,
  filters: { person: '', type: '', category: '' }
};

export async function initStatement() {
  const section = document.getElementById('view-statement');
  section.innerHTML = '<div style="text-align:center;padding:var(--sp-10)"><span class="spinner spinner-lg"></span></div>';

  try {
    const [config, categories, paymentMethods] = await Promise.all([
      getConfig(),
      getCategories(),
      getPaymentMethods()
    ]);

    if (!config || !categories) {
      section.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Não foi possível carregar os dados.</p></div>';
      return;
    }

    viewState.config = config;
    viewState.categories = categories;
    viewState.paymentMethods = paymentMethods;
    viewState.yearMonth = getCurrentYearMonth();
    viewState.selectedIds = new Set();
    viewState.filters = { person: '', type: '', category: '' };

    renderShell(section);
    await loadTransactions(section);
  } catch (err) {
    console.error('initStatement error:', err);
    section.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Erro ao carregar extrato.</p></div>';
  }
}

function renderShell(section) {
  const { config, categories } = viewState;
  const people = config.people || [];
  const allCats = [...(categories.expense || []), ...(categories.income || [])];
  const uniqueCats = [...new Set(allCats.map(c => c.name))];

  section.innerHTML = `
    <div class="section-header">
      <h2>📋 Extrato</h2>
      <div style="display:flex;align-items:center;gap:var(--sp-2)">
        <button class="btn btn-ghost" id="stmt-prev-month" title="Mês anterior" aria-label="Mês anterior">←</button>
        <span id="stmt-month-label" style="font-weight:700;min-width:100px;text-align:center"></span>
        <button class="btn btn-ghost" id="stmt-next-month" title="Próximo mês" aria-label="Próximo mês">→</button>
      </div>
    </div>

    <div class="filter-bar">
      <select id="stmt-filter-person" class="form-select">
        <option value="">Todas as pessoas</option>
        ${people.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
      </select>
      <select id="stmt-filter-type" class="form-select">
        <option value="">Todos os tipos</option>
        <option value="income">Receitas</option>
        <option value="expense">Despesas</option>
      </select>
      <select id="stmt-filter-category" class="form-select">
        <option value="">Todas as categorias</option>
        ${uniqueCats.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>

    <div id="stmt-bulk-bar" class="bulk-bar" style="display:none">
      <span id="stmt-bulk-count">0 selecionado(s)</span>
      <button class="btn" id="stmt-bulk-delete">🗑️ Excluir selecionados</button>
    </div>

    <div id="stmt-loading" style="text-align:center;padding:var(--sp-8);display:none">
      <span class="spinner spinner-lg"></span>
    </div>

    <div id="stmt-content">
      <div class="data-table-wrapper" id="stmt-table-wrapper"></div>
      <div class="txn-card-list" id="stmt-card-list"></div>
    </div>
  `;

  updateMonthLabel();
  bindShellEvents(section);
}

function updateMonthLabel() {
  const label = document.getElementById('stmt-month-label');
  if (!label) return;
  const [y, m] = viewState.yearMonth.split('-');
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  label.textContent = `${monthNames[parseInt(m) - 1]} ${y}`;
}

function bindShellEvents(section) {
  section.querySelector('#stmt-prev-month').addEventListener('click', () => changeMonth(-1, section));
  section.querySelector('#stmt-next-month').addEventListener('click', () => changeMonth(1, section));

  section.querySelector('#stmt-filter-person').addEventListener('change', (e) => {
    viewState.filters.person = e.target.value;
    applyFiltersAndRender(section);
  });
  section.querySelector('#stmt-filter-type').addEventListener('change', (e) => {
    viewState.filters.type = e.target.value;
    applyFiltersAndRender(section);
  });
  section.querySelector('#stmt-filter-category').addEventListener('change', (e) => {
    viewState.filters.category = e.target.value;
    applyFiltersAndRender(section);
  });

  section.querySelector('#stmt-bulk-delete').addEventListener('click', () => {
    confirmBulkDelete(section);
  });
}

async function changeMonth(delta, section) {
  const [y, m] = viewState.yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  viewState.yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  viewState.selectedIds = new Set();
  updateMonthLabel();
  await loadTransactions(section);
}

async function loadTransactions(section) {
  const loading = section.querySelector('#stmt-loading');
  const content = section.querySelector('#stmt-content');
  if (loading) loading.style.display = '';
  if (content) content.style.display = 'none';

  invalidateCache(`txn-${viewState.yearMonth}`);

  try {
    const data = await getTransactions(viewState.yearMonth);
    viewState.allTransactions = data?.transactions || [];
    viewState.allTransactions.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    viewState.allTransactions = [];
  }

  if (loading) loading.style.display = 'none';
  if (content) content.style.display = '';

  applyFiltersAndRender(section);
}

function applyFiltersAndRender(section) {
  const { person, type, category } = viewState.filters;
  let txns = [...viewState.allTransactions];

  if (person) txns = txns.filter(t => t.person === person);
  if (type) txns = txns.filter(t => t.type === type);
  if (category) txns = txns.filter(t => t.category === category);

  viewState.filtered = txns;
  viewState.selectedIds = new Set();

  renderTable(section);
  renderCardList(section);
  updateBulkBar(section);
}

function getSyncBadge(txnId) {
  const state = getState();
  const sync = state.pendingSyncs.get(txnId);
  if (!sync) return '';
  const labels = { syncing: '⏳ Sincronizando', synced: '✅ Sincronizado', failed: '❌ Falhou' };
  return `<span class="sync-badge ${sync.status}">${labels[sync.status] || ''}</span>`;
}

function getCategoryIcon(categoryName) {
  const { categories } = viewState;
  if (!categories) return '';
  const allCats = [...(categories.expense || []), ...(categories.income || [])];
  const cat = allCats.find(c => c.name === categoryName);
  return cat?.icon || '📁';
}

function renderTable(section) {
  const wrapper = section.querySelector('#stmt-table-wrapper');
  if (!wrapper) return;

  const txns = viewState.filtered;

  if (txns.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Nenhuma transação encontrada</p>
      </div>
    `;
    return;
  }

  const allChecked = txns.length > 0 && txns.every(t => viewState.selectedIds.has(t.id));

  wrapper.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th class="checkbox-cell"><input type="checkbox" id="stmt-check-all" ${allChecked ? 'checked' : ''}></th>
          <th>Data</th>
          <th>Descrição</th>
          <th>Categoria</th>
          <th>Valor</th>
          <th>Pessoa</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${txns.map(t => `
          <tr data-id="${t.id}">
            <td class="checkbox-cell"><input type="checkbox" class="stmt-row-check" data-id="${t.id}" ${viewState.selectedIds.has(t.id) ? 'checked' : ''}></td>
            <td>${formatDate(t.date)}</td>
            <td>${escapeHtml(t.description)} ${getSyncBadge(t.id)}</td>
            <td>${getCategoryIcon(t.category)} ${escapeHtml(t.category)}${t.subcategory ? ' / ' + escapeHtml(t.subcategory) : ''}</td>
            <td class="${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}</td>
            <td>${escapeHtml(t.person || '')}</td>
            <td>
              <button class="btn-icon stmt-edit" data-id="${t.id}" title="Editar">✏️</button>
              <button class="btn-icon stmt-delete" data-id="${t.id}" title="Excluir">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  wrapper.querySelector('#stmt-check-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    txns.forEach(t => {
      if (checked) viewState.selectedIds.add(t.id);
      else viewState.selectedIds.delete(t.id);
    });
    renderTable(section);
    renderCardList(section);
    updateBulkBar(section);
  });

  wrapper.querySelectorAll('.stmt-row-check').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = parseId(e.target.dataset.id);
      if (e.target.checked) viewState.selectedIds.add(id);
      else viewState.selectedIds.delete(id);
      updateBulkBar(section);
    });
  });

  wrapper.querySelectorAll('.stmt-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(parseId(btn.dataset.id), section));
  });

  wrapper.querySelectorAll('.stmt-delete').forEach(btn => {
    btn.addEventListener('click', () => confirmSingleDelete(parseId(btn.dataset.id), section));
  });
}

function renderCardList(section) {
  const list = section.querySelector('#stmt-card-list');
  if (!list) return;

  const txns = viewState.filtered;

  if (txns.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Nenhuma transação encontrada</p>
      </div>
    `;
    return;
  }

  const allChecked = txns.length > 0 && txns.every(t => viewState.selectedIds.has(t.id));

  let html = `
    <div class="stmt-select-all-row">
      <label class="stmt-select-all-label">
        <input type="checkbox" id="stmt-card-check-all" ${allChecked ? 'checked' : ''}>
        <span>Selecionar todos (${txns.length})</span>
      </label>
    </div>
  `;

  html += txns.map(t => `
    <div class="txn-card ${viewState.selectedIds.has(t.id) ? 'txn-card-selected' : ''}" data-id="${t.id}">
      <div class="txn-card-top">
        <label class="txn-card-check">
          <input type="checkbox" class="stmt-card-check" data-id="${t.id}" ${viewState.selectedIds.has(t.id) ? 'checked' : ''}>
        </label>
        <span class="txn-card-icon">${getCategoryIcon(t.category)}</span>
        <div class="txn-card-info">
          <div class="txn-card-desc">${escapeHtml(t.description)} ${getSyncBadge(t.id)}</div>
          <div class="txn-card-meta">${formatDate(t.date)} · ${escapeHtml(t.category)}${t.person ? ' · ' + escapeHtml(t.person) : ''}</div>
        </div>
      </div>
      <div class="txn-card-bottom">
        <span class="txn-card-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
          ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
        </span>
        <div class="txn-card-actions">
          <button class="btn-icon stmt-edit" data-id="${t.id}" title="Editar">✏️</button>
          <button class="btn-icon stmt-delete" data-id="${t.id}" title="Excluir">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');

  list.innerHTML = html;

  list.querySelector('#stmt-card-check-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    txns.forEach(t => {
      if (checked) viewState.selectedIds.add(t.id);
      else viewState.selectedIds.delete(t.id);
    });
    renderCardList(section);
    renderTable(section);
    updateBulkBar(section);
  });

  list.querySelectorAll('.stmt-card-check').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = parseId(e.target.dataset.id);
      if (e.target.checked) viewState.selectedIds.add(id);
      else viewState.selectedIds.delete(id);
      const card = e.target.closest('.txn-card');
      if (card) card.classList.toggle('txn-card-selected', e.target.checked);
      updateBulkBar(section);

      const checkAll = list.querySelector('#stmt-card-check-all');
      if (checkAll) checkAll.checked = txns.every(t => viewState.selectedIds.has(t.id));
    });
  });

  list.querySelectorAll('.stmt-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(parseId(btn.dataset.id), section));
  });

  list.querySelectorAll('.stmt-delete').forEach(btn => {
    btn.addEventListener('click', () => confirmSingleDelete(parseId(btn.dataset.id), section));
  });
}

function updateBulkBar(section) {
  const bar = section.querySelector('#stmt-bulk-bar');
  const count = viewState.selectedIds.size;
  if (!bar) return;

  bar.style.display = count > 0 ? '' : 'none';
  const countSpan = bar.querySelector('#stmt-bulk-count');
  if (countSpan) countSpan.textContent = `${count} selecionado(s)`;
}

// --- Edit Modal ---

function openEditModal(id, section) {
  const txn = viewState.allTransactions.find(t => t.id === id);
  if (!txn) return;

  const { config, categories, paymentMethods } = viewState;
  const people = config.people || [];
  const methods = paymentMethods?.methods || [];
  const cats = categories[txn.type] || [];
  const cat = cats.find(c => c.name === txn.category);
  const subs = cat?.subcategories || [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'stmt-edit-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Editar Transação</h3>
        <button class="modal-close" id="stmt-edit-close">✕</button>
      </div>
      <form id="stmt-edit-form" novalidate>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <div class="toggle-group" id="edit-type-toggle">
            <button type="button" class="toggle-option ${txn.type === 'expense' ? 'active' : ''}" data-value="expense">Despesa</button>
            <button type="button" class="toggle-option ${txn.type === 'income' ? 'active' : ''}" data-value="income">Receita</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-date">Data</label>
          <input type="date" id="edit-date" class="form-input" value="${txn.date}" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-description">Descrição</label>
          <input type="text" id="edit-description" class="form-input" value="${escapeAttr(txn.description)}" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-amount">Valor (R$)</label>
          <input type="number" id="edit-amount" class="form-input" step="0.01" min="0.01" value="${txn.amount}" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-category">Categoria</label>
          <select id="edit-category" class="form-select" required>
            <option value="">Selecione...</option>
            ${cats.map(c => `<option value="${c.name}" ${c.name === txn.category ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group" id="edit-subcategory-group" style="${subs.length > 0 ? '' : 'display:none'}">
          <label class="form-label" for="edit-subcategory">Subcategoria</label>
          <select id="edit-subcategory" class="form-select">
            <option value="">Nenhuma</option>
            ${subs.map(s => `<option value="${s}" ${s === txn.subcategory ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>

        ${people.length > 1 ? `
        <div class="form-group">
          <label class="form-label" for="edit-person">Pessoa</label>
          <select id="edit-person" class="form-select" required>
            ${people.map(p => `<option value="${p.name}" ${p.name === txn.person ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label" for="edit-payment">Método de Pagamento</label>
          <select id="edit-payment" class="form-select" required>
            ${methods.map(m => `<option value="${m}" ${m === txn.paymentMethod ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-notes">Observação</label>
          <textarea id="edit-notes" class="form-input" rows="2">${escapeHtml(txn.notes || '')}</textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="stmt-edit-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  let editType = txn.type;

  const toggleBtns = overlay.querySelectorAll('#edit-type-toggle .toggle-option');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editType = btn.dataset.value;
      const newCats = categories[editType] || [];
      const catSelect = overlay.querySelector('#edit-category');
      catSelect.innerHTML = '<option value="">Selecione...</option>' +
        newCats.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
      overlay.querySelector('#edit-subcategory-group').style.display = 'none';
    });
  });

  overlay.querySelector('#edit-category').addEventListener('change', (e) => {
    const catName = e.target.value;
    const currentCats = categories[editType] || [];
    const selectedCat = currentCats.find(c => c.name === catName);
    const subList = selectedCat?.subcategories || [];
    const subGroup = overlay.querySelector('#edit-subcategory-group');
    const subSelect = overlay.querySelector('#edit-subcategory');

    if (subList.length > 0) {
      subGroup.style.display = '';
      subSelect.innerHTML = '<option value="">Nenhuma</option>' +
        subList.map(s => `<option value="${s}">${s}</option>`).join('');
    } else {
      subGroup.style.display = 'none';
      subSelect.innerHTML = '<option value="">Nenhuma</option>';
    }
  });

  const closeModal = () => overlay.remove();
  overlay.querySelector('#stmt-edit-close').addEventListener('click', closeModal);
  overlay.querySelector('#stmt-edit-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  overlay.querySelector('#stmt-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleEdit(id, overlay, section, editType);
  });
}

async function handleEdit(id, overlay, section, editType) {
  const dateVal = overlay.querySelector('#edit-date').value;
  const description = overlay.querySelector('#edit-description').value.trim();
  const amount = parseFloat(overlay.querySelector('#edit-amount').value);
  const category = overlay.querySelector('#edit-category').value;
  const subcategory = overlay.querySelector('#edit-subcategory')?.value || '';
  const personSelect = overlay.querySelector('#edit-person');
  const person = personSelect ? personSelect.value : (viewState.config.people[0]?.name || '');
  const paymentMethod = overlay.querySelector('#edit-payment').value;
  const notes = overlay.querySelector('#edit-notes').value.trim();

  if (!dateVal || !description || !amount || amount <= 0 || !category || !paymentMethod) {
    showAlert('Preencha todos os campos obrigatórios.', 'error');
    return;
  }

  const original = viewState.allTransactions.find(t => t.id === id);
  const updated = {
    id,
    date: dateVal,
    description,
    amount,
    type: editType,
    category,
    subcategory,
    person,
    paymentMethod,
    notes,
    createdAt: original?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const idx = viewState.allTransactions.findIndex(t => t.id === id);
  if (idx !== -1) viewState.allTransactions[idx] = updated;

  const cacheKey = `txn-${viewState.yearMonth}`;
  const maxId = Math.max(0, ...viewState.allTransactions.map(t => (typeof t.id === 'number' && t.id > 0) ? t.id : 0));
  putCacheEntry(cacheKey, {
    _schema_version: 1,
    month: viewState.yearMonth,
    lastId: maxId,
    transactions: [...viewState.allTransactions]
  });

  overlay.remove();
  applyFiltersAndRender(section);
  showAlert('Transação atualizada!', 'success');

  addPendingSync(id, 'edit');

  try {
    const result = await dispatch('edit-transaction', updated, viewState.yearMonth);
    resolvePendingSync(id, result?.success ?? false);
    if (!result?.success) {
      showAlert('Erro ao sincronizar edição: ' + (result?.error || 'desconhecido'), 'warning');
    }
  } catch (err) {
    console.error('edit dispatch error:', err);
    resolvePendingSync(id, false);
  }
}

// --- Delete ---

async function confirmSingleDelete(id, section) {
  const txn = viewState.allTransactions.find(t => t.id === id);
  if (!txn) return;

  const ok = await showConfirm('Excluir transação', `Tem certeza que deseja excluir "${escapeHtml(txn.description)}"?`, { confirmText: 'Excluir', danger: true });
  if (ok) executeDelete([id], section);
}

async function confirmBulkDelete(section) {
  const count = viewState.selectedIds.size;
  if (count === 0) return;

  const ok = await showConfirm('Excluir transações', `Tem certeza que deseja excluir ${count} transação(ões)?`, { confirmText: 'Excluir', danger: true });
  if (ok) executeDelete([...viewState.selectedIds], section);
}

async function executeDelete(ids, section) {
  viewState.allTransactions = viewState.allTransactions.filter(t => !ids.includes(t.id));
  viewState.selectedIds = new Set();

  const cacheKey = `txn-${viewState.yearMonth}`;
  const maxIdDel = Math.max(0, ...viewState.allTransactions.map(t => (typeof t.id === 'number' && t.id > 0) ? t.id : 0));
  putCacheEntry(cacheKey, {
    _schema_version: 1,
    month: viewState.yearMonth,
    lastId: maxIdDel,
    transactions: [...viewState.allTransactions]
  });

  applyFiltersAndRender(section);
  showAlert(`${ids.length} transação(ões) excluída(s)!`, 'success');

  const syncId = ids.length === 1 ? ids[0] : -Date.now();
  addPendingSync(syncId, 'delete');

  try {
    const result = await dispatch('delete-transaction', { ids }, viewState.yearMonth);
    resolvePendingSync(syncId, result?.success ?? false);
    if (!result?.success) {
      showAlert('Erro ao sincronizar exclusão: ' + (result?.error || 'desconhecido'), 'warning');
    }
  } catch (err) {
    console.error('delete dispatch error:', err);
    resolvePendingSync(syncId, false);
  }
}

// --- Helpers ---

function parseId(val) {
  const n = Number(val);
  return Number.isNaN(n) ? val : n;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}
