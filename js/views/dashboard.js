import { getConfig, getTransactions, getCategories, invalidateCache } from '../modules/data-service.js';
import { formatCurrency, getCurrentYearMonth, formatDate } from '../modules/format.js';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

let currentYearMonth = getCurrentYearMonth();
let currentPerson = 'all';
let doughnutChart = null;
let barChart = null;
let initialized = false;

function parseYearMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m };
}

function shiftMonth(ym, delta) {
  let { year, month } = parseYearMonth(ym);
  month += delta;
  if (month > 12) { month = 1; year++; }
  if (month < 1) { month = 12; year--; }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const { year, month } = parseYearMonth(ym);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function chartColors() {
  const dark = isDark();
  return {
    text: dark ? '#8b92a8' : '#64748b',
    grid: dark ? '#232840' : '#e2e8f0',
    cardBg: dark ? '#141825' : '#ffffff'
  };
}

function destroyCharts() {
  if (doughnutChart) { doughnutChart.destroy(); doughnutChart = null; }
  if (barChart) { barChart.destroy(); barChart = null; }
}

function buildLayout(section, people) {
  section.innerHTML = `
    <div class="dash-header">
      <h2>Dashboard</h2>
      <div class="dash-controls">
        <div class="dash-month-nav">
          <button class="btn btn-ghost" id="dash-prev-month" aria-label="Mes anterior">&lsaquo;</button>
          <span id="dash-month-label" class="dash-month-text"></span>
          <button class="btn btn-ghost" id="dash-next-month" aria-label="Proximo mes">&rsaquo;</button>
        </div>
        <select class="form-select" id="dash-person-filter" style="min-width:120px">
          <option value="all">Todos</option>
          ${people.map(p => `<option value="${p.name}">${p.name.charAt(0).toUpperCase() + p.name.slice(1)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div id="dash-summary" class="dash-summary-grid"></div>
    <div id="dash-budget-progress"></div>

    <div class="dash-charts-row">
      <div class="card dash-chart-card">
        <h3>Despesas por Categoria</h3>
        <div id="dash-doughnut-wrapper" class="dash-chart-wrapper">
          <canvas id="dash-doughnut-chart"></canvas>
        </div>
      </div>
      <div class="card dash-chart-card">
        <h3>Orcado vs Realizado</h3>
        <div id="dash-bar-wrapper" class="dash-chart-wrapper">
          <canvas id="dash-bar-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="card" id="dash-recent" style="margin-top:var(--sp-4)">
      <h3 style="margin:0 0 var(--sp-4)">Ultimas Transacoes</h3>
      <div id="dash-recent-list"></div>
    </div>
  `;
}

function renderSummary(transactions, config) {
  const container = document.getElementById('dash-summary');
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const person = currentPerson === 'all'
    ? config?.people?.[0]
    : config?.people?.find(p => p.name === currentPerson);
  const salary = person?.salary || 0;
  const available = salary > 0 ? salary - expense : balance;

  let html = '';

  if (salary > 0) {
    const pctUsed = Math.min((expense / salary) * 100, 100);
    const barClass = pctUsed > 90 ? 'over' : pctUsed > 70 ? 'warning' : 'under';
    html += `
      <div class="summary-card summary-card--salary">
        <div class="summary-card__label">Salario</div>
        <div class="summary-card__value">${formatCurrency(salary)}</div>
        <div class="summary-card__bar"><div class="summary-card__bar-fill budget-bar-fill ${barClass}" style="width:${pctUsed}%"></div></div>
        <div class="summary-card__hint">${pctUsed.toFixed(0)}% comprometido</div>
      </div>
      <div class="summary-card summary-card--${available >= 0 ? 'positive' : 'negative'}">
        <div class="summary-card__label">Disponivel</div>
        <div class="summary-card__value">${formatCurrency(available)}</div>
        ${person?.monthlyGoal > 0 ? `<div class="summary-card__hint">Meta: ${formatCurrency(person.monthlyGoal)}</div>` : ''}
      </div>
    `;
  }

  html += `
    <div class="summary-card summary-card--income">
      <div class="summary-card__label">Receitas</div>
      <div class="summary-card__value">${formatCurrency(income)}</div>
    </div>
    <div class="summary-card summary-card--expense">
      <div class="summary-card__label">Despesas</div>
      <div class="summary-card__value">${formatCurrency(expense)}</div>
    </div>
  `;

  container.innerHTML = html;
}

function renderBudgetProgress(transactions, categories, config) {
  const container = document.getElementById('dash-budget-progress');
  if (!container) return;

  const personName = currentPerson === 'all' ? config?.people?.[0]?.name : currentPerson;
  const budgets = config?.budgets?.[personName];

  if (!budgets || Object.keys(budgets).length === 0) { container.innerHTML = ''; return; }

  const expenses = transactions.filter(t => t.type === 'expense');
  const grouped = {};
  expenses.forEach(t => { grouped[t.category] = (grouped[t.category] || 0) + t.amount; });

  const expenseCats = categories?.expense || [];
  const catMap = new Map();
  expenseCats.forEach(c => catMap.set(c.name, c));

  let items = '';
  for (const [catName, budgetVal] of Object.entries(budgets)) {
    if (budgetVal <= 0) continue;
    const spent = grouped[catName] || 0;
    const pct = Math.min((spent / budgetVal) * 100, 100);
    const barClass = pct > 100 ? 'over' : pct > 75 ? 'warning' : 'under';
    const cat = catMap.get(catName);
    const icon = cat?.icon || '';
    const overText = spent > budgetVal ? `<span class="budget-over-alert">Excedeu ${formatCurrency(spent - budgetVal)}</span>` : '';

    items += `
      <div class="budget-item">
        <div class="budget-item-header">
          <span class="budget-item-label">${icon} ${catName}</span>
          <span class="budget-item-values">${formatCurrency(spent)} / ${formatCurrency(budgetVal)}</span>
        </div>
        <div class="budget-bar"><div class="budget-bar-fill ${barClass}" style="width:${pct}%"></div></div>
        ${overText}
      </div>
    `;
  }

  if (!items) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4)">
      <h3 style="margin:0 0 var(--sp-4)">Orcamento do Mes${personName ? ` — ${personName}` : ''}</h3>
      ${items}
    </div>
  `;
}

function renderDoughnutChart(transactions, categories) {
  const wrapper = document.getElementById('dash-doughnut-wrapper');
  if (!wrapper) return;
  const expenses = transactions.filter(t => t.type === 'expense');

  if (!expenses.length) {
    wrapper.innerHTML = '<div class="empty-state"><p>Nenhuma despesa registrada</p></div>';
    return;
  }

  wrapper.innerHTML = '<canvas id="dash-doughnut-chart"></canvas>';
  const canvas = document.getElementById('dash-doughnut-chart');

  const catMap = new Map();
  (categories?.expense || []).forEach(c => catMap.set(c.name, c));

  const grouped = {};
  expenses.forEach(t => { grouped[t.category] = (grouped[t.category] || 0) + t.amount; });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);
  const colors = labels.map(l => catMap.get(l)?.color || '#78909c');
  const c = chartColors();

  doughnutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: c.cardBg }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 12, usePointStyle: true, pointStyleWidth: 10, color: c.text, font: { family: "'Inter', sans-serif", size: 11 } }
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderBarChart(transactions, categories, config) {
  const wrapper = document.getElementById('dash-bar-wrapper');
  if (!wrapper) return;
  const expenses = transactions.filter(t => t.type === 'expense');
  const expenseCats = categories?.expense || [];

  if (!expenseCats.length || !expenses.length) {
    wrapper.innerHTML = '<div class="empty-state"><p>Sem dados para exibir</p></div>';
    return;
  }

  wrapper.innerHTML = '<canvas id="dash-bar-chart"></canvas>';
  const canvas = document.getElementById('dash-bar-chart');

  const grouped = {};
  expenses.forEach(t => { grouped[t.category] = (grouped[t.category] || 0) + t.amount; });

  const personName = currentPerson === 'all' ? config?.people?.[0]?.name : currentPerson;
  const budgets = config?.budgets?.[personName] || {};
  const hasBudgets = Object.keys(budgets).length > 0;

  const activeCats = expenseCats.filter(c => grouped[c.name] || budgets[c.name]);
  const labels = activeCats.map(c => c.name);
  const actual = activeCats.map(c => grouped[c.name] || 0);
  const colors = activeCats.map(c => c.color || '#78909c');
  const c = chartColors();

  const datasets = [];
  if (hasBudgets) {
    datasets.push({
      label: 'Orcado',
      data: activeCats.map(cat => budgets[cat.name] || 0),
      backgroundColor: isDark() ? 'rgba(129,140,248,0.15)' : 'rgba(79,70,229,0.12)',
      borderColor: isDark() ? 'rgba(129,140,248,0.4)' : 'rgba(79,70,229,0.4)',
      borderWidth: 1, borderRadius: 4
    });
  }

  datasets.push({
    label: 'Realizado',
    data: actual,
    backgroundColor: colors.map(cl => cl + 'cc'),
    borderColor: colors,
    borderWidth: 1, borderRadius: 4
  });

  barChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => formatCurrency(v), color: c.text, font: { size: 11 } },
          grid: { color: c.grid }
        },
        x: {
          ticks: { color: c.text, font: { size: 11 } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: { usePointStyle: true, pointStyleWidth: 10, color: c.text, font: { size: 11 } }
        },
        tooltip: { callbacks: { label(ctx) { return ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`; } } }
      }
    }
  });
}

function renderRecentTransactions(transactions, categories) {
  const container = document.getElementById('dash-recent-list');

  if (!transactions.length) {
    container.innerHTML = '<div class="empty-state"><p>Nenhuma transacao neste mes</p></div>';
    return;
  }

  const catMap = new Map();
  (categories?.expense || []).forEach(c => catMap.set(c.name, c));
  (categories?.income || []).forEach(c => catMap.set(c.name, c));

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const recent = sorted.slice(0, 5);

  container.innerHTML = recent.map(t => {
    const cat = catMap.get(t.category);
    const icon = cat?.icon || '';
    const isIncome = t.type === 'income';
    const colorClass = isIncome ? 'amount-income' : 'amount-expense';
    const sign = isIncome ? '+' : '-';

    return `
      <div class="txn-card">
        <span class="txn-card-icon">${icon}</span>
        <div class="txn-card-info">
          <div class="txn-card-desc">${t.description}</div>
          <div class="txn-card-meta">${formatDate(t.date)} · ${t.category}${t.person ? ' · ' + t.person : ''}</div>
        </div>
        <span class="txn-card-amount ${colorClass}">${sign} ${formatCurrency(t.amount)}</span>
      </div>
    `;
  }).join('');
}

async function loadDashboard() {
  invalidateCache();
  const [config, categories, txnData] = await Promise.all([
    getConfig(),
    getCategories(),
    getTransactions(currentYearMonth)
  ]);

  let transactions = txnData?.transactions || [];
  if (currentPerson !== 'all') {
    transactions = transactions.filter(t => t.person === currentPerson);
  }

  document.getElementById('dash-month-label').textContent = monthLabel(currentYearMonth);

  destroyCharts();
  renderSummary(transactions, config);
  renderBudgetProgress(transactions, categories, config);
  renderDoughnutChart(transactions, categories);
  renderBarChart(transactions, categories, config);
  renderRecentTransactions(transactions, categories);
}

export async function initDashboard() {
  const section = document.getElementById('view-dashboard');

  if (!initialized) {
    const config = await getConfig();
    const people = config?.people || [];

    buildLayout(section, people);

    document.getElementById('dash-prev-month').addEventListener('click', () => {
      currentYearMonth = shiftMonth(currentYearMonth, -1);
      loadDashboard();
    });

    document.getElementById('dash-next-month').addEventListener('click', () => {
      currentYearMonth = shiftMonth(currentYearMonth, 1);
      loadDashboard();
    });

    document.getElementById('dash-person-filter').addEventListener('change', (e) => {
      currentPerson = e.target.value;
      loadDashboard();
    });

    initialized = true;
  }

  await loadDashboard();
}
