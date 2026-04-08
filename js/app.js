import { initDashboard } from './views/dashboard.js';
import { initTransaction } from './views/transaction.js';
import { initStatement } from './views/statement.js';
import { initReceipt } from './views/receipt.js';
import { initSettings } from './views/settings.js';
import { initSavings } from './views/savings.js';
import { initSalaryHistory } from './views/salary-history.js';
import { checkFirstRun, startWizard } from './views/wizard.js';
import { isRepoConfigured } from './modules/github-api.js';
import { getRepoConfig, saveRepoConfig } from './modules/storage.js';
import { getConfig } from './modules/data-service.js';
import { saveGeminiModel, saveGeminiKey, getGeminiKey } from './modules/gemini.js';
import { isAuthenticated } from './modules/auth.js';
import { showLoginScreen } from './views/login.js';

const VIEWS = {
  dashboard:   { init: initDashboard },
  transaction: { init: initTransaction },
  statement:   { init: initStatement },
  savings:     { init: initSavings },
  salary:      { init: initSalaryHistory },
  receipt:     { init: initReceipt },
  settings:    { init: initSettings }
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

// ── Theme ──

function initTheme() {
  const saved = localStorage.getItem('fvk_theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  updateThemeUI();

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('fvk_theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('fvk_theme', 'dark');
      }
      updateThemeUI();
    });
  }
}

function updateThemeUI() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const lightIcon = document.getElementById('theme-icon-light');
  const darkIcon = document.getElementById('theme-icon-dark');
  const label = document.getElementById('theme-label');

  if (lightIcon) lightIcon.style.display = isDark ? 'none' : '';
  if (darkIcon) darkIcon.style.display = isDark ? '' : 'none';
  if (label) label.textContent = isDark ? 'Modo claro' : 'Modo escuro';
}

// ── Config Restore ──

async function restoreConfigFromGit() {
  const existing = getRepoConfig();
  const hasRepo = existing.owner && existing.repo;
  const hasPat = !!existing.pat;
  const hasGeminiKey = !!getGeminiKey();

  if (hasRepo && hasPat && hasGeminiKey) return null;

  try {
    const config = await getConfig();
    if (!config) return null;

    if (config.repo?.owner && config.repo?.name) {
      saveRepoConfig({
        owner: config.repo.owner,
        repo: config.repo.name,
        pat: existing.pat || config.repo.pat || ''
      });
    }
    if (config.geminiModel) saveGeminiModel(config.geminiModel);
    if (config.geminiKey && !hasGeminiKey) saveGeminiKey(config.geminiKey);
    return config;
  } catch { return null; }
}

// ── Auth Gate ──

async function checkAuth() {
  if (isAuthenticated()) return true;

  let cfg;
  try { cfg = await getConfig(); } catch { return true; }
  const pinHash = cfg?.pinHash;
  if (!pinHash) return true;

  return new Promise((resolve) => {
    const appLayout = document.getElementById('app-layout');
    if (appLayout) appLayout.style.display = 'none';
    showLoginScreen(pinHash, () => {
      if (appLayout) appLayout.style.display = '';
      resolve(true);
    });
  });
}

// ── Boot ──

window.addEventListener('wizard-complete', () => {
  navigate('dashboard');
});

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

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
    await checkAuth();
    navigate('dashboard');
    if (!isRepoConfigured()) {
      showAlert('PAT nao configurado. Va em Config > Repositorio e cole seu Personal Access Token.', 'warning');
    }
  }
});
