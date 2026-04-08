const KEYS = {
  REPO_CONFIG: 'financeirovk_repo',
  WIZARD_DONE: 'financeirovk_wizard_done',
  PENDING_WRITES: 'financeirovk_pending'
};

export function getRepoConfig() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.REPO_CONFIG)) || {};
  } catch {
    return {};
  }
}

export function saveRepoConfig(config) {
  localStorage.setItem(KEYS.REPO_CONFIG, JSON.stringify(config));
}

export function isWizardDone() {
  return localStorage.getItem(KEYS.WIZARD_DONE) === 'true';
}

export function markWizardDone() {
  localStorage.setItem(KEYS.WIZARD_DONE, 'true');
}

export function getPendingWrites() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.PENDING_WRITES)) || [];
  } catch {
    return [];
  }
}

export function savePendingWrites(writes) {
  localStorage.setItem(KEYS.PENDING_WRITES, JSON.stringify(writes));
}
