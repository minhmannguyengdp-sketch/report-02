import { ensureProductCatalog } from './product-catalog.js';

function text(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function number(value = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value = 0) {
  const amount = number(value);
  return amount ? `${amount.toLocaleString('vi-VN')}đ` : 'Liên hệ';
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayLabel() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function toast(message) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function downloadHtml(filename, html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function groupProducts(products = []) {
  const groups = new Map();
  products
    .filter((item) => item && item.active !== false && item.orderable !== false)
    .sort((a, b) => String(a.industry_key || '').localeCompare(String(b.industry_key || ''), 'vi') || String(a.category_key || '').localeCompare(String(b.category_key || ''), 'vi') || String(a.name || '').localeCompare(String(b.name || ''), 'vi'))
    .forEach((item) => {
      const industry = text(item.industry || 'Khác');
      const category = text(item.category || 'Khác');
      if (!groups.has(industry)) groups.set(industry, new Map());
      const categories = groups.get(industry);
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category).push(item);
    });
  return groups;
}

function productNote(item = {}) {
  return [item.brand, item.size, item.flavor, item.choice_summary].map(text).filter(Boolean).join(' · ');
}

function renderCategory(category, products = []) {
  return `<section class="category"><div class="category-title"><span>${esc(category)}</span><b>${products.length} mã</b></div><table><thead><tr><th style="width:34px">STT</th><th style="width:78px">SKU</th><th>Sản phẩm</th><th style="width:64px">ĐVT</th><th style="width:92px" class="right">Giá</th></tr></thead><tbody>${products.map((item, index) => `<tr><td class="center">${index + 1}</td><td class="sku">${esc(item.sku || item.source_sku || '')}</td><td><div class="product">${esc(item.name || item.product_name || '')}</div>${productNote(item) ? `<div class="muted">${esc(productNote(item))}</div>` : ''}</td><td class="center">${esc(item.unit || '')}</td><td class="right price">${esc(money(item.price || item.unit_price))}</td></tr>`).join('')}</tbody></table></section>`;
}

function renderIndustry(industry, categories) {
  const total = [...categories.values()].reduce((sum, list) => sum + list.length, 0);
  return `<section class="industry"><div class="industry-head"><h2>${esc(industry)}</h2><span>${total} sản phẩm</span></div>${[...categories.entries()].map(([category, products]) => renderCategory(category, products)).join('')}</section>`;
}

async function exportPriceQuotePdf() {
  const products = await ensureProductCatalog();
  const groups = groupProducts(products);
  const totalProducts = [...groups.values()].reduce((sum, categories) => sum + [...categories.values()].reduce((s, list) => s + list.length, 0), 0);
  if (!totalProducts) return toast('Chưa có dữ liệu sản phẩm để xuất báo giá.');
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Báo giá sản phẩm ${todayLabel()}</title><style>
    @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef3f1;color:#10212b;font-family:Arial,Helvetica,sans-serif}body{padding:16px}.toolbar{width:210mm;max-width:100%;margin:0 auto 10px;display:flex;justify-content:flex-end;gap:8px}.toolbar button{border:1px solid #cfe1db;background:#fff;color:#10212b;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer}.toolbar .primary{background:#0f8f7a;border-color:#0f8f7a;color:#fff}.sheet{width:210mm;max-width:100%;min-height:297mm;margin:0 auto;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.08);padding:12mm}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f8f7a;padding-bottom:10px;margin-bottom:12px}.title h1{font-size:26px;line-height:1.05;margin:0;color:#082337;letter-spacing:.4px}.title p{margin:5px 0 0;color:#63727c;font-size:12px;line-height:1.4}.meta{text-align:right;font-size:12px;line-height:1.55;color:#31434c}.pill{display:inline-block;margin-top:6px;border:1px solid #cdece4;background:#e9f8f4;color:#0f8f7a;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:900}.note{border:1px solid #d9e6e1;border-radius:12px;background:#fbfffd;padding:9px 10px;margin:0 0 12px;font-size:12px;color:#41515a;line-height:1.45}.industry{page-break-inside:avoid;margin:0 0 14px}.industry-head{display:flex;justify-content:space-between;align-items:center;background:#0b3b35;color:#fff;border-radius:12px 12px 0 0;padding:9px 11px}.industry-head h2{font-size:16px;margin:0;line-height:1.1}.industry-head span{font-size:11px;font-weight:900;background:rgba(255,255,255,.14);border-radius:999px;padding:4px 8px}.category{border:1px solid #d9e6e1;border-top:0;margin-bottom:8px;page-break-inside:avoid}.category-title{display:flex;justify-content:space-between;align-items:center;background:#f3f8f6;border-bottom:1px solid #d9e6e1;padding:7px 9px;font-size:12px;font-weight:900;color:#0b3b35}.category-title b{font-size:10px;color:#63727c}table{width:100%;border-collapse:collapse}thead th{background:#fafdfc;color:#16323e;font-size:10.5px;font-weight:900;padding:7px;border-bottom:1px solid #d9e6e1;text-align:left}tbody td{border-top:1px solid #edf3f1;padding:7px;font-size:11.5px;vertical-align:top}.center{text-align:center}.right{text-align:right}.sku{font-size:10.5px;color:#52636c;font-weight:800}.product{font-weight:800;color:#082337;line-height:1.25}.muted{font-size:10.2px;color:#65757e;margin-top:2px;line-height:1.25}.price{font-weight:900;color:#0f8f7a;white-space:nowrap}.footer{border-top:1px solid #d9e6e1;margin-top:14px;padding-top:8px;text-align:center;color:#7a878f;font-size:10.5px}@media print{body{padding:0;background:#fff}.toolbar{display:none!important}.sheet{width:auto;min-height:auto;box-shadow:none;margin:0;padding:0}.industry{break-inside:avoid}.category{break-inside:avoid}}
  </style></head><body><div class="toolbar"><button onclick="window.close()">Đóng</button><button class="primary" onclick="window.print()">In / Lưu PDF</button></div><main class="sheet"><header class="top"><div class="title"><h1>BÁO GIÁ SẢN PHẨM</h1><p>Sắp xếp theo ngành hàng · dễ xem trên điện thoại và khi in PDF</p></div><div class="meta"><div><b>Ngày:</b> ${todayLabel()}</div><div><b>Tổng:</b> ${totalProducts} sản phẩm</div><span class="pill">Theo ngành hàng</span></div></header><div class="note">Giá dùng để tham khảo/báo nhanh theo dữ liệu sản phẩm trong máy. Giá thực tế có thể điều chỉnh theo khách hàng, khu vực, số lượng hoặc chương trình bán hàng.</div>${[...groups.entries()].map(([industry, categories]) => renderIndustry(industry, categories)).join('')}<div class="footer">Báo giá được tạo tự động từ dữ liệu sản phẩm local.</div></main></body></html>`;
  downloadHtml(`bao-gia-san-pham-theo-nganh-${stamp()}.html`, html);
  toast('Đã xuất báo giá. Mở file rồi bấm In / Lưu PDF.');
}

function installStyle() {
  let style = document.querySelector('style[data-price-quote-export]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.priceQuoteExport = '1';
    document.head.appendChild(style);
  }
  style.textContent = `.price-quote-tools{margin:0 0 12px!important;border:1px solid #dce8e5!important;border-radius:18px!important;background:#fff!important;padding:12px!important;box-shadow:0 8px 20px rgba(12,55,50,.05)!important;display:grid!important;gap:9px!important}.price-quote-tools b{font-size:14px!important;color:#082337!important}.price-quote-tools small{font-size:11px!important;color:#63727c!important;line-height:1.25!important}.price-quote-tools button{min-height:40px!important;border-radius:12px!important;font-size:12px!important;font-weight:950!important;border:1px solid #9bdccd!important;background:#eefbf6!important;color:#007866!important}`;
}

function mountPriceQuoteTool() {
  installStyle();
  const page = document.querySelector('section.page[data-page="admin"]');
  if (!page || page.querySelector('[data-price-quote-tools]')) return;
  const anchor = page.querySelector('[data-admin-data-tools]') || page.querySelector('article.admin');
  const block = document.createElement('article');
  block.className = 'price-quote-tools';
  block.dataset.priceQuoteTools = '1';
  block.innerHTML = `<div><b>Báo giá sản phẩm</b><br><small>Xuất báo giá theo ngành từ data sản phẩm hiện có. File mở được để in / lưu PDF.</small></div><button type="button" data-export-price-quote>Xuất báo giá PDF</button>`;
  if (anchor) anchor.insertAdjacentElement('afterend', block);
  else page.appendChild(block);
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-export-price-quote]')) {
    event.preventDefault();
    exportPriceQuotePdf().catch((error) => {
      console.warn('price quote export failed', error);
      toast('Xuất báo giá thất bại.');
    });
    return;
  }
  setTimeout(mountPriceQuoteTool, 120);
}, true);

window.addEventListener('DOMContentLoaded', mountPriceQuoteTool);
mountPriceQuoteTool();
