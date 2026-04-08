import { initDashboard } from './views/dashboard.js';
import { initTransaction } from './views/transaction.js';
import { initStatement } from './views/statement.js';
import { initReceipt } from './views/receipt.js';
import { initSettings } from './views/settings.js';
import { checkFirstRun, startWizard } from './views/wizard.js';
import { isRepoConfigured } from './modules/github-api.js';
import { getRepoConfig, saveRepoConfig } from './modules/storage.js';
import { getConfig } from './modules/data-service.js';
import { saveGeminiModel } from './modules/gemini.js';

const VIEWS = {
  dashboard:   { init: initDashboard,   icon: '📊', label: 'Dashboard' },
  transaction: { init: initTransaction, icon: '💳', label: 'Transação' },
  statement:   { init: initStatement,   icon: '📋', label: 'Extrato' },
  receipt:     { init: initReceipt,     icon: '📸', label: 'Comprovante' },
  settings:    { init: initSettings,    icon: '⚙️', label: 'Config' }
};

let currentView = null;

export function navigate(viewName) {
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

async function restoreConfigFromGit() {
  const existing = getRepoConfig();
  if (existing.owner && existing.repo) return;

  try {
    const config = await getConfig();
    if (config?.repo?.owner && config?.repo?.name) {
      saveRepoConfig({
        owner: config.repo.owner,
        repo: config.repo.name,
        pat: existing.pat || ''
      });
      console.log('[app] repo config restaurado do config.json');
    }
    if (config?.geminiModel) {
      saveGeminiModel(config.geminiModel);
    }
  } catch { /* config.json não disponível */ }
}

window.addEventListener('wizard-complete', () => {
  navigate('dashboard');
});

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) navigate(view);
    });
  });

  const isFirstRun = await checkFirstRun();
  if (isFirstRun) {
    startWizard();
  } else {
    await restoreConfigFromGit();
    navigate('dashboard');
    if (!isRepoConfigured()) {
      showAlert('⚠️ PAT não configurado. Vá em Config → Repositório e cole seu Personal Access Token.', 'warning');
    }
  }
});
