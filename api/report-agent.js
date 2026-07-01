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

function fallbackResult(reason = 'ADK agent chưa trả kết quả.') {
  return {
    summary: reason,
    market_insights: [],
    product_insights: [],
    customer_actions: [],
    sample_requests: [],
    follow_up_list: [],
    order_opportunities: [],
    risks: [reason],
    next_steps: ['Deploy backend ADK từ Get Code rồi cấu hình AI_AGENT_URL trong Vercel Production.']
  };
}

function normalizeResult(result) {
  if (typeof result === 'string') return fallbackResult(result);
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

function extractResult(payload = {}) {
  if (payload.result) return payload.result;
  if (payload.output) return payload.output;
  if (payload.analysis) return payload.analysis;
  if (payload.response) return payload.response;
  if (payload.content) {
    if (typeof payload.content === 'string') return safeJsonParse(payload.content) || { summary: payload.content };
    return payload.content;
  }
  return payload;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const agentUrl = process.env.AI_AGENT_URL || process.env.ADK_AGENT_URL || '';
  if (!agentUrl) {
    res.status(200).json({ ok: false, source: 'missing_adk_agent_url', result: fallbackResult('Thiếu AI_AGENT_URL. App này phải gọi backend ADK/Agent Builder đã deploy, không dùng Gemini Studio key.') });
    return;
  }

  const body = await readBody(req);
  const token = process.env.AI_AGENT_TOKEN || process.env.ADK_AGENT_TOKEN || '';
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: body.snapshot || body.data || body,
        snapshot: body.snapshot || body.data || body,
        task: 'report_analysis'
      })
    });
    const text = await response.text();
    const json = safeJsonParse(text) || { content: text };
    const result = normalizeResult(extractResult(json));
    res.status(200).json({ ok: response.ok, source: 'adk_agent_url', status: response.status, result, raw: json });
  } catch (error) {
    res.status(200).json({ ok: false, source: 'adk_agent_exception', error: error?.message || 'ADK agent failed', result: fallbackResult(error?.message || 'ADK agent failed') });
  }
}
