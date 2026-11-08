const {
  createAdminCookie,
  clearAdminCookie,
  constantTimeEquals,
  verifyAdminSession
} = require('../server/admin-session');

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (err) { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const adminLoginSecret = process.env.ADMIN_LOGIN_SECRET;

  if (req.method === 'GET') {
    if (verifyAdminSession(req.headers.cookie, adminLoginSecret)) {
      return res.status(200).json({ authenticated: true });
    }
    return res.status(401).json({ authenticated: false });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearAdminCookie());
    return res.status(200).json({ authenticated: false });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
  }

  if (!adminLoginSecret) {
    return res.status(503).json({
      error: 'Chưa cấu hình ADMIN_LOGIN_SECRET trên Vercel.'
    });
  }

  const password = String(readBody(req).password || '');
  if (!constantTimeEquals(password, adminLoginSecret)) {
    return res.status(401).json({ error: 'Mật khẩu quản trị không đúng.' });
  }

  res.setHeader('Set-Cookie', createAdminCookie(adminLoginSecret));
  return res.status(200).json({ authenticated: true });
};
