import { initDashboard } from './views/dashboard.js';
import { initTransaction } from './views/transaction.js';
import { initStatement } from './views/statement.js';
import { initReceipt } from './views/receipt.js';
import { initSettings } from './views/settings.js';
import { isWizardDone } from './modules/storage.js';

const VIEWS = {
  dashboard:   { init: initDashboard,   icon: '📊', label: 'Dashboard' },
  transaction: { init: initTransaction, icon: '💳', label: 'Transação' },
  statement:   { init: initStatement,   icon: '📋', label: 'Extrato' },
  receipt:     { init: initReceipt,     icon: '📸', label: 'Comprovante' },
  settings:    { init: initSettings,    icon: '⚙️', label: 'Config' }
};

let currentView = null;

export function navigate(viewName) {
  if (currentView === viewName) return;

  document.querySelectorAll('.view-section').forEach(s => s.hidden = true);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById(`view-${viewName}`);
  const navItem = document.querySelector(`[data-view="${viewName}"]`);

  if (section) section.hidden = false;
  if (navItem) navItem.classList.add('active');

  currentView = viewName;
  VIEWS[viewName]?.init();
}

export function showAlert(message, type = 'info') {
  const container = document.getElementById('alert-container');
  if (!container) return;

  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  container.appendChild(alert);

  setTimeout(() => {
    alert.style.opacity = '0';
    alert.style.transition = 'opacity 300ms ease';
    setTimeout(() => alert.remove(), 300);
  }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) navigate(view);
    });
  });

  if (!isWizardDone()) {
    navigate('settings');
  } else {
    navigate('dashboard');
  }
});
