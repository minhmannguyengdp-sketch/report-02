const REPORT_SCHEMA = {
  summary: '',
  market_insights: [],
  product_insights: [{ product: '', status: 'good|watch|bad|unknown', insight: '' }],
  customer_actions: [{ customer: '', priority: 'high|medium|low', action: '', reason: '' }],
  sample_requests: [{ customer: '', products: [], note: '' }],
  follow_up_list: [{ customer: '', date: 'YYYY-MM-DD hoặc rỗng', note: '' }],
  order_opportunities: [{ customer: '', products: [], confidence: 'high|medium|low', reason: '' }],
  risks: [],
  next_steps: []
};

function safeJsonParse(value = '') {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return safeJsonParse(req.body) || {};
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return safeJsonParse(Buffer.concat(chunks).toString('utf8')) || {};
}

function compact(value, max = 32000) {
  const text = JSON.stringify(value ?? {}, null, 2);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n/* truncated */`;
}

function extractJson(text = '') {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const direct = safeJsonParse(cleaned);
  if (direct) return direct;
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return safeJsonParse(cleaned.slice(start, end + 1));
  return null;
}

function fallbackResult(reason = 'AI chưa trả JSON hợp lệ.') {
  return {
    summary: reason,
    market_insights: ['Chưa đủ dữ liệu hoặc AI chưa trả kết quả hợp lệ.'],
    product_insights: [],
    customer_actions: [],
    sample_requests: [],
    follow_up_list: [],
    order_opportunities: [],
    risks: [reason],
    next_steps: ['Kiểm tra dữ liệu đầu vào và cấu hình GEMINI_API_KEY / GOOGLE_API_KEY.']
  };
}

function normalizeResult(result) {
  return {
    summary: String(result?.summary || ''),
    market_insights: Array.isArray(result?.market_insights) ? result.market_insights : [],
    product_insights: Array.isArray(result?.product_insights) ? result.product_insights : [],
    customer_actions: Array.isArray(result?.customer_actions) ? result.customer_actions : [],
    sample_requests: Array.isArray(result?.sample_requests) ? result.sample_requests : [],
    follow_up_list: Array.isArray(result?.follow_up_list) ? result.follow_up_list : [],
    order_opportunities: Array.isArray(result?.order_opportunities) ? result.order_opportunities : [],
    risks: Array.isArray(result?.risks) ? result.risks : [],
    next_steps: Array.isArray(result?.next_steps) ? result.next_steps : []
  };
}

const SYSTEM_INSTRUCTION = `Bạn là Bépi Report Analyst, agent phân tích báo cáo thị trường trà sữa cho đội sales.

Nhiệm vụ chính:
1. Đọc báo cáo thô từ app Bépi Field Report.
2. Phân loại dữ liệu theo: thị trường, khách hàng, sản phẩm test, trạng thái phản hồi, nhu cầu mẫu, báo lại A Tân, rủi ro và đơn hàng tiềm năng.
3. Tổng hợp điểm chính thành báo cáo dễ đọc, ngắn gọn nhưng đủ chi tiết để quản lý ra quyết định.
4. Tạo danh sách hành động tiếp theo cho sales: khách cần gọi lại, khách cần gửi mẫu, khách cần xử lý phản hồi xấu, khách có khả năng lên đơn.
5. Đánh giá sản phẩm theo phản hồi: sản phẩm dễ bán, sản phẩm bị chê, sản phẩm cần test lại, sản phẩm nên ưu tiên đẩy.
6. Nếu dữ liệu thiếu hoặc mâu thuẫn, ghi rõ "Chưa đủ dữ liệu" thay vì tự bịa.
7. Không tự tạo giá, số điện thoại, địa chỉ, doanh thu hoặc kết luận không có trong dữ liệu.
8. Không thay đổi dữ liệu gốc. Chỉ phân tích, tổng hợp và đề xuất.
9. Không tự xuất DOC/XLSX. Chỉ trả kết quả phân tích có cấu trúc để module app xuất file.

Chỉ trả JSON hợp lệ, không markdown. Schema bắt buộc:
${JSON.stringify(REPORT_SCHEMA, null, 2)}`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  if (!apiKey) {
    res.status(200).json({ ok: false, source: 'missing_key', result: fallbackResult('Thiếu GEMINI_API_KEY hoặc GOOGLE_API_KEY trong Vercel env.') });
    return;
  }

  const body = await readBody(req);
  const snapshot = body.snapshot || body.data || body;
  const model = process.env.AI_REPORT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-pro';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = `Dữ liệu thô từ app Bếp Sỉ Báo Cáo/Bépi Field Report:\n${compact(snapshot)}\n\nHãy phân tích và trả đúng JSON schema.`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });
    const json = await response.json().catch(() => ({}));
    const text = json?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
    const parsed = extractJson(text);
    if (!response.ok) {
      res.status(200).json({ ok: false, source: 'gemini_error', status: response.status, error: json?.error?.message || `Gemini HTTP ${response.status}`, raw: json, result: fallbackResult(json?.error?.message || `Gemini HTTP ${response.status}`) });
      return;
    }
    res.status(200).json({ ok: Boolean(parsed), source: 'gemini_report_agent', model, result: parsed ? normalizeResult(parsed) : fallbackResult('AI không trả JSON hợp lệ.'), raw: parsed || text });
  } catch (error) {
    res.status(200).json({ ok: false, source: 'exception', error: error?.message || 'report agent failed', result: fallbackResult(error?.message || 'report agent failed') });
  }
}
