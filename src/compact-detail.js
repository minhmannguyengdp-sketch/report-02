import { LOCAL_STORES, getAllLocal } from '../local-db.js';

const LABELS = {
  pending: 'Chưa thử',
  ok: 'OK',
  interested: 'Quan tâm',
  sample: 'Cần mẫu',
  follow: 'Báo sau',
  bad: 'Chưa tốt',
  retry: 'Thử lại',
};

const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}[char]));

const query = (selector) => document.querySelector(selector);

function normalizeStatus(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function statusTone(status) {
  const value = normalizeStatus(status);
  if (['ok', 'tot', 'good', 'dat'].includes(value)) return 'ok';
  if (['bad', 'retry', 'chua tot', 'thu lai', 'fail', 'not ok'].includes(value)) return 'bad';
  return 'warn';
}

function ensureCss() {
  if (query('#compactCss')) return;
  const style = document.createElement('style');
  style.id = 'compactCss';
  style.textContent = `
    #modal[data-type="test-detail"]{width:min(390px,calc(100vw - 24px))!important;max-width:calc(100vw - 24px)!important;max-height:calc(100dvh - 24px)!important;overflow:hidden!important;padding:0!important;border-radius:18px!important;margin:auto!important}
    #modal[data-type="test-detail"] .compact-modal{box-sizing:border-box!important;width:100%!important;max-width:100%!important;max-height:calc(100dvh - 24px)!important;overflow-y:auto!important;overflow-x:hidden!important;padding:0!important;background:#fff!important;border-radius:18px!important}
    #modal[data-type="test-detail"] .compact-modal header{position:sticky!important;top:0!important;z-index:3!important;display:grid!important;grid-template-columns:minmax(0,1fr) 76px!important;gap:8px!important;align-items:center!important;padding:12px!important;background:#fff!important;border-bottom:1px solid #edf3f1!important;overflow:hidden!important}
    #modal[data-type="test-detail"] .compact-modal h2{font-size:18px!important;line-height:1.15!important;margin:0!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    #modal[data-type="test-detail"] .compact-modal header button{width:76px!important;min-width:76px!important;max-width:76px!important;height:38px!important;min-height:38px!important;padding:0!important;border-radius:999px!important;font-size:13px!important;font-weight:850!important;white-space:nowrap!important}
    #modal[data-type="test-detail"] .compact-list{width:100%!important;max-width:100%!important;padding:8px 10px 14px!important;overflow-x:hidden!important;box-sizing:border-box!important}
    #modal[data-type="test-detail"] .compact-customer{width:100%!important;max-width:100%!important;overflow:hidden!important;box-sizing:border-box!important;border:1px solid #dce8e5!important;border-radius:12px!important;padding:8px 9px!important;background:#fbfffd!important;margin-top:7px!important}
    #modal[data-type="test-detail"] .compact-customer b{font-size:14px!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    #modal[data-type="test-detail"] .compact-meta{display:inline-block!important;max-width:88px!important;font-size:11px!important;color:#63727c!important;margin-left:6px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    #modal[data-type="test-detail"] .compact-results{display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin-top:7px!important;max-width:100%!important;overflow:hidden!important}
    #modal[data-type="test-detail"] .compact-result{display:inline-flex!important;align-items:center!important;gap:4px!important;max-width:100%!important;min-width:0!important;padding:3px 6px!important;border:1px solid #dce8e5!important;border-radius:999px!important;background:#fff!important;font-size:12px!important;line-height:1.25!important;overflow:hidden!important;box-sizing:border-box!important}
    #modal[data-type="test-detail"] .compact-product{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;max-width:88px!important;min-width:0!important}
    #modal[data-type="test-detail"] .compact-status{padding:2px 6px!important;border-radius:999px!important;border:1px solid transparent!important;font-size:11px!important;font-weight:850!important;white-space:nowrap!important;max-width:74px!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #modal[data-type="test-detail"] .compact-status.ok{background:#e7f9eb!important;color:#167c32!important;border-color:#bdeec9!important}
    #modal[data-type="test-detail"] .compact-status.warn{background:#fff7df!important;color:#9a5a00!important;border-color:#f1d17d!important}
    #modal[data-type="test-detail"] .compact-status.bad{background:#fff0ed!important;color:#c63b2e!important;border-color:#f3b7ad!important}
    #modal[data-type="test-detail"] .compact-note{font-size:11px!important;color:#63727c!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;max-width:48px!important;min-width:0!important}
    @media(max-width:380px){#modal[data-type="test-detail"] .compact-product{max-width:72px!important}#modal[data-type="test-detail"] .compact-status{max-width:68px!important}#modal[data-type="test-detail"] .compact-note{max-width:38px!important}}
  `;
  document.head.appendChild(style);
}

function resultHtml(result) {
  const label = LABELS[result.status] || result.status || 'Chưa thử';
  const tone = statusTone(result.status || label);
  return `
    <span class="compact-result">
      <span class="compact-product">${escapeHtml(result.product_name)}</span>
      <span class="compact-status ${tone}">${escapeHtml(label)}</span>
      ${result.note ? `<span class="compact-note">${escapeHtml(result.note)}</span>` : ''}
    </span>
  `;
}

async function openCompact(fileId) {
  ensureCss();

  const tests = await getAllLocal(LOCAL_STORES.onaTests);
  const items = await getAllLocal(LOCAL_STORES.onaTestItems);
  const file = tests.find((test) => test.id === fileId);
  const customers = tests.filter((test) => test.raw_payload && test.raw_payload.file_id === fileId);

  let html = `<div class="modal compact-modal"><header><h2>${escapeHtml(file?.customer_name || 'File test')}</h2><button type="button" data-close>Đóng</button></header><div class="compact-list">`;

  for (const customer of customers) {
    const results = items.filter((item) => item.test_id === customer.id);
    html += `
      <article class="compact-customer">
        <b>${escapeHtml(customer.customer_name)}</b>
        ${customer.area ? `<span class="compact-meta">${escapeHtml(customer.area)}</span>` : ''}
        ${customer.customer_phone ? `<span class="compact-meta">${escapeHtml(customer.customer_phone)}</span>` : ''}
        ${results.length ? `<div class="compact-results">${results.map(resultHtml).join('')}</div>` : '<p class="compact-empty">Chưa ghi kết quả sản phẩm.</p>'}
      </article>
    `;
  }

  html += `${customers.length ? '' : '<p class="empty">Chưa có khách.</p>'}</div></div>`;
  const modal = query('#modal');
  modal.dataset.type = 'test-detail';
  modal.innerHTML = html;
  modal.showModal();
}

document.addEventListener('click', (event) => {
  const detailButton = event.target.closest('[data-detail]');
  if (!detailButton) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openCompact(detailButton.dataset.detail);
}, true);
