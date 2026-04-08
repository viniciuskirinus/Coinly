import { getConfig } from './data-service.js';
import { formatCurrency } from './format.js';

export async function getBudgets() {
  const config = await getConfig();
  return config?.budgets || {};
}

export function getBudgetForPerson(budgets, personName) {
  return budgets[personName] || {};
}

export function calculateBudgetStatus(budgets, personName, transactions) {
  const personBudget = getBudgetForPerson(budgets, personName);
  const categories = Object.keys(personBudget);
  if (!categories.length) return [];

  const expenseByCategory = {};
  for (const txn of transactions) {
    if (txn.type !== 'expense') continue;
    if (txn.person?.toLowerCase() !== personName.toLowerCase()) continue;
    const cat = txn.category || '';
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Math.abs(txn.amount || 0);
  }

  return categories.map(category => {
    const budgeted = personBudget[category] || 0;
    const actual = expenseByCategory[category] || 0;
    const percentage = budgeted > 0 ? (actual / budgeted) * 100 : 0;
    return {
      category,
      budgeted,
      actual,
      percentage: Math.round(percentage * 10) / 10,
      isOver: percentage > 100
    };
  });
}

function getBarClass(percentage) {
  if (percentage > 100) return 'over';
  if (percentage >= 80) return 'warning';
  return 'under';
}

function findCategoryIcon(categories, categoryName) {
  const cats = categories?.expense || [];
  const found = cats.find(c => c.name === categoryName);
  return found?.icon || '📁';
}

export function renderBudgetSection(container, personName, transactions, categories, budgets) {
  const statuses = calculateBudgetStatus(budgets, personName, transactions);

  if (!statuses.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.padding = 'var(--space-lg)';
    empty.innerHTML = `
      <div class="empty-icon">📊</div>
      <p>Configure orçamentos nas <strong>Configurações</strong></p>
    `;
    container.appendChild(empty);
    return;
  }

  const sorted = [...statuses].sort((a, b) => b.percentage - a.percentage);

  for (const item of sorted) {
    const icon = findCategoryIcon(categories, item.category);
    const barClass = getBarClass(item.percentage);
    const fillWidth = Math.min(item.percentage, 100);

    const budgetItem = document.createElement('div');
    budgetItem.className = 'budget-item';

    budgetItem.innerHTML = `
      <div class="budget-item-header">
        <span class="budget-item-label">${icon} ${item.category}</span>
        <span class="budget-item-values">${formatCurrency(item.actual)} / ${formatCurrency(item.budgeted)}</span>
      </div>
      <div class="budget-bar">
        <div class="budget-bar-fill ${barClass}" style="width: ${fillWidth}%"></div>
      </div>
      ${item.isOver ? `<div class="budget-over-alert">⚠️ Estourou ${(item.percentage - 100).toFixed(1)}% acima do orçamento</div>` : ''}
    `;

    container.appendChild(budgetItem);
  }
}
