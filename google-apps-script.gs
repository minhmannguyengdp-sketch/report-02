/*
  Bépi Field Report - Google Apps Script receiver.

  Deploy Web App:
  - Execute as: Me
  - Who has access: Anyone
  - URL phải kết thúc bằng /exec

  Cách dùng dễ cho sales:
  - Admin có thể dán DEFAULT_DRIVE_FOLDER_ID bên dưới để cố định thư mục Drive.
  - Mỗi báo cáo mới trong app = 1 Google Doc riêng trong thư mục đó.
  - Gửi lại cùng báo cáo = cập nhật đúng file cũ nhờ report.id, không tạo file mới.
  - Nếu báo cáo khác bị trùng tên file, script tự thêm (1), (2), ...
*/

const REPORT_SHEET_NAME = 'Báo cáo';
const CUSTOMER_SHEET_NAME = 'Chi tiết khách hàng';
const PRODUCTS = ['Trà Đen', 'Trà Quả Mộng', 'Trà Gạo Rang', 'Trà Lài', 'Trà Olong', 'Trà Olong Sen'];

// Admin có thể dán ID thư mục Drive cố định ở đây để sales không cần nhập Folder ID trong app.
// Ví dụ URL thư mục: https://drive.google.com/drive/folders/ABC123xyz
// thì Folder ID là: ABC123xyz
const DEFAULT_DRIVE_FOLDER_ID = '';
const CREATE_DRIVE_FILE_BY_DEFAULT = true;

const REPORT_HEADERS = [
  'ID báo cáo', 'Thời gian gửi', 'Ngày báo cáo', 'Thị trường / khu vực', 'Sales phụ trách',
  'Ghi chú báo cáo', 'Tổng khách', 'Cần mẫu', 'Báo A Tân / báo sau', 'Cần xử lý',
  'File báo cáo Drive', 'Tên file báo cáo', 'Tạo lúc', 'Cập nhật lúc'
];

const CUSTOMER_HEADERS = [
  'ID báo cáo', 'ID khách', 'Thời gian gửi', 'Ngày báo cáo', 'Thị trường / khu vực', 'Sales phụ trách',
  'Tên khách hàng', 'Khu vực khách', 'Loại SP test', 'Hẹn báo lại', 'Test chung thị trường', 'Ghi chú tổng',
  ...PRODUCTS.flatMap((product) => [`${product} - trạng thái`, `${product} - ghi chú`])
];

function doGet() {
  return jsonOutput({ ok: true, message: 'Bépi Field Report Sheet API đang hoạt động.' });
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    if (!payload.report || !payload.report.id) return jsonOutput({ ok: false, message: 'Thiếu report.id' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportSheet = ensureSheet(ss, REPORT_SHEET_NAME, REPORT_HEADERS);
    const customerSheet = ensureSheet(ss, CUSTOMER_SHEET_NAME, CUSTOMER_HEADERS);

    const docResult = maybeCreateOrUpdateReportDoc(payload);

    removeOldRows(reportSheet, 1, payload.report.id);
    removeOldRows(customerSheet, 1, payload.report.id);
    appendReportRow(reportSheet, payload, docResult);
    appendCustomerRows(customerSheet, payload);

    return jsonOutput({
      ok: true,
      message: 'Đã ghi báo cáo.',
      reportId: payload.report.id,
      fileUrl: docResult.url || '',
      fileName: docResult.name || ''
    });
  } catch (error) {
    return jsonOutput({ ok: false, message: error.message, stack: error.stack });
  }
}

function parsePayload(e) {
  if (e && e.parameter && e.parameter.payload) return JSON.parse(e.parameter.payload);
  if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents);
  return {};
}

function maybeCreateOrUpdateReportDoc(payload) {
  const settings = payload.settings || {};
  const folderId = settings.driveFolderId || DEFAULT_DRIVE_FOLDER_ID;
  const shouldCreate = Boolean(folderId) && (settings.createDriveFile || CREATE_DRIVE_FILE_BY_DEFAULT);
  if (!shouldCreate) return { url: '', name: '' };
  return createOrUpdateReportDoc(payload, folderId);
}

function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const currentFirst = sheet.getLastRow() ? sheet.getRange(1, 1).getValue() : '';
  if (!currentFirst || currentFirst !== headers[0]) sheet.clear();

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0a6b5f').setFontColor('#ffffff');
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function removeOldRows(sheet, idColumn, reportId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(reportId)) sheet.deleteRow(i + 2);
  }
}

function appendReportRow(sheet, payload, docResult) {
  const r = payload.report;
  const s = r.summary || {};
  sheet.appendRow([
    r.id,
    payload.submittedAt || new Date().toISOString(),
    r.date || '',
    r.market || '',
    r.sales || '',
    r.note || '',
    s.totalCustomers || 0,
    s.needSample || 0,
    s.follow || 0,
    s.bad || 0,
    docResult.url || '',
    docResult.name || '',
    r.createdAt || '',
    r.updatedAt || ''
  ]);
}

function appendCustomerRows(sheet, payload) {
  const r = payload.report;
  const rows = (payload.customers || []).map((c) => {
    const base = [
      r.id,
      c.id || '',
      payload.submittedAt || new Date().toISOString(),
      r.date || '',
      r.market || '',
      r.sales || '',
      c.name || '',
      c.area || '',
      c.testType || '',
      c.followDate || '',
      (c.marketTags || []).join(', '),
      c.note || ''
    ];
    const tests = PRODUCTS.flatMap((product) => {
      const test = c.tests && c.tests[product] ? c.tests[product] : {};
      return [statusVi(test.status || 'pending'), test.note || ''];
    });
    return [...base, ...tests];
  });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CUSTOMER_HEADERS.length).setValues(rows);
}

function createOrUpdateReportDoc(payload, folderId) {
  const r = payload.report;
  const folder = DriveApp.getFolderById(folderId);
  const props = PropertiesService.getDocumentProperties();
  const propKey = `reportFileId:${r.id}`;
  const existingFileId = props.getProperty(propKey);

  let file;
  let doc;

  if (existingFileId) {
    try {
      file = DriveApp.getFileById(existingFileId);
      doc = DocumentApp.openById(existingFileId);
    } catch (error) {
      file = null;
      doc = null;
      props.deleteProperty(propKey);
    }
  }

  if (!file || !doc) {
    const baseName = buildReportFileBaseName(payload);
    const uniqueName = makeUniqueFileName(folder, baseName);
    doc = DocumentApp.create(uniqueName);
    file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
    props.setProperty(propKey, file.getId());
  }

  // Gửi lại cùng report thì cập nhật đúng file đã map theo report.id.
  doc.getBody().clear();
  writeReportDoc(doc, payload);
  doc.saveAndClose();

  return { url: file.getUrl(), name: file.getName(), id: file.getId() };
}

function buildReportFileBaseName(payload) {
  const r = payload.report;
  const date = toViDateForName(r.date || '');
  const market = safeName(r.market || 'Thị trường');
  const sales = safeName(r.sales || 'Sales');
  return `Báo cáo thị trường ${market} - ${date} - ${sales}`;
}

function makeUniqueFileName(folder, baseName) {
  if (!folder.getFilesByName(baseName).hasNext()) return baseName;
  let index = 1;
  while (folder.getFilesByName(`${baseName} (${index})`).hasNext()) index += 1;
  return `${baseName} (${index})`;
}

function writeReportDoc(doc, payload) {
  const r = payload.report;
  const summary = r.summary || {};
  const body = doc.getBody();

  body.appendParagraph('BÁO CÁO THỊ TRƯỜNG').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`Ngày: ${r.date || ''}`);
  body.appendParagraph(`Thị trường: ${r.market || ''}`);
  body.appendParagraph(`Sales: ${r.sales || ''}`);
  if (r.note) body.appendParagraph(`Ghi chú: ${r.note}`);
  body.appendParagraph('');

  body.appendParagraph('1. Tổng quan thị trường').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(`Tổng khách: ${summary.totalCustomers || 0}`);
  body.appendParagraph(`Cần mẫu: ${summary.needSample || 0}`);
  body.appendParagraph(`Báo A Tân / báo sau: ${summary.follow || 0}`);
  body.appendParagraph(`Cần xử lý: ${summary.bad || 0}`);
  body.appendParagraph('');

  body.appendParagraph('2. Kết quả test sản phẩm').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  appendProductSummary(body, payload.customers || []);
  body.appendParagraph('');

  body.appendParagraph('3. Chi tiết khách hàng').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  appendCustomerDetails(body, payload.customers || []);
  body.appendParagraph('');

  body.appendParagraph('4. Lên đơn hàng').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Chưa có dữ liệu đơn hàng. Mục này sẽ dùng để nối dữ liệu từ Bépi/SOBépi sau này.');
}

function appendProductSummary(body, customers) {
  PRODUCTS.forEach((product) => {
    const stats = { ok: 0, interested: 0, sample: 0, follow: 0, bad: 0, retry: 0, pending: 0 };
    customers.forEach((c) => {
      const status = c.tests && c.tests[product] ? (c.tests[product].status || 'pending') : 'pending';
      stats[status] = (stats[status] || 0) + 1;
    });
    body.appendParagraph(`${product}: OK ${stats.ok || 0}, quan tâm ${stats.interested || 0}, cần mẫu ${stats.sample || 0}, báo Tân ${stats.follow || 0}, chưa tốt ${stats.bad || 0}, thử lại ${stats.retry || 0}, chưa thử ${stats.pending || 0}`);
  });
}

function appendCustomerDetails(body, customers) {
  customers.forEach((c, index) => {
    body.appendParagraph(`${index + 1}. ${c.name || ''}${c.area ? ' - ' + c.area : ''}`).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    PRODUCTS.forEach((product) => {
      const test = c.tests && c.tests[product] ? c.tests[product] : {};
      if ((test.status || 'pending') !== 'pending' || test.note) {
        body.appendParagraph(`- ${product}: ${statusVi(test.status || 'pending')}${test.note ? ' (' + test.note + ')' : ''}`);
      }
    });
    if (c.marketTags && c.marketTags.length) body.appendParagraph(`- Thị trường: ${c.marketTags.join(', ')}`);
    if (c.followDate) body.appendParagraph(`- Hẹn báo lại: ${c.followDate}`);
    if (c.note) body.appendParagraph(`- Ghi chú: ${c.note}`);
  });
}

function toViDateForName(value) {
  if (!value) return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy');
  const parts = String(value).split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return safeName(value);
}

function safeName(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80);
}

function statusVi(status) {
  const map = {
    pending: 'Chưa thử', ok: 'OK', interested: 'Quan tâm', sample: 'Cần mẫu',
    follow: 'Báo A Tân', bad: 'Chưa tốt', retry: 'Thử lại'
  };
  return map[status] || status || 'Chưa thử';
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
