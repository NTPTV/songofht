const { verifyAdminSession } = require('../server/admin-session');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Chỉ chấp nhận POST.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://ycifixbmcfjixmmjyfpb.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminLoginSecret = process.env.ADMIN_LOGIN_SECRET;
  if (!adminLoginSecret) {
    return res.status(503).json({
      error: 'Chưa cấu hình ADMIN_LOGIN_SECRET trên Vercel.'
    });
  }
  if (!verifyAdminSession(req.headers.cookie, adminLoginSecret)) {
    return res.status(401).json({ error: 'Phiên Admin hết hạn. Hãy đăng nhập lại.' });
  }
  if (!serviceRoleKey) {
    return res.status(503).json({
      error: 'Chưa cấu hình SUPABASE_SECRET_KEY trên Vercel.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (err) { body = null; }
  }
  const id = String(body?.id || '').trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    return res.status(400).json({ error: 'ID lời nhắn không hợp lệ.' });
  }

  try {
    const endpoint = new URL('/rest/v1/ky', supabaseUrl);
    endpoint.searchParams.set('id', `eq.${id}`);
    const headers = {
      apikey: serviceRoleKey,
      Prefer: 'return=representation'
    };
    // New sb_secret_* keys are API keys, not JWTs. Sending one as a Bearer
    // token makes Supabase reject the request with Invalid JWT.
    if (!serviceRoleKey.startsWith('sb_secret_')) {
      headers.Authorization = `Bearer ${serviceRoleKey}`;
    }

    const upstream = await fetch(endpoint, {
      method: 'DELETE',
      headers
    });

    const responseText = await upstream.text();
    if (!upstream.ok) {
      console.error('[admin-delete-graffiti] Supabase returned', upstream.status, responseText);
      let detail = 'Supabase từ chối yêu cầu.';
      try {
        const errorBody = JSON.parse(responseText);
        detail = errorBody.message || errorBody.hint || errorBody.code || detail;
      } catch (err) {}
      return res.status(502).json({ error: `Supabase HTTP ${upstream.status}: ${detail}` });
    }

    let deletedRows = [];
    try { deletedRows = responseText ? JSON.parse(responseText) : []; } catch (err) {}
    if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy lời nhắn trên máy chủ.' });
    }

    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error('[admin-delete-graffiti] Request failed:', err);
    return res.status(502).json({ error: 'Không kết nối được tới Supabase.' });
  }
};
