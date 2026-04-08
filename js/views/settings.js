import { getConfig, getCategories, getPaymentMethods, invalidateCache } from '../modules/data-service.js';
import { dispatch } from '../modules/github-api.js';
import { isWizardDone, getRepoConfig } from '../modules/storage.js';
import { formatCurrency } from '../modules/format.js';
import { showAlert } from '../app.js';

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

  const card = el('div', { className: 'card', style: { marginBottom: 'var(--space-md)', borderLeft: `4px solid ${person.color || 'var(--color-secondary)'}` } });

  const row = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' } });

  const info = el('div', { style: { flex: '1' } });
  info.append(
    el('div', { style: { fontWeight: '700', fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-sm)', textTransform: 'capitalize' } }, person.name),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-sm)' } },
      el('div', {},
        el('span', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' } }, 'Salário: '),
        el('strong', {}, formatCurrency(person.salary || 0))
      ),
      el('div', {},
        el('span', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' } }, 'Meta mensal: '),
        el('strong', {}, formatCurrency(person.monthlyGoal || 0))
      ),
      el('div', {},
        el('span', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' } }, 'Fechamento: '),
        el('strong', {}, `Dia ${person.creditCard?.closingDay || '-'}`)
      ),
      el('div', {},
        el('span', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' } }, 'Pagamento: '),
        el('strong', {}, `Dia ${person.creditCard?.paymentDay || '-'}`)
      )
    )
  );

  const actions = el('div', { style: { display: 'flex', gap: 'var(--space-xs)', flexShrink: '0' } });
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

  const card = el('div', { className: 'card', style: { marginBottom: 'var(--space-md)', borderLeft: '4px solid var(--color-secondary)' } });
  const title = el('div', { style: { fontWeight: '700', fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-md)' } }, isNew ? 'Nova Pessoa' : `Editando: ${data.name}`);

  const form = el('div');

  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' } });

  grid.append(
    buildFormGroup('Nome *', el('input', { className: 'form-input', type: 'text', value: data.name, id: `person-name-${data.id}`, placeholder: 'Nome da pessoa', required: 'true' })),
    buildFormGroup('Salário', el('input', { className: 'form-input', type: 'number', value: String(data.salary || 0), id: `person-salary-${data.id}`, min: '0', step: '0.01' })),
    buildFormGroup('Meta mensal', el('input', { className: 'form-input', type: 'number', value: String(data.monthlyGoal || 0), id: `person-goal-${data.id}`, min: '0', step: '0.01' })),
    buildFormGroup('Meta poupança', el('input', { className: 'form-input', type: 'number', value: String(data.savingsGoal || 0), id: `person-savings-${data.id}`, min: '0', step: '0.01' })),
    buildFormGroup('Dia fechamento', el('input', { className: 'form-input', type: 'number', value: String(data.creditCard?.closingDay || 5), id: `person-closing-${data.id}`, min: '1', max: '31' })),
    buildFormGroup('Dia pagamento', el('input', { className: 'form-input', type: 'number', value: String(data.creditCard?.paymentDay || 10), id: `person-payment-${data.id}`, min: '1', max: '31' })),
    buildFormGroup('Cor', el('input', { className: 'form-input', type: 'color', value: data.color || '#3949ab', id: `person-color-${data.id}`, style: { height: '38px', padding: '2px' } }))
  );

  const actions = el('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' } });
  actions.append(
    el('button', { className: 'btn btn-primary', onClick: () => savePerson(data.id, isNew) }, '💾 Salvar'),
    el('button', { className: 'btn btn-ghost', onClick: () => { state.editingPersonId = null; if (isNew) render(); else render(); } }, 'Cancelar')
  );

  form.append(grid, actions);
  card.append(title, form);
  return card;
}

function buildFormGroup(label, input) {
  return el('div', { className: 'form-group' },
    el('label', { className: 'form-label' }, label),
    input
  );
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
  if (isNew) {
    people.push(personData);
  } else {
    const idx = people.findIndex(p => p.id === id);
    if (idx >= 0) people[idx] = personData;
  }

  state.saving = true;
  render();

  const result = await dispatch('update-config', { ...state.config, people, _schema_version: state.config._schema_version });

  state.saving = false;
  if (result.success) {
    state.config.people = people;
    state.editingPersonId = null;
    invalidateCache('config');
    showAlert('Pessoa salva com sucesso!', 'success');
  } else {
    showAlert(`Erro ao salvar: ${result.error}`, 'error');
  }
  render();
}

function removePerson(id) {
  if (state.config.people.length <= 1) {
    showAlert('É necessário manter ao menos uma pessoa.', 'error');
    return;
  }
  const person = state.config.people.find(p => p.id === id);
  if (!confirm(`Remover "${person?.name}"? Esta ação não pode ser desfeita.`)) return;

  const people = state.config.people.filter(p => p.id !== id);
  state.config.people = people;
  render();

  dispatch('update-config', { ...state.config, people, _schema_version: state.config._schema_version }).then(result => {
    if (result.success) {
      invalidateCache('config');
      showAlert('Pessoa removida!', 'success');
    } else {
      showAlert(`Erro ao remover: ${result.error}`, 'error');
    }
  });
}

function buildPeopleContent(container) {
  const people = state.config?.people || [];

  people.forEach(p => container.append(renderPersonCard(p)));

  if (state.editingPersonId === 'new') {
    container.append(renderPersonForm(null));
  }

  if (state.editingPersonId !== 'new') {
    container.append(
      el('button', {
        className: 'btn btn-ghost',
        style: { width: '100%' },
        onClick: () => { state.editingPersonId = 'new'; render(); }
      }, '➕ Adicionar Pessoa')
    );
  }
}

// ─── Categories Section ───

function renderCategoryRow(cat, type, index) {
  const editKey = `${type}-${index}`;
  if (state.editingCategory === editKey) return renderCategoryForm(cat, type, index);

  const row = el('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
      padding: 'var(--space-sm) 0',
      borderBottom: '1px solid var(--color-border)'
    }
  });

  const icon = el('span', { style: { fontSize: '20px', flexShrink: '0' } }, cat.icon || '📁');
  const name = el('span', { style: { fontWeight: '700', color: cat.color || 'var(--color-text)', minWidth: '120px' } }, cat.name);

  const chips = el('div', { className: 'chip-list', style: { flex: '1' } });
  (cat.subcategories || []).forEach(sub => {
    chips.append(el('span', { className: 'chip' }, sub));
  });
  if (!cat.subcategories?.length) {
    chips.append(el('span', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' } }, 'Sem subcategorias'));
  }

  const actions = el('div', { style: { display: 'flex', gap: 'var(--space-xs)', flexShrink: '0' } });
  actions.append(
    el('button', { className: 'btn-icon', title: 'Editar', onClick: () => { state.editingCategory = editKey; render(); } }, '✏️'),
    el('button', { className: 'btn-icon', title: 'Remover', onClick: () => removeCategory(type, index) }, '🗑️')
  );

  row.append(icon, name, chips, actions);
  return row;
}

function renderCategoryForm(cat, type, index) {
  const isNew = index === -1;
  const data = cat || { name: '', icon: '📁', color: '#78909c', subcategories: [] };
  const formId = `cat-${type}-${isNew ? 'new' : index}`;
  let subs = [...(data.subcategories || [])];

  const wrapper = el('div', {
    className: 'card',
    style: { marginBottom: 'var(--space-sm)', padding: 'var(--space-md)', border: '2px solid var(--color-secondary)' }
  });

  const title = el('div', { style: { fontWeight: '700', marginBottom: 'var(--space-md)' } }, isNew ? 'Nova Categoria' : `Editando: ${data.name}`);

  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-md)' } });
  grid.append(
    buildFormGroup('Nome *', el('input', { className: 'form-input', type: 'text', value: data.name, id: `${formId}-name`, placeholder: 'Nome da categoria' })),
    buildFormGroup('Ícone', el('input', { className: 'form-input', type: 'text', value: data.icon, id: `${formId}-icon`, placeholder: '📁', style: { width: '60px' } })),
    buildFormGroup('Cor', el('input', { className: 'form-input', type: 'color', value: data.color || '#78909c', id: `${formId}-color`, style: { height: '38px', padding: '2px' } }))
  );

  const subSection = el('div', { style: { marginTop: 'var(--space-md)' } });
  subSection.append(el('label', { className: 'form-label' }, 'Subcategorias'));

  const chipContainer = el('div', { className: 'chip-list', id: `${formId}-chips`, style: { marginTop: 'var(--space-xs)', marginBottom: 'var(--space-sm)' } });

  function refreshChips() {
    chipContainer.innerHTML = '';
    subs.forEach((sub, si) => {
      const chip = el('span', { className: 'chip' },
        sub,
        el('button', { className: 'chip-remove', title: 'Remover', onClick: () => { subs.splice(si, 1); refreshChips(); } }, '×')
      );
      chipContainer.append(chip);
    });
    if (!subs.length) {
      chipContainer.append(el('span', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' } }, 'Nenhuma subcategoria'));
    }
  }
  refreshChips();

  const addSubRow = el('div', { style: { display: 'flex', gap: 'var(--space-sm)' } });
  const subInput = el('input', { className: 'form-input', type: 'text', placeholder: 'Nova subcategoria', style: { flex: '1' } });
  const addSubBtn = el('button', { className: 'btn btn-ghost', onClick: () => {
    const val = subInput.value.trim();
    if (val && !subs.includes(val)) {
      subs.push(val);
      subInput.value = '';
      refreshChips();
    }
  } }, '+ Adicionar');
  subInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSubBtn.click(); } });
  addSubRow.append(subInput, addSubBtn);

  subSection.append(chipContainer, addSubRow);

  const actions = el('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' } });
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

  const catData = {
    name,
    icon: document.getElementById(`${formId}-icon`)?.value.trim() || '📁',
    color: document.getElementById(`${formId}-color`)?.value || '#78909c',
    subcategories: [...subs]
  };

  const cats = JSON.parse(JSON.stringify(state.categories));
  if (index === -1) {
    cats[type].push(catData);
  } else {
    cats[type][index] = catData;
  }

  state.saving = true;
  render();

  const result = await dispatch('update-categories', cats);

  state.saving = false;
  if (result.success) {
    state.categories = cats;
    state.editingCategory = null;
    invalidateCache('categories');
    showAlert('Categoria salva!', 'success');
  } else {
    showAlert(`Erro ao salvar: ${result.error}`, 'error');
  }
  render();
}

function removeCategory(type, index) {
  const cat = state.categories[type][index];
  if (!confirm(`Remover categoria "${cat.name}"?`)) return;

  const cats = JSON.parse(JSON.stringify(state.categories));
  cats[type].splice(index, 1);
  state.categories = cats;
  render();

  dispatch('update-categories', cats).then(result => {
    if (result.success) {
      invalidateCache('categories');
      showAlert('Categoria removida!', 'success');
    } else {
      showAlert(`Erro ao remover: ${result.error}`, 'error');
    }
  });
}

function buildCategoriesContent(container) {
  const cats = state.categories || { expense: [], income: [] };

  [
    { key: 'expense', label: '💸 Despesas', color: 'var(--color-expense)' },
    { key: 'income', label: '💰 Receitas', color: 'var(--color-income)' }
  ].forEach(({ key, label, color }) => {
    const subtitle = el('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-sm)', marginTop: 'var(--space-md)',
        paddingBottom: 'var(--space-xs)', borderBottom: `2px solid ${color}`
      }
    });
    subtitle.append(
      el('span', { style: { fontWeight: '700', fontSize: 'var(--font-size-lg)', color } }, label),
      el('span', { style: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' } }, `${cats[key].length} categorias`)
    );
    container.append(subtitle);

    const list = el('div');
    cats[key].forEach((cat, i) => list.append(renderCategoryRow(cat, key, i)));

    if (state.editingCategory === `${key}--1`) {
      list.append(renderCategoryForm(null, key, -1));
    }
    container.append(list);

    if (state.editingCategory !== `${key}--1`) {
      container.append(
        el('button', {
          className: 'btn btn-ghost',
          style: { width: '100%', marginTop: 'var(--space-sm)', marginBottom: 'var(--space-md)' },
          onClick: () => { state.editingCategory = `${key}--1`; render(); }
        }, `➕ Adicionar ${key === 'expense' ? 'Despesa' : 'Receita'}`)
      );
    }
  });
}

// ─── Budget Section ───

function buildBudgetContent(container) {
  const people = state.config?.people || [];
  const categories = state.categories || { expense: [] };
  const expenseCategories = categories.expense || [];
  const budgets = state.config?.budgets || {};

  if (!people.length) {
    container.append(el('p', { style: { color: 'var(--color-text-secondary)', fontStyle: 'italic' } }, 'Adicione pessoas primeiro.'));
    return;
  }

  if (!expenseCategories.length) {
    container.append(el('p', { style: { color: 'var(--color-text-secondary)', fontStyle: 'italic' } }, 'Adicione categorias de despesa primeiro.'));
    return;
  }

  if (people.length > 1) {
    const selected = state.budgetPerson || people[0].name;

    const selectorRow = el('div', { style: { marginBottom: 'var(--space-lg)' } });
    selectorRow.append(el('label', { className: 'form-label' }, 'Pessoa'));

    const select = el('select', {
      className: 'form-select',
      style: { width: '100%', marginTop: 'var(--space-xs)' },
      onChange: (e) => { state.budgetPerson = e.target.value; render(); }
    });

    people.forEach(p => {
      const opt = el('option', { value: p.name }, p.name.charAt(0).toUpperCase() + p.name.slice(1));
      if (p.name === selected) opt.selected = true;
      select.append(opt);
    });

    selectorRow.append(select);
    container.append(selectorRow);
  }

  const personName = state.budgetPerson || people[0].name;
  const personBudget = budgets[personName] || {};

  const grid = el('div', { className: 'budget-settings-grid' });

  expenseCategories.forEach((cat, i) => {
    const row = el('div', { className: 'budget-settings-row' });
    const catLabel = el('span', { className: 'budget-settings-category' },
      el('span', {}, cat.icon || '📁'),
      el('span', {}, cat.name)
    );

    const inputWrapper = el('div', { className: 'budget-settings-input' });
    inputWrapper.append(
      el('span', { className: 'currency-label' }, 'R$'),
      el('input', {
        className: 'form-input',
        type: 'number',
        min: '0',
        step: '50',
        value: String(personBudget[cat.name] || ''),
        placeholder: '0',
        id: `budget-${i}`,
        'data-category': cat.name,
        style: { flex: '1' }
      })
    );

    row.append(catLabel, inputWrapper);
    grid.append(row);
  });

  container.append(grid);

  const actions = el('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' } });
  actions.append(
    el('button', { className: 'btn btn-primary', onClick: () => saveBudgets(personName, expenseCategories) }, '💾 Salvar Orçamento'),
    el('button', { className: 'btn btn-ghost', onClick: () => clearBudgets(personName) }, '🗑️ Limpar')
  );
  container.append(actions);
}

async function saveBudgets(personName, expenseCategories) {
  const personBudget = {};

  expenseCategories.forEach((cat, i) => {
    const input = document.getElementById(`budget-${i}`);
    const val = parseFloat(input?.value);
    if (val > 0) personBudget[cat.name] = val;
  });

  const budgets = { ...(state.config?.budgets || {}) };
  budgets[personName] = personBudget;

  state.saving = true;
  render();

  const result = await dispatch('update-config', { ...state.config, budgets, _schema_version: state.config._schema_version });

  state.saving = false;
  if (result.success) {
    state.config.budgets = budgets;
    invalidateCache('config');
    showAlert('Orçamento salvo com sucesso!', 'success');
  } else {
    showAlert(`Erro ao salvar orçamento: ${result.error}`, 'error');
  }
  render();
}

async function clearBudgets(personName) {
  if (!confirm(`Limpar todos os orçamentos de "${personName}"?`)) return;

  const budgets = { ...(state.config?.budgets || {}) };
  delete budgets[personName];

  state.saving = true;
  render();

  const result = await dispatch('update-config', { ...state.config, budgets, _schema_version: state.config._schema_version });

  state.saving = false;
  if (result.success) {
    state.config.budgets = budgets;
    invalidateCache('config');
    showAlert('Orçamento limpo!', 'success');
  } else {
    showAlert(`Erro ao limpar orçamento: ${result.error}`, 'error');
  }
  render();
}

// ─── Payment Methods Section ───

function buildPaymentContent(container) {
  const methods = state.paymentMethods?.methods || [];

  const list = el('div');
  methods.forEach((method, i) => {
    const row = el('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-sm) var(--space-xs)',
        borderBottom: '1px solid var(--color-border)'
      }
    });
    row.append(
      el('span', { style: { fontWeight: '600' } }, `💳 ${method}`),
      el('button', { className: 'btn-icon', title: 'Remover', onClick: () => removePaymentMethod(i) }, '🗑️')
    );
    list.append(row);
  });

  if (!methods.length) {
    list.append(el('div', { className: 'empty-state', style: { padding: 'var(--space-lg)' } },
      el('div', { className: 'empty-icon' }, '💳'),
      el('p', {}, 'Nenhum método de pagamento cadastrado.')
    ));
  }

  container.append(list);

  const addRow = el('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' } });
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
  if (methods.some(m => m.toLowerCase() === value.toLowerCase())) {
    showAlert('Este método já existe.', 'error');
    return;
  }
  methods.push(value);

  state.paymentMethods = { ...state.paymentMethods, methods };
  render();

  const result = await dispatch('update-payment-methods', { methods });
  if (result.success) {
    invalidateCache('payment-methods');
    showAlert('Método adicionado!', 'success');
  } else {
    showAlert(`Erro ao adicionar: ${result.error}`, 'error');
  }
}

function removePaymentMethod(index) {
  const method = state.paymentMethods.methods[index];
  if (!confirm(`Remover "${method}"?`)) return;

  const methods = state.paymentMethods.methods.filter((_, i) => i !== index);
  state.paymentMethods = { ...state.paymentMethods, methods };
  render();

  dispatch('update-payment-methods', { methods }).then(result => {
    if (result.success) {
      invalidateCache('payment-methods');
      showAlert('Método removido!', 'success');
    } else {
      showAlert(`Erro ao remover: ${result.error}`, 'error');
    }
  });
}

// ─── Repo Section ───

function buildRepoContent(container) {
  const repo = getRepoConfig();

  const info = el('div', { style: { display: 'grid', gap: 'var(--space-sm)' } });
  info.append(
    el('div', {},
      el('span', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' } }, 'Proprietário: '),
      el('strong', {}, repo.owner || '—')
    ),
    el('div', {},
      el('span', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' } }, 'Repositório: '),
      el('strong', {}, repo.repo || '—')
    ),
    el('div', {},
      el('span', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' } }, 'Status: '),
      el('span', { style: { color: 'var(--color-income)', fontWeight: '700' } }, '✅ Conectado')
    )
  );

  container.append(info);
  container.append(
    el('p', { style: { color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-md)' } },
      'Para alterar o repositório, execute o assistente de configuração novamente.'
    )
  );
}

// ─── Main Render ───

function render() {
  const section = document.getElementById('view-settings');
  if (!section) return;
  section.innerHTML = '';

  const header = el('div', { className: 'section-header' });
  header.append(el('h2', {}, '⚙️ Configurações'));
  if (state.saving) {
    const spinner = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' } });
    spinner.append(el('div', { className: 'spinner spinner-sm' }), el('span', { style: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' } }, 'Salvando...'));
    header.append(spinner);
  }
  section.append(header);

  section.append(buildAccordion('pessoas', '👤 Pessoas', buildPeopleContent));
  section.append(buildAccordion('categorias', '🏷️ Categorias', buildCategoriesContent));
  section.append(buildAccordion('orcamento', '📊 Orçamento', buildBudgetContent));
  section.append(buildAccordion('pagamento', '💳 Métodos de Pagamento', buildPaymentContent));
  section.append(buildAccordion('repo', '🔗 Repositório', buildRepoContent));
}

// ─── Init ───

export async function initSettings() {
  const section = document.getElementById('view-settings');

  if (!isWizardDone()) {
    section.innerHTML = `
      <div class="placeholder-view">
        <div class="placeholder-icon">⚙️</div>
        <h2>Configurações</h2>
        <p>Complete o assistente de boas-vindas para configurar o app.</p>
      </div>
    `;
    return;
  }

  section.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:var(--space-2xl);">
      <div class="spinner spinner-lg"></div>
    </div>
  `;

  const [config, categories, paymentMethods] = await Promise.all([
    getConfig(),
    getCategories(),
    getPaymentMethods()
  ]);

  state.config = config || { _schema_version: 1, people: [], settings: {} };
  state.categories = categories || { _schema_version: 1, expense: [], income: [] };
  state.paymentMethods = paymentMethods || { _schema_version: 1, methods: [] };
  state.editingPersonId = null;
  state.editingCategory = null;
  state.budgetPerson = null;
  state.saving = false;

  render();
}
