export function initSettings() {
  const section = document.getElementById('view-settings');
  if (section.dataset.loaded) return;
  section.innerHTML = `
    <div class="placeholder-view">
      <div class="placeholder-icon">⚙️</div>
      <h2>Configurações</h2>
      <p>Configure suas preferências usando o assistente de boas-vindas.</p>
    </div>
  `;
  section.dataset.loaded = 'true';
}
