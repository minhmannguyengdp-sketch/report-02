function safeJsonParse(value = '') {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function envAgentManifest() {
  const explicitName = process.env.AI_AGENT_NAME || process.env.OPENAI_ASSISTANT_NAME || '';
  const agentName = explicitName || 'Bếp Sỉ Report Analyst';
  const agentId = process.env.AI_AGENT_ID
    || process.env.OPENAI_AGENT_ID
    || process.env.OPENAI_ASSISTANT_ID
    || process.env.ASSISTANT_ID
    || process.env.GOOGLE_AGENT_ID
    || process.env.GOOGLE_AGENT_ENGINE_ID
    || '';
  const model = process.env.AI_AGENT_MODEL || process.env.OPENAI_MODEL || process.env.MODEL || '';
  const provider = process.env.AI_AGENT_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : (process.env.GOOGLE_AGENT_ID || process.env.GOOGLE_AGENT_ENGINE_ID ? 'google' : 'env'));

  if (!agentId && !explicitName && !process.env.OPENAI_API_KEY && !process.env.AI_AGENT_JSON && !process.env.GOOGLE_AGENT_BUILDER_JSON) return null;

  return {
    id: agentId || 'env-agent',
    name: agentName,
    displayName: agentName,
    description: process.env.AI_AGENT_DESCRIPTION || process.env.AI_AGENT_PROMPT || 'Agent cấu hình từ Vercel env',
    model,
    provider,
    source: 'vercel_env',
    configuredBy: {
      hasAgentUrl: Boolean(process.env.AI_AGENT_URL),
      hasAgentId: Boolean(agentId),
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
      hasJsonEnv: Boolean(process.env.AI_AGENT_JSON || process.env.GOOGLE_AGENT_BUILDER_JSON)
    }
  };
}

async function fetchOpenAiAssistant(agentId, agentName) {
  if (!process.env.OPENAI_API_KEY || !agentId) return null;
  try {
    const response = await fetch(`https://api.openai.com/v1/assistants/${encodeURIComponent(agentId)}`, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
        Accept: 'application/json'
      },
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const assistant = await response.json();
    return {
      id: assistant.id || agentId,
      name: assistant.name || agentName || agentId,
      displayName: assistant.name || agentName || agentId,
      description: assistant.description || assistant.instructions || 'OpenAI assistant',
      instructions: assistant.instructions || '',
      model: assistant.model || '',
      tools: assistant.tools || [],
      provider: 'openai',
      source: 'openai_assistant_api',
      raw: assistant
    };
  } catch (_error) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const agentUrl = process.env.AI_AGENT_URL || '';
  const agentName = process.env.AI_AGENT_NAME || process.env.OPENAI_ASSISTANT_NAME || 'Bếp Sỉ Report Analyst';
  const agentToken = process.env.AI_AGENT_TOKEN || process.env.AI_AGENT_KEY || process.env.GOOGLE_AGENT_TOKEN || '';
  const jsonEnv = process.env.AI_AGENT_JSON || process.env.GOOGLE_AGENT_BUILDER_JSON || '';
  const envJson = safeJsonParse(jsonEnv);
  const manifest = envAgentManifest();
  const agentId = manifest?.id && manifest.id !== 'env-agent' ? manifest.id : '';

  if (envJson) {
    res.status(200).json({
      configured: true,
      ok: true,
      source: 'env_json',
      agentName,
      data: envJson,
      agents: Array.isArray(envJson?.agents) ? envJson.agents : undefined,
      fallbackAgent: manifest
    });
    return;
  }

  const openAiAssistant = await fetchOpenAiAssistant(agentId, agentName);
  if (openAiAssistant) {
    res.status(200).json({
      configured: true,
      ok: true,
      source: 'openai_assistant_api',
      agentName: openAiAssistant.name,
      agents: [openAiAssistant],
      data: { agents: [openAiAssistant] }
    });
    return;
  }

  if (!agentUrl) {
    res.status(200).json({
      configured: Boolean(manifest),
      ok: Boolean(manifest),
      source: manifest ? 'env_manifest' : 'none',
      agentName,
      agents: manifest ? [manifest] : [],
      data: manifest ? { agents: [manifest] } : null,
      message: manifest ? 'Loaded agent from Vercel env manifest.' : 'Missing AI_AGENT_URL, AI_AGENT_JSON, AI_AGENT_ID, OPENAI_ASSISTANT_ID, or OPENAI_API_KEY.'
    });
    return;
  }

  try {
    const requestHeaders = { Accept: 'application/json,text/plain,*/*' };
    if (agentToken) requestHeaders.Authorization = `Bearer ${agentToken}`;
    const response = await fetch(agentUrl, { headers: requestHeaders, cache: 'no-store' });
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
      source: 'agent_url',
      agentName,
      agentUrl,
      data,
      fallbackAgent: manifest
    });
  } catch (error) {
    if (manifest) {
      res.status(200).json({
        configured: true,
        ok: true,
        source: 'env_manifest_fallback',
        agentName,
        agentUrl,
        agents: [manifest],
        data: { agents: [manifest] },
        warning: error?.message || 'AI_AGENT_URL fetch failed, using env manifest fallback.'
      });
      return;
    }
    res.status(502).json({ configured: true, ok: false, agentName, agentUrl, error: error?.message || 'AI agent fetch failed' });
  }
}
