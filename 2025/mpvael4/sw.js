// 방방곡곡 나라사랑 전자책 Service Worker
const CACHE_NAME = 'narasarang-ebook-v1.0.0';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap'
];

// 설치 이벤트
self.addEventListener('install', event => {
  console.log('Service Worker 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시 오픈 성공');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('캐시 추가 실패:', error);
      })
  );
});

// 활성화 이벤트
self.addEventListener('activate', event => {
  console.log('Service Worker 활성화');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 요청 가로채기
self.addEventListener('fetch', event => {
  // GET 요청만 처리
  if (event.request.method !== 'GET') {
    return;
  }

  // HTML 페이지 요청인 경우 네트워크 우선 전략
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 네트워크 응답이 성공적이면 캐시에 저장
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 네트워크 실패 시 캐시에서 반환
          return caches.match(event.request);
        })
    );
    return;
  }

  // JSON 데이터 요청인 경우 네트워크 우선
  if (event.request.url.includes('.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 이미지 요청인 경우 캐시 우선
  if (event.request.url.includes('.png') || event.request.url.includes('.jpg') || event.request.url.includes('.jpeg')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request).then(response => {
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // 기타 모든 요청 (CSS, JS, 폰트 등)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에 있으면 반환
        if (response) {
          return response;
        }
        
        // 없으면 네트워크에서 가져와서 캐시에 저장
        return fetch(event.request).then(response => {
          // 유효한 응답인지 확인
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // 응답을 복제하여 캐시에 저장
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// 백그라운드 동기화 (선택사항)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('백그라운드 동기화 실행');
  }
});

// 푸시 알림 (선택사항)
self.addEventListener('push', event => {
  console.log('푸시 메시지 수신:', event);
  
  const options = {
    body: '새로운 콘텐츠가 업데이트되었습니다.',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: '보러가기',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">👀</text></svg>'
      },
      {
        action: 'close',
        title: '닫기',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">❌</text></svg>'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('방방곡곡 나라사랑', options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
  console.log('알림 클릭:', event);
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('Service Worker 로드 완료');