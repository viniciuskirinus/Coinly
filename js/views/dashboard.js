import { getConfig, getTransactions, getCategories, invalidateCache } from '../modules/data-service.js';
import { formatCurrency, getCurrentYearMonth, formatDate } from '../modules/format.js';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
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

function destroyCharts() {
  if (doughnutChart) { doughnutChart.destroy(); doughnutChart = null; }
  if (barChart) { barChart.destroy(); barChart = null; }
}

function buildLayout(section, people) {
  section.innerHTML = `
    <div class="section-header">
      <h2>📊 Dashboard</h2>
    </div>

    <div class="filter-bar">
      <div style="display:flex;align-items:center;gap:var(--space-sm)">
        <button class="btn btn-ghost" id="dash-prev-month" aria-label="Mês anterior">◀</button>
        <span id="dash-month-label" style="font-weight:700;min-width:160px;text-align:center;font-size:var(--font-size-lg)"></span>
        <button class="btn btn-ghost" id="dash-next-month" aria-label="Próximo mês">▶</button>
      </div>
      <select class="form-select" id="dash-person-filter">
        <option value="all">Todos</option>
        ${people.map(p => `<option value="${p.name}">${p.name.charAt(0).toUpperCase() + p.name.slice(1)}</option>`).join('')}
      </select>
    </div>

    <div id="dash-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-md);margin-bottom:var(--space-lg)"></div>

    <div id="dash-charts" style="display:flex;gap:var(--space-lg);margin-bottom:var(--space-lg);flex-wrap:wrap">
      <div class="card" style="flex:1;min-width:280px">
        <h3 style="margin:0 0 var(--space-md)">Despesas por Categoria</h3>
        <div id="dash-doughnut-wrapper" style="position:relative;max-height:320px;display:flex;align-items:center;justify-content:center">
          <canvas id="dash-doughnut-chart"></canvas>
        </div>
      </div>
      <div class="card" style="flex:1;min-width:280px">
        <h3 style="margin:0 0 var(--space-md)">Orçado vs Realizado</h3>
        <div id="dash-bar-wrapper" style="position:relative;max-height:320px">
          <canvas id="dash-bar-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="card" id="dash-recent" style="margin-bottom:var(--space-lg)">
      <h3 style="margin:0 0 var(--space-md)">Últimas Transações</h3>
      <div id="dash-recent-list"></div>
    </div>
  `;
}

function renderSummary(transactions) {
  const container = document.getElementById('dash-summary');
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const balanceColor = balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)';

  container.innerHTML = `
    <div class="card" style="border-left:4px solid var(--color-income)">
      <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-bottom:var(--space-xs)">💰 Receitas</div>
      <div style="font-size:var(--font-size-2xl);font-weight:700;color:var(--color-income)">${formatCurrency(income)}</div>
    </div>
    <div class="card" style="border-left:4px solid var(--color-expense)">
      <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-bottom:var(--space-xs)">💸 Despesas</div>
      <div style="font-size:var(--font-size-2xl);font-weight:700;color:var(--color-expense)">${formatCurrency(expense)}</div>
    </div>
    <div class="card" style="border-left:4px solid ${balanceColor}">
      <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-bottom:var(--space-xs)">📊 Saldo</div>
      <div style="font-size:var(--font-size-2xl);font-weight:700;color:${balanceColor}">${formatCurrency(balance)}</div>
    </div>
  `;
}

function renderDoughnutChart(transactions, categories) {
  const canvas = document.getElementById('dash-doughnut-chart');
  const wrapper = document.getElementById('dash-doughnut-wrapper');
  const expenses = transactions.filter(t => t.type === 'expense');

  if (!expenses.length) {
    canvas.style.display = 'none';
    wrapper.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Nenhuma despesa registrada</p></div>`;
    return;
  }

  canvas.style.display = 'block';

  const catMap = new Map();
  const expenseCats = categories?.expense || [];
  expenseCats.forEach(c => catMap.set(c.name, c));

  const grouped = {};
  expenses.forEach(t => {
    grouped[t.category] = (grouped[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);
  const colors = labels.map(l => catMap.get(l)?.color || '#78909c');

  doughnutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 10,
            font: { family: "'Inter', sans-serif", size: 12 }
          }
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
  const canvas = document.getElementById('dash-bar-chart');
  const wrapper = document.getElementById('dash-bar-wrapper');
  const expenses = transactions.filter(t => t.type === 'expense');
  const expenseCats = categories?.expense || [];

  if (!expenseCats.length) {
    canvas.style.display = 'none';
    wrapper.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Nenhuma categoria disponível</p></div>`;
    return;
  }

  canvas.style.display = 'block';

  const grouped = {};
  expenses.forEach(t => {
    grouped[t.category] = (grouped[t.category] || 0) + t.amount;
  });

  const activeCats = expenseCats.filter(c => grouped[c.name]);
  const labels = activeCats.map(c => c.name);
  const actual = activeCats.map(c => grouped[c.name] || 0);
  const colors = activeCats.map(c => c.color);

  const person = currentPerson === 'all'
    ? config?.people?.[0]
    : config?.people?.find(p => p.name === currentPerson);
  const hasBudget = person?.monthlyGoal && person.monthlyGoal > 0;
  const budgetPerCat = hasBudget ? person.monthlyGoal / labels.length : 0;

  const datasets = [];

  if (hasBudget) {
    datasets.push({
      label: 'Orçado',
      data: labels.map(() => budgetPerCat),
      backgroundColor: 'rgba(57, 73, 171, 0.2)',
      borderColor: 'rgba(57, 73, 171, 0.6)',
      borderWidth: 1,
      borderRadius: 4
    });
  }

  datasets.push({
    label: 'Realizado',
    data: actual,
    backgroundColor: colors.map(c => c + 'cc'),
    borderColor: colors,
    borderWidth: 1,
    borderRadius: 4
  });

  barChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => formatCurrency(v),
            font: { family: "'Inter', sans-serif", size: 11 }
          },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          ticks: { font: { family: "'Inter', sans-serif", size: 11 } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: {
            usePointStyle: true,
            pointStyleWidth: 10,
            font: { family: "'Inter', sans-serif", size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              return ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`;
            }
          }
        }
      }
    }
  });
}

function renderRecentTransactions(transactions, categories) {
  const container = document.getElementById('dash-recent-list');

  if (!transactions.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Nenhuma transação neste mês</p></div>`;
    return;
  }

  const catMap = new Map();
  (categories?.expense || []).forEach(c => catMap.set(c.name, c));
  (categories?.income || []).forEach(c => catMap.set(c.name, c));

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const recent = sorted.slice(0, 5);

  container.innerHTML = recent.map(t => {
    const cat = catMap.get(t.category);
    const icon = cat?.icon || '💵';
    const isIncome = t.type === 'income';
    const colorClass = isIncome ? 'amount-income' : 'amount-expense';
    const sign = isIncome ? '+' : '-';

    return `
      <div class="txn-card">
        <span class="txn-card-icon">${icon}</span>
        <div class="txn-card-info">
          <div class="txn-card-desc">${t.description}</div>
          <div class="txn-card-meta">${formatDate(t.date)} · ${t.category}</div>
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
  renderSummary(transactions);
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
