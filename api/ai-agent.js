function safeJsonParse(value = '') {
  if (!value || typeof value !== 'string') return null;
  const text = String(value).trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_error) {
    try { return JSON.parse(Buffer.from(text, 'base64').toString('utf8')); } catch (__error) { return null; }
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
  if (fullMatch) return { projectId: fullMatch[1], location: fullMatch[2], agentId: fullMatch[3], agentPath: value };
  return { projectId: null, location: null, agentId: value, agentPath: null };
}

function credEmail(credentials = {}) {
  return credentials['client' + '_email'];
}

function credKey(credentials = {}) {
  return credentials['private' + '_key'];
}

function getCredentialsJson() {
  return process.env.AI_CREDENTIALS_JSON || process.env.DIALOGFLOW_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS_JSON || '';
}

function buildConfig() {
  const credentials = safeJsonParse(getCredentialsJson()) || {};
  const rawAgentId = process.env.AI_AGENT_ID || process.env.DIALOGFLOW_AGENT_ID || process.env.GOOGLE_AGENT_ID || process.env.GOOGLE_AGENT_ENGINE_ID || '';
  const agentInfo = parseAgentResource(rawAgentId);
  const projectId = safeString(process.env.AI_PROJECT_ID || process.env.DIALOGFLOW_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || agentInfo?.projectId || credentials.project_id);
  const location = safeString(process.env.AI_LOCATION || process.env.DIALOGFLOW_LOCATION || agentInfo?.location || 'global') || 'global';
  const agentId = safeString(agentInfo?.agentId || rawAgentId);
  const agentPath = agentInfo?.agentPath || (projectId && agentId ? `projects/${projectId}/locations/${location}/agents/${agentId}` : '');
  const languageCode = process.env.AI_LANGUAGE_CODE || process.env.DIALOGFLOW_LANGUAGE_CODE || 'vi';
  const baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL || process.env.DIALOGFLOW_BASE_URL, location);
  const name = process.env.AI_AGENT_NAME || process.env.DIALOGFLOW_AGENT_NAME || agentId || 'Agent Builder';
  return { credentials, projectId, location, agentId, agentPath, languageCode, baseUrl, name };
}

async function googleToken(credentials) {
  const crypto = await import('node:crypto');
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ iss: credEmail(credentials), scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/dialogflow', aud: tokenUri, iat: now, exp: now + 3600 }))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(credKey(credentials), 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const response = await fetch(tokenUri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || `Google token HTTP ${response.status}`);
  return json.access_token;
}

function makeAgent(cfg, raw = null) {
  return { id: cfg.agentPath, name: cfg.name, displayName: cfg.name, title: cfg.name, description: 'Agent Builder live via detectIntent', type: 'dialogflow_cx_detect_intent', provider: 'google', source: 'detect_intent_live', agent: true, runnable: true, agentId: cfg.agentId, projectId: cfg.projectId, location: cfg.location, agentPath: cfg.agentPath, baseUrl: cfg.baseUrl, languageCode: cfg.languageCode, raw };
}

async function liveCheck(cfg) {
  if (!credEmail(cfg.credentials) || !credKey(cfg.credentials)) return { ok: false, reason: 'missing_credentials', message: 'Thiếu credentials trong env.' };
  if (!cfg.agentPath) return { ok: false, reason: 'missing_agent_id', message: 'Thiếu AI_AGENT_ID.' };
  const token = await googleToken(cfg.credentials);
  const session = `${cfg.agentPath}/sessions/report-agent-check-${Date.now()}`;
  const response = await fetch(`${cfg.baseUrl}/${session}:detectIntent`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ queryInput: { text: { text: 'ping' }, languageCode: cfg.languageCode } }) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, reason: 'detect_intent_failed', status: response.status, message: json?.error?.message || `detectIntent HTTP ${response.status}`, raw: json };
  return { ok: true, raw: json };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const envJson = safeJsonParse(process.env.AI_AGENT_JSON || process.env.GOOGLE_AGENT_BUILDER_JSON || '');
  if (envJson) {
    const agents = Array.isArray(envJson.agents) ? envJson.agents : [envJson];
    res.status(200).json({ configured: true, ok: true, source: 'agent_json', agents, data: envJson });
    return;
  }
  const cfg = buildConfig();
  const check = await liveCheck(cfg).catch((error) => ({ ok: false, reason: 'live_check_exception', message: error?.message || 'live check failed' }));
  if (check.ok) {
    const agent = makeAgent(cfg, check.raw);
    res.status(200).json({ configured: true, ok: true, live: true, source: 'detect_intent_live', agentName: agent.displayName, agents: [agent], data: { agents: [agent], detectIntent: check.raw } });
    return;
  }
  res.status(200).json({ configured: Boolean(credEmail(cfg.credentials) || cfg.agentId || cfg.projectId), ok: false, live: false, source: 'detect_intent_check_failed', agents: [], reason: check.reason, message: check.message, status: check.status || null, raw: check.raw || null, configState: { hasCredentials: Boolean(credEmail(cfg.credentials) && credKey(cfg.credentials)), hasAgentId: Boolean(cfg.agentId), hasProjectId: Boolean(cfg.projectId), agentPath: cfg.agentPath, location: cfg.location, languageCode: cfg.languageCode } });
}
