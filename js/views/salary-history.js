import { getConfig, getTransactions, putCacheEntry } from '../modules/data-service.js';
import { dispatch } from '../modules/github-api.js';
import { formatCurrency } from '../modules/format.js';
import { showAlert } from '../app.js';

let state = { config: null, selectedPerson: null, transactions: {} };
let chartInstance = null;
let barChartInstance = null;

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

function getHistory(person) {
  return person?.salaryHistory || [];
}

function calcVariation(history) {
  if (history.length < 2) return null;
  const prev = history[history.length - 2].amount;
  const curr = history[history.length - 1].amount;
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function renderChart(person) {
  const container = document.getElementById('salary-chart-container');
  if (!container) return;
  container.innerHTML = '<canvas id="salary-chart"></canvas>';
  const canvas = document.getElementById('salary-chart');
  if (!canvas) return;

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const history = getHistory(person);
  if (!history.length) return;

  const labels = history.map(h => h.date);
  const values = history.map(h => h.amount);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#8b92a8' : '#64748b';
  const gridColor = isDark ? '#232840' : '#e2e8f0';

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Salario',
        data: values,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#4f46e5',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false } },
        y: {
          ticks: { color: textColor, callback: (v) => formatCurrency(v) },
          grid: { color: gridColor }
        }
      }
    }
  });
}

function renderSalaryVsExpensesChart(person) {
  const container = document.getElementById('salary-vs-expenses-container');
  if (!container) return;
  container.innerHTML = '<canvas id="salary-vs-expenses-chart"></canvas>';
  const canvas = document.getElementById('salary-vs-expenses-chart');
  if (!canvas) return;

  const history = getHistory(person);
  if (!history.length) return;

  const months = history.map(h => h.date);
  const salaryValues = history.map(h => h.amount);
  const expenseValues = months.map(m => {
    const txns = state.transactions[m]?.transactions || [];
    return txns
      .filter(t => t.type === 'expense' && (!person.name || t.person === person.name))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
  });

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#8b92a8' : '#64748b';
  const gridColor = isDark ? '#232840' : '#e2e8f0';

  if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }

  barChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Salario', data: salaryValues, backgroundColor: 'rgba(79,70,229,0.7)', borderRadius: 4 },
        { label: 'Despesas', data: expenseValues, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, boxWidth: 12 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false } },
        y: { ticks: { color: textColor, callback: (v) => formatCurrency(v) }, grid: { color: gridColor } }
      }
    }
  });
}

function renderTable(person) {
  const history = getHistory(person);

  if (!history.length) {
    return el('div', { className: 'empty-state' },
      el('div', { className: 'empty-icon' }, '\uD83D\uDCCA'),
      el('p', {}, 'Nenhum registro salarial encontrado.')
    );
  }

  const wrapper = el('div', { className: 'card', style: { overflow: 'auto' } });
  const table = el('table', { className: 'data-table' });

  const thead = el('thead');
  const headRow = el('tr');
  ['Periodo', 'Valor', 'Variacao'].forEach(h => headRow.append(el('th', {}, h)));
  thead.append(headRow);

  const tbody = el('tbody');
  [...history].reverse().forEach((entry, i, arr) => {
    const row = el('tr');
    row.append(el('td', {}, entry.date));
    row.append(el('td', { className: 'amount-income' }, formatCurrency(entry.amount)));

    const prevEntry = arr[i + 1];
    let varText = '-';
    let varClass = '';
    if (prevEntry) {
      const diff = entry.amount - prevEntry.amount;
      const pct = prevEntry.amount > 0 ? ((diff / prevEntry.amount) * 100).toFixed(1) : '0';
      varText = `${diff >= 0 ? '+' : ''}${formatCurrency(diff)} (${diff >= 0 ? '+' : ''}${pct}%)`;
      varClass = diff >= 0 ? 'amount-income' : 'amount-expense';
    }
    row.append(el('td', { className: varClass }, varText));
    tbody.append(row);
  });

  table.append(thead, tbody);
  wrapper.append(table);
  return wrapper;
}

function render() {
  const section = document.getElementById('view-salary');
  if (!section) return;
  section.innerHTML = '';

  const people = state.config?.people || [];
  const person = people.find(p => p.name === state.selectedPerson) || people[0];
  if (!person) {
    section.append(el('div', { className: 'empty-state' },
      el('div', { className: 'empty-icon' }, '\uD83D\uDCCA'),
      el('p', {}, 'Adicione pessoas nas configuracoes primeiro.')
    ));
    return;
  }
  state.selectedPerson = person.name;

  const header = el('div', { className: 'section-header' });
  header.append(el('h2', {}, 'Historico Salarial'));
  section.append(header);

  if (people.length > 1) {
    const filterBar = el('div', { className: 'filter-bar' });
    const sel = el('select', {
      className: 'form-select',
      onChange: (e) => { state.selectedPerson = e.target.value; render(); }
    });
    people.forEach(p => {
      const opt = el('option', { value: p.name }, p.name.charAt(0).toUpperCase() + p.name.slice(1));
      if (p.name === state.selectedPerson) opt.selected = true;
      sel.append(opt);
    });
    filterBar.append(sel);
    section.append(filterBar);
  }

  const history = getHistory(person);
  const currentSalary = history.length > 0 ? history[history.length - 1].amount : (person.salary || 0);
  const variation = calcVariation(history);

  const grid = el('div', { className: 'dash-summary-grid' });
  grid.append(
    (() => {
      const c = el('div', { className: 'summary-card summary-card--salary' });
      c.append(el('div', { className: 'summary-card__label' }, 'Salario atual'), el('div', { className: 'summary-card__value' }, formatCurrency(currentSalary)));
      return c;
    })(),
    (() => {
      const c = el('div', { className: 'summary-card' });
      c.append(el('div', { className: 'summary-card__label' }, 'Registros'), el('div', { className: 'summary-card__value' }, String(history.length)));
      return c;
    })(),
    (() => {
      const cls = variation != null ? (variation >= 0 ? 'summary-card--positive' : 'summary-card--negative') : '';
      const c = el('div', { className: `summary-card ${cls}` });
      c.append(
        el('div', { className: 'summary-card__label' }, 'Ultima variacao'),
        el('div', { className: 'summary-card__value' }, variation != null ? `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%` : '-')
      );
      return c;
    })()
  );
  section.append(grid);

  const chartsRow = el('div', { className: 'dash-charts-row' });

  const chartCard1 = el('div', { className: 'card' });
  chartCard1.append(el('h3', { style: { marginBottom: 'var(--sp-3)' } }, 'Progressao Salarial'));
  chartCard1.append(el('div', { id: 'salary-chart-container', style: { height: '260px' } }));
  chartsRow.append(chartCard1);

  const chartCard2 = el('div', { className: 'card' });
  chartCard2.append(el('h3', { style: { marginBottom: 'var(--sp-3)' } }, 'Salario vs Despesas'));
  chartCard2.append(el('div', { id: 'salary-vs-expenses-container', style: { height: '260px' } }));
  chartsRow.append(chartCard2);

  section.append(chartsRow);
  section.append(renderTable(person));

  requestAnimationFrame(() => {
    renderChart(person);
    renderSalaryVsExpensesChart(person);
  });
}

export async function initSalaryHistory() {
  const section = document.getElementById('view-salary');
  if (!section) return;

  section.innerHTML = '<div style="display:flex;justify-content:center;padding:var(--sp-10)"><div class="spinner spinner-lg"></div></div>';

  const config = await getConfig();
  state.config = config;
  state.selectedPerson = config?.people?.[0]?.name || null;

  const people = config?.people || [];
  const monthsToLoad = new Set();
  people.forEach(p => {
    (p.salaryHistory || []).forEach(h => monthsToLoad.add(h.date));
  });

  const txnPromises = [...monthsToLoad].map(async m => {
    try {
      const data = await getTransactions(m);
      state.transactions[m] = data;
    } catch { /* ignore */ }
  });
  await Promise.all(txnPromises);

  render();
}

export async function recordSalaryChange(personName, newSalary, yearMonth) {
  const config = await getConfig();
  if (!config) return;

  const person = config.people.find(p => p.name === personName);
  if (!person) return;

  const month = yearMonth || new Date().toISOString().slice(0, 7);

  if (!person.salaryHistory) person.salaryHistory = [];

  const existing = person.salaryHistory.find(h => h.date === month);
  if (existing) {
    existing.amount = newSalary;
  } else {
    person.salaryHistory.push({ date: month, amount: newSalary });
  }
  person.salaryHistory.sort((a, b) => a.date.localeCompare(b.date));

  const updatedConfig = { ...config, _schema_version: config._schema_version || 1 };
  putCacheEntry('config', updatedConfig);

  try {
    await dispatch('update-config', updatedConfig);
  } catch (err) {
    console.error('[recordSalaryChange]', err);
  }
}
