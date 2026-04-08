export function initDashboard() {
  const section = document.getElementById('view-dashboard');
  if (section.dataset.loaded) return;
  section.innerHTML = `
    <div class="placeholder-view">
      <div class="placeholder-icon">📊</div>
      <h2>Seu painel financeiro</h2>
      <p>Os resumos e gráficos aparecerão aqui quando você registrar suas primeiras transações.</p>
    </div>
  `;
  section.dataset.loaded = 'true';
}
