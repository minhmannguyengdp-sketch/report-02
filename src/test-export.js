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

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function safeFileName(value = 'test') {
  return String(value || 'test')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'test';
}

function statusLabel(status) {
  return LABELS[status] || status || '';
}

function cell(value = '') {
  return `<td>${escapeHtml(value)}</td>`;
}

function headingCell(value = '') {
  return `<th>${escapeHtml(value)}</th>`;
}

function makeResultMap(results) {
  const map = new Map();
  for (const result of results) {
    if (result.product_id) map.set(`id:${result.product_id}`, result);
    if (result.product_name) map.set(`name:${result.product_name}`, result);
  }
  return map;
}

function excelHtml({ file, products, customers, items }) {
  const customerRows = customers.length ? customers : [{ customer_name: '', customer_phone: '', area: '', overall_note: '', id: '__empty' }];
  const headerColumns = ['STT', 'Khách', 'SĐT', 'Khu vực', 'Ghi chú khách'];
  for (const product of products) {
    headerColumns.push(`${product.product_name} - trạng thái`, `${product.product_name} - ghi chú`);
  }

  const rows = customerRows.map((customer, index) => {
    const results = items.filter((item) => item.test_id === customer.id);
    const resultMap = makeResultMap(results);
    const productCells = products.map((product) => {
      const result = resultMap.get(`id:${product.product_id}`) || resultMap.get(`name:${product.product_name}`) || {};
      return `${cell(statusLabel(result.status))}${cell(result.note || '')}`;
    }).join('');

    return `<tr>${cell(customers.length ? index + 1 : '')}${cell(customer.customer_name)}${cell(customer.customer_phone)}${cell(customer.area)}${cell(customer.overall_note)}${productCells}</tr>`;
  }).join('');

  const generatedAt = new Date().toLocaleString('vi-VN');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;color:#111827}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #9ca3af;padding:6px 8px;font-size:12px;vertical-align:top;mso-number-format:'\\@'}
  th{background:#dff7ef;font-weight:700;text-align:left;color:#063a35}
  .title{font-size:18px;font-weight:700;color:#007866}
  .meta td{border:0;padding:3px 0;font-size:12px}
</style>
</head>
<body>
<table class="meta">
  <tr><td class="title" colspan="4">${escapeHtml(file.customer_name || 'File test')}</td></tr>
  <tr><td>Ngày test:</td><td>${escapeHtml(file.test_date || '')}</td><td>Sales:</td><td>${escapeHtml(file.sales || '')}</td></tr>
  <tr><td>Ghi chú file:</td><td colspan="3">${escapeHtml(file.overall_note || '')}</td></tr>
  <tr><td>Số sản phẩm:</td><td>${products.length}</td><td>Số khách:</td><td>${customers.length}</td></tr>
  <tr><td>Xuất lúc:</td><td colspan="3">${escapeHtml(generatedAt)}</td></tr>
</table>
<br>
<table>
  <thead><tr>${headerColumns.map(headingCell).join('')}</tr></thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

function downloadExcel(html, fileName) {
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportTestFile(fileId) {
  const [tests, items] = await Promise.all([
    getAllLocal(LOCAL_STORES.onaTests),
    getAllLocal(LOCAL_STORES.onaTestItems),
  ]);

  const file = tests.find((test) => test.id === fileId);
  if (!file) {
    toast('Không tìm thấy file test để xuất.');
    return;
  }

  const products = items.filter((item) => item.test_id === fileId);
  const customers = tests.filter((test) => test.raw_payload?.kind === 'test_customer' && test.raw_payload?.file_id === fileId);
  const html = excelHtml({ file, products, customers, items });
  const fileName = safeFileName(`${file.customer_name || 'test'}-${file.test_date || ''}`);
  downloadExcel(html, fileName);
  toast('Đã xuất file Excel.');
}

function addExportButtons() {
  document.querySelectorAll('#dataList .test-actions').forEach((actions) => {
    if (actions.querySelector('[data-export-test]')) return;
    const refButton = actions.querySelector('[data-detail]') || actions.querySelector('[data-add-customer]');
    const fileId = refButton?.dataset.detail || refButton?.dataset.addCustomer;
    if (!fileId) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary test-export-btn';
    button.dataset.exportTest = fileId;
    button.textContent = 'Excel';
    actions.appendChild(button);
  });
}

function injectCss() {
  if (document.querySelector('style[data-test-export]')) return;
  const style = document.createElement('style');
  style.dataset.testExport = '1';
  style.textContent = `
    #dataList .record .test-actions{display:grid!important;grid-template-columns:76px 76px 76px!important;gap:6px!important;align-items:center!important;justify-content:start!important;overflow:visible!important}
    #dataList .record .test-actions button.secondary{box-sizing:border-box!important;display:inline-grid!important;place-items:center!important;width:76px!important;min-width:76px!important;max-width:76px!important;height:32px!important;min-height:32px!important;max-height:32px!important;padding:0 5px!important;font-size:11px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;flex:0 0 76px!important}
    #dataList .record .test-actions .test-export-btn{border-color:#188733!important;color:#188733!important;background:#f4fff6!important}
  `;
  document.head.appendChild(style);
}

function boot() {
  injectCss();
  addExportButtons();
  const dataList = document.querySelector('#dataList');
  if (dataList && !dataList.dataset.exportWatch) {
    dataList.dataset.exportWatch = '1';
    new MutationObserver(addExportButtons).observe(dataList, { childList: true, subtree: true });
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-export-test]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  exportTestFile(button.dataset.exportTest);
});

boot();
window.addEventListener('DOMContentLoaded', boot);
