import { initDashboard } from './views/dashboard.js';
import { initTransaction } from './views/transaction.js';
import { initStatement } from './views/statement.js';
import { initReceipt } from './views/receipt.js';
import { initSettings } from './views/settings.js';
import { initSavings } from './views/savings.js';
import { initSalaryHistory } from './views/salary-history.js';
import { checkFirstRun, startWizard } from './views/wizard.js';
import { getConfig } from './modules/data-service.js';
import { isAuthenticated } from './modules/auth.js';
import { showLoginScreen } from './views/login.js';
import { setAlertFunction } from './modules/gemini.js';

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

const ALERT_ICONS = {
  success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'
};

export function showAlert(message, type = 'info') {
  const container = document.getElementById('alert-container');
  if (!container) return;

  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `
    <span class="alert-icon">${ALERT_ICONS[type] || ALERT_ICONS.info}</span>
    <span class="alert-text">${escapeHtml(message)}</span>
    <button class="alert-close" aria-label="Fechar">&times;</button>
  `;
  alert.querySelector('.alert-close').addEventListener('click', () => {
    alert.style.opacity = '0';
    alert.style.transform = 'translateX(40px)';
    setTimeout(() => alert.remove(), 200);
  });
  container.appendChild(alert);
  requestAnimationFrame(() => alert.classList.add('alert-show'));

  setTimeout(() => {
    if (!alert.parentNode) return;
    alert.style.opacity = '0';
    alert.style.transform = 'translateX(40px)';
    setTimeout(() => alert.remove(), 200);
  }, 5000);
}

export function showConfirm(title, message, { confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal confirm-modal">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
          <button class="modal-close confirm-dismiss" aria-label="Fechar">&times;</button>
        </div>
        <div class="confirm-dialog">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost confirm-dismiss">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} confirm-accept">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = (result) => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 150ms ease';
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    };

    overlay.querySelectorAll('.confirm-dismiss').forEach(b => b.addEventListener('click', () => close(false)));
    overlay.querySelector('.confirm-accept').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    const acceptBtn = overlay.querySelector('.confirm-accept');
    requestAnimationFrame(() => acceptBtn.focus());
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Theme ──

function initTheme() {
  const saved = localStorage.getItem('coinly_theme');
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
        localStorage.setItem('coinly_theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('coinly_theme', 'dark');
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

// ── Auth Gate ──

async function checkAuth() {
  if (isAuthenticated()) return true;

  let pinHash = null;
  let encryptedSecrets = null;

  try {
    const config = await getConfig();
    if (config?.pinHash) {
      pinHash = config.pinHash;
      encryptedSecrets = config.encryptedSecrets || null;
    }
  } catch { /* offline */ }

  if (!pinHash) return true;

  return new Promise((resolve) => {
    const appLayout = document.getElementById('app-layout');
    if (appLayout) appLayout.style.display = 'none';
    showLoginScreen(pinHash, encryptedSecrets, () => {
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
  setAlertFunction(showAlert);

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
    await checkAuth();
    navigate('dashboard');
  }
});
