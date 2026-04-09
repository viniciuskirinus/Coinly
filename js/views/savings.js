import { getSavings, getConfig, putCacheEntry } from '../modules/data-service.js';
import { dispatch } from '../modules/github-api.js';
import { formatCurrency, formatDate } from '../modules/format.js';
import { showAlert, showConfirm } from '../app.js';

let state = {
  savings: null,
  config: null,
  showForm: false,
  showDeposit: null,
  editGoal: null,
  expandedGoal: null
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
  if (!arr || !arr.length) return 1;
  return Math.max(...arr.map(i => i.id || 0)) + 1;
}

async function save(data) {
  putCacheEntry('savings', data);
  try {
    const result = await dispatch('update-savings', data);
    if (!result.success) showAlert(`Erro ao sincronizar poupanca: ${result.error}`, 'error');
  } catch (err) {
    console.error('[savings save]', err);
    showAlert('Erro ao sincronizar poupanca.', 'error');
  }
}

function renderGoalCard(goal) {
  const deposits = (state.savings.deposits || []).filter(d => d.goalId === goal.id);
  const totalDeposited = deposits.reduce((s, d) => s + d.amount, 0);
  const pct = goal.targetAmount > 0 ? Math.min(100, (totalDeposited / goal.targetAmount) * 100) : 0;
  const remaining = Math.max(0, goal.targetAmount - totalDeposited);

  const card = el('div', { className: 'savings-card' });

  const header = el('div', { className: 'savings-card__header' });
  header.append(
    el('div', {},
      el('div', { className: 'savings-card__name' }, goal.name),
      el('div', { className: 'savings-card__person' }, goal.person || '')
    ),
    el('div', { style: { display: 'flex', gap: 'var(--sp-1)' } },
      el('button', { className: 'btn-icon', title: 'Editar', onClick: () => { state.editGoal = goal.id; state.showForm = true; render(); } }, '\u270E'),
      el('button', { className: 'btn-icon', title: 'Remover', onClick: () => removeGoal(goal.id) }, '\u2715')
    )
  );

  const progress = el('div', { className: 'savings-card__progress' });
  progress.append(
    el('div', { className: 'savings-card__bar' },
      el('div', { className: 'savings-card__bar-fill', style: { width: `${pct}%`, background: goal.color || 'var(--accent)' } })
    ),
    el('div', { className: 'savings-card__values' },
      el('span', {}, formatCurrency(totalDeposited)),
      el('span', {}, `${pct.toFixed(0)}%`),
      el('span', {}, formatCurrency(goal.targetAmount))
    )
  );

  const amountEl = el('div', { className: 'savings-card__amount' }, formatCurrency(totalDeposited));

  const info = el('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' } });
  if (goal.deadline) info.textContent = `Prazo: ${goal.deadline} | Faltam: ${formatCurrency(remaining)}`;
  else info.textContent = `Faltam: ${formatCurrency(remaining)}`;

  const actions = el('div', { className: 'savings-card__actions' });
  actions.append(
    el('button', { className: 'btn btn-primary', style: { flex: '1', fontSize: 'var(--text-sm)' }, onClick: () => { state.showDeposit = goal.id; render(); } }, '+ Deposito'),
    el('button', { className: 'btn btn-ghost', style: { flex: '1', fontSize: 'var(--text-sm)' }, onClick: () => { state.showDeposit = -goal.id; render(); } }, '- Retirada')
  );

  const isExpanded = state.expandedGoal === goal.id;
  const toggleHistory = el('button', {
    className: 'btn btn-ghost',
    style: { width: '100%', fontSize: 'var(--text-xs)', marginTop: 'var(--sp-2)' },
    onClick: () => { state.expandedGoal = isExpanded ? null : goal.id; render(); }
  }, isExpanded ? 'Ocultar lancamentos' : `Ver lancamentos (${deposits.length})`);

  card.append(header, amountEl, progress, info, actions, toggleHistory);

  if (isExpanded) {
    card.append(renderDepositHistory(deposits, goal.id));
  }

  if (state.showDeposit === goal.id || state.showDeposit === -goal.id) {
    const isWithdraw = state.showDeposit < 0;
    card.append(renderDepositForm(goal.id, isWithdraw, totalDeposited));
  }

  return card;
}

function renderDepositHistory(deposits, goalId) {
  const wrapper = el('div', { style: { marginTop: 'var(--sp-3)', borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-3)' } });

  if (!deposits.length) {
    wrapper.append(el('p', { style: { color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', textAlign: 'center' } }, 'Nenhum lancamento ainda.'));
    return wrapper;
  }

  const sorted = [...deposits].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  sorted.forEach(d => {
    const isPositive = d.amount >= 0;
    const row = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-2) 0', borderBottom: '1px solid var(--border-light)', gap: 'var(--sp-2)' } });

    const left = el('div', { style: { minWidth: 0, flex: 1 } });
    left.append(
      el('div', { style: { fontSize: 'var(--text-sm)', fontWeight: '500' } }, d.note || (isPositive ? 'Deposito' : 'Retirada')),
      el('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' } }, formatDate(d.date))
    );

    const amountSpan = el('span', {
      style: { fontWeight: '600', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }
    }, `${isPositive ? '+' : ''}${formatCurrency(d.amount)}`);

    const deleteBtn = el('button', {
      className: 'btn-icon',
      title: 'Remover',
      style: { fontSize: '12px', minWidth: '24px', minHeight: '24px' },
      onClick: () => removeDeposit(d.id, goalId)
    }, '\u2715');

    row.append(left, amountSpan, deleteBtn);
    wrapper.append(row);
  });

  return wrapper;
}

async function removeDeposit(depositId, goalId) {
  if (!await showConfirm('Remover lançamento', 'Remover este lançamento?', { confirmText: 'Remover', danger: true })) return;
  state.savings.deposits = state.savings.deposits.filter(d => d.id !== depositId);
  render();
  showAlert('Lancamento removido!', 'success');
  save(state.savings);
}

function renderDepositForm(goalId, isWithdraw, currentTotal) {
  const form = el('div', { style: { marginTop: 'var(--sp-3)', padding: 'var(--sp-3)', background: 'var(--bg-hover)', borderRadius: 'var(--radius)' } });
  form.append(
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, isWithdraw ? 'Valor da retirada' : 'Valor do deposito'),
      el('input', { className: 'form-input', type: 'number', id: 'deposit-amount', min: '0.01', step: '0.01', placeholder: '0.00' })
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Nota (opcional)'),
      el('input', { className: 'form-input', type: 'text', id: 'deposit-note', placeholder: 'Ex: Deposito mensal' })
    ),
    el('div', { style: { display: 'flex', gap: 'var(--sp-2)' } },
      el('button', { className: `btn ${isWithdraw ? 'btn-danger' : 'btn-primary'}`, onClick: () => saveDeposit(goalId, isWithdraw, currentTotal) }, isWithdraw ? 'Retirar' : 'Depositar'),
      el('button', { className: 'btn btn-ghost', onClick: () => { state.showDeposit = null; render(); } }, 'Cancelar')
    )
  );
  return form;
}

async function saveDeposit(goalId, isWithdraw, currentTotal) {
  let amount = parseFloat(document.getElementById('deposit-amount')?.value);
  if (!amount || amount <= 0) { showAlert('Valor invalido.', 'error'); return; }
  if (isWithdraw && amount > currentTotal) { showAlert('Valor maior que o saldo.', 'error'); return; }
  if (isWithdraw) amount = -amount;

  const note = document.getElementById('deposit-note')?.value.trim() || '';
  const deposit = {
    id: nextId(state.savings.deposits),
    goalId,
    amount,
    date: new Date().toISOString().slice(0, 10),
    note
  };

  state.savings.deposits.push(deposit);
  state.showDeposit = null;
  render();
  showAlert(amount > 0 ? 'Deposito registrado!' : 'Retirada registrada!', 'success');
  await save(state.savings);
}

async function removeGoal(id) {
  const goal = state.savings.goals.find(g => g.id === id);
  if (!await showConfirm('Remover meta', `Remover meta "${goal?.name}"?\nDepósitos associados também serão removidos.`, { confirmText: 'Remover', danger: true })) return;

  state.savings.goals = state.savings.goals.filter(g => g.id !== id);
  state.savings.deposits = state.savings.deposits.filter(d => d.goalId !== id);
  render();
  showAlert('Meta removida!', 'success');
  save(state.savings);
}

function renderGoalForm() {
  const isEdit = state.editGoal != null;
  const existing = isEdit ? state.savings.goals.find(g => g.id === state.editGoal) : null;
  const people = state.config?.people || [];

  const overlay = el('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === overlay) { state.showForm = false; state.editGoal = null; render(); } } });
  const modal = el('div', { className: 'modal' });

  const header = el('div', { className: 'modal-header' });
  header.append(
    el('h3', {}, isEdit ? 'Editar Meta' : 'Nova Meta de Poupanca'),
    el('button', { className: 'modal-close', onClick: () => { state.showForm = false; state.editGoal = null; render(); } }, '\u2715')
  );

  const form = el('div');
  form.append(
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Nome da meta *'),
      el('input', { className: 'form-input', type: 'text', id: 'goal-name', value: existing?.name || '', placeholder: 'Ex: Reserva de emergencia' })
    ),
    el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' } },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Valor alvo (R$) *'),
        el('input', { className: 'form-input', type: 'number', id: 'goal-target', min: '0', step: '0.01', value: String(existing?.targetAmount || '') })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Prazo (opcional)'),
        el('input', { className: 'form-input', type: 'date', id: 'goal-deadline', value: existing?.deadline || '' })
      )
    ),
    el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' } },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Pessoa'),
        (() => {
          const sel = el('select', { className: 'form-select', id: 'goal-person' });
          people.forEach(p => {
            const opt = el('option', { value: p.name }, p.name.charAt(0).toUpperCase() + p.name.slice(1));
            if (existing?.person === p.name) opt.selected = true;
            sel.append(opt);
          });
          return sel;
        })()
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Cor'),
        el('input', { className: 'form-input', type: 'color', id: 'goal-color', value: existing?.color || '#4f46e5', style: { height: '38px', padding: '2px' } })
      )
    )
  );

  const actions = el('div', { className: 'modal-actions' });
  actions.append(
    el('button', { className: 'btn btn-ghost', onClick: () => { state.showForm = false; state.editGoal = null; render(); } }, 'Cancelar'),
    el('button', { className: 'btn btn-primary', onClick: () => saveGoal(isEdit, existing) }, isEdit ? 'Salvar' : 'Criar Meta')
  );

  modal.append(header, form, actions);
  overlay.append(modal);
  return overlay;
}

async function saveGoal(isEdit, existing) {
  const name = document.getElementById('goal-name')?.value.trim();
  const target = parseFloat(document.getElementById('goal-target')?.value);
  if (!name || !target || target <= 0) { showAlert('Nome e valor alvo sao obrigatorios.', 'error'); return; }

  const goalData = {
    id: isEdit ? existing.id : nextId(state.savings.goals),
    name,
    targetAmount: target,
    currentAmount: existing?.currentAmount || 0,
    deadline: document.getElementById('goal-deadline')?.value || '',
    person: document.getElementById('goal-person')?.value || '',
    color: document.getElementById('goal-color')?.value || '#4f46e5',
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  if (isEdit) {
    const idx = state.savings.goals.findIndex(g => g.id === existing.id);
    if (idx >= 0) state.savings.goals[idx] = goalData;
  } else {
    state.savings.goals.push(goalData);
  }

  state.showForm = false;
  state.editGoal = null;
  render();
  showAlert(isEdit ? 'Meta atualizada!' : 'Meta criada!', 'success');
  await save(state.savings);
}

function renderSummary() {
  const goals = state.savings?.goals || [];
  const deposits = state.savings?.deposits || [];

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = deposits.reduce((s, d) => s + d.amount, 0);
  const pct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

  const grid = el('div', { className: 'dash-summary-grid' });
  grid.append(
    buildSummaryCard('Total poupado', formatCurrency(totalSaved), 'summary-card--income'),
    buildSummaryCard('Total metas', formatCurrency(totalTarget), 'summary-card--salary'),
    buildSummaryCard('Progresso geral', `${pct.toFixed(0)}%`, pct >= 100 ? 'summary-card--positive' : '')
  );
  return grid;
}

function buildSummaryCard(label, value, cls) {
  const card = el('div', { className: `summary-card ${cls}` });
  card.append(
    el('div', { className: 'summary-card__label' }, label),
    el('div', { className: 'summary-card__value' }, value)
  );
  return card;
}

function render() {
  const section = document.getElementById('view-savings');
  if (!section) return;
  section.innerHTML = '';

  if (!state.savings) {
    section.append(el('div', { style: { display: 'flex', justifyContent: 'center', padding: 'var(--sp-10)' } },
      el('div', { className: 'spinner spinner-lg' })
    ));
    return;
  }

  const header = el('div', { className: 'section-header' });
  header.append(
    el('h2', {}, 'Poupanca'),
    el('button', { className: 'btn btn-primary', onClick: () => { state.showForm = true; state.editGoal = null; render(); } }, '+ Nova Meta')
  );
  section.append(header);

  section.append(renderSummary());

  const goals = state.savings.goals || [];
  if (!goals.length) {
    section.append(el('div', { className: 'empty-state' },
      el('div', { className: 'empty-icon' }, '\uD83C\uDFF3'),
      el('p', {}, 'Nenhuma meta criada. Comece sua poupanca!')
    ));
  } else {
    const grid = el('div', { className: 'savings-grid' });
    goals.forEach(g => grid.append(renderGoalCard(g)));
    section.append(grid);
  }

  if (state.showForm) {
    section.append(renderGoalForm());
  }
}

export async function initSavings() {
  const section = document.getElementById('view-savings');
  if (!section) return;

  section.innerHTML = '<div style="display:flex;justify-content:center;padding:var(--sp-10)"><div class="spinner spinner-lg"></div></div>';

  const [savings, config] = await Promise.all([
    getSavings(),
    getConfig()
  ]);

  state.savings = savings || { _schema_version: 1, goals: [], deposits: [] };
  state.config = config;
  state.showForm = false;
  state.showDeposit = null;
  state.editGoal = null;
  render();
}
