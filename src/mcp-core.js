import { makeMcpRouteSession, makeMcpVisit, todayIsoDate, nowIso } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, getLocal, putLocal } from '../local-db.js';

function cleanDate(value) {
  return value || todayIsoDate();
}

function compareNewest(a, b) {
  return String(b.session_date || b.visit_date || b.created_at).localeCompare(String(a.session_date || a.visit_date || a.created_at));
}

export function mcpVisitCounts(customers = [], visits = []) {
  const customerIds = new Set(customers.map((customer) => customer.id));
  const scopedVisits = visits.filter((visit) => !customerIds.size || customerIds.has(visit.route_customer_id));
  const visited = scopedVisits.filter((visit) => visit.status && visit.status !== 'todo' && visit.status !== 'skipped');
  return {
    planned_customers: customers.length,
    visited_customers: new Set(visited.map((visit) => visit.route_customer_id)).size,
    order_count: scopedVisits.filter((visit) => visit.has_order || visit.status === 'order').length,
    test_count: scopedVisits.filter((visit) => visit.has_test || visit.status === 'test').length,
    report_count: scopedVisits.filter((visit) => visit.has_report || visit.status === 'report').length
  };
}

export async function getMcpRoutes() {
  const routes = await getAllLocal(LOCAL_STORES.mcpRoutes);
  return routes.filter((route) => route.active !== false).sort((a, b) => Number(a.weekday || 0) - Number(b.weekday || 0) || String(a.route_name).localeCompare(String(b.route_name), 'vi'));
}

export async function getMcpRouteCustomers(routeId) {
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  return customers
    .filter((customer) => customer.active !== false && (!routeId || customer.route_id === routeId))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.customer_name).localeCompare(String(b.customer_name), 'vi'));
}

export async function getMcpRouteSessions() {
  const sessions = await getAllLocal(LOCAL_STORES.mcpRouteSessions);
  return sessions.slice().sort(compareNewest);
}

export async function getMcpSession(sessionId) {
  if (!sessionId) return null;
  return getLocal(LOCAL_STORES.mcpRouteSessions, sessionId);
}

export async function getMcpSessionDetail(sessionId) {
  const session = await getMcpSession(sessionId);
  if (!session) return null;
  const [route, customers, visits] = await Promise.all([
    session.route_id ? getLocal(LOCAL_STORES.mcpRoutes, session.route_id) : Promise.resolve(null),
    getMcpRouteCustomers(session.route_id),
    getAllLocal(LOCAL_STORES.mcpVisits)
  ]);
  const sessionVisits = visits.filter((visit) => visit.session_id === session.id || (visit.route_id === session.route_id && visit.visit_date === session.session_date));
  return { session, route, customers, visits: sessionVisits, stats: mcpVisitCounts(customers, sessionVisits) };
}

export async function findMcpRouteSession(routeId, sessionDate = todayIsoDate()) {
  const sessions = await getAllLocal(LOCAL_STORES.mcpRouteSessions);
  return sessions.find((session) => session.route_id === routeId && session.session_date === cleanDate(sessionDate) && session.status !== 'cancelled') || null;
}

export async function createOrOpenMcpRouteSession(input = {}) {
  const routeId = input.route_id;
  const sessionDate = cleanDate(input.session_date || input.date);
  if (!routeId) throw new Error('MCP session thiếu route_id.');

  const existing = await findMcpRouteSession(routeId, sessionDate);
  if (existing) return existing;

  const [route, customers] = await Promise.all([
    getLocal(LOCAL_STORES.mcpRoutes, routeId),
    getMcpRouteCustomers(routeId)
  ]);
  const session = makeMcpRouteSession({
    ...input,
    route_id: routeId,
    route_name: input.route_name || route?.route_name,
    session_date: sessionDate,
    weekday: input.weekday ?? route?.weekday,
    area: input.area || route?.area,
    planned_customers: customers.length,
    status: input.status || 'active',
    raw_payload: { kind: 'mcp_route_session', route_id: routeId, session_date: sessionDate, ...(input.raw_payload || {}) }
  });
  await putLocal(LOCAL_STORES.mcpRouteSessions, session);
  return session;
}

export async function recalcMcpRouteSession(sessionId) {
  const detail = await getMcpSessionDetail(sessionId);
  if (!detail) return null;
  const patch = {
    ...detail.session,
    ...detail.stats,
    updated_at: nowIso()
  };
  await putLocal(LOCAL_STORES.mcpRouteSessions, patch);
  return patch;
}

export async function upsertMcpVisitForSession(input = {}) {
  const sessionId = input.session_id;
  if (!sessionId) throw new Error('MCP visit thiếu session_id.');
  const session = await getMcpSession(sessionId);
  if (!session) throw new Error('Không tìm thấy MCP session.');
  const visitId = input.id || `mcp-visit-${session.id}-${input.route_customer_id}`;
  const visit = makeMcpVisit({
    ...input,
    id: visitId,
    session_id: session.id,
    route_id: input.route_id || session.route_id,
    visit_date: input.visit_date || session.session_date
  });
  await putLocal(LOCAL_STORES.mcpVisits, visit);
  await recalcMcpRouteSession(session.id);
  return visit;
}
