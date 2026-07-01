import { makeAiSummary, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, getAllLocal, putLocal } from '../local-db.js';

const money = new Intl.NumberFormat('vi-VN');

function $(selector, root = document) {
  return root.querySelector(selector);
}

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function clean(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function formatMoney(value = 0) {
  const amount = Number(value || 0);
  return amount ? `${money.format(amount)}đ` : '0đ';
}

function formatDate(value = '') {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function activeRow(row = {}) {
  return row.status !== 'deleted' && !row.deleted_at && !row.raw_payload?.deleted_at;
}

function isAiReport(row = {}) {
  return row.summary_type !== 'agent_config' && activeRow(row);
}

function textOfSummary(row = {}) {
  if (typeof row.result === 'string') return row.result;
  return row.result?.text || row.result?.summary || row.note || '';
}

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2300);
}

function closeModal() {
  const modal = $('#modal');
  if (modal?.open) modal.close();
  if (modal) modal.dataset.type = '';
}

function saveText(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function filenameSafe(value = '') {
  return clean(value).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'bao-cao-ai';
}

function installStyle() {
  if ($('style[data-ai-summary-ui]')) return;
  const style = document.createElement('style');
  style.dataset.aiSummaryUi = '1';
  style.textContent = `
    .ai-summary-panel{display:grid!important;gap:8px!important}
    .ai-summary-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
    .ai-summary-actions button{min-height:38px!important}
    .ai-summary-list{display:grid!important;gap:8px!important}
    .ai-summary-card{border:1px solid #dce8e5!important;border-radius:14px!important;background:#fbfffd!important;padding:10px!important;display:grid!important;gap:7px!important;min-width:0!important}
    .ai-summary-card h3{font-size:14px!important;line-height:1.15!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .ai-summary-card small{display:block!important;color:#63727c!important;font-size:11px!important;line-height:1.3!important}
    .ai-summary-card p{margin:0!important;color:#33444c!important;font-size:12px!important;line-height:1.35!important;display:-webkit-box!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important;overflow:hidden!important}
    .ai-summary-card-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
    .ai-summary-card-actions button{min-height:32px!important;border-radius:10px!important;font-size:11px!important;font-weight:900!important}
    .ai-summary-danger{border-color:#fecaca!important;background:#fff7f7!important;color:#b91c1c!important}
    #modal[data-type="ai-summary"]{width:min(410px,calc(100vw - 20px));max-height:calc(100dvh - 20px)}
    #modal[data-type="ai-summary"] .modal{max-height:calc(100dvh - 20px)!important;overflow:hidden!important;display:grid!important;gap:10px!important}
    .ai-summary-form{min-height:0!important;overflow:auto!important;display:grid!important;gap:9px!important;padding-right:2px!important}
    .ai-summary-form label{display:grid!important;gap:4px!important;margin:0!important}
    .ai-summary-form span{font-size:11px!important;font-weight:900!important;color:#52616b!important}
    .ai-summary-form input,.ai-summary-form textarea{width:100%!important;border:1px solid #cad7d4!important;border-radius:12px!important;background:#fff!important;padding:8px 10px!important;font:inherit!important;font-size:13px!important;box-sizing:border-box!important}
    .ai-summary-form textarea{min-height:180px!important;line-height:1.4!important;resize:vertical!important}
    .ai-summary-form-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
    .ai-summary-modal-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
    .ai-summary-view-text{white-space:pre-wrap!important;border:1px solid #dce8e5!important;border-radius:13px!important;background:#fbfffd!important;padding:10px!important;font-size:13px!important;line-height:1.45!important;max-height:52dvh!important;overflow:auto!important}
  `;
  document.head.appendChild(style);
}

async function loadAiReports() {
  await openLocalDb();
  const rows = await getAllLocal(LOCAL_STORES.aiSummaries);
  return rows.filter(isAiReport).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

async function readBusinessSnapshot() {
  await openLocalDb();
  const [orders, orderItems, tests, reports, mcpSessions] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.orderItems),
    getAllLocal(LOCAL_STORES.onaTests),
    getAllLocal(LOCAL_STORES.marketReports),
    getAllLocal(LOCAL_STORES.mcpRouteSessions)
  ]);
  const today = todayIsoDate();
  const activeOrders = orders.filter((order) => activeRow(order) && order.status !== 'cancelled');
  const todayOrders = activeOrders.filter((order) => order.order_date === today);
  const activeReports = reports.filter(activeRow);
  const activeTests = tests.filter((row) => activeRow(row) && row.raw_payload?.kind === 'test_file');
  const activeMcpSessions = mcpSessions.filter((session) => activeRow(session) && session.status !== 'cancelled');
  return {
    today,
    orders,
    orderItems,
    tests,
    reports,
    mcpSessions,
    metrics: {
      orders: activeOrders.length,
      todayOrders: todayOrders.length,
      revenueToday: todayOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0),
      tests: activeTests.length,
      reports: activeReports.length,
      mcpSessions: activeMcpSessions.length
    }
  };
}

function buildDraftText(snapshot) {
  const { metrics, today } = snapshot;
  return [
    `BÁO CÁO AI - ${formatDate(today)}`,
    '',
    '1. Tổng quan dữ liệu',
    `- MCP: ${metrics.mcpSessions} phiên tuyến đang lưu.`,
    `- Đơn hàng: ${metrics.orders} đơn hoạt động, trong đó hôm nay có ${metrics.todayOrders} đơn.`,
    `- Doanh số hôm nay: ${formatMoney(metrics.revenueToday)}.`,
    `- Test sản phẩm: ${metrics.tests} file test.`,
    `- Báo cáo thị trường: ${metrics.reports} báo cáo.`,
    '',
    '2. Nhận xét nhanh',
    '- Cần rà soát các đơn chờ xử lý và các báo cáo có cơ hội/rủi ro nổi bật.',
    '- Dữ liệu này là bản tổng hợp local, có thể chỉnh nội dung trước khi lưu.',
    '',
    '3. Hành động đề xuất',
    '- Kiểm tra đơn chưa chốt.',
    '- Tổng hợp khách cần follow từ Test/Báo cáo.',
    '- Xuất file nếu cần gửi công ty.'
  ].join('\n');
}

async function openCreateSummaryModal() {
  const modal = $('#modal');
  if (!modal) return;
  const snapshot = await readBusinessSnapshot();
  const draftText = buildDraftText(snapshot);
  modal.dataset.type = 'ai-summary';
  modal.innerHTML = `
    <div class="modal">
      <header><h2>Lưu báo cáo AI</h2><button type="button" data-ai-summary-close>Đóng</button></header>
      <form class="ai-summary-form" data-ai-summary-form>
        <label><span>Tiêu đề</span><input name="title" value="Báo cáo AI ${esc(formatDate(snapshot.today))}" required></label>
        <div class="ai-summary-form-grid">
          <label><span>Từ ngày</span><input type="date" name="date_from" value="${esc(snapshot.today)}"></label>
          <label><span>Đến ngày</span><input type="date" name="date_to" value="${esc(snapshot.today)}"></label>
        </div>
        <div class="ai-summary-form-grid">
          <label><span>Sales</span><input name="sales" placeholder="Tên sales"></label>
          <label><span>Khu vực</span><input name="market_area" placeholder="Khu vực"></label>
        </div>
        <label><span>Nội dung báo cáo</span><textarea name="content" required>${esc(draftText)}</textarea></label>
        <div class="ai-summary-modal-actions"><button type="button" class="secondary" data-ai-summary-close>Hủy</button><button type="submit" class="primary">Lưu báo cáo</button></div>
      </form>
    </div>`;
  modal.showModal();
}

async function saveSummaryFromForm(form) {
  const data = new FormData(form);
  const snapshot = await readBusinessSnapshot();
  const content = clean(data.get('content'));
  if (!content) return toast('Chưa có nội dung báo cáo AI');
  const row = makeAiSummary({
    title: clean(data.get('title')) || `Báo cáo AI ${formatDate(snapshot.today)}`,
    summary_type: 'company_report',
    date_from: clean(data.get('date_from')) || null,
    date_to: clean(data.get('date_to')) || null,
    sales: clean(data.get('sales')),
    market_area: clean(data.get('market_area')),
    source_filters: { source: 'local_ai_summary_ui', metrics: snapshot.metrics },
    source_refs: [
      { type: 'orders', count: snapshot.metrics.orders },
      { type: 'tests', count: snapshot.metrics.tests },
      { type: 'market_reports', count: snapshot.metrics.reports },
      { type: 'mcp_sessions', count: snapshot.metrics.mcpSessions }
    ],
    result: { text: content, format: 'text', generated_at: nowIso(), metrics: snapshot.metrics },
    status: 'saved',
    note: 'Saved from AI summary UI'
  });
  await putLocal(LOCAL_STORES.aiSummaries, row);
  closeModal();
  await renderSummarySection();
  toast('Đã lưu báo cáo AI');
}

async function openViewSummaryModal(id = '') {
  const rows = await loadAiReports();
  const row = rows.find((item) => item.id === id);
  if (!row) return toast('Không tìm thấy báo cáo AI');
  const modal = $('#modal');
  if (!modal) return;
  modal.dataset.type = 'ai-summary';
  modal.innerHTML = `
    <div class="modal">
      <header><h2>${esc(row.title || 'Báo cáo AI')}</h2><button type="button" data-ai-summary-close>Đóng</button></header>
      <div class="ai-summary-form">
        <small>${esc(formatDate(row.date_from || ''))}${row.date_to && row.date_to !== row.date_from ? ` → ${esc(formatDate(row.date_to))}` : ''}${row.sales ? ` · ${esc(row.sales)}` : ''}${row.market_area ? ` · ${esc(row.market_area)}` : ''}</small>
        <div class="ai-summary-view-text">${esc(textOfSummary(row))}</div>
        <div class="ai-summary-modal-actions"><button type="button" class="secondary" data-ai-summary-export="${esc(row.id)}">Xuất file</button><button type="button" class="ai-summary-danger" data-ai-summary-delete="${esc(row.id)}">Xoá</button></div>
      </div>
    </div>`;
  modal.showModal();
}

async function deleteSummary(id = '') {
  const rows = await loadAiReports();
  const row = rows.find((item) => item.id === id);
  if (!row) return toast('Không tìm thấy báo cáo AI');
  if (!window.confirm(`Xoá báo cáo AI "${row.title || 'này'}"?`)) return;
  await putLocal(LOCAL_STORES.aiSummaries, {
    ...row,
    status: 'deleted',
    deleted_at: row.deleted_at || nowIso(),
    updated_at: nowIso(),
    raw_payload: { ...(row.raw_payload || {}), deleted_at: row.deleted_at || nowIso(), delete_reason: 'local_ui' }
  });
  closeModal();
  await renderSummarySection();
  toast('Đã xoá báo cáo AI');
}

async function exportSummary(id = '') {
  const rows = await loadAiReports();
  const row = rows.find((item) => item.id === id);
  if (!row) return toast('Không tìm thấy báo cáo AI');
  const lines = [
    row.title || 'Báo cáo AI',
    `Ngày: ${formatDate(row.date_from || row.created_at?.slice(0, 10) || '')}${row.date_to && row.date_to !== row.date_from ? ` - ${formatDate(row.date_to)}` : ''}`,
    row.sales ? `Sales: ${row.sales}` : '',
    row.market_area ? `Khu vực: ${row.market_area}` : '',
    '',
    textOfSummary(row)
  ].filter((line) => line !== null && line !== undefined).join('\n');
  saveText(`${filenameSafe(row.title)}.txt`, lines);
  toast('Đã xuất file báo cáo AI');
}

function summaryCard(row) {
  const text = textOfSummary(row);
  const date = row.date_from || row.created_at?.slice(0, 10) || '';
  return `<article class="ai-summary-card" data-ai-summary-id="${esc(row.id)}">
    <h3>${esc(row.title || 'Báo cáo AI')}</h3>
    <small>${esc(formatDate(date))}${row.sales ? ` · ${esc(row.sales)}` : ''}${row.market_area ? ` · ${esc(row.market_area)}` : ''}</small>
    <p>${esc(text || 'Chưa có nội dung.')}</p>
    <div class="ai-summary-card-actions"><button type="button" class="secondary" data-ai-summary-view="${esc(row.id)}">Xem</button><button type="button" class="secondary" data-ai-summary-export="${esc(row.id)}">Xuất</button><button type="button" class="ai-summary-danger" data-ai-summary-delete="${esc(row.id)}">Xoá</button></div>
  </article>`;
}

async function renderSummarySection() {
  installStyle();
  const page = $('[data-page="ai"]');
  const body = page?.querySelector('.ai-page-body');
  if (!body) return;
  let panel = body.querySelector('[data-ai-summary-panel]');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'ai-panel ai-summary-panel';
    panel.dataset.aiSummaryPanel = '1';
    body.appendChild(panel);
  }
  const rows = await loadAiReports();
  panel.innerHTML = `<h2>Báo cáo AI đã lưu</h2><p>Lưu bản tổng hợp AI local để xem lại, xoá hoặc xuất file gửi công ty.</p><div class="ai-summary-actions"><button type="button" class="ai-run-btn" data-ai-summary-create>Tạo/Lưu báo cáo</button><button type="button" class="secondary" data-ai-summary-refresh>Làm mới</button></div><div class="ai-summary-list">${rows.map(summaryCard).join('') || '<p class="ai-agent-empty">Chưa có báo cáo AI đã lưu.</p>'}</div>`;
}

function schedule() {
  clearTimeout(schedule.timer);
  schedule.timer = setTimeout(() => renderSummarySection().catch((error) => console.warn('AI summary render failed', error)), 180);
}

function wire() {
  document.addEventListener('click', async (event) => {
    const createButton = event.target.closest('[data-ai-summary-create], #aiBtn');
    if (createButton && $('[data-page="ai"]')?.contains(createButton)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await openCreateSummaryModal();
      return;
    }
    const refresh = event.target.closest('[data-ai-summary-refresh]');
    if (refresh) {
      event.preventDefault();
      await renderSummarySection();
      return;
    }
    const view = event.target.closest('[data-ai-summary-view]');
    if (view) {
      event.preventDefault();
      await openViewSummaryModal(view.dataset.aiSummaryView);
      return;
    }
    const exportButton = event.target.closest('[data-ai-summary-export]');
    if (exportButton) {
      event.preventDefault();
      await exportSummary(exportButton.dataset.aiSummaryExport);
      return;
    }
    const deleteButton = event.target.closest('[data-ai-summary-delete]');
    if (deleteButton) {
      event.preventDefault();
      await deleteSummary(deleteButton.dataset.aiSummaryDelete);
      return;
    }
    if (event.target.closest('[data-ai-summary-close]')) {
      event.preventDefault();
      closeModal();
    }
  }, true);

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest?.('[data-ai-summary-form]');
    if (!form) return;
    event.preventDefault();
    await saveSummaryFromForm(form);
  }, true);
}

wire();
window.addEventListener('DOMContentLoaded', schedule);
window.addEventListener('order:changed', schedule);
window.addEventListener('test:changed', schedule);
window.addEventListener('report:changed', schedule);
window.addEventListener('mcp:session-changed', schedule);
setInterval(schedule, 1600);
schedule();
