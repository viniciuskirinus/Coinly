export function initStatement() {
  const section = document.getElementById('view-statement');
  if (section.dataset.loaded) return;
  section.innerHTML = `
    <div class="placeholder-view">
      <div class="placeholder-icon">📋</div>
      <h2>Extrato mensal</h2>
      <p>A lista de transações com filtros será habilitada na próxima fase.</p>
    </div>
  `;
  section.dataset.loaded = 'true';
}
