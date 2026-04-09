import { verifyPin, setSession, decryptSecrets } from '../modules/auth.js';
import { saveRepoConfig, getRepoConfig } from '../modules/storage.js';
import { saveGeminiKey } from '../modules/gemini.js';

export function showLoginScreen(pinHash, encryptedSecrets, onSuccess) {
  const screen = document.getElementById('login-screen');
  if (!screen) return;

  screen.hidden = false;
  screen.innerHTML = `
    <div class="login-box">
      <h1>FinanceiroVK</h1>
      <p>Digite seu PIN para acessar</p>
      <div class="form-group">
        <label for="login-pin" class="form-label" style="text-align:center">PIN de acesso</label>
        <input type="password" id="login-pin" class="form-input" placeholder="PIN" maxlength="20"
          style="text-align:center;font-size:var(--text-xl);letter-spacing:0.3em;padding:var(--sp-3)">
      </div>
      <div id="login-error" style="display:none;margin-bottom:var(--sp-3)">
        <div class="alert alert-error" style="justify-content:center">PIN incorreto</div>
      </div>
      <button id="login-btn" class="btn btn-primary" style="width:100%;padding:var(--sp-3)">Entrar</button>
    </div>
  `;

  const pinInput = screen.querySelector('#login-pin');
  const btn = screen.querySelector('#login-btn');
  const errorEl = screen.querySelector('#login-error');

  async function attempt() {
    const val = pinInput.value.trim();
    if (!val) return;

    btn.disabled = true;
    btn.textContent = 'Verificando...';
    errorEl.style.display = 'none';

    const ok = await verifyPin(val, pinHash);
    if (ok) {
      setSession();
      sessionStorage.setItem('fvk_pin', val);

      if (encryptedSecrets) {
        const secrets = await decryptSecrets(val, encryptedSecrets);
        if (secrets) {
          if (secrets.pat) {
            const existing = getRepoConfig();
            saveRepoConfig({ ...existing, pat: secrets.pat });
          }
          if (secrets.geminiKey) {
            saveGeminiKey(secrets.geminiKey);
          }
        } else {
          console.warn('[login] Falha ao descriptografar segredos. PAT e chave Gemini podem não estar disponíveis.');
        }
      }

      screen.hidden = true;
      screen.innerHTML = '';
      onSuccess();
    } else {
      errorEl.style.display = '';
      pinInput.value = '';
      pinInput.focus();
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }

  btn.addEventListener('click', attempt);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attempt();
  });
  pinInput.focus();
}
