export function initReceipt() {
  const section = document.getElementById('view-receipt');
  if (section.dataset.loaded) return;
  section.innerHTML = `
    <div class="placeholder-view">
      <div class="placeholder-icon">📸</div>
      <h2>Leitura de comprovantes</h2>
      <p>O scanner de comprovantes e faturas com IA será habilitado em uma fase futura.</p>
    </div>
  `;
  section.dataset.loaded = 'true';
}
