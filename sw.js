// sw.js - ملف عامل الخدمة الأساسي
const CACHE_NAME = 'legal-search-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/admin.html',
  '/app.js',
  '/admin.js',
  '/firebase-config.js',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'
];

// حدث التثبيت: تخزين الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching all assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// حدث التفعيل: تنظيف الكاش القديم إذا تغير الإصدار
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// استراتيجية جلب البيانات: الشبكة أولاً، ثم الكاش (للبيانات المتغيرة)
// أو الكاش أولاً (للأداء الأسرع للملفات الثابتة)
// هنا سنستخدم استراتيجية بسيطة: حاول من الشبكة، لو فشل هات من الكاش
self.addEventListener('fetch', (event) => {
    // نتجاهل طلبات فايربيس وموارد خارجية معينة لتجنب مشاكل الكاش
    if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('cdn.tailwindcss.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // لو موجود في الكاش رجعه
            if (cachedResponse) {
                return cachedResponse;
            }
            // لو مش موجود، هاته من النت
            return fetch(event.request);
        })
    );
});
