// ===================================================================
// SERVICE WORKER - SÓNG OF HT (PROGRESSIVE WEB APP)
// THPT Hà Trung • Phú Vang, Thành Phố Huế
// ===================================================================

const CACHE_NAME = 'song-of-ht-cache-v9';

// Danh sách tài nguyên cốt lõi cần precache khi cài đặt
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-192.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'assets/logo-song-of-ht.jpg',
  'assets/logo-song-of-ht-transparent.png',
  'assets/banner-song-of-ht.jpg',
  'assets/bg-ocean-wave.webp',
  'assets/school-logo.png',
  'assets/fb-icon.png',
  'assets/tiktok-icon.png',
  'assets/members/default-member-01.webp',
  'assets/members/default-member-02.webp',
  'assets/members/default-member-03.webp',
  'assets/members/default-member-04.webp',
  'assets/members/default-member-05.webp',
  'assets/members/default-member-06.webp',
  'assets/members/default-member-07.webp',
  'assets/members/default-member-08.webp',
  'assets/members/default-member-09.webp',
  'assets/members/default-member-10.webp'
];

// 1. SỰ KIỆN CÀI ĐẶT (INSTALL): Lưu trước các tài nguyên tĩnh
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Đang nạp tài nguyên tĩnh vào bộ nhớ cache...');
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Bỏ qua tài nguyên tùy chọn chưa tải được:', asset, err.message);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// 2. SỰ KIỆN KÍCH HOẠT (ACTIVATE): Dọn dẹp cache cũ khi có phiên bản mới
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Xóa cache phiên bản cũ:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. SỰ KIỆN FETCH: Chiến lược tối ưu tải nhanh và hỗ trợ ngoại tuyến
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Chỉ xử lý các yêu cầu GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // TUYỆT ĐỐI KHÔNG can thiệp vào các API call của Supabase hoặc kết nối Realtime WebSocket
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/realtime') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return; // Để trình duyệt trực tiếp gọi mạng
  }

  // Bỏ qua các schema mở rộng của trình duyệt (chrome-extension, edge, ...)
  if (!req.url.startsWith('http')) return;

  // Chiến lược cho trang HTML (Navigation): Network-First, Fallback to Cache
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(req) || await caches.match('index.html') || await caches.match('./');
          if (cached) return cached;
          return new Response(
            `<!DOCTYPE html>
            <html lang="vi">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Sóng Of HT - Ngoại Tuyến</title>
              <style>
                body { background: #0b132b; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
                h1 { color: #38bdf8; font-size: 24px; margin-bottom: 12px; }
                p { color: #94a3b8; font-size: 15px; max-width: 400px; line-height: 1.5; }
                button { margin-top: 20px; padding: 10px 24px; border-radius: 9999px; background: linear-gradient(135deg, #0284c7, #06b6d4); color: white; border: none; font-weight: bold; cursor: pointer; }
              </style>
            </head>
            <body>
              <div style="font-size: 50px; margin-bottom: 15px;">🌊</div>
              <h1>Bạn Đang Ngoại Tuyến</h1>
              <p>Hiện không có kết nối internet. Vui lòng kết nối lại mạng để xem đầy đủ nội dung và tương tác cùng Sóng Of HT!</p>
              <button onclick="window.location.reload()">Thử Lại</button>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Chiến lược cho tài nguyên tĩnh nội bộ (Stale-While-Revalidate / Cache-First)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Trả về bản cache ngay tức thì để web tải nhanh
        // Đồng thời tải nền từ mạng để làm mới cache cho lần sau (Stale-While-Revalidate)
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
            }
          })
          .catch(() => { /* Ngoại tuyến - bản cache đã được trả về */ });
        return cachedResponse;
      }

      // Chưa có trong cache: tải từ mạng rồi lưu vào cache
      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return networkResponse;
      }).catch((err) => {
        console.warn('[SW] Không thể tải tài nguyên ngoại tuyến:', req.url);
      });
    })
  );
});
