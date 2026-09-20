import { isIP } from 'node:net';

const invalid = (message) => Object.assign(new Error(message), { status: 422 });
const text = (value, label, max = 128) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw invalid(`Invalid ${label}`);
  return value.trim();
};

export function validateRouterInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Router details required');
  const allowed = new Set(['name', 'host', 'port', 'routerOsVersion', 'status']);
  if (Object.keys(body).some((key) => !allowed.has(key))) throw invalid('Unsupported router field');
  const name = text(body.name, 'router name', 80);
  const host = text(body.host, 'router host', 253);
  if (isIP(host) !== 4 && isIP(host) !== 6 && !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i.test(host)) throw invalid('Invalid router host');
  const port = Number(body.port ?? 8729);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw invalid('Invalid RouterOS port');
  const routerOsVersion = body.routerOsVersion ?? '7';
  if (!['6', '7'].includes(routerOsVersion)) throw invalid('Unsupported RouterOS version');
  const status = body.status ?? 'Disabled';
  if (!['Active', 'Disabled'].includes(status)) throw invalid('Invalid router status');
  return { name, host, port, routerOsVersion, status };
}

export function validateRouterId(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) throw invalid('Invalid router ID');
  return Number(value);
}

export function requireRouterOwner(actor) {
  if (!actor || actor.status !== 'Active' || actor.impersonatedBy || !['Admin', 'Reseller', 'Sub-reseller'].includes(actor.role) || !Number.isSafeInteger(Number(actor.id)) || Number(actor.id) < 1) {
    throw Object.assign(new Error('Active own-tenant session required'), { status: 403 });
  }
  return Number(actor.id);
}
