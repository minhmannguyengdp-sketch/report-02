import { makeAiSummary } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, getAllLocal, putLocal } from '../local-db.js';

const AGENT_ROW_ID = 'ai-agent-config-selected';
const RAW_JSON_KEY = 'ai_agent_builder_json';
let cfg = { supabaseUrl: '', supabaseKey: '' };
let parsedAgents = [];
let rawJson = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) return;
    const json = await response.json();
    cfg.supabaseUrl = String(json.supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    cfg.supabaseKey = json.supabaseKey || '';
  } catch (error) {
    console.warn('AI config load failed', error);
  }
}

function hasSupabase() {
  return Boolean(cfg.supabaseUrl && cfg.supabaseKey && navigator.onLine);
}

function apiUrl(table) {
  return `${cfg.supabaseUrl}/rest/v1/${table}`;
}

function headers(extra = {}) {
  return {
    apikey: cfg.supabaseKey,
    Authorization: `Bearer ${cfg.supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
    ...extra
  };
}

function addCss() {
  if ($('style[data-ai-agent-settings]')) return;
  const style = document.createElement('style');
  style.dataset.aiAgentSettings = '1';
  style.textContent = `
    [data-page="ai"]{height:100%;min-height:0;overflow:hidden!important;display:none}
    [data-page="ai"].active{display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:10px!important}
    .ai-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .ai-page-title h1{font-size:21px!important;line-height:1.05!important;margin:0!important}
    .ai-page-title p{margin:4px 0 0!important;color:#63727c!important;font-size:12px!important;line-height:1.25!important}
    .ai-config-btn{border:0!important;border-radius:999px!important;background:#e8f8f3!important;color:#007866!important;min-height:34px!important;padding:0 12px!important;font-size:12px!important;font-weight:950!important;white-space:nowrap!important}
    .ai-page-body{min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;display:grid;gap:10px;padding-right:2px}
    .ai-hero{border:1px solid #bfe9dc;border-radius:20px;background:linear-gradient(135deg,#007866,#00a991);color:#fff;padding:13px;box-shadow:0 13px 28px rgba(0,120,102,.14)}
    .ai-hero b{display:block;font-size:17px;line-height:1.08}.ai-hero small{display:block;margin-top:5px;color:rgba(255,255,255,.84);font-size:12px;line-height:1.25}
    .ai-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
    .ai-metric{background:#fff;border:1px solid #dce8e5;border-radius:15px;padding:9px 6px;text-align:center;box-shadow:0 7px 16px rgba(12,55,50,.045);min-width:0}
    .ai-metric b{display:block;font-size:17px;line-height:1;color:#082337}.ai-metric span{display:block;margin-top:4px;color:#63727c;font-size:10px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ai-panel{background:#fff;border:1px solid #dce8e5;border-radius:17px;padding:11px;box-shadow:0 9px 20px rgba(12,55,50,.052);display:grid;gap:8px;min-width:0}
    .ai-panel h2{font-size:15px!important;margin:0!important;line-height:1.15}.ai-panel p{margin:0;color:#63727c;font-size:12px;line-height:1.35}
    .ai-agent-pill{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid #dce8e5;background:#fbfffd;border-radius:13px;padding:9px;min-width:0}
    .ai-agent-pill div{min-width:0}.ai-agent-pill b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-agent-pill small{display:block;color:#63727c;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ai-badge{border-radius:999px;background:#e1f8f1;color:#007866;font-weight:950;font-size:10px;padding:4px 7px;white-space:nowrap}
    .ai-run-btn{border:0;border-radius:13px;background:linear-gradient(135deg,#00957f,#007866);color:#fff;font-weight:950;min-height:40px}
    #modal[data-type="ai-agent"]{width:min(410px,calc(100vw - 20px));max-height:calc(100dvh - 20px)}
    #modal[data-type="ai-agent"] .modal{gap:10px!important;max-height:calc(100dvh - 20px);overflow:hidden}
    .ai-agent-form{min-height:0;overflow-y:auto;display:grid;gap:10px;padding-right:2px}
    .ai-json-load{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}
    .ai-json-load textarea{width:100%;min-height:112px;resize:vertical;border:1px solid #cad7d4;border-radius:13px;padding:9px;font-size:12px;line-height:1.35;background:#fbfffd}
    .ai-agent-list{display:grid;gap:7px}.ai-agent-option{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start;border:1px solid #dce8e5;border-radius:13px;background:#fff;padding:9px}.ai-agent-option b{display:block;font-size:13px}.ai-agent-option small{display:block;color:#63727c;font-size:11px;line-height:1.25;word-break:break-word}
    .ai-agent-empty{border:1px dashed #dce8e5;border-radius:13px;background:#fbfffd;color:#63727c;font-size:12px;text-align:center;padding:12px;margin:0}
    .ai-save-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ai-save-row button{min-height:38px}
  `;
  document.head.appendChild(style);
}

function pickName(obj, fallback) {
  return obj.displayName || obj.display_name || obj.name || obj.agentName || obj.agent_name || obj.title || obj.id || fallback;
}

function pickId(obj, fallback) {
  return obj.id || obj.agentId || obj.agent_id || obj.name || fallback;
}

function summarizeAgent(obj) {
  return obj.description || obj.instruction || obj.instructions || obj.system_instruction || obj.goal || obj.model || obj.type || 'Agent Builder JSON';
}

function normalizeAgent(obj, index) {
  const id = String(pickId(obj, `agent-${index + 1}`));
  const name = String(pickName(obj, id));
  return { id, name, description: String(summarizeAgent(obj)), raw: obj };
}

function collectAgents(value) {
  const candidates = [];
  const seen = new Set();
  const arrays = [];
  if (Array.isArray(value)) arrays.push(value);
  if (value && typeof value === 'object') {
    ['agents', 'agentConfigs', 'agent_configs', 'agentEngines', 'agent_engines', 'apps', 'tools'].forEach((key) => {
      if (Array.isArray(value[key])) arrays.push(value[key]);
    });
  }
  if (!arrays.length && value && typeof value === 'object') arrays.push([value]);
  arrays.flat().forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const looksAgent = pickName(item, '') || item.instruction || item.instructions || item.tools || item.model || item.flow || item.playbook;
    if (!looksAgent) return;
    const agent = normalizeAgent(item, candidates.length);
    const key = `${agent.id}::${agent.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(agent);
  });
  return candidates;
}

async function getSavedAgent() {
  await openLocalDb();
  const rows = await getAllLocal(LOCAL_STORES.aiSummaries);
  return rows.find((row) => row.id === AGENT_ROW_ID) || rows.find((row) => row.summary_type === 'agent_config') || null;
}

async function upsertSupabaseAgent(row) {
  if (!hasSupabase()) return false;
  const payload = [{
    id: row.id,
    title: row.title,
    summary_type: row.summary_type,
    source_filters: row.source_filters,
    source_refs: row.source_refs,
    result: row.result,
    status: row.status,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at
  }];
  const response = await fetch(apiUrl('ai_summaries'), { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(await response.text());
  return true;
}

async function saveSelectedAgent() {
  const selected = $('[name="aiAgentChoice"]:checked');
  if (!selected) return toast('Chưa chọn agent');
  const agent = parsedAgents.find((item) => item.id === selected.value);
  if (!agent) return toast('Không tìm thấy agent đã chọn');
  const row = makeAiSummary({
    id: AGENT_ROW_ID,
    title: `Agent config · ${agent.name}`,
    summary_type: 'agent_config',
    source_filters: { source: 'google_agent_builder_json', agent_count: parsedAgents.length, selected_agent_id: agent.id },
    source_refs: parsedAgents.map((item) => ({ id: item.id, name: item.name })),
    result: { selected_agent: agent, raw_json: rawJson },
    status: 'active',
    agent_id: agent.id,
    agent_name: agent.name,
    note: 'Saved from Google Agent Builder JSON'
  });
  await putLocal(LOCAL_STORES.aiSummaries, row);
  try {
    const synced = await upsertSupabaseAgent(row);
    toast(synced ? 'Đã lưu agent lên Supabase' : 'Đã lưu agent local, chưa có Supabase/online');
  } catch (error) {
    console.warn('save AI agent to supabase failed', error);
    toast('Đã lưu local, Supabase lỗi');
  }
  closeModal();
  await renderAiPage();
}

function renderAgentOptions() {
  const box = $('#aiAgentList');
  const count = $('#aiAgentCount');
  if (count) count.textContent = `${parsedAgents.length} agent`;
  if (!box) return;
  box.innerHTML = parsedAgents.length ? parsedAgents.map((agent, index) => `
    <label class="ai-agent-option">
      <input type="radio" name="aiAgentChoice" value="${esc(agent.id)}" ${index === 0 ? 'checked' : ''}>
      <span><b>${esc(agent.name)}</b><small>${esc(agent.id)} · ${esc(agent.description).slice(0, 160)}</small></span>
    </label>
  `).join('') : '<p class="ai-agent-empty">Chưa load JSON. Dán JSON hoặc chọn file export từ Google Agent Builder.</p>';
}

function parseTextareaJson() {
  const text = $('#aiAgentJson')?.value.trim();
  if (!text) return toast('Chưa có JSON');
  try {
    rawJson = JSON.parse(text);
    parsedAgents = collectAgents(rawJson);
    renderAgentOptions();
    toast(`Đã load ${parsedAgents.length} agent`);
  } catch (error) {
    toast('JSON không hợp lệ');
  }
}

async function loadJsonFile(file) {
  if (!file) return;
  const text = await file.text();
  const input = $('#aiAgentJson');
  if (input) input.value = text;
  parseTextareaJson();
}

function closeModal() {
  const modal = $('#modal');
  if (modal?.open) modal.close();
  if (modal) modal.dataset.type = '';
}

async function openAgentModal() {
  const modal = $('#modal');
  if (!modal) return;
  modal.dataset.type = 'ai-agent';
  const saved = await getSavedAgent();
  parsedAgents = saved?.source_refs?.map((item, index) => normalizeAgent(item, index)) || [];
  rawJson = saved?.result?.raw_json || null;
  modal.innerHTML = `
    <div class="modal">
      <header><h2>Cài đặt AI Agent</h2><button type="button" data-ai-agent-close>Đóng</button></header>
      <div class="ai-agent-form">
        <div class="ai-json-load">
          <label><span>Google Agent Builder JSON</span><textarea id="aiAgentJson" placeholder="Dán JSON export hoặc load file .json">${rawJson ? esc(JSON.stringify(rawJson, null, 2)) : ''}</textarea></label>
          <button class="secondary" type="button" data-ai-load-json>Load JSON</button>
        </div>
        <label><span>Chọn file JSON</span><input id="aiAgentFile" type="file" accept="application/json,.json"></label>
        <div class="ai-agent-pill"><div><b>Agent trong project</b><small>Load JSON xong sẽ hiện danh sách để chọn</small></div><span class="ai-badge" id="aiAgentCount">0 agent</span></div>
        <div class="ai-agent-list" id="aiAgentList"></div>
        <div class="ai-save-row"><button class="secondary" type="button" data-ai-agent-close>Hủy</button><button class="primary" type="button" data-ai-save-agent>Lưu agent</button></div>
      </div>
    </div>`;
  renderAgentOptions();
  modal.showModal();
}

async function renderAiPage() {
  const page = $('[data-page="ai"]');
  if (!page) return;
  const saved = await getSavedAgent();
  const agentCount = saved?.source_filters?.agent_count || saved?.source_refs?.length || 0;
  const agentName = saved?.agent_name || 'Chưa chọn agent';
  page.innerHTML = `
    <div class="ai-page-head">
      <div class="ai-page-title"><h1>AI tổng hợp</h1><p>Chọn agent Google Agent Builder để tổng hợp dữ liệu MCP / Đơn / Test / Báo cáo.</p></div>
      <button class="ai-config-btn" type="button" data-open-ai-agent>⚙ Agent</button>
    </div>
    <div class="ai-page-body">
      <article class="ai-hero"><b>Agent báo cáo công ty</b><small>Agent được lưu local và đồng bộ Supabase qua bảng ai_summaries để không bị trôi cấu hình.</small></article>
      <div class="ai-metrics"><div class="ai-metric"><b>${esc(agentCount)}</b><span>Agent JSON</span></div><div class="ai-metric"><b>${saved ? '1' : '0'}</b><span>Đã chọn</span></div><div class="ai-metric"><b>${hasSupabase() ? 'ON' : 'Local'}</b><span>Supabase</span></div></div>
      <section class="ai-panel"><h2>Agent đang dùng</h2><div class="ai-agent-pill"><div><b>${esc(agentName)}</b><small>${saved ? esc(saved.agent_id || '') : 'Bấm Agent để load JSON và lưu agent.'}</small></div><span class="ai-badge">${saved?.status || 'draft'}</span></div><button class="ai-run-btn" type="button" id="aiBtn">Tạo báo cáo AI</button><p>Phần chạy AI backend chưa nối. Màn này chỉ cài agent và giữ cấu hình ổn định.</p></section>
    </div>`;
}

function wire() {
  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-open-ai-agent]')) {
      event.preventDefault();
      await openAgentModal();
      return;
    }
    if (event.target.closest('[data-ai-agent-close]')) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.target.closest('[data-ai-load-json]')) {
      event.preventDefault();
      parseTextareaJson();
      return;
    }
    if (event.target.closest('[data-ai-save-agent]')) {
      event.preventDefault();
      await saveSelectedAgent();
    }
  }, true);
  document.addEventListener('change', async (event) => {
    if (event.target?.id === 'aiAgentFile') await loadJsonFile(event.target.files?.[0]);
  }, true);
}

async function boot() {
  addCss();
  await openLocalDb();
  await loadConfig();
  await renderAiPage();
}

wire();
boot();
window.addEventListener('DOMContentLoaded', boot);
