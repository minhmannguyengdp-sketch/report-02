function safeJsonParse(value = '') {
  if (!value || typeof value !== 'string') return null;
  const text = String(value).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    try {
      return JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
    } catch (__error) {
      return null;
    }
  }
}

function safeString(value = '', fallback = '') {
  if (value == null) return fallback;
  return String(value).trim();
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function normalizeBaseUrl(baseUrl, location) {
  const provided = safeString(baseUrl);
  if (provided) return provided.replace(/\/+$/, '');
  const loc = safeString(location, 'global');
  if (!loc || loc === 'global') return 'https://dialogflow.googleapis.com/v3';
  return `https://${loc}-dialogflow.googleapis.com/v3`;
}

function parseAgentResource(agentValue) {
  const value = safeString(agentValue);
  if (!value) return null;
  const fullMatch = value.match(/^projects\/([^/]+)\/locations\/([^/]+)\/agents\/([^/]+)$/);
  if (fullMatch) {
    return { projectId: fullMatch[1], location: fullMatch[2], agentId: fullMatch[3], agentPath: value };
  }
  return { projectId: null, location: null, agentId: value, agentPath: null };
}

function dialogCredentialsJson() {
  return process.env.AI_CREDENTIALS_JSON
    || process.env.DIALOGFLOW_CREDENTIALS_JSON
    || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    || process.env.GOOGLE_CREDENTIALS_JSON
    || '';
}

function dialogAgentManifest(extra = {}) {
  const credentials = safeJsonParse(dialogCredentialsJson()) || {};
  const rawAgentId = process.env.AI_AGENT_ID
    || process.env.DIALOGFLOW_AGENT_ID
    || process.env.GOOGLE_AGENT_ID
    || process.env.GOOGLE_AGENT_ENGINE_ID
    || '';
  const agentInfo = parseAgentResource(rawAgentId);
  const projectId = safeString(process.env.AI_PROJECT_ID || process.env.DIALOGFLOW_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || agentInfo?.projectId || credentials.project_id);
  const location = safeString(process.env.AI_LOCATION || process.env.DIALOGFLOW_LOCATION || agentInfo?.location || 'global') || 'global';
  const agentId = safeString(agentInfo?.agentId || rawAgentId);
  const agentPath = agentInfo?.agentPath || (projectId && agentId ? `projects/${projectId}/locations/${location}/agents/${agentId}` : '');
  const displayName = safeString(extra.displayName || extra.display_name || process.env.AI_AGENT_NAME || process.env.DIALOGFLOW_AGENT_NAME || process.env.GOOGLE_AGENT_NAME || agentId || 'Google Agent Builder');

  if (!agentPath && !displayName && !dialogCredentialsJson()) return null;

  return {
    id: agentPath || agentId || 'dialogflow-agent',
    name: agentPath || agentId || displayName,
    displayName,
    title: displayName,
    description: safeString(extra.description || extra.descriptionText || process.env.AI_AGENT_DESCRIPTION || 'Google Agent Builder / Dialogflow CX agent'),
    type: 'dialogflow_cx_agent',
    provider: 'google',
    source: extra.source || 'dialogflow_cx_env',
    agent: true,
    agentId: agentId || '',
    projectId: projectId || '',
    location,
    agentPath,
    baseUrl: normalizeBaseUrl(process.env.AI_BASE_URL || process.env.DIALOGFLOW_BASE_URL, location),
    languageCode: process.env.AI_LANGUAGE_CODE || process.env.DIALOGFLOW_LANGUAGE_CODE || 'vi',
    configuredBy: {
      hasCredentials: Boolean(dialogCredentialsJson()),
      hasAgentId: Boolean(agentId),
      hasProjectId: Boolean(projectId),
      hasFullAgentPath: Boolean(agentInfo?.agentPath)
    },
    raw: extra.raw || null
  };
}

async function googleAccessToken(credentials) {
  const crypto = await import('node:crypto');
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/dialogflow',
    aud: tokenUri,
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(credentials.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const assertion = `${unsigned}.${signature}`;
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || `Google token HTTP ${response.status}`);
  return json.access_token;
}

async function fetchDialogflowAgent() {
  const credentials = safeJsonParse(dialogCredentialsJson());
  const manifest = dialogAgentManifest();
  if (!manifest) return null;
  if (!credentials?.client_email || !credentials?.private_key || !manifest.agentPath) {
    return { manifest, metadata: null, warning: 'missing_dialogflow_credentials_or_agent_path' };
  }
  const token = await googleAccessToken(credentials);
  const response = await fetch(`${manifest.baseUrl}/${manifest.agentPath}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store'
  });
  const metadata = await response.json().catch(() => null);
  if (!response.ok) {
    return { manifest, metadata, warning: metadata?.error?.message || `Dialogflow agent HTTP ${response.status}` };
  }
  return {
    manifest: dialogAgentManifest({
      displayName: metadata?.displayName || metadata?.display_name || manifest.displayName,
      description: metadata?.description || manifest.description,
      source: 'dialogflow_cx_api',
      raw: metadata
    }),
    metadata,
    warning: null
  };
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
  const provider = process.env.AI_AGENT_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : (process.env.GOOGLE_AGENT_ID || process.env.GOOGLE_AGENT_ENGINE_ID || dialogCredentialsJson() ? 'google' : 'env'));

  if (!agentId && !explicitName && !process.env.OPENAI_API_KEY && !process.env.AI_AGENT_JSON && !process.env.GOOGLE_AGENT_BUILDER_JSON && !dialogCredentialsJson()) return null;

  return {
    id: agentId || 'env-agent',
    name: agentName,
    displayName: agentName,
    description: process.env.AI_AGENT_DESCRIPTION || process.env.AI_AGENT_PROMPT || 'Agent cấu hình từ Vercel env',
    model,
    provider,
    type: provider === 'google' ? 'dialogflow_cx_agent' : 'env_agent',
    agent: true,
    source: 'vercel_env',
    configuredBy: {
      hasAgentUrl: Boolean(process.env.AI_AGENT_URL),
      hasAgentId: Boolean(agentId),
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
      hasDialogCredentials: Boolean(dialogCredentialsJson()),
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
      type: 'openai_assistant',
      agent: true,
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
  const agentName = process.env.AI_AGENT_NAME || process.env.OPENAI_ASSISTANT_NAME || process.env.DIALOGFLOW_AGENT_NAME || 'Bếp Sỉ Report Analyst';
  const agentToken = process.env.AI_AGENT_TOKEN || process.env.AI_AGENT_KEY || process.env.GOOGLE_AGENT_TOKEN || '';
  const jsonEnv = process.env.AI_AGENT_JSON || process.env.GOOGLE_AGENT_BUILDER_JSON || '';
  const envJson = safeJsonParse(jsonEnv);
  const manifest = envAgentManifest();
  const agentId = manifest?.id && manifest.id !== 'env-agent' ? manifest.id : '';

  if (envJson) {
    const agents = Array.isArray(envJson?.agents) ? envJson.agents : [];
    res.status(200).json({ configured: true, ok: true, source: 'env_json', agentName, data: envJson, agents, fallbackAgent: manifest });
    return;
  }

  const dialogflow = await fetchDialogflowAgent().catch((error) => ({ manifest: dialogAgentManifest(), metadata: null, warning: error?.message || 'dialogflow_agent_load_failed' }));
  if (dialogflow?.manifest) {
    const agent = dialogflow.manifest;
    res.status(200).json({
      configured: true,
      ok: true,
      source: dialogflow.warning ? 'dialogflow_cx_env_manifest' : 'dialogflow_cx_api',
      agentName: agent.displayName || agent.name,
      agents: [agent],
      data: { agents: [agent], metadata: dialogflow.metadata || null },
      warning: dialogflow.warning || null
    });
    return;
  }

  const openAiAssistant = await fetchOpenAiAssistant(agentId, agentName);
  if (openAiAssistant) {
    res.status(200).json({ configured: true, ok: true, source: 'openai_assistant_api', agentName: openAiAssistant.name, agents: [openAiAssistant], data: { agents: [openAiAssistant] } });
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
      message: manifest ? 'Loaded agent from Vercel env manifest.' : 'Missing Dialogflow/Agent Builder env: AI_CREDENTIALS_JSON + AI_AGENT_ID, or AI_AGENT_JSON, AI_AGENT_URL, OPENAI_ASSISTANT_ID.'
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
    res.status(response.ok ? 200 : response.status).json({ configured: true, ok: response.ok, status: response.status, source: 'agent_url', agentName, agentUrl, data, fallbackAgent: manifest });
  } catch (error) {
    if (manifest) {
      res.status(200).json({ configured: true, ok: true, source: 'env_manifest_fallback', agentName, agentUrl, agents: [manifest], data: { agents: [manifest] }, warning: error?.message || 'AI_AGENT_URL fetch failed, using env manifest fallback.' });
      return;
    }
    res.status(502).json({ configured: true, ok: false, agentName, agentUrl, error: error?.message || 'AI agent fetch failed' });
  }
}
