export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const agentUrl = process.env.AI_AGENT_URL || '';
  const agentName = process.env.AI_AGENT_NAME || 'Bếp Sỉ Report Analyst';
  const agentToken = process.env.AI_AGENT_TOKEN || process.env.AI_AGENT_KEY || '';

  if (!agentUrl) {
    res.status(200).json({ configured: false, agentName, agents: [] });
    return;
  }

  try {
    const headers = { Accept: 'application/json,text/plain,*/*' };
    if (agentToken) headers.Authorization = `Bearer ${agentToken}`;
    const response = await fetch(agentUrl, { headers, cache: 'no-store' });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_error) {
      data = { text };
    }

    res.status(response.ok ? 200 : response.status).json({
      configured: true,
      ok: response.ok,
      status: response.status,
      agentName,
      agentUrl,
      data
    });
  } catch (error) {
    res.status(502).json({ configured: true, ok: false, agentName, agentUrl, error: error?.message || 'AI agent fetch failed' });
  }
}
