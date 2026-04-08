export function initTransaction() {
  const section = document.getElementById('view-transaction');
  if (section.dataset.loaded) return;
  section.innerHTML = `
    <div class="placeholder-view">
      <div class="placeholder-icon">💳</div>
      <h2>Nova transação</h2>
      <p>O formulário de registro de transações será habilitado na próxima fase.</p>
    </div>
  `;
  section.dataset.loaded = 'true';
}
