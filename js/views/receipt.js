import { getConfig, getCategories, getPaymentMethods, getTransactions, putCacheEntry, findDuplicates } from '../modules/data-service.js';
import { dispatch } from '../modules/github-api.js';
import { formatCurrency } from '../modules/format.js';
import { getState, setState, addPendingSync, resolvePendingSync } from '../modules/state.js';
import { isGeminiConfigured, analyzeReceipt, analyzeStatement, compressImage } from '../modules/gemini.js';
import { showAlert, navigate } from '../app.js';
import { recordSalaryChange } from './salary-history.js';

const SALARY_KEYWORDS = ['salário', 'salario', 'salary', 'holerite', 'pagamento mensal', 'remuneração', 'remuneracao', 'folha de pagamento', 'vencimento', 'proventos'];

let state = {
  tab: 'receipt',
  file: null,
  preview: null,
  analyzing: false,
  receiptResult: null,
  statementItems: null,
  config: null,
  categories: null,
  paymentMethods: null,
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

function getSection() {
  return document.getElementById('view-receipt');
}

function render() {
  const section = getSection();
  if (!section) return;
  section.innerHTML = '';

  if (!isGeminiConfigured()) {
    renderNotConfigured(section);
    return;
  }

  const header = el('div', { className: 'section-header' });
  header.append(el('h2', {}, '📸 Scanner IA'));
  section.append(header);

  section.append(buildTabs());

  if (state.tab === 'receipt') {
    renderReceiptTab(section);
  } else {
    renderStatementTab(section);
  }
}

function renderNotConfigured(section) {
  const card = el('div', { className: 'card', style: { textAlign: 'center', padding: 'var(--sp-10)' } });
  card.append(
    el('div', { style: { fontSize: '48px', marginBottom: 'var(--sp-4)' } }, '🤖'),
    el('h3', { style: { marginBottom: 'var(--sp-4)' } }, 'Gemini AI não configurado'),
    el('p', { style: { color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' } },
      'Configure sua chave da API Gemini nas Configurações para usar o scanner de comprovantes.'
    ),
    el('button', {
      className: 'btn btn-primary',
      onClick: () => navigate('settings')
    }, '⚙️ Ir para Configurações')
  );
  section.append(card);
}

function buildTabs() {
  const tabs = el('div', { className: 'toggle-group', style: { marginBottom: 'var(--sp-6)' } });

  const receiptBtn = el('button', {
    className: `toggle-option${state.tab === 'receipt' ? ' active' : ''}`,
    onClick: () => { state.tab = 'receipt'; state.file = null; state.preview = null; state.receiptResult = null; state.statementItems = null; render(); }
  }, '📸 Comprovante');

  const statementBtn = el('button', {
    className: `toggle-option${state.tab === 'statement' ? ' active' : ''}`,
    onClick: () => { state.tab = 'statement'; state.file = null; state.preview = null; state.receiptResult = null; state.statementItems = null; render(); }
  }, '📄 Fatura');

  tabs.append(receiptBtn, statementBtn);
  return tabs;
}

function buildUploadArea(onFileSelected) {
  const area = el('div', {
    className: 'card',
    style: {
      border: '2px dashed var(--border)',
      textAlign: 'center',
      padding: 'var(--sp-10)',
      cursor: 'pointer',
      transition: 'border-color 0.2s, background 0.2s'
    }
  });

  const input = el('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp,image/heic,application/pdf',
    style: { display: 'none' }
  });

  input.addEventListener('change', (e) => {
    if (e.target.files?.[0]) onFileSelected(e.target.files[0]);
  });

  area.addEventListener('click', () => input.click());

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.style.borderColor = 'var(--accent)';
    area.style.background = 'var(--bg-hover)';
  });
  area.addEventListener('dragleave', () => {
    area.style.borderColor = 'var(--border)';
    area.style.background = '';
  });
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.style.borderColor = 'var(--border)';
    area.style.background = '';
    if (e.dataTransfer.files?.[0]) onFileSelected(e.dataTransfer.files[0]);
  });

  area.append(
    input,
    el('div', { style: { fontSize: '48px', marginBottom: 'var(--sp-4)' } }, '📷'),
    el('p', { style: { fontWeight: '600', marginBottom: 'var(--sp-1)' } }, 'Clique ou arraste um arquivo'),
    el('p', { style: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' } }, 'JPG, PNG, WebP, HEIC ou PDF')
  );

  return area;
}

function buildPreviewBar(onAnalyze, label) {
  const bar = el('div', {
    className: 'card',
    style: { display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4)' }
  });

  if (state.preview) {
    const thumb = el('img', {
      src: state.preview,
      style: { width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius)' }
    });
    bar.append(thumb);
  }

  const info = el('div', { style: { flex: '1' } });
  info.append(
    el('div', { style: { fontWeight: '600' } }, state.file?.name || 'Imagem'),
    el('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' } },
      state.file ? `${(state.file.size / 1024).toFixed(0)} KB` : ''
    )
  );
  bar.append(info);

  if (state.analyzing) {
    const spinnerWrap = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' } });
    spinnerWrap.append(
      el('div', { className: 'spinner spinner-sm' }),
      el('span', { style: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' } }, label)
    );
    bar.append(spinnerWrap);
  } else {
    bar.append(
      el('button', { className: 'btn btn-ghost', onClick: () => { state.file = null; state.preview = null; state.receiptResult = null; state.statementItems = null; render(); } }, '✕'),
      el('button', { className: 'btn btn-primary', onClick: onAnalyze }, '🤖 Analisar com IA')
    );
  }

  return bar;
}

// ─── Receipt Tab ───

function renderReceiptTab(section) {
  if (!state.file) {
    section.append(buildUploadArea(handleFileSelected));
    return;
  }

  section.append(buildPreviewBar(handleAnalyzeReceipt, 'Analisando comprovante...'));

  if (state.receiptResult) {
    section.append(buildReceiptForm());
  }
}

function handleFileSelected(file) {
  state.file = file;
  state.receiptResult = null;
  state.statementItems = null;

  const reader = new FileReader();
  reader.onload = (e) => {
    state.preview = e.target.result;
    render();
  };
  reader.readAsDataURL(file);
}

async function handleAnalyzeReceipt() {
  if (!state.file) return;
  state.analyzing = true;
  render();

  try {
    const { base64, mimeType } = await compressImage(state.file);
    const result = await analyzeReceipt(base64, mimeType, state.categories);
    state.receiptResult = result;
  } catch (err) {
    console.error('analyzeReceipt error:', err);
    showAlert(`Erro ao analisar: ${err.message}`, 'error');
  } finally {
    state.analyzing = false;
    render();
  }
}

function buildReceiptForm() {
  const r = state.receiptResult;
  const config = state.config;
  const categories = state.categories;
  const people = config?.people || [];
  const methods = state.paymentMethods?.methods || [];
  const type = r.type || 'expense';
  const cats = categories?.[type] || [];

  const card = el('div', { className: 'card', style: { marginTop: 'var(--sp-4)' } });

  const badge = el('div', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-1)',
      padding: '2px 10px', borderRadius: '12px',
      fontSize: 'var(--text-sm)', fontWeight: '600',
      background: 'var(--bg-hover)', color: 'var(--accent)',
      marginBottom: 'var(--sp-4)'
    }
  }, '🤖 Preenchido por IA');

  const form = el('form', { id: 'receipt-form', noValidate: 'true' });

  const typeToggle = el('div', { className: 'form-group' });
  typeToggle.append(el('label', { className: 'form-label' }, 'Tipo'));
  const toggleGrp = el('div', { className: 'toggle-group', id: 'r-type-toggle' });
  const expBtn = el('button', { type: 'button', className: `toggle-option${type === 'expense' ? ' active' : ''}`, 'data-value': 'expense' }, 'Despesa');
  const incBtn = el('button', { type: 'button', className: `toggle-option${type === 'income' ? ' active' : ''}`, 'data-value': 'income' }, 'Receita');
  toggleGrp.append(expBtn, incBtn);
  typeToggle.append(toggleGrp);

  const dateGrp = buildFormGroup('Data',
    el('input', { className: 'form-input', type: 'date', id: 'r-date', value: r.date || new Date().toISOString().slice(0, 10) })
  );

  const descGrp = buildFormGroup('Descrição',
    el('input', { className: 'form-input', type: 'text', id: 'r-description', value: r.description || '' })
  );

  const amountGrp = buildFormGroup('Valor (R$)',
    el('input', { className: 'form-input', type: 'number', id: 'r-amount', step: '0.01', min: '0.01', value: String(r.amount || '') })
  );

  const catSelect = el('select', { className: 'form-select', id: 'r-category' });
  catSelect.append(el('option', { value: '' }, 'Selecione...'));
  cats.forEach(c => {
    const opt = el('option', { value: c.name }, `${c.icon} ${c.name}`);
    if (c.name === r.category) opt.selected = true;
    catSelect.append(opt);
  });
  const catGrp = buildFormGroup('Categoria', catSelect);

  const subSelect = el('select', { className: 'form-select', id: 'r-subcategory' });
  subSelect.append(el('option', { value: '' }, 'Nenhuma'));
  const selectedCat = cats.find(c => c.name === r.category);
  if (selectedCat?.subcategories) {
    selectedCat.subcategories.forEach(s => {
      const opt = el('option', { value: s }, s);
      if (s === r.subcategory) opt.selected = true;
      subSelect.append(opt);
    });
  }
  const subGrp = buildFormGroup('Subcategoria', subSelect);
  if (!selectedCat?.subcategories?.length) subGrp.style.display = 'none';

  let personGrp = null;
  if (people.length > 1) {
    const personSelect = el('select', { className: 'form-select', id: 'r-person' });
    people.forEach(p => personSelect.append(el('option', { value: p.name }, p.name)));
    personGrp = buildFormGroup('Pessoa', personSelect);
  }

  const paySelect = el('select', { className: 'form-select', id: 'r-payment' });
  methods.forEach(m => paySelect.append(el('option', { value: m }, m)));
  const payGrp = buildFormGroup('Método de Pagamento', paySelect);

  const notesGrp = buildFormGroup('Observação',
    el('textarea', { className: 'form-input', id: 'r-notes', rows: '2', placeholder: 'Opcional...' })
  );

  const submitBtn = el('button', {
    type: 'submit',
    className: 'btn btn-primary',
    style: { width: '100%', marginTop: 'var(--sp-4)' }
  }, '💾 Salvar Transação');

  form.append(typeToggle, dateGrp, descGrp, amountGrp, catGrp, subGrp);
  if (personGrp) form.append(personGrp);
  form.append(payGrp, notesGrp, submitBtn);

  [expBtn, incBtn].forEach(btn => {
    btn.addEventListener('click', () => {
      [expBtn, incBtn].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const newType = btn.dataset.value;
      const newCats = categories?.[newType] || [];
      catSelect.innerHTML = '<option value="">Selecione...</option>';
      newCats.forEach(c => catSelect.append(el('option', { value: c.name }, `${c.icon} ${c.name}`)));
      subGrp.style.display = 'none';
    });
  });

  catSelect.addEventListener('change', () => {
    const activeType = form.querySelector('#r-type-toggle .toggle-option.active')?.dataset.value || 'expense';
    const activeCats = categories?.[activeType] || [];
    const cat = activeCats.find(c => c.name === catSelect.value);
    subSelect.innerHTML = '<option value="">Nenhuma</option>';
    if (cat?.subcategories?.length) {
      cat.subcategories.forEach(s => subSelect.append(el('option', { value: s }, s)));
      subGrp.style.display = '';
    } else {
      subGrp.style.display = 'none';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveReceiptTransaction(form, people);
  });

  card.append(badge, form);
  return card;
}

async function saveReceiptTransaction(form, people) {
  const activeType = form.querySelector('#r-type-toggle .toggle-option.active')?.dataset.value || 'expense';
  const dateVal = form.querySelector('#r-date').value;
  const description = form.querySelector('#r-description').value.trim();
  const amount = parseFloat(form.querySelector('#r-amount').value);
  const category = form.querySelector('#r-category').value;
  const subcategory = form.querySelector('#r-subcategory').value || '';
  const person = form.querySelector('#r-person')?.value || (people[0]?.name || '');
  const paymentMethod = form.querySelector('#r-payment').value;
  const notes = form.querySelector('#r-notes').value.trim();

  if (!dateVal || !description || !amount || amount <= 0 || !category) {
    showAlert('Preencha todos os campos obrigatórios.', 'error');
    return;
  }

  const yearMonth = dateVal.slice(0, 7);
  const tempId = -Date.now();
  const txnData = {
    id: tempId,
    date: dateVal,
    description,
    amount,
    type: activeType,
    category,
    subcategory,
    person,
    paymentMethod,
    notes,
    source: 'gemini-receipt',
    createdAt: new Date().toISOString()
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Salvando...';

  try {
    const existing = await getTransactions(yearMonth);
    const fileData = existing || { _schema_version: 1, month: yearMonth, lastId: 0, transactions: [] };

    const dupes = findDuplicates(fileData.transactions, txnData);
    if (dupes.length > 0) {
      const proceed = confirm(`⚠️ Possível duplicata!\n\nJá existe transação em ${dateVal} com "${description}" no valor de R$ ${amount.toFixed(2)}.\n\nDeseja salvar mesmo assim?`);
      if (!proceed) {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Salvar Transação';
        return;
      }
    }

    fileData.transactions = [...fileData.transactions, txnData];
    putCacheEntry(`txn-${yearMonth}`, { ...fileData });

    const appState = getState();
    setState({ transactions: [...appState.transactions, txnData] });
    addPendingSync(tempId, 'create');

    showAlert('Transação registrada via IA!', 'success');

    const dispatchData = { ...txnData };
    delete dispatchData.id;
    const result = await dispatch('create-transaction', dispatchData, yearMonth);
    resolvePendingSync(tempId, result?.success ?? false);

    if (!result?.success) {
      showAlert('Erro ao sincronizar: ' + (result?.error || 'desconhecido'), 'warning');
    }

    if (activeType === 'income' && amount > 0) {
      const descLower = description.toLowerCase();
      const isSalary = SALARY_KEYWORDS.some(kw => descLower.includes(kw));
      if (isSalary) {
        checkAndOfferSalaryUpdate(person, amount);
      }
    }

    state.file = null;
    state.preview = null;
    state.receiptResult = null;
    render();
  } catch (err) {
    console.error('save receipt error:', err);
    showAlert('Erro ao salvar transação.', 'error');
    resolvePendingSync(tempId, false);
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Salvar Transação';
  }
}

// ─── Statement Tab ───

function renderStatementTab(section) {
  if (!state.file) {
    section.append(buildUploadArea(handleFileSelected));
    return;
  }

  section.append(buildPreviewBar(handleAnalyzeStatement, 'Analisando fatura...'));

  if (state.statementItems) {
    section.append(buildStatementTable());
  }
}

async function handleAnalyzeStatement() {
  if (!state.file) return;
  state.analyzing = true;
  render();

  try {
    const { base64, mimeType } = await compressImage(state.file);
    const items = await analyzeStatement(base64, mimeType, state.categories);
    state.statementItems = (Array.isArray(items) ? items : []).map((item, i) => ({
      ...item,
      _id: i,
      _selected: true
    }));
  } catch (err) {
    console.error('analyzeStatement error:', err);
    showAlert(`Erro ao analisar fatura: ${err.message}`, 'error');
  } finally {
    state.analyzing = false;
    render();
  }
}

function buildStatementTable() {
  const items = state.statementItems || [];
  const expenseCats = state.categories?.expense || [];

  const card = el('div', { className: 'card', style: { marginTop: 'var(--sp-4)', overflowX: 'auto' } });

  const badge = el('div', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-1)',
      padding: '2px 10px', borderRadius: '12px',
      fontSize: 'var(--text-sm)', fontWeight: '600',
      background: 'var(--bg-hover)', color: 'var(--accent)',
      marginBottom: 'var(--sp-4)'
    }
  }, `🤖 ${items.length} itens encontrados`);

  if (!items.length) {
    card.append(badge, el('p', { style: { color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--sp-6)' } }, 'Nenhum item identificado na fatura.'));
    return card;
  }

  const table = el('table', { className: 'data-table' });

  const allSelected = items.every(i => i._selected);
  const thead = el('thead');
  const headerRow = el('tr');
  const selectAllCb = el('input', {
    type: 'checkbox',
    onChange: (e) => {
      items.forEach(i => i._selected = e.target.checked);
      render();
    }
  });
  selectAllCb.checked = allSelected;

  headerRow.append(
    el('th', { style: { width: '40px' } }, selectAllCb),
    el('th', {}, 'Data'),
    el('th', {}, 'Descrição'),
    el('th', {}, 'Categoria'),
    el('th', { style: { textAlign: 'right' } }, 'Valor')
  );
  thead.append(headerRow);

  const tbody = el('tbody');
  items.forEach((item) => {
    const row = el('tr');

    const cb = el('input', {
      type: 'checkbox',
      onChange: (e) => { item._selected = e.target.checked; render(); }
    });
    cb.checked = item._selected;

    const dateInput = el('input', {
      className: 'form-input', type: 'date', value: item.date || '',
      style: { fontSize: 'var(--text-sm)', padding: '4px' },
      onChange: (e) => { item.date = e.target.value; }
    });

    const descInput = el('input', {
      className: 'form-input', type: 'text', value: item.description || '',
      style: { fontSize: 'var(--text-sm)', padding: '4px', minWidth: '150px' },
      onChange: (e) => { item.description = e.target.value; }
    });

    const catSelect = el('select', {
      className: 'form-select',
      style: { fontSize: 'var(--text-sm)', padding: '4px' },
      onChange: (e) => { item.category = e.target.value; }
    });
    catSelect.append(el('option', { value: '' }, '—'));
    expenseCats.forEach(c => {
      const opt = el('option', { value: c.name }, `${c.icon} ${c.name}`);
      if (c.name === item.category) opt.selected = true;
      catSelect.append(opt);
    });

    const amountInput = el('input', {
      className: 'form-input', type: 'number', step: '0.01', value: String(item.amount || ''),
      style: { fontSize: 'var(--text-sm)', padding: '4px', width: '100px', textAlign: 'right' },
      onChange: (e) => { item.amount = parseFloat(e.target.value) || 0; }
    });

    row.append(
      el('td', {}, cb),
      el('td', {}, dateInput),
      el('td', {}, descInput),
      el('td', {}, catSelect),
      el('td', { style: { textAlign: 'right' } }, amountInput)
    );
    tbody.append(row);
  });

  table.append(thead, tbody);

  const selectedCount = items.filter(i => i._selected).length;
  const selectedTotal = items.filter(i => i._selected).reduce((s, i) => s + (i.amount || 0), 0);

  const footer = el('div', {
    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-4)', flexWrap: 'wrap', gap: 'var(--sp-2)' }
  });

  footer.append(
    el('span', { style: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' } },
      `${selectedCount} de ${items.length} selecionados · Total: ${formatCurrency(selectedTotal)}`
    )
  );

  const actions = el('div', { style: { display: 'flex', gap: 'var(--sp-2)' } });
  const people = state.config?.people || [];

  if (people.length > 1) {
    const personSelect = el('select', { className: 'form-select', id: 'stmt-person', style: { fontSize: 'var(--text-sm)' } });
    people.forEach(p => personSelect.append(el('option', { value: p.name }, p.name)));
    actions.append(personSelect);
  }

  const paySelect = el('select', { className: 'form-select', id: 'stmt-payment', style: { fontSize: 'var(--text-sm)' } });
  (state.paymentMethods?.methods || []).forEach(m => paySelect.append(el('option', { value: m }, m)));
  actions.append(paySelect);

  actions.append(
    el('button', {
      className: 'btn btn-primary',
      disabled: selectedCount === 0 ? 'true' : undefined,
      onClick: saveStatementItems
    }, `💾 Salvar ${selectedCount} Selecionados`)
  );

  footer.append(actions);
  card.append(badge, table, footer);
  return card;
}

async function saveStatementItems() {
  const items = (state.statementItems || []).filter(i => i._selected);
  if (!items.length) { showAlert('Nenhum item selecionado.', 'error'); return; }

  const people = state.config?.people || [];
  const person = document.getElementById('stmt-person')?.value || (people[0]?.name || '');
  const paymentMethod = document.getElementById('stmt-payment')?.value || '';

  state.saving = true;
  render();

  let successCount = 0;
  let errorCount = 0;
  let dupeCount = 0;

  for (const item of items) {
    if (!item.date || !item.description || !item.amount) {
      errorCount++;
      continue;
    }

    const yearMonth = item.date.slice(0, 7);
    const tempId = -Date.now() - item._id;
    const txnData = {
      id: tempId,
      date: item.date,
      description: item.description,
      amount: item.amount,
      type: 'expense',
      category: item.category || '',
      subcategory: item.subcategory || '',
      person,
      paymentMethod,
      notes: '',
      source: 'gemini-statement',
      createdAt: new Date().toISOString()
    };

    try {
      const existing = await getTransactions(yearMonth);
      const fileData = existing || { _schema_version: 1, month: yearMonth, lastId: 0, transactions: [] };

      const dupes = findDuplicates(fileData.transactions, txnData);
      if (dupes.length > 0) {
        dupeCount++;
        item._duplicate = true;
      }

      fileData.transactions = [...fileData.transactions, txnData];
      putCacheEntry(`txn-${yearMonth}`, { ...fileData });

      addPendingSync(tempId, 'create');

      const dispatchData = { ...txnData };
      delete dispatchData.id;
      const result = await dispatch('create-transaction', dispatchData, yearMonth);
      resolvePendingSync(tempId, result?.success ?? false);
      successCount++;
    } catch {
      errorCount++;
      resolvePendingSync(tempId, false);
    }
  }

  state.saving = false;

  if (successCount > 0) {
    showAlert(`${successCount} transações salvas via IA!`, 'success');
  }
  if (dupeCount > 0) {
    showAlert(`⚠️ ${dupeCount} possíveis duplicatas detectadas (foram salvas mesmo assim).`, 'warning');
  }
  if (errorCount > 0) {
    showAlert(`${errorCount} itens com erro.`, 'warning');
  }

  state.file = null;
  state.preview = null;
  state.statementItems = null;
  render();
}

async function checkAndOfferSalaryUpdate(personName, amount) {
  const config = state.config;
  if (!config?.people?.length) return;

  const person = config.people.find(p => p.name === personName);
  if (!person) return;

  const currentSalary = person.salary || 0;
  if (Math.abs(currentSalary - amount) < 0.01) return;

  const msg = currentSalary > 0
    ? `Salário detectado: ${formatCurrency(amount)}.\n\nAtualizar o salário de "${person.name}" (atual: ${formatCurrency(currentSalary)})?`
    : `Salário detectado: ${formatCurrency(amount)}.\n\nDefinir como salário de "${person.name}"?`;

  if (!confirm(msg)) return;

  await recordSalaryChange(personName, amount);
  showAlert(`Salário de "${person.name}" atualizado para ${formatCurrency(amount)}!`, 'success');
}

function buildFormGroup(label, input) {
  return el('div', { className: 'form-group' },
    el('label', { className: 'form-label' }, label),
    input
  );
}

// ─── Init ───

export async function initReceipt() {
  const section = getSection();
  if (!section) return;

  section.innerHTML = '<div style="text-align:center;padding:var(--sp-10)"><span class="spinner spinner-lg"></span></div>';

  try {
    const [config, categories, paymentMethods] = await Promise.all([
      getConfig(),
      getCategories(),
      getPaymentMethods()
    ]);
    state.config = config;
    state.categories = categories;
    state.paymentMethods = paymentMethods;
  } catch (err) {
    console.error('initReceipt load error:', err);
  }

  state.file = null;
  state.preview = null;
  state.analyzing = false;
  state.receiptResult = null;
  state.statementItems = null;
  state.saving = false;

  render();
}
