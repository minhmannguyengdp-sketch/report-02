import { ensureProductCatalog } from './product-catalog.js';

let quoteCatalog = [];
let selectedQuoteIds = new Set();

function text(value = '') { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function norm(value = '') { return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd'); }
function esc(value = '') { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function number(value = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function money(value = 0) { const amount = number(value); return amount ? `${amount.toLocaleString('vi-VN')}đ` : 'Liên hệ'; }
function stamp() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`; }
function todayLabel() { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }
function toast(message) { const el = document.querySelector('#toast'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600); }
function downloadHtml(filename, html) { const blob = new Blob([html], { type: 'text/html;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }

function usableProducts(products = []) {
  return products.filter((item) => item && item.active !== false && item.orderable !== false).sort((a, b) => String(a.industry_key || '').localeCompare(String(b.industry_key || ''), 'vi') || String(a.category_key || '').localeCompare(String(b.category_key || ''), 'vi') || String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
}

function groupProducts(products = []) {
  const groups = new Map();
  usableProducts(products).forEach((item) => {
    const industry = text(item.industry || 'Khác');
    const category = text(item.category || 'Khác');
    if (!groups.has(industry)) groups.set(industry, new Map());
    const categories = groups.get(industry);
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(item);
  });
  return groups;
}

function productNote(item = {}) { return [item.brand, item.size, item.flavor, item.choice_summary].map(text).filter(Boolean).join(' · '); }
function productSearchText(item = {}) { return norm([item.sku, item.source_sku, item.name, item.product_name, item.brand, item.category, item.industry, item.size, item.flavor].filter(Boolean).join(' ')); }
function industryOptions(products = []) { return [...new Set(usableProducts(products).map((p) => text(p.industry || 'Khác')))].sort((a, b) => a.localeCompare(b, 'vi')); }

function renderCategory(category, products = []) {
  return `<section class="category"><div class="category-title"><span>${esc(category)}</span><b>${products.length} mã</b></div><table><thead><tr><th style="width:34px">STT</th><th style="width:78px">SKU</th><th>Sản phẩm</th><th style="width:64px">ĐVT</th><th style="width:92px" class="right">Giá</th></tr></thead><tbody>${products.map((item, index) => `<tr><td class="center">${index + 1}</td><td class="sku">${esc(item.sku || item.source_sku || '')}</td><td><div class="product">${esc(item.name || item.product_name || '')}</div>${productNote(item) ? `<div class="muted">${esc(productNote(item))}</div>` : ''}</td><td class="center">${esc(item.unit || '')}</td><td class="right price">${esc(money(item.price || item.unit_price))}</td></tr>`).join('')}</tbody></table></section>`;
}

function renderIndustry(industry, categories) {
  const total = [...categories.values()].reduce((sum, list) => sum + list.length, 0);
  return `<section class="industry"><div class="industry-head"><h2>${esc(industry)}</h2><span>${total} sản phẩm</span></div>${[...categories.entries()].map(([category, products]) => renderCategory(category, products)).join('')}</section>`;
}

function quoteHtml(products, titleSuffix = 'Theo ngành hàng') {
  const groups = groupProducts(products);
  const totalProducts = [...groups.values()].reduce((sum, categories) => sum + [...categories.values()].reduce((s, list) => s + list.length, 0), 0);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Báo giá sản phẩm ${todayLabel()}</title><style>
    @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef3f1;color:#10212b;font-family:Arial,Helvetica,sans-serif}body{padding:16px}.toolbar{width:210mm;max-width:100%;margin:0 auto 10px;display:flex;justify-content:flex-end;gap:8px}.toolbar button{border:1px solid #cfe1db;background:#fff;color:#10212b;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer}.toolbar .primary{background:#0f8f7a;border-color:#0f8f7a;color:#fff}.sheet{width:210mm;max-width:100%;min-height:297mm;margin:0 auto;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.08);padding:12mm}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f8f7a;padding-bottom:10px;margin-bottom:12px}.title h1{font-size:26px;line-height:1.05;margin:0;color:#082337;letter-spacing:.4px}.title p{margin:5px 0 0;color:#63727c;font-size:12px;line-height:1.4}.meta{text-align:right;font-size:12px;line-height:1.55;color:#31434c}.pill{display:inline-block;margin-top:6px;border:1px solid #cdece4;background:#e9f8f4;color:#0f8f7a;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:900}.note{border:1px solid #d9e6e1;border-radius:12px;background:#fbfffd;padding:9px 10px;margin:0 0 12px;font-size:12px;color:#41515a;line-height:1.45}.industry{page-break-inside:avoid;margin:0 0 14px}.industry-head{display:flex;justify-content:space-between;align-items:center;background:#0b3b35;color:#fff;border-radius:12px 12px 0 0;padding:9px 11px}.industry-head h2{font-size:16px;margin:0;line-height:1.1}.industry-head span{font-size:11px;font-weight:900;background:rgba(255,255,255,.14);border-radius:999px;padding:4px 8px}.category{border:1px solid #d9e6e1;border-top:0;margin-bottom:8px;page-break-inside:avoid}.category-title{display:flex;justify-content:space-between;align-items:center;background:#f3f8f6;border-bottom:1px solid #d9e6e1;padding:7px 9px;font-size:12px;font-weight:900;color:#0b3b35}.category-title b{font-size:10px;color:#63727c}table{width:100%;border-collapse:collapse}thead th{background:#fafdfc;color:#16323e;font-size:10.5px;font-weight:900;padding:7px;border-bottom:1px solid #d9e6e1;text-align:left}tbody td{border-top:1px solid #edf3f1;padding:7px;font-size:11.5px;vertical-align:top}.center{text-align:center}.right{text-align:right}.sku{font-size:10.5px;color:#52636c;font-weight:800}.product{font-weight:800;color:#082337;line-height:1.25}.muted{font-size:10.2px;color:#65757e;margin-top:2px;line-height:1.25}.price{font-weight:900;color:#0f8f7a;white-space:nowrap}.footer{border-top:1px solid #d9e6e1;margin-top:14px;padding-top:8px;text-align:center;color:#7a878f;font-size:10.5px}@media print{body{padding:0;background:#fff}.toolbar{display:none!important}.sheet{width:auto;min-height:auto;box-shadow:none;margin:0;padding:0}.industry{break-inside:avoid}.category{break-inside:avoid}}
  </style></head><body><div class="toolbar"><button onclick="window.close()">Đóng</button><button class="primary" onclick="window.print()">In / Lưu PDF</button></div><main class="sheet"><header class="top"><div class="title"><h1>BÁO GIÁ SẢN PHẨM</h1><p>Sắp xếp theo ngành hàng · dễ xem trên điện thoại và khi in PDF</p></div><div class="meta"><div><b>Ngày:</b> ${todayLabel()}</div><div><b>Tổng:</b> ${totalProducts} sản phẩm</div><span class="pill">${esc(titleSuffix)}</span></div></header><div class="note">Giá dùng để tham khảo/báo nhanh theo dữ liệu sản phẩm trong máy. Giá thực tế có thể điều chỉnh theo khách hàng, khu vực, số lượng hoặc chương trình bán hàng.</div>${[...groups.entries()].map(([industry, categories]) => renderIndustry(industry, categories)).join('')}<div class="footer">Báo giá được tạo tự động từ dữ liệu sản phẩm local.</div></main></body></html>`;
}

async function getCatalog() {
  if (!quoteCatalog.length) quoteCatalog = usableProducts(await ensureProductCatalog());
  return quoteCatalog;
}

async function exportPriceQuotePdf(products = null, label = 'Theo ngành hàng') {
  const catalog = products || await getCatalog();
  const rows = usableProducts(catalog);
  if (!rows.length) return toast('Chưa có dữ liệu sản phẩm để xuất báo giá.');
  downloadHtml(`bao-gia-san-pham-${stamp()}.html`, quoteHtml(rows, label));
  toast('Đã xuất báo giá. Mở file rồi bấm In / Lưu PDF.');
}

async function exportByIndustry() {
  const catalog = await getCatalog();
  const select = document.querySelector('[data-price-quote-industry]');
  const industry = select?.value || 'all';
  const products = industry === 'all' ? catalog : catalog.filter((p) => text(p.industry || 'Khác') === industry);
  return exportPriceQuotePdf(products, industry === 'all' ? 'Tất cả ngành' : `Ngành: ${industry}`);
}

function selectedProducts() { return quoteCatalog.filter((p) => selectedQuoteIds.has(p.id)); }
async function exportSelectedProducts() {
  await getCatalog();
  const selected = selectedProducts();
  if (!selected.length) return toast('Chưa chọn sản phẩm báo giá.');
  return exportPriceQuotePdf(selected, `Chọn riêng: ${selected.length} sản phẩm`);
}

function renderQuotePicker() {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  const keyword = norm(dialog.querySelector('[data-quote-search]')?.value || '');
  const industry = dialog.querySelector('[data-quote-picker-industry]')?.value || 'all';
  const filtered = quoteCatalog.filter((p) => (industry === 'all' || text(p.industry || 'Khác') === industry) && (!keyword || productSearchText(p).includes(keyword))).slice(0, 120);
  const list = dialog.querySelector('[data-quote-picker-list]');
  const count = dialog.querySelector('[data-quote-picked-count]');
  if (count) count.textContent = `${selectedQuoteIds.size} đã chọn`;
  if (!list) return;
  list.innerHTML = filtered.map((p) => `<label class="quote-product-row"><input type="checkbox" data-quote-pick="${esc(p.id)}" ${selectedQuoteIds.has(p.id) ? 'checked' : ''}><span><b>${esc(p.name || p.product_name)}</b><small>${esc([p.sku, p.industry, p.category, productNote(p)].filter(Boolean).join(' · '))}</small></span><em>${esc(money(p.price || p.unit_price))}</em></label>`).join('') || '<p class="empty">Không tìm thấy sản phẩm.</p>';
}

async function openQuotePicker() {
  await getCatalog();
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  const options = industryOptions(quoteCatalog).map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  dialog.dataset.type = 'price-quote-picker';
  dialog.innerHTML = `<div class="modal quote-picker-modal"><header><h2>Chọn sản phẩm báo giá</h2><button type="button" data-close>Đóng</button></header><div class="quote-picker-filters"><input type="search" placeholder="Tìm SKU / tên sản phẩm" data-quote-search><select data-quote-picker-industry><option value="all">Tất cả ngành</option>${options}</select></div><div class="quote-picker-actions"><button type="button" class="secondary" data-quote-select-visible>Chọn trang này</button><button type="button" class="secondary" data-quote-clear-selected>Bỏ chọn</button><button type="button" class="primary" data-export-selected-price-quote>Xuất báo giá</button></div><small class="quote-picked" data-quote-picked-count>${selectedQuoteIds.size} đã chọn</small><div class="quote-picker-list" data-quote-picker-list></div></div>`;
  if (!dialog.open) dialog.showModal();
  renderQuotePicker();
}

function installStyle() {
  let style = document.querySelector('style[data-price-quote-export]');
  if (!style) { style = document.createElement('style'); style.dataset.priceQuoteExport = '1'; document.head.appendChild(style); }
  style.textContent = `.price-quote-tools{margin:0 0 12px!important;border:1px solid #dce8e5!important;border-radius:18px!important;background:#fff!important;padding:12px!important;box-shadow:0 8px 20px rgba(12,55,50,.05)!important;display:grid!important;gap:9px!important}.price-quote-tools b{font-size:14px!important;color:#082337!important}.price-quote-tools small{font-size:11px!important;color:#63727c!important;line-height:1.25!important}.price-quote-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important}.price-quote-grid select,.price-quote-grid button{min-height:40px!important;border-radius:12px!important;font-size:12px!important;font-weight:950!important}.price-quote-grid select{border:1px solid #dce8e5!important;background:#fff!important;padding:0 10px!important;color:#082337!important}.price-quote-grid button{border:1px solid #9bdccd!important;background:#eefbf6!important;color:#007866!important}.quote-picker-modal{max-height:calc(100dvh - 24px)!important;overflow:auto!important}.quote-picker-filters{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important}.quote-picker-filters input,.quote-picker-filters select{min-height:38px!important;border:1px solid #dce8e5!important;border-radius:12px!important;padding:0 10px!important}.quote-picker-actions{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:6px!important}.quote-picked{font-weight:900!important;color:#007866!important}.quote-picker-list{display:grid!important;gap:7px!important}.quote-product-row{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;border:1px solid #dce8e5!important;border-radius:14px!important;background:#fff!important;padding:8px!important}.quote-product-row b{display:block!important;font-size:12.5px!important;color:#082337!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.quote-product-row small{display:block!important;margin-top:3px!important;font-size:10px!important;color:#63727c!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.quote-product-row em{font-style:normal!important;font-size:11px!important;font-weight:950!important;color:#007866!important;white-space:nowrap!important}@media(max-width:380px){.price-quote-grid,.quote-picker-filters,.quote-picker-actions{grid-template-columns:1fr!important}}`;
}

async function mountPriceQuoteTool() {
  installStyle();
  const page = document.querySelector('section.page[data-page="admin"]');
  if (!page || page.querySelector('[data-price-quote-tools]')) return;
  const catalog = await getCatalog().catch(() => []);
  const options = industryOptions(catalog).map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  const anchor = page.querySelector('[data-admin-data-tools]') || page.querySelector('article.admin');
  const block = document.createElement('article');
  block.className = 'price-quote-tools';
  block.dataset.priceQuoteTools = '1';
  block.innerHTML = `<div><b>Báo giá sản phẩm</b><br><small>Xuất báo giá theo ngành hoặc chọn sản phẩm riêng lẻ từ data hiện có.</small></div><div class="price-quote-grid"><select data-price-quote-industry><option value="all">Tất cả ngành</option>${options}</select><button type="button" data-export-price-quote-industry>Xuất theo ngành</button><button type="button" data-open-price-quote-picker>Chọn sản phẩm riêng</button><button type="button" data-export-price-quote>Tất cả sản phẩm</button></div>`;
  if (anchor) anchor.insertAdjacentElement('afterend', block); else page.appendChild(block);
}

document.addEventListener('input', (event) => { if (event.target.closest('[data-quote-search]')) renderQuotePicker(); }, true);
document.addEventListener('change', (event) => {
  if (event.target.closest('[data-quote-picker-industry]')) { renderQuotePicker(); return; }
  const pick = event.target.closest('[data-quote-pick]');
  if (pick) { if (pick.checked) selectedQuoteIds.add(pick.dataset.quotePick); else selectedQuoteIds.delete(pick.dataset.quotePick); renderQuotePicker(); }
}, true);

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-export-price-quote]')) { event.preventDefault(); exportPriceQuotePdf().catch((error) => { console.warn(error); toast('Xuất báo giá thất bại.'); }); return; }
  if (event.target.closest('[data-export-price-quote-industry]')) { event.preventDefault(); exportByIndustry().catch((error) => { console.warn(error); toast('Xuất báo giá theo ngành thất bại.'); }); return; }
  if (event.target.closest('[data-open-price-quote-picker]')) { event.preventDefault(); openQuotePicker().catch((error) => { console.warn(error); toast('Không mở được bộ chọn sản phẩm.'); }); return; }
  if (event.target.closest('[data-export-selected-price-quote]')) { event.preventDefault(); exportSelectedProducts().catch((error) => { console.warn(error); toast('Xuất báo giá sản phẩm chọn thất bại.'); }); return; }
  if (event.target.closest('[data-quote-clear-selected]')) { event.preventDefault(); selectedQuoteIds.clear(); renderQuotePicker(); return; }
  if (event.target.closest('[data-quote-select-visible]')) { event.preventDefault(); document.querySelectorAll('[data-quote-pick]').forEach((input) => selectedQuoteIds.add(input.dataset.quotePick)); renderQuotePicker(); return; }
  setTimeout(() => mountPriceQuoteTool(), 120);
}, true);

window.addEventListener('DOMContentLoaded', () => mountPriceQuoteTool().catch(() => null));
mountPriceQuoteTool().catch(() => null);
