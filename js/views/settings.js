import { getConfig, getCategories, getPaymentMethods, putCacheEntry, invalidateCache } from '../modules/data-service.js';
import { dispatch, testConnection } from '../modules/github-api.js';
import { isWizardDone } from '../modules/storage.js';
import { formatCurrency } from '../modules/format.js';
import { showAlert, showConfirm } from '../app.js';
import { getGeminiKey, saveGeminiKey, isGeminiConfigured, testApiKey, getGeminiModel, saveGeminiModel, getAvailableModels } from '../modules/gemini.js';
import { hashPin, logout, encryptSecrets } from '../modules/auth.js';

let state = {
  config: null,
  categories: null,
  paymentMethods: null,
  editingPersonId: null,
  editingCategory: null,
  budgetPerson: null,
  openAccordions: new Set(['pessoas']),
  saving: false
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function nextId(arr) {
  if (!arr.length) return 1;
  return Math.max(...arr.map(i => i.id || 0)) + 1;
}

function toggleAccordion(key) {
  if (state.openAccordions.has(key)) state.openAccordions.delete(key);
  else state.openAccordions.add(key);
  render();
}

function buildAccordion(key, title, contentFn) {
  const isOpen = state.openAccordions.has(key);
  const section = el('div', { className: 'accordion-section' });

  const header = el('button', {
    className: `accordion-header${isOpen ? ' open' : ''}`,
    onClick: () => toggleAccordion(key)
  },
    el('span', {}, title),
    el('span', { className: 'arrow' }, '▼')
  );
  section.append(header);

  if (isOpen) {
    const body = el('div', { className: 'accordion-body' });
    contentFn(body);
    section.append(body);
  }
  return section;
}

// ─── People Section ───

function renderPersonCard(person) {
  if (state.editingPersonId === person.id) return renderPersonForm(person);

  const card = el('div', { className: 'card', style: { marginBottom: 'var(--sp-4)', borderLeft: `4px solid ${person.color || 'var(--accent)'}` } });
  const row = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-4)' } });

  const info = el('div', { style: { flex: '1', minWidth: '0' } });
  info.append(
    el('div', { style: { fontWeight: '700', fontSize: 'var(--text-lg)', marginBottom: 'var(--sp-2)', textTransform: 'capitalize' } }, person.name),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--sp-2)', fontSize: 'var(--text-sm)' } },
      el('div', {}, el('span', { style: { color: 'var(--text-secondary)' } }, 'Salário: '), el('strong', {}, formatCurrency(person.salary || 0))),
      el('div', {}, el('span', { style: { color: 'var(--text-secondary)' } }, 'Meta: '), el('strong', {}, formatCurrency(person.monthlyGoal || 0))),
      el('div', {}, el('span', { style: { color: 'var(--text-secondary)' } }, 'Fech.: '), el('strong', {}, `Dia ${person.creditCard?.closingDay || '-'}`)),
      el('div', {}, el('span', { style: { color: 'var(--text-secondary)' } }, 'Pgto.: '), el('strong', {}, `Dia ${person.creditCard?.paymentDay || '-'}`))
    )
  );

  const actions = el('div', { style: { display: 'flex', gap: 'var(--sp-1)', flexShrink: '0' } });
  actions.append(
    el('button', { className: 'btn-icon', title: 'Editar', onClick: () => { state.editingPersonId = person.id; render(); } }, '✏️'),
    el('button', { className: 'btn-icon', title: 'Remover', onClick: () => removePerson(person.id) }, '🗑️')
  );

  row.append(info, actions);
  card.append(row);
  return card;
}

function renderPersonForm(person) {
  const isNew = !person;
  const data = person || { id: nextId(state.config.people), name: '', salary: 0, savingsGoal: 0, monthlyGoal: 0, color: '#3949ab', creditCard: { closingDay: 5, paymentDay: 10 } };

  const card = el('div', { className: 'card', style: { marginBottom: 'var(--sp-4)', borderLeft: '4px solid var(--accent)' } });
  const title = el('div', { style: { fontWeight: '700', fontSize: 'var(--text-lg)', marginBottom: 'var(--sp-4)' } }, isNew ? 'Nova Pessoa' : `Editando: ${data.name}`);
  const form = el('div');
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--sp-4)' } });

  grid.append(
    buildFormGroup('Nome *', el('input', { className: 'form-input', type: 'text', value: data.name, id: `person-name-${data.id}`, placeholder: 'Nome da pessoa', required: 'true' })),
    buildFormGroup('Salário', el('input', { className: 'form-input', type: 'number', value: String(data.salary || 0), id: `person-salary-${data.id}`, min: '0', step: '0.01' })),
    buildFormGroup('Meta mensal', el('input', { className: 'form-input', type: 'number', value: String(data.monthlyGoal || 0), id: `person-goal-${data.id}`, min: '0', step: '0.01' })),
    buildFormGroup('Meta poupança', el('input', { className: 'form-input', type: 'number', value: String(data.savingsGoal || 0), id: `person-savings-${data.id}`, min: '0', step: '0.01' })),
    buildFormGroup('Dia fechamento', el('input', { className: 'form-input', type: 'number', value: String(data.creditCard?.closingDay || 5), id: `person-closing-${data.id}`, min: '1', max: '31' })),
    buildFormGroup('Dia pagamento', el('input', { className: 'form-input', type: 'number', value: String(data.creditCard?.paymentDay || 10), id: `person-payment-${data.id}`, min: '1', max: '31' })),
    buildFormGroup('Cor', el('input', { className: 'form-input', type: 'color', value: data.color || '#3949ab', id: `person-color-${data.id}`, style: { height: '38px', padding: '2px' } }))
  );

  const actions = el('div', { style: { display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' } });
  actions.append(
    el('button', { className: 'btn btn-primary', onClick: () => savePerson(data.id, isNew) }, '💾 Salvar'),
    el('button', { className: 'btn btn-ghost', onClick: () => { state.editingPersonId = null; render(); } }, 'Cancelar')
  );

  form.append(grid, actions);
  card.append(title, form);
  return card;
}

function buildFormGroup(label, input) {
  return el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, label), input);
}

async function savePerson(id, isNew) {
  const name = document.getElementById(`person-name-${id}`)?.value.trim();
  if (!name) { showAlert('Nome é obrigatório.', 'error'); return; }

  const personData = {
    id,
    name: name.toLowerCase(),
    salary: parseFloat(document.getElementById(`person-salary-${id}`)?.value) || 0,
    monthlyGoal: parseFloat(document.getElementById(`person-goal-${id}`)?.value) || 0,
    savingsGoal: parseFloat(document.getElementById(`person-savings-${id}`)?.value) || 0,
    color: document.getElementById(`person-color-${id}`)?.value || '#3949ab',
    creditCard: {
      closingDay: parseInt(document.getElementById(`person-closing-${id}`)?.value) || 5,
      paymentDay: parseInt(document.getElementById(`person-payment-${id}`)?.value) || 10
    }
  };

  const people = [...state.config.people];
  if (isNew) people.push(personData);
  else {
    const idx = people.findIndex(p => p.id === id);
    if (idx >= 0) people[idx] = personData;
  }

  state.saving = true;
  render();

  try {
    const updatedConfig = { ...state.config, people };
    const result = await dispatch('update-config', updatedConfig);
    if (result.success) {
      state.config.people = people;
      state.editingPersonId = null;
      invalidateCache('config');
      showAlert('Pessoa salva!', 'success');
    } else {
      showAlert(`Erro ao salvar: ${result.error}`, 'error');
    }
  } catch (err) {
    console.error('[savePerson]', err);
    showAlert('Erro inesperado ao salvar pessoa.', 'error');
  } finally {
    state.saving = false;
    render();
  }
}

async function removePerson(id) {
  if (state.config.people.length <= 1) { showAlert('É necessário manter ao menos uma pessoa.', 'error'); return; }
  const person = state.config.people.find(p => p.id === id);
  if (!await showConfirm('Remover pessoa', `Remover "${person?.name}"? Esta ação não pode ser desfeita.`, { confirmText: 'Remover', danger: true })) return;

  const people = state.config.people.filter(p => p.id !== id);
  state.config.people = people;
  render();

  const result = await dispatch('update-config', { ...state.config, people });
  if (result.success) {
    invalidateCache('config');
    showAlert('Pessoa removida!', 'success');
  } else showAlert(`Erro: ${result.error}`, 'error');
}

function buildPeopleContent(container) {
  (state.config?.people || []).forEach(p => container.append(renderPersonCard(p)));
  if (state.editingPersonId === 'new') container.append(renderPersonForm(null));
  if (state.editingPersonId !== 'new') {
    container.append(el('button', { className: 'btn btn-ghost', style: { width: '100%' }, onClick: () => { state.editingPersonId = 'new'; render(); } }, '➕ Adicionar Pessoa'));
  }
}

// ─── Categories Section ───

function renderCategoryRow(cat, type, index) {
  const editKey = `${type}-${index}`;
  if (state.editingCategory === editKey) return renderCategoryForm(cat, type, index);

  const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' } });

  const nameRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flex: '1', minWidth: '0' } });
  nameRow.append(
    el('span', { style: { fontSize: '18px', flexShrink: '0' } }, cat.icon || '📁'),
    el('span', { style: { fontWeight: '700', color: cat.color || 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, cat.name)
  );

  const actionBtns = el('div', { style: { display: 'flex', gap: 'var(--sp-1)', flexShrink: '0' } });
  actionBtns.append(
    el('button', { className: 'btn-icon', title: 'Editar', onClick: () => { state.editingCategory = editKey; render(); } }, '✏️'),
    el('button', { className: 'btn-icon', title: 'Remover', onClick: () => removeCategory(type, index) }, '🗑️')
  );

  row.append(nameRow, actionBtns);

  if (cat.subcategories?.length) {
    const chips = el('div', { className: 'chip-list', style: { width: '100%', paddingLeft: 'var(--sp-6)' } });
    cat.subcategories.forEach(sub => chips.append(el('span', { className: 'chip' }, sub)));
    row.append(chips);
  }

  return row;
}

function renderCategoryForm(cat, type, index) {
  const isNew = index === -1;
  const data = cat || { name: '', icon: '📁', color: '#78909c', subcategories: [] };
  const formId = `cat-${type}-${isNew ? 'new' : index}`;
  let subs = [...(data.subcategories || [])];

  const wrapper = el('div', { className: 'card', style: { marginBottom: 'var(--sp-2)', padding: 'var(--sp-4)', border: '2px solid var(--accent)' } });
  const title = el('div', { style: { fontWeight: '700', marginBottom: 'var(--sp-4)' } }, isNew ? 'Nova Categoria' : `Editando: ${data.name}`);
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--sp-4)' } });
  grid.append(
    buildFormGroup('Nome *', el('input', { className: 'form-input', type: 'text', value: data.name, id: `${formId}-name`, placeholder: 'Nome da categoria' })),
    buildFormGroup('Ícone', el('input', { className: 'form-input', type: 'text', value: data.icon, id: `${formId}-icon`, placeholder: '📁', style: { width: '60px' } })),
    buildFormGroup('Cor', el('input', { className: 'form-input', type: 'color', value: data.color || '#78909c', id: `${formId}-color`, style: { height: '38px', padding: '2px' } }))
  );

  const subSection = el('div', { style: { marginTop: 'var(--sp-4)' } });
  subSection.append(el('label', { className: 'form-label' }, 'Subcategorias'));
  const chipContainer = el('div', { className: 'chip-list', id: `${formId}-chips`, style: { marginTop: 'var(--sp-1)', marginBottom: 'var(--sp-2)' } });

  function refreshChips() {
    chipContainer.innerHTML = '';
    subs.forEach((sub, si) => {
      chipContainer.append(el('span', { className: 'chip' }, sub, el('button', { className: 'chip-remove', title: 'Remover', onClick: () => { subs.splice(si, 1); refreshChips(); } }, '×')));
    });
    if (!subs.length) chipContainer.append(el('span', { style: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontStyle: 'italic' } }, 'Nenhuma subcategoria'));
  }
  refreshChips();

  const addSubRow = el('div', { style: { display: 'flex', gap: 'var(--sp-2)' } });
  const subInput = el('input', { className: 'form-input', type: 'text', placeholder: 'Nova subcategoria', style: { flex: '1' } });
  const addSubBtn = el('button', { className: 'btn btn-ghost', onClick: () => { const val = subInput.value.trim(); if (val && !subs.includes(val)) { subs.push(val); subInput.value = ''; refreshChips(); } } }, '+ Adicionar');
  subInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSubBtn.click(); } });
  addSubRow.append(subInput, addSubBtn);
  subSection.append(chipContainer, addSubRow);

  const actions = el('div', { style: { display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' } });
  actions.append(
    el('button', { className: 'btn btn-primary', onClick: () => saveCategory(type, index, formId, subs) }, '💾 Salvar'),
    el('button', { className: 'btn btn-ghost', onClick: () => { state.editingCategory = null; render(); } }, 'Cancelar')
  );

  wrapper.append(title, grid, subSection, actions);
  return wrapper;
}

async function saveCategory(type, index, formId, subs) {
  const name = document.getElementById(`${formId}-name`)?.value.trim();
  if (!name) { showAlert('Nome da categoria é obrigatório.', 'error'); return; }

  const catData = { name, icon: document.getElementById(`${formId}-icon`)?.value.trim() || '📁', color: document.getElementById(`${formId}-color`)?.value || '#78909c', subcategories: [...subs] };
  const cats = JSON.parse(JSON.stringify(state.categories));
  if (index === -1) cats[type].push(catData);
  else cats[type][index] = catData;

  state.saving = true;
  render();

  try {
    const result = await dispatch('update-categories', cats);
    if (result.success) {
      state.categories = cats;
      state.editingCategory = null;
      showAlert('Categoria salva!', 'success');
    } else showAlert(`Erro: ${result.error}`, 'error');
  } catch (err) {
    console.error('[saveCategory]', err);
    showAlert('Erro inesperado.', 'error');
  } finally {
    state.saving = false;
    render();
  }
}

async function removeCategory(type, index) {
  const cat = state.categories[type][index];
  if (!await showConfirm('Remover categoria', `Remover categoria "${cat.name}"?`, { confirmText: 'Remover', danger: true })) return;

  const cats = JSON.parse(JSON.stringify(state.categories));
  cats[type].splice(index, 1);
  state.categories = cats;
  render();

  const result = await dispatch('update-categories', cats);
  if (result.success) showAlert('Categoria removida!', 'success');
  else showAlert(`Erro: ${result.error}`, 'error');
}

function buildCategoriesContent(container) {
  const cats = state.categories || { expense: [], income: [] };

  [{ key: 'expense', label: '💸 Despesas', color: 'var(--color-expense)' }, { key: 'income', label: '💰 Receitas', color: 'var(--color-income)' }].forEach(({ key, label, color }) => {
    const subtitle = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)', marginTop: 'var(--sp-4)', paddingBottom: 'var(--sp-1)', borderBottom: `2px solid ${color}` } });
    subtitle.append(el('span', { style: { fontWeight: '700', fontSize: 'var(--text-lg)', color } }, label), el('span', { style: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' } }, `${cats[key].length} categorias`));
    container.append(subtitle);

    const list = el('div');
    cats[key].forEach((cat, i) => list.append(renderCategoryRow(cat, key, i)));
    if (state.editingCategory === `${key}--1`) list.append(renderCategoryForm(null, key, -1));
    container.append(list);

    if (state.editingCategory !== `${key}--1`) {
      container.append(el('button', { className: 'btn btn-ghost', style: { width: '100%', marginTop: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }, onClick: () => { state.editingCategory = `${key}--1`; render(); } }, `➕ Adicionar ${key === 'expense' ? 'Despesa' : 'Receita'}`));
    }
  });
}

// ─── Budget Section ───

function buildBudgetContent(container) {
  const people = state.config?.people || [];
  const categories = state.categories || { expense: [] };
  const expenseCategories = categories.expense || [];
  const budgets = state.config?.budgets || {};

  if (!people.length) { container.append(el('p', { style: { color: 'var(--text-secondary)', fontStyle: 'italic' } }, 'Adicione pessoas primeiro.')); return; }
  if (!expenseCategories.length) { container.append(el('p', { style: { color: 'var(--text-secondary)', fontStyle: 'italic' } }, 'Adicione categorias de despesa primeiro.')); return; }

  if (people.length > 1) {
    const selected = state.budgetPerson || people[0].name;
    const selectorRow = el('div', { style: { marginBottom: 'var(--sp-6)' } });
    selectorRow.append(el('label', { className: 'form-label' }, 'Pessoa'));
    const select = el('select', { className: 'form-select', style: { width: '100%', marginTop: 'var(--sp-1)' }, onChange: (e) => { state.budgetPerson = e.target.value; render(); } });
    people.forEach(p => { const opt = el('option', { value: p.name }, p.name.charAt(0).toUpperCase() + p.name.slice(1)); if (p.name === selected) opt.selected = true; select.append(opt); });
    selectorRow.append(select);
    container.append(selectorRow);
  }

  const personName = state.budgetPerson || people[0].name;
  const personBudget = budgets[personName] || {};
  const grid = el('div', { className: 'budget-settings-grid' });

  expenseCategories.forEach((cat, i) => {
    const row = el('div', { className: 'budget-settings-row' });
    row.append(
      el('span', { className: 'budget-settings-category' }, el('span', {}, cat.icon || '📁'), el('span', {}, cat.name)),
      el('div', { className: 'budget-settings-input' }, el('span', { className: 'currency-label' }, 'R$'), el('input', { className: 'form-input', type: 'number', min: '0', step: '50', value: String(personBudget[cat.name] || ''), placeholder: '0', id: `budget-${i}`, 'data-category': cat.name, style: { flex: '1' } }))
    );
    grid.append(row);
  });
  container.append(grid);

  const actions = el('div', { style: { display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-6)' } });
  actions.append(
    el('button', { className: 'btn btn-primary', onClick: () => saveBudgets(personName, expenseCategories) }, '💾 Salvar Orçamento'),
    el('button', { className: 'btn btn-ghost', onClick: () => clearBudgets(personName) }, '🗑️ Limpar')
  );
  container.append(actions);
}

async function saveBudgets(personName, expenseCategories) {
  const personBudget = {};
  expenseCategories.forEach((cat, i) => { const val = parseFloat(document.getElementById(`budget-${i}`)?.value); if (val > 0) personBudget[cat.name] = val; });

  const budgets = { ...(state.config?.budgets || {}), [personName]: personBudget };
  state.saving = true;
  render();

  try {
    const updatedConfig = { ...state.config, budgets };
    const result = await dispatch('update-config', updatedConfig);
    if (result.success) { state.config.budgets = budgets; invalidateCache('config'); showAlert('Orçamento salvo!', 'success'); }
    else showAlert(`Erro: ${result.error}`, 'error');
  } catch (err) { showAlert('Erro inesperado.', 'error'); }
  finally { state.saving = false; render(); }
}

async function clearBudgets(personName) {
  if (!await showConfirm('Limpar orçamentos', `Limpar todos os orçamentos de "${personName}"?`, { confirmText: 'Limpar', danger: true })) return;
  const budgets = { ...(state.config?.budgets || {}) };
  delete budgets[personName];
  state.saving = true;
  render();
  try {
    const updatedConfig = { ...state.config, budgets };
    const result = await dispatch('update-config', updatedConfig);
    if (result.success) { state.config.budgets = budgets; invalidateCache('config'); showAlert('Orçamento limpo!', 'success'); }
    else showAlert(`Erro: ${result.error}`, 'error');
  } catch { showAlert('Erro inesperado.', 'error'); }
  finally { state.saving = false; render(); }
}

// ─── Payment Methods Section ───

function buildPaymentContent(container) {
  const methods = state.paymentMethods?.methods || [];
  const list = el('div');
  methods.forEach((method, i) => {
    const row = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-2) var(--sp-1)', borderBottom: '1px solid var(--border)' } });
    row.append(el('span', { style: { fontWeight: '600' } }, `💳 ${method}`), el('button', { className: 'btn-icon', title: 'Remover', onClick: () => removePaymentMethod(i) }, '🗑️'));
    list.append(row);
  });
  if (!methods.length) list.append(el('div', { className: 'empty-state', style: { padding: 'var(--sp-6)' } }, el('div', { className: 'empty-icon' }, '💳'), el('p', {}, 'Nenhum método cadastrado.')));
  container.append(list);

  const addRow = el('div', { style: { display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' } });
  const input = el('input', { className: 'form-input', type: 'text', placeholder: 'Novo método (ex: Pix)', style: { flex: '1' }, id: 'new-payment-method' });
  const addBtn = el('button', { className: 'btn btn-primary', onClick: addPaymentMethod }, '➕ Adicionar');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
  addRow.append(input, addBtn);
  container.append(addRow);
}

async function addPaymentMethod() {
  const input = document.getElementById('new-payment-method');
  const value = input?.value.trim();
  if (!value) { showAlert('Digite o nome do método.', 'error'); return; }
  const methods = [...(state.paymentMethods?.methods || [])];
  if (methods.some(m => m.toLowerCase() === value.toLowerCase())) { showAlert('Este método já existe.', 'error'); return; }
  methods.push(value);
  state.paymentMethods = { ...state.paymentMethods, methods };
  render();
  const result = await dispatch('update-payment-methods', { methods });
  if (result.success) showAlert('Método adicionado!', 'success');
  else showAlert(`Erro: ${result.error}`, 'error');
}

async function removePaymentMethod(index) {
  const method = state.paymentMethods.methods[index];
  if (!await showConfirm('Remover método', `Remover "${method}"?`, { confirmText: 'Remover', danger: true })) return;
  const methods = state.paymentMethods.methods.filter((_, i) => i !== index);
  state.paymentMethods = { ...state.paymentMethods, methods };
  render();
  const result = await dispatch('update-payment-methods', { methods });
  if (result.success) showAlert('Método removido!', 'success');
  else showAlert(`Erro: ${result.error}`, 'error');
}

// ─── Gemini AI Section ───

function buildGeminiContent(container) {
  const configured = isGeminiConfigured();
  const currentKey = getGeminiKey();
  const statusRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-6)' } });
  statusRow.append(el('span', { style: { fontSize: '20px' } }, configured ? '✅' : '⚠️'), el('span', { style: { fontWeight: '600' } }, configured ? 'Chave configurada' : 'Chave não configurada'));
  container.append(statusRow);

  const keyGroup = el('div', { className: 'form-group' });
  keyGroup.append(el('label', { className: 'form-label' }, 'Chave da API'));
  const inputRow = el('div', { style: { display: 'flex', gap: 'var(--sp-2)' } });
  const keyInput = el('input', { className: 'form-input', type: 'password', id: 'gemini-key-input', value: currentKey, placeholder: 'Cole sua chave da API Gemini', style: { flex: '1' } });
  const toggleBtn = el('button', { className: 'btn btn-ghost', type: 'button', onClick: () => { const inp = document.getElementById('gemini-key-input'); if (inp) { inp.type = inp.type === 'password' ? 'text' : 'password'; toggleBtn.textContent = inp.type === 'password' ? '👁️' : '🙈'; } } }, '👁️');
  inputRow.append(keyInput, toggleBtn);
  keyGroup.append(inputRow);
  container.append(keyGroup);

  const modelGroup = el('div', { className: 'form-group', style: { marginTop: 'var(--sp-4)' } });
  modelGroup.append(el('label', { className: 'form-label' }, 'Modelo'));
  const modelSelect = el('select', { className: 'form-input', id: 'gemini-model-select' });
  const currentModel = getGeminiModel();
  getAvailableModels().forEach(m => { const opt = el('option', { value: m.id }, m.name); if (m.id === currentModel) opt.selected = true; modelSelect.append(opt); });
  modelGroup.append(modelSelect);
  container.append(modelGroup);

  const actions = el('div', { style: { display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)', flexWrap: 'wrap' } });

  actions.append(
    el('button', { className: 'btn btn-primary', onClick: async () => {
      const val = document.getElementById('gemini-key-input')?.value.trim();
      const selModel = document.getElementById('gemini-model-select')?.value;
      saveGeminiKey(val);
      if (selModel) saveGeminiModel(selModel);

      const updatedConfig = { ...state.config, geminiModel: selModel || undefined };
      const pin = sessionStorage.getItem('fvk_pin');
      if (pin) updatedConfig.encryptedSecrets = await encryptSecrets(pin, { pat: '', geminiKey: val || '' });

      state.config = updatedConfig;
      dispatch('update-config', updatedConfig).catch(() => {});
      showAlert(val ? 'Chave e modelo salvos!' : 'Chave removida.', 'success');
      render();
    }}, '💾 Salvar'),
    el('button', { className: 'btn btn-ghost', id: 'gemini-test-btn', onClick: async () => {
      const val = document.getElementById('gemini-key-input')?.value.trim();
      const selModel = document.getElementById('gemini-model-select')?.value;
      if (!val) { showAlert('Digite uma chave para testar.', 'error'); return; }
      const btn = document.getElementById('gemini-test-btn');
      btn.disabled = true; btn.textContent = 'Testando...';
      try {
        const result = await testApiKey(val, selModel);
        showAlert(result.success ? `Conexão OK com ${selModel}!` : `Falha: ${result.error}`, result.success ? 'success' : 'error');
      } catch (err) { showAlert(`Erro: ${err.message}`, 'error'); }
      finally { btn.disabled = false; btn.textContent = '🔗 Testar Conexão'; }
    }}, '🔗 Testar Conexão')
  );

  if (configured) actions.append(el('button', { className: 'btn btn-ghost', style: { color: 'var(--color-expense)' }, onClick: async () => {
    if (!await showConfirm('Remover chave', 'Remover a chave da API Gemini?', { confirmText: 'Remover', danger: true })) return;
    saveGeminiKey(''); showAlert('Chave removida.', 'success'); render();
  }}, '🗑️ Remover'));

  container.append(actions);
  container.append(el('p', { style: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--sp-6)', lineHeight: '1.5' } },
    '🔐 A chave é criptografada com seu PIN. Obtenha em: ', el('a', { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener', style: { color: 'var(--accent)' } }, 'aistudio.google.com')
  ));
}

// ─── Security Section ───

function buildSecurityContent(container) {
  const hasPinHash = !!state.config?.pinHash;
  const statusRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' } });
  statusRow.append(el('span', { style: { fontSize: '20px' } }, hasPinHash ? '🔒' : '🔓'), el('span', { style: { fontWeight: '600' } }, hasPinHash ? 'PIN ativo — login necessário' : 'Sem PIN — acesso livre'));
  container.append(statusRow);

  container.append(buildFormGroup(hasPinHash ? 'Novo PIN (vazio = manter)' : 'Defina um PIN', el('input', { className: 'form-input', type: 'password', id: 'security-pin', placeholder: 'Ex: 1234', maxlength: '20' })));
  container.append(buildFormGroup('Confirme o PIN', el('input', { className: 'form-input', type: 'password', id: 'security-pin-confirm', placeholder: 'Repita', maxlength: '20' })));

  const actions = el('div', { style: { display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' } });
  actions.append(el('button', { className: 'btn btn-primary', onClick: savePin }, 'Salvar PIN'));
  if (hasPinHash) {
    actions.append(
      el('button', { className: 'btn btn-danger', onClick: removePin }, 'Remover PIN'),
      el('button', { className: 'btn btn-ghost', onClick: () => { logout(); location.reload(); } }, 'Sair (Logout)')
    );
  }
  container.append(actions);
  container.append(el('p', { style: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--sp-4)', lineHeight: '1.6' } }, 'O PIN é armazenado como hash SHA-256. A chave Gemini é criptografada com AES-256 usando seu PIN.'));
}

async function savePin() {
  const pin = document.getElementById('security-pin')?.value;
  const confirm2 = document.getElementById('security-pin-confirm')?.value;
  if (!pin) { showAlert('Digite um PIN.', 'error'); return; }
  if (pin !== confirm2) { showAlert('PINs não conferem.', 'error'); return; }

  state.saving = true;
  render();
  try {
    const pinHash = await hashPin(pin);
    const updatedConfig = { ...state.config, pinHash };
    const geminiKey = getGeminiKey() || '';
    if (geminiKey) updatedConfig.encryptedSecrets = await encryptSecrets(pin, { pat: '', geminiKey });

    const result = await dispatch('update-config', updatedConfig);
    if (result.success) {
      state.config = { ...state.config, pinHash, encryptedSecrets: updatedConfig.encryptedSecrets };
      invalidateCache('config');
      sessionStorage.setItem('fvk_pin', pin);
      showAlert('PIN definido com sucesso!', 'success');
    } else showAlert(`Erro: ${result.error}`, 'error');
  } catch (err) { showAlert('Erro inesperado.', 'error'); }
  finally { state.saving = false; render(); }
}

async function removePin() {
  if (!await showConfirm('Remover PIN', 'Remover o PIN? Qualquer pessoa poderá acessar.', { confirmText: 'Remover PIN', danger: true })) return;
  state.saving = true;
  render();
  try {
    const updatedConfig = { ...state.config, pinHash: null, encryptedSecrets: null };
    const result = await dispatch('update-config', updatedConfig);
    if (result.success) {
      delete state.config.pinHash;
      delete state.config.encryptedSecrets;
      sessionStorage.removeItem('fvk_pin');
      invalidateCache('config');
      showAlert('PIN removido.', 'success');
    } else showAlert(`Erro: ${result.error}`, 'error');
  } catch { showAlert('Erro inesperado.', 'error'); }
  finally { state.saving = false; render(); }
}

// ─── Database Status Section ───

function buildDatabaseContent(container) {
  const statusRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' } });
  statusRow.append(el('span', { style: { fontSize: '20px' } }, '🗄️'), el('span', { style: { fontWeight: '600' } }, 'Supabase PostgreSQL'));
  container.append(statusRow);

  const testBtn = el('button', { className: 'btn btn-primary', onClick: async () => {
    testBtn.disabled = true; testBtn.textContent = 'Testando...';
    try {
      const result = await testConnection();
      testBtn.disabled = false; testBtn.textContent = '🔗 Testar Conexão';
      showAlert(result.success ? 'Conexão com Supabase OK!' : `Falha: ${result.error}`, result.success ? 'success' : 'error');
    } catch (err) {
      testBtn.disabled = false; testBtn.textContent = '🔗 Testar Conexão';
      showAlert(`Erro: ${err.message}`, 'error');
    }
  }}, '🔗 Testar Conexão');

  container.append(testBtn);
  container.append(el('p', { style: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--sp-4)' } }, 'Os dados são salvos diretamente no Supabase. Não é necessário configuração adicional.'));
}

// ─── Theme Toggle (mobile) ───

function buildThemeToggle() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const row = el('div', {
    className: 'card',
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--sp-4) var(--sp-5)', marginBottom: 'var(--sp-3)', cursor: 'pointer'
    },
    onClick: () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (dark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('coinly_theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('coinly_theme', 'dark');
      }
      const lightIcon = document.getElementById('theme-icon-light');
      const darkIcon = document.getElementById('theme-icon-dark');
      const label = document.getElementById('theme-label');
      if (lightIcon) lightIcon.style.display = !dark ? 'none' : '';
      if (darkIcon) darkIcon.style.display = !dark ? '' : 'none';
      if (label) label.textContent = !dark ? 'Modo claro' : 'Modo escuro';
      render();
    }
  });

  const left = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' } });
  left.append(
    el('span', { style: { fontSize: '20px' } }, isDark ? '🌙' : '☀️'),
    el('span', { style: { fontWeight: '600' } }, isDark ? 'Modo Escuro' : 'Modo Claro')
  );

  const toggle = el('div', {
    style: {
      width: '44px', height: '24px', borderRadius: '12px',
      background: isDark ? 'var(--accent)' : 'var(--border)',
      position: 'relative', transition: 'background 0.2s ease', flexShrink: '0'
    }
  });
  const knob = el('div', {
    style: {
      width: '20px', height: '20px', borderRadius: '50%',
      background: 'white', position: 'absolute', top: '2px',
      left: isDark ? '22px' : '2px', transition: 'left 0.2s ease',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    }
  });
  toggle.append(knob);

  row.append(left, toggle);
  return row;
}

// ─── Main Render ───

function render() {
  const section = document.getElementById('view-settings');
  if (!section) return;
  section.innerHTML = '';

  const header = el('div', { className: 'section-header' });
  header.append(el('h2', {}, 'Configurações'));
  if (state.saving) {
    const spinner = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' } });
    spinner.append(el('div', { className: 'spinner spinner-sm' }), el('span', { style: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' } }, 'Salvando...'));
    header.append(spinner);
  }
  section.append(header);

  section.append(buildThemeToggle());
  section.append(buildAccordion('seguranca', 'Segurança', buildSecurityContent));
  section.append(buildAccordion('pessoas', 'Pessoas', buildPeopleContent));
  section.append(buildAccordion('categorias', 'Categorias', buildCategoriesContent));
  section.append(buildAccordion('orcamento', 'Orçamento', buildBudgetContent));
  section.append(buildAccordion('pagamento', 'Métodos de Pagamento', buildPaymentContent));
  section.append(buildAccordion('gemini', 'Gemini AI', buildGeminiContent));
  section.append(buildAccordion('banco', 'Banco de Dados', buildDatabaseContent));
}

// ─── Init ───

export async function initSettings() {
  const section = document.getElementById('view-settings');

  if (!isWizardDone()) {
    section.innerHTML = '<div class="placeholder-view"><div class="placeholder-icon">⚙️</div><h2>Configurações</h2><p>Complete o assistente para configurar.</p></div>';
    return;
  }

  section.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:var(--sp-10);"><div class="spinner spinner-lg"></div></div>';

  const [config, categories, paymentMethods] = await Promise.all([getConfig(), getCategories(), getPaymentMethods()]);

  state.config = config || { _schema_version: 1, people: [], settings: {} };
  state.categories = categories || { _schema_version: 1, expense: [], income: [] };
  state.paymentMethods = paymentMethods || { _schema_version: 1, methods: [] };
  state.editingPersonId = null;
  state.editingCategory = null;
  state.budgetPerson = null;
  state.saving = false;
  render();
}
