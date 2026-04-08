import { getConfig, getCategories, getPaymentMethods, getTransactions, invalidateCache, putCacheEntry } from '../modules/data-service.js';
import { dispatch } from '../modules/github-api.js';
import { formatCurrency, getCurrentYearMonth } from '../modules/format.js';
import { getState, setState, addPendingSync, resolvePendingSync } from '../modules/state.js';
import { showAlert } from '../app.js';
import { isGeminiConfigured, suggestCategory } from '../modules/gemini.js';

export async function initTransaction() {
  const section = document.getElementById('view-transaction');
  section.innerHTML = '<div style="text-align:center;padding:var(--space-2xl)"><span class="spinner spinner-lg"></span></div>';

  try {
    const [config, categories, paymentMethods] = await Promise.all([
      getConfig(),
      getCategories(),
      getPaymentMethods()
    ]);

    if (!config || !categories || !paymentMethods) {
      section.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Não foi possível carregar os dados necessários.</p></div>';
      return;
    }

    setState({ config, categories, paymentMethods });
    render(section, config, categories, paymentMethods);
  } catch (err) {
    console.error('initTransaction error:', err);
    section.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Erro ao carregar formulário.</p></div>';
  }
}

function render(section, config, categories, paymentMethods) {
  const people = config.people || [];
  const methods = paymentMethods.methods || [];
  const today = new Date().toISOString().slice(0, 10);
  const showPersonField = people.length > 1;

  section.innerHTML = `
    <div class="section-header">
      <h2>💳 Nova Transação</h2>
    </div>
    <div class="card" style="max-width:600px">
      <form id="txn-form" novalidate>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <div class="toggle-group" id="txn-type-toggle">
            <button type="button" class="toggle-option active" data-value="expense">Despesa</button>
            <button type="button" class="toggle-option" data-value="income">Receita</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="txn-date">Data</label>
          <input type="date" id="txn-date" class="form-input" value="${today}" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="txn-description">Descrição</label>
          <input type="text" id="txn-description" class="form-input" placeholder="Ex: Supermercado, Salário..." required>
          <div id="txn-ai-hint" style="display:none;margin-top:4px;padding:6px 10px;border-radius:8px;background:var(--color-surface-hover);font-size:var(--font-size-sm);display:none;align-items:center;gap:6px;flex-wrap:wrap"></div>
        </div>

        <div class="form-group">
          <label class="form-label" for="txn-amount">Valor (R$)</label>
          <input type="number" id="txn-amount" class="form-input" step="0.01" min="0.01" placeholder="0,00" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="txn-category">Categoria</label>
          <select id="txn-category" class="form-select" required>
            <option value="">Selecione...</option>
          </select>
        </div>

        <div class="form-group" id="txn-subcategory-group" style="display:none">
          <label class="form-label" for="txn-subcategory">Subcategoria</label>
          <select id="txn-subcategory" class="form-select">
            <option value="">Nenhuma</option>
          </select>
        </div>

        ${showPersonField ? `
        <div class="form-group">
          <label class="form-label" for="txn-person">Pessoa</label>
          <select id="txn-person" class="form-select" required>
            ${people.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
          </select>
        </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label" for="txn-payment">Método de Pagamento</label>
          <select id="txn-payment" class="form-select" required>
            ${methods.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="txn-notes">Observação</label>
          <textarea id="txn-notes" class="form-input" rows="2" placeholder="Opcional..."></textarea>
        </div>

        <div id="txn-credit-info" style="display:none" class="alert alert-info" style="margin-bottom:var(--space-md)">
          📅 Lançado na fatura do mês seguinte
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%">Registrar Transação</button>
      </form>
    </div>
  `;

  bindEvents(section, config, categories, people);
}

function bindEvents(section, config, categories, people) {
  const form = section.querySelector('#txn-form');
  const toggleBtns = section.querySelectorAll('#txn-type-toggle .toggle-option');
  const categorySelect = section.querySelector('#txn-category');
  const subcategoryGroup = section.querySelector('#txn-subcategory-group');
  const subcategorySelect = section.querySelector('#txn-subcategory');
  const dateInput = section.querySelector('#txn-date');
  const paymentSelect = section.querySelector('#txn-payment');
  const creditInfo = section.querySelector('#txn-credit-info');

  let currentType = 'expense';

  function populateCategories(type) {
    const cats = categories[type] || [];
    categorySelect.innerHTML = '<option value="">Selecione...</option>' +
      cats.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
    subcategoryGroup.style.display = 'none';
    subcategorySelect.innerHTML = '<option value="">Nenhuma</option>';
  }

  populateCategories(currentType);

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.value;
      populateCategories(currentType);
      updateCreditCardInfo();
    });
  });

  categorySelect.addEventListener('change', () => {
    const catName = categorySelect.value;
    const cats = categories[currentType] || [];
    const cat = cats.find(c => c.name === catName);
    const subs = cat?.subcategories || [];

    if (subs.length > 0) {
      subcategoryGroup.style.display = '';
      subcategorySelect.innerHTML = '<option value="">Nenhuma</option>' +
        subs.map(s => `<option value="${s}">${s}</option>`).join('');
    } else {
      subcategoryGroup.style.display = 'none';
      subcategorySelect.innerHTML = '<option value="">Nenhuma</option>';
    }
  });

  function updateCreditCardInfo() {
    const payment = paymentSelect.value;
    const dateVal = dateInput.value;
    if (!creditInfo) return;

    if (payment === 'Cartão de Crédito' && dateVal) {
      const adjusted = getCreditCardAdjustedMonth(dateVal, people, section);
      creditInfo.style.display = adjusted.wasAdjusted ? '' : 'none';
    } else {
      creditInfo.style.display = 'none';
    }
  }

  paymentSelect.addEventListener('change', updateCreditCardInfo);
  dateInput.addEventListener('change', updateCreditCardInfo);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit(section, config, categories, people, currentType);
  });

  let aiDebounce = null;
  const descInput = section.querySelector('#txn-description');
  const aiHint = section.querySelector('#txn-ai-hint');

  if (descInput && aiHint && isGeminiConfigured()) {
    descInput.addEventListener('input', () => {
      clearTimeout(aiDebounce);
      const text = descInput.value.trim();
      if (text.length < 3) {
        aiHint.style.display = 'none';
        return;
      }
      aiDebounce = setTimeout(async () => {
        try {
          const suggestion = await suggestCategory(text, categories);
          if (!suggestion?.category) { aiHint.style.display = 'none'; return; }

          if (suggestion.type && suggestion.type !== currentType) {
            const matchBtn = section.querySelector(`.toggle-option[data-value="${suggestion.type}"]`);
            if (matchBtn) {
              toggleBtns.forEach(b => b.classList.remove('active'));
              matchBtn.classList.add('active');
              currentType = suggestion.type;
              populateCategories(currentType);
            }
          }

          aiHint.innerHTML = '';
          aiHint.style.display = 'flex';

          const label = document.createElement('span');
          label.textContent = `💡 Sugestão: ${suggestion.category}`;
          label.style.color = 'var(--color-text-secondary)';

          const acceptBtn = document.createElement('button');
          acceptBtn.type = 'button';
          acceptBtn.className = 'btn btn-ghost';
          acceptBtn.style.cssText = 'padding:2px 8px;font-size:var(--font-size-sm);min-height:0';
          acceptBtn.textContent = 'Aceitar';
          acceptBtn.addEventListener('click', () => {
            categorySelect.value = suggestion.category;
            categorySelect.dispatchEvent(new Event('change'));
            if (suggestion.subcategory) {
              setTimeout(() => {
                const subSel = section.querySelector('#txn-subcategory');
                if (subSel) subSel.value = suggestion.subcategory;
              }, 50);
            }
            aiHint.style.display = 'none';
          });

          aiHint.append(label, acceptBtn);
        } catch {
          aiHint.style.display = 'none';
        }
      }, 500);
    });
  }
}

function getCreditCardAdjustedMonth(dateStr, people, section) {
  const personSelect = section.querySelector('#txn-person');
  const personName = personSelect ? personSelect.value : (people[0]?.name || '');
  const person = people.find(p => p.name === personName);

  if (!person?.creditCard?.closingDay) {
    return { yearMonth: dateStr.slice(0, 7), wasAdjusted: false };
  }

  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDate();
  const closingDay = person.creditCard.closingDay;

  if (day > closingDay) {
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const ym = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    return { yearMonth: ym, wasAdjusted: true };
  }

  return { yearMonth: dateStr.slice(0, 7), wasAdjusted: false };
}

async function handleSubmit(section, config, categories, people, currentType) {
  const form = section.querySelector('#txn-form');
  const dateInput = section.querySelector('#txn-date');
  const descInput = section.querySelector('#txn-description');
  const amountInput = section.querySelector('#txn-amount');
  const categorySelect = section.querySelector('#txn-category');
  const subcategorySelect = section.querySelector('#txn-subcategory');
  const personSelect = section.querySelector('#txn-person');
  const paymentSelect = section.querySelector('#txn-payment');
  const notesInput = section.querySelector('#txn-notes');

  const dateVal = dateInput.value;
  const description = descInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categorySelect.value;
  const subcategory = subcategorySelect.value || '';
  const person = personSelect ? personSelect.value : (people[0]?.name || '');
  const paymentMethod = paymentSelect.value;
  const notes = notesInput.value.trim();

  if (!dateVal || !description || !amount || amount <= 0 || !category || !paymentMethod) {
    showAlert('Preencha todos os campos obrigatórios.', 'error');
    return;
  }

  let yearMonth = dateVal.slice(0, 7);
  if (paymentMethod === 'Cartão de Crédito') {
    const adjusted = getCreditCardAdjustedMonth(dateVal, people, section);
    yearMonth = adjusted.yearMonth;
  }

  const tempId = -Date.now();
  const txnData = {
    id: tempId,
    date: dateVal,
    description,
    amount,
    type: currentType,
    category,
    subcategory,
    person,
    paymentMethod,
    notes,
    createdAt: new Date().toISOString()
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registrando...';

  try {
    const cacheKey = `txn-${yearMonth}`;
    const existing = await getTransactions(yearMonth);
    const fileData = existing || { _schema_version: 1, month: yearMonth, lastId: 0, transactions: [] };
    fileData.transactions = [...fileData.transactions, txnData];
    putCacheEntry(cacheKey, { ...fileData });

    const state = getState();
    setState({ transactions: [...state.transactions, txnData] });

    showAlert('Transação registrada!', 'success');
    resetForm(section);

    addPendingSync(tempId, 'create');

    const dispatchData = { ...txnData };
    delete dispatchData.id;

    const result = await dispatch('create-transaction', dispatchData, yearMonth);
    resolvePendingSync(tempId, result?.success ?? false);

    if (!result?.success) {
      showAlert('Erro ao sincronizar: ' + (result?.error || 'desconhecido'), 'warning');
    }
  } catch (err) {
    console.error('submit error:', err);
    showAlert('Erro ao registrar transação.', 'error');
    resolvePendingSync(tempId, false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Registrar Transação';
  }
}

function resetForm(section) {
  const form = section.querySelector('#txn-form');
  if (!form) return;

  const today = new Date().toISOString().slice(0, 10);
  section.querySelector('#txn-date').value = today;
  section.querySelector('#txn-description').value = '';
  section.querySelector('#txn-amount').value = '';
  section.querySelector('#txn-notes').value = '';

  const categorySelect = section.querySelector('#txn-category');
  if (categorySelect) categorySelect.selectedIndex = 0;

  const subcategoryGroup = section.querySelector('#txn-subcategory-group');
  if (subcategoryGroup) subcategoryGroup.style.display = 'none';

  const creditInfo = section.querySelector('#txn-credit-info');
  if (creditInfo) creditInfo.style.display = 'none';

  const toggleBtns = section.querySelectorAll('#txn-type-toggle .toggle-option');
  toggleBtns.forEach(b => b.classList.remove('active'));
  const expenseBtn = section.querySelector('.toggle-option[data-value="expense"]');
  if (expenseBtn) expenseBtn.classList.add('active');
}
