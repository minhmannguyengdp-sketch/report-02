const shellPages = {
  mcp: { subtitle: 'MCP tuyến', nav: 'create' },
  'order-shell': { subtitle: 'Đơn hàng', nav: 'create' },
  'report-shell': { subtitle: 'Báo cáo', nav: 'create' }
};

function setPage(page) {
  const config = shellPages[page];
  if (!config) return false;
  document.querySelectorAll('.page').forEach((element) => element.classList.toggle('active', element.dataset.page === page));
  document.querySelectorAll('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === config.nav));
  const subtitle = document.querySelector('#subtitle');
  if (subtitle) subtitle.textContent = config.subtitle;
  return true;
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-page]');
  if (!trigger) return;
  const target = trigger.dataset.page;
  if (!shellPages[target]) return;
  if (!setPage(target)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

window.addEventListener('DOMContentLoaded', () => {
  const active = document.querySelector('.page.active')?.dataset.page;
  if (active) setPage(active);
});
