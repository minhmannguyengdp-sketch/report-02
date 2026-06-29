import { makeOnaTest, makeOnaTestItem, todayIsoDate, uid } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal, putManyLocal, enqueueLocalSync } from '../local-db.js';
import { getActiveMcpSessionDetail, upsertMcpVisitForSession } from './mcp-core.js';

const statusRows = [
  ['pending', 'Chưa thử'],
  ['ok', 'OK'],
  ['interested', 'Quan tâm'],
  ['sample', 'Cần mẫu'],
  ['follow', 'Báo sau'],
  ['bad', 'Chưa tốt'],
  ['retry', 'Thử lại']
];

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function mountStyle() {
  let style = document.querySelector('style[data-mcp-test-actions]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpTestActions = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="mcp"] .mcp-actions [data-mcp-status="test"],
    section.page[data-page="mcp"] .mcp-actions [data-mcp-create-test]{border-color:#b9e2ff!important;background:#f2f9ff!important;color:#12639a!important}
    #modal[data-type="mcp-test"] .modal{max-height:calc(100dvh - 24px);overflow:auto;padding:13px 14px!important;gap:8px!important}
    #modal[data-type="mcp-test"] .form{display:grid!important;gap:8px!important}
    #modal[data-type="mcp-test"] .mcp-test-source{border:1px solid #b9e2ff;border-radius:14px;background:#f2f9ff;padding:9px 10px;color:#164663;font-size:12px;line-height:1.35;display:grid;gap:3px}
    #modal[data-type="mcp-test"] .mcp-test-source b{font-size:13px;color:#164663}
    #modal[data-type="mcp-test"] .mcp-test-source span{color:#203940;font-weight:850}
    #modal[data-type="mcp-test"] .mcp-test-source small{font-size:11px;color:#66757c}
    #modal[data-type="mcp-test"] .mcp-test-line{display:grid;grid-template-columns:minmax(0,1.15fr) 104px 34px;gap:6px;align-items:center}
    #modal[data-type="mcp-test"] .mcp-test-line input,
    #modal[data-type="mcp-test"] .mcp-test-line select{min-width:0;min-height:38px!important;border-radius:12px!important;padding:8px 10px!important;font-size:16px!important;line-height:1.2!important}
    #modal[data-type="mcp-test"] .mcp-test-line .mcp-test-note{grid-column:1 / 4}
    #modal[data-type="mcp-test"] .mcp-test-line .secondary{min-height:34px;padding:0!important;border-radius:11px!important}
    #modal[data-type="mcp-test"] textarea{min-height:56px!important;resize:vertical!important}
    #modal[data-type="mcp-test"] .primary{min-height:43px!important;border-radius:13px!important}
    @media(max-width:380px){#modal[data-type="mcp-test"] .mcp-test-line{grid-template-columns:minmax(0,1fr) 92px 32px;gap:5px}}
  `;
}

function formatDate(value = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || todayIsoDate();
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function compactName(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeName(value = '') {
  return compactName(value).toLowerCase();
}

function sessionFileId(session) {
  return `test-file-mcp-${session.id}`;
}

function routeName(detail) {
  return detail.route?.route_name || detail.session.route_name || 'Tuyến MCP';
}

function statusOptions(selected = 'pending') {
  return statusRows.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}

function sourceSummary({ detail, customer }) {
  const addressLine = [customer.area || detail.route?.area || detail.session.area, customer.address].filter(Boolean).join(' · ') || 'Chưa có địa chỉ';
  const sessionLine = [`Ngày ${formatDate(detail.session.session_date)}`, detail.session.sales ? `Sales ${detail.session.sales}` : 'Chưa nhập sales'].join(' · ');
  return `<div class="mcp-test-source"><b>🧪 ${esc(routeName(detail))}</b><span>${esc(customer.customer_name || 'Khách MCP')}${customer.phone ? ` · ${esc(customer.phone)}` : ''}</span><small>${esc(addressLine)}</small><small>${esc(sessionLine)}</small></div>`;
}

function productLine({ product_name = '', status = 'pending', note = '' } = {}) {
  return `<div class="mcp-test-line" data-mcp-test-line><input data-mcp-test-product placeholder="Sản phẩm test" value="${esc(product_name)}"><select data-mcp-test-status>${statusOptions(status)}</select><button type="button" class="secondary" data-mcp-test-remove-line>×</button><input class="mcp-test-note" data-mcp-test-note placeholder="Ghi chú kết quả" value="${esc(note)}"></div>`;
}

function readLines() {
  return [...document.querySelectorAll('#modal[data-type="mcp-test"] [data-mcp-test-line]')].map((row) => ({
    product_name: compactName(row.querySelector('[data-mcp-test-product]')?.value || ''),
    status: row.querySelector('[data-mcp-test-status]')?.value || 'pending',
    note: row.querySelector('[data-mcp-test-note]')?.value.trim() || ''
  })).filter((line) => line.product_name);
}

function summaryStatus(lines) {
  return lines.find((line) => line.status && line.status !== 'pending')?.status || 'pending';
}

function modalHtml({ detail, customer }) {
  return `<form class="modal" data-mcp-test-form data-customer-id="${esc(customer.id)}"><header><h2>Test từ MCP</h2><button type="button" data-close>Đóng</button></header><div class="form">${sourceSummary({ detail, customer })}<div class="line"><b>Sản phẩm test</b><div id="mcpTestLines">${productLine()}</div><button type="button" class="secondary wide" data-mcp-test-add-line>+ Thêm sản phẩm</button></div><label><span>Ghi chú khách</span><textarea id="mcpTestNote" rows="2" placeholder="Phản hồi chung của khách sau khi test..."></textarea></label><button class="primary">Lưu test</button></div></form>`;
}

async function openMcpTestModal(customerId) {
  const detail = await getActiveMcpSessionDetail();
  if (!detail?.session) return toast('Chọn phiên MCP trước khi tạo test.');
  const customer = detail.customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách trong tuyến.');
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'mcp-test';
  dialog.innerHTML = modalHtml({ detail, customer });
  if (!dialog.open) dialog.showModal();
  document.querySelector('[data-mcp-test-product]')?.focus();
}

async function ensureMcpTestFile(detail, lines) {
  const [tests, items] = await Promise.all([
    getAllLocal(LOCAL_STORES.onaTests),
    getAllLocal(LOCAL_STORES.onaTestItems)
  ]);
  const fileId = sessionFileId(detail.session);
  const existingFile = tests.find((test) => test.id === fileId);
  const fileItems = items.filter((item) => item.test_id === fileId);
  const byName = new Map(fileItems.map((item) => [normalizeName(item.product_name), item]));
  const nextFileItems = fileItems.slice();

  lines.forEach((line) => {
    const key = normalizeName(line.product_name);
    if (!key || byName.has(key)) return;
    const item = makeOnaTestItem({
      id: uid('test-product'),
      test_id: fileId,
      product_id: uid('mcp-product'),
      product_name: line.product_name,
      status: 'pending',
      note: ''
    });
    byName.set(key, item);
    nextFileItems.push(item);
  });

  const file = makeOnaTest({
    ...(existingFile || {}),
    id: fileId,
    test_date: detail.session.session_date || todayIsoDate(),
    sales: detail.session.sales || '',
    customer_name: `MCP Test · ${routeName(detail)} · ${formatDate(detail.session.session_date)}`,
    customer_phone: '',
    area: detail.route?.area || detail.session.area || '',
    test_type: 'MCP Test',
    overall_status: 'pending',
    overall_note: existingFile?.overall_note || 'File test tự động từ MCP.',
    sync_status: 'pending',
    raw_payload: {
      ...(existingFile?.raw_payload || {}),
      kind: 'test_file',
      source: 'mcp',
      mcp_session_id: detail.session.id,
      mcp_route_id: detail.session.route_id,
      mcp_route_name: routeName(detail)
    }
  });

  await putLocal(LOCAL_STORES.onaTests, file);
  await putManyLocal(LOCAL_STORES.onaTestItems, nextFileItems);
  await enqueueLocalSync('test_file', file.id, { test: file, items: nextFileItems });
  return { file, productByName: byName };
}

async function saveMcpTest(event) {
  event.preventDefault();
  const form = event.target.closest('[data-mcp-test-form]');
  const customerId = form?.dataset.customerId || '';
  const detail = await getActiveMcpSessionDetail();
  if (!detail?.session) return toast('Chọn phiên MCP trước khi lưu test.');
  const customer = detail.customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách trong tuyến.');
  const lines = readLines();
  if (!lines.length) return toast('Nhập ít nhất 1 sản phẩm test.');

  const visit = detail.visits.find((item) => item.route_customer_id === customer.id);
  const { file, productByName } = await ensureMcpTestFile(detail, lines);
  const note = document.querySelector('#mcpTestNote')?.value.trim() || '';
  const test = makeOnaTest({
    id: uid('test-customer'),
    test_date: detail.session.session_date || todayIsoDate(),
    sales: detail.session.sales || '',
    customer_id: customer.id,
    customer_name: customer.customer_name,
    customer_phone: customer.phone || '',
    area: customer.area || detail.route?.area || detail.session.area || '',
    test_type: 'MCP Test',
    need_sample: lines.some((line) => line.status === 'sample'),
    overall_status: summaryStatus(lines),
    overall_note: note,
    sync_status: 'pending',
    raw_payload: {
      kind: 'test_customer',
      source: 'mcp',
      file_id: file.id,
      route_customer_id: customer.id,
      mcp_session_id: detail.session.id,
      mcp_route_id: detail.session.route_id,
      mcp_route_name: routeName(detail),
      mcp_visit_id: visit?.id || `mcp-visit-${detail.session.id}-${customer.id}`,
      customer_name: customer.customer_name,
      customer_phone: customer.phone || '',
      customer_area: customer.area || '',
      customer_address: customer.address || '',
      google_maps_url: customer.google_maps_url || '',
      geo_lat: customer.geo_lat ?? null,
      geo_lng: customer.geo_lng ?? null
    }
  });
  const resultItems = lines.map((line) => {
    const fileProduct = productByName.get(normalizeName(line.product_name));
    return makeOnaTestItem({
      id: uid('test-result'),
      test_id: test.id,
      product_id: fileProduct?.product_id || uid('mcp-product'),
      product_name: line.product_name,
      status: line.status,
      note: line.note
    });
  });

  await putLocal(LOCAL_STORES.onaTests, test);
  await putManyLocal(LOCAL_STORES.onaTestItems, resultItems);
  await enqueueLocalSync('test_customer', test.id, { test, items: resultItems });
  await upsertMcpVisitForSession({
    ...(visit || {}),
    id: visit?.id,
    session_id: detail.session.id,
    route_id: detail.session.route_id,
    route_customer_id: customer.id,
    visit_date: detail.session.session_date,
    status: 'test',
    has_order: visit?.has_order,
    has_test: true,
    has_report: visit?.has_report,
    order_id: visit?.order_id,
    test_id: test.id,
    report_id: visit?.report_id,
    note: 'Có test sản phẩm',
    raw_payload: {
      ...(visit?.raw_payload || {}),
      mcp_test_id: test.id,
      mcp_test_file_id: file.id
    }
  });

  document.querySelector('#modal')?.close();
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  window.dispatchEvent(new CustomEvent('test:changed'));
  toast('Đã lưu test từ MCP.');
}

function handleClick(event) {
  const testButton = event.target.closest('section.page[data-page="mcp"] .mcp-actions [data-mcp-status="test"], section.page[data-page="mcp"] .mcp-actions [data-mcp-create-test]');
  if (testButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openMcpTestModal(testButton.dataset.customerId || testButton.closest('.mcp-customer')?.dataset.customerId || '').catch((error) => {
      console.warn('mcp test open failed', error);
      toast('Không mở được test từ MCP.');
    });
    return;
  }

  if (event.target.closest('#modal[data-type="mcp-test"] [data-mcp-test-add-line]')) {
    event.preventDefault();
    document.querySelector('#mcpTestLines')?.insertAdjacentHTML('beforeend', productLine());
    document.querySelector('#mcpTestLines [data-mcp-test-line]:last-child [data-mcp-test-product]')?.focus();
    return;
  }

  const remove = event.target.closest('#modal[data-type="mcp-test"] [data-mcp-test-remove-line]');
  if (remove) {
    event.preventDefault();
    const rows = document.querySelectorAll('#modal[data-type="mcp-test"] [data-mcp-test-line]');
    if (rows.length > 1) remove.closest('[data-mcp-test-line]')?.remove();
  }
}

function boot() {
  mountStyle();
}

window.addEventListener('click', handleClick, true);
document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-mcp-test-form]')) return;
  saveMcpTest(event).catch((error) => {
    console.warn('mcp test save failed', error);
    toast('Không lưu được test từ MCP.');
  });
});
boot();
window.addEventListener('DOMContentLoaded', boot);
