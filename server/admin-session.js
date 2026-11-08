const { createHmac, timingSafeEqual } = require('node:crypto');

const ADMIN_COOKIE_NAME = 'songofht_admin_session';
const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

function constantTimeEquals(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ''), 'utf8');
  const right = Buffer.from(String(rightValue || ''), 'utf8');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

function signPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function createAdminCookie(secret) {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS
  })).toString('base64url');
  const token = `${payload}.${signPayload(payload, secret)}`;
  return `${ADMIN_COOKIE_NAME}=${token}; Path=/; Max-Age=${ADMIN_SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

function clearAdminCookie() {
  return `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function readCookie(cookieHeader, name) {
  const prefix = `${name}=`;
  const match = String(cookieHeader || '').split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

function verifyAdminSession(cookieHeader, secret) {
  if (!secret) return false;
  const token = readCookie(cookieHeader, ADMIN_COOKIE_NAME);
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payload, suppliedSignature] = parts;
  if (!constantTimeEquals(suppliedSignature, signPayload(payload, secret))) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch (err) {
    return false;
  }
}

module.exports = {
  ADMIN_COOKIE_NAME,
  createAdminCookie,
  clearAdminCookie,
  constantTimeEquals,
  verifyAdminSession
};
