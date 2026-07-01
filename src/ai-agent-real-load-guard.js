import { makeAiSummary } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, putLocal } from '../local-db.js';

const AGENT_ROW_ID = 'ai-agent-config-selected';
let rawJson = null;
let agents = [];

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

function firstValue(obj = {}, keys = []) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function isCredentialJson(obj = {}) {
  return obj?.type === 'service_account' && obj?.client_email && obj?.project_id;
}

function isFakeAgent(obj = {}) {
  const configured = obj?.configuredBy || {};
  return Boolean(
    obj?.source === 'dialogflow_cx_env'
    && !obj?.agentId
    && !obj?.projectId
    && !obj?.agentPath
    && configured.hasCredentials === false
    && configured.hasAgentId === false
  );
}

function looksLikeAgent(obj = {}, parentKey = '') {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (isCredentialJson(obj) || isFakeAgent(obj)) return false;
  const resource = String(obj.name || obj.resourceName || obj.resource_name || obj.agentPath || '').trim();
  const parentLooks = /agent|assistant|bot|playbook|flow|engine|app|resource|deployment/i.test(parentKey);
  return Boolean(
    obj.agent === true
    || obj.agentId
    || obj.agent_id
    || obj.agentPath
    || obj.agent_path
    || obj.displayName
    || obj.display_name
    || obj.playbook
    || obj.flow
    || obj.tools
    || /^projects\/[^/]+\/locations\/[^/]+\/(agents|engines|apps|reasoningEngines)\/[^/]+/.test(resource)
    || (parentLooks && (obj.name || obj.id || obj.title))
  );
}

function normalizeAgent(obj = {}, index = 0) {
  const id = firstValue(obj, ['id', 'agentId', 'agent_id', 'agentPath', 'agent_path', 'resourceName', 'resource_name', 'name']) || `agent-${index + 1}`;
  const name = firstValue(obj, ['displayName', 'display_name', 'title', 'agentName', 'agent_name', 'name', 'id']) || id;
  const description = firstValue(obj, ['description', 'instruction', 'instructions', 'systemInstruction', 'system_instruction', 'prompt', 'model', 'type', 'provider']) || 'Agent Builder config';
  return { id, name, description, raw: obj };
}

function collectAgents(value) {
  const out = [];
  const seen = new Set();
  const visited = new WeakSet();
  const keys = new Set(['agents', 'agentConfigs', 'agent_configs', 'agentEngines', 'agent_engines', 'apps', 'resources', 'playbooks', 'flows', 'deployments', 'engines', 'reasoningEngines', 'reasoning_engines', 'data', 'result', 'metadata']);

  function add(obj) {
    const agent = normalizeAgent(obj, out.length);
    const key = `${agent.id}::${agent.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(agent);
  }

  function scan(node, depth = 0, parentKey = '') {
    if (!node || depth > 9) return;
    if (Array.isArray(node)) return node.forEach((item) => scan(item, depth + 1, parentKey));
    if (typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);
    if (looksLikeAgent(node, parentKey)) add(node);
    for (const [key, child] of Object.entries(node)) {
      if (!child || typeof child !== 'object') continue;
      if (keys.has(key) || Array.isArray(child) || depth < 4) scan(child, depth + 1, key);
    }
  }

  scan(value, 0, 'root');
  return out;
}

function noticeFor(json, list) {
  if (list.length) return '';
  if (isCredentialJson(json)) return 'File này là service account credentials, chưa phải agent. Cần thêm AI_AGENT_ID dạng projects/.../locations/.../agents/... trong Vercel hoặc dán JSON export agent thật.';
  if (json?.warning === 'missing_dialogflow_credentials_or_agent_path') return 'Server chỉ trả manifest thiếu credentials/agentPath, chưa phải agent thật.';
  if (json?.incompleteAgent) return 'Server thiếu AI_CREDENTIALS_JSON và/hoặc AI_AGENT_ID nên chưa load được Agent Builder thật.';
  return json?.message || json?.error || 'Chưa tìm thấy agent thật trong JSON này.';
}

function render(list, notice = '') {
  const box = $('#aiAgentList');
  const count = $('#aiAgentCount');
  if (count) count.textContent = `${list.length} agent`;
  if (!box) return;
  if (!list.length) {
    box.innerHTML = `<p class="ai-agent-empty">${esc(notice)}</p>`;
    return;
  }
  box.innerHTML = list.map((agent, index) => `
    <label class="ai-agent-option">
      <input type="radio" name="aiAgentChoice" value="${esc(agent.id)}" ${index === 0 ? 'checked' : ''}>
      <span><b>${esc(agent.name)}</b><small>${esc(agent.id)} · ${esc(agent.description).slice(0, 180)}</small></span>
    </label>
  `).join('');
}

function parseCurrentTextarea() {
  const text = $('#aiAgentJson')?.value?.trim();
  if (!text) return toast('Chưa có JSON');
  try {
    rawJson = JSON.parse(text);
    agents = collectAgents(rawJson);
    render(agents, noticeFor(rawJson, agents));
    toast(agents.length ? `Đã load ${agents.length} agent thật` : 'Chưa tìm thấy agent thật');
  } catch (_error) {
    toast('JSON không hợp lệ');
  }
}

async function loadServer() {
  try {
    const response = await fetch('/api/ai-agent', { cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    rawJson = { source: 'ai_agent_server', ...json };
    const input = $('#aiAgentJson');
    if (input) input.value = JSON.stringify(rawJson, null, 2);
    agents = response.ok && json.ok !== false ? collectAgents(json.data || json.agents || json) : [];
    render(agents, noticeFor(rawJson, agents));
    toast(agents.length ? `Đã load ${agents.length} agent thật từ server` : 'Server chưa có agent thật');
  } catch (_error) {
    agents = [];
    render([], 'Không gọi được /api/ai-agent');
    toast('Không load được agent server');
  }
}

async function loadFile(file) {
  if (!file) return;
  const text = await file.text();
  const input = $('#aiAgentJson');
  if (input) input.value = text;
  parseCurrentTextarea();
}

async function saveAgent() {
  const selectedId = $('[name="aiAgentChoice"]:checked')?.value || '';
  const agent = agents.find((item) => item.id === selectedId);
  if (!agent) return toast('Chưa chọn agent thật');
  await openLocalDb();
  const row = makeAiSummary({
    id: AGENT_ROW_ID,
    title: `Agent config · ${agent.name}`,
    summary_type: 'agent_config',
    source_filters: { source: rawJson?.source || 'ai_agent_config', agent_count: agents.length, selected_agent_id: agent.id },
    source_refs: agents.map((item) => ({ id: item.id, name: item.name, description: item.description })),
    result: { selected_agent: agent, raw_json: rawJson },
    status: 'active',
    agent_id: agent.id,
    agent_name: agent.name,
    note: 'Saved from real AI Agent Builder config'
  });
  await putLocal(LOCAL_STORES.aiSummaries, row);
  const modal = $('#modal');
  if (modal?.open) modal.close();
  toast('Đã lưu agent thật local');
}

document.addEventListener('click', async (event) => {
  if (event.target.closest('[data-ai-load-json]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    parseCurrentTextarea();
    return;
  }
  if (event.target.closest('[data-ai-load-server]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await loadServer();
    return;
  }
  if (event.target.closest('[data-ai-save-agent]')) {
    if (agents.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await saveAgent();
    }
  }
}, true);

document.addEventListener('change', async (event) => {
  if (event.target?.id === 'aiAgentFile') {
    event.preventDefault();
    event.stopImmediatePropagation();
    await loadFile(event.target.files?.[0]);
  }
}, true);
