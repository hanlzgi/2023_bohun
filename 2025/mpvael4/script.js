/* 방방곡곡 나라사랑 전자책 뷰어 - 설정 및 북마크 수정본 (h1 클래스 추가) */

document.addEventListener('DOMContentLoaded', function () {
    class EnhancedEbookViewer {
        constructor() {
            this.totalPages = 108;
            this.currentPage = 1; 
            this.pagesData = {};
            this.searchIndex = {};

            this.bookmarks = this.loadFromStorage('ebook_bookmarks', []);
            this.memos = this.loadFromStorage('ebook_memos', {});
            
            this.visitedPages = new Set(this.loadFromStorage('visited_pages', []));
            this.readingTime = this.loadFromStorage('reading_time', {});
            this.pageStartTime = Date.now();

            this.colorThemes = {
                black: "#000000",
                red: "#d95c55",
                yellow: "#FFBA0D",
                green: "#16A53E",
                blue: "#009EFF"
            };

            // 터치 스와이프 변수
            this.touchStartX = 0;
            this.touchStartY = 0;
            this.touchEndX = 0;
            this.touchEndY = 0;

            this.init();
        }

        init() {
            console.log('고급 전자책 뷰어 초기화 중...');
            this.setupElements();
            this.setupEventListeners();
            this.loadInitialPage(); 
            this.initializeProgressTracking();
            this.buildSearchIndex();
            
            // 초기 스케일링 실행
            this.applyScaling();
            window.addEventListener('resize', () => this.applyScaling());
        }

        loadFromStorage(key, defaultValue) {
            try { return JSON.parse(localStorage.getItem(key)) || defaultValue; } 
            catch (e) { return defaultValue; }
        }

        saveToStorage(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; } 
            catch (e) { return false; }
        }

        setupElements() {
            this.elements = {
                pageContent: document.getElementById('pageContent'),
                currentPage: document.getElementById('currentPage'),
                totalPages: document.getElementById('totalPages'),
                prevButton: document.getElementById('prevButton'),
                nextButton: document.getElementById('nextButton'),
                pageSelector: document.getElementById('pageSelector'),
                hamburgerBtn: document.getElementById('hamburgerBtn'),
                mobileMenu: document.getElementById('mobileMenu'),
                bookmarkBtn: document.getElementById('bookmarkBtn'),
                memoBtn: document.getElementById('memoBtn'),
                searchBtn: document.getElementById('searchBtn'),
                settingsBtn: document.getElementById('settingsBtn'),
                downloadBtn: document.getElementById('downloadBtn'),
                fullscreenBtn: document.getElementById('fullscreenBtn'),
                searchModal: document.getElementById('searchModal'),
                settingsModal: document.getElementById('settingsModal'),
                bookmarkModal: document.getElementById('bookmarkModal'),
                searchInput: document.getElementById('searchInput'),
                searchExecuteBtn: document.getElementById('searchExecuteBtn'),
                searchResults: document.getElementById('searchResults'),
                bookmarkList: document.getElementById('bookmarkList'),
                visitedCount: document.getElementById('visitedCount'),
                progressPercent: document.getElementById('progressPercent'),
                totalReadingTime: document.getElementById('totalReadingTime'),
                showBookmarksBtn: document.getElementById('showBookmarksBtn'),
            };

            if (this.elements.pageSelector) {
                this.elements.pageSelector.innerHTML = '';
                for (let i = 1; i <= this.totalPages; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = i;
                    this.elements.pageSelector.appendChild(option);
                }
            }
            if (this.elements.totalPages) this.elements.totalPages.textContent = this.totalPages;
            if (document.getElementById('totalCount')) document.getElementById('totalCount').textContent = this.totalPages;
        }

        setupEventListeners() {
            // 페이지 네비게이션
            if (this.elements.prevButton) this.elements.prevButton.addEventListener('click', () => this.previousPage());
            if (this.elements.nextButton) this.elements.nextButton.addEventListener('click', () => this.nextPage());
            if (this.elements.pageSelector) this.elements.pageSelector.addEventListener('change', (e) => this.goToPage(parseInt(e.target.value)));
            
            // 햄버거 메뉴
            if (this.elements.hamburgerBtn) {
                this.elements.hamburgerBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleMobileMenu();
                });
            }

            // 외부 클릭 시 메뉴 닫기
            document.addEventListener('click', (e) => {
                if (this.elements.mobileMenu && 
                    this.elements.mobileMenu.classList.contains('active') && 
                    !this.elements.mobileMenu.contains(e.target) &&
                    !this.elements.hamburgerBtn.contains(e.target)) {
                    this.closeMobileMenu();
                }
            });

            // 메뉴 버튼들
            if (this.elements.bookmarkBtn) {
                this.elements.bookmarkBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeMobileMenu();
                    this.toggleBookmark();
                });
            }
            
            if (this.elements.memoBtn) {
                this.elements.memoBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeMobileMenu();
                    this.openMemoDialog();
                });
            }
            
            if (this.elements.searchBtn) {
                this.elements.searchBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeMobileMenu();
                    this.openSearchModal();
                });
            }
            
            if (this.elements.settingsBtn) {
                this.elements.settingsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeMobileMenu();
                    this.openSettingsModal();
                });
            }
            
            if (this.elements.downloadBtn) {
                this.elements.downloadBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeMobileMenu();
                    this.downloadPDF();
                });
            }
            
            if (this.elements.fullscreenBtn) {
                this.elements.fullscreenBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeMobileMenu();
                    this.toggleFullscreen();
                });
            }

            // 검색 모달
            if (this.elements.searchExecuteBtn) {
                this.elements.searchExecuteBtn.addEventListener('click', () => this.performSearch());
            }
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('keypress', (e) => { 
                    if(e.key === 'Enter') this.performSearch(); 
                });
            }
            
            if (this.elements.showBookmarksBtn) {
                this.elements.showBookmarksBtn.addEventListener('click', () => {
                    this.closeModals();
                    this.openBookmarkModal();
                });
            }
            
            // 모달 닫기 버튼들
            document.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeModals();
                });
            });
            
            // 모달 배경 클릭 시 닫기
            document.querySelectorAll('.modal').forEach(modal => {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeModals();
                    }
                });
            });
            
            // 키보드 이벤트
            document.addEventListener('keydown', (e) => this.handleKeyboard(e));
            window.addEventListener('hashchange', () => this.loadInitialPage());
            
            // 로고 클릭
            const logo = document.querySelector('.header-logo');
            if(logo) logo.addEventListener('click', () => window.open('https://www.mpva.go.kr/', '_blank'));
            
            // 페이지 이탈 시 진행 상황 저장
            window.addEventListener('beforeunload', () => this.saveProgress());
            document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

            // 모바일 스와이프 제스처 이벤트 등록
            if (this.elements.pageContent) {
                this.elements.pageContent.addEventListener('touchstart', (e) => {
                    this.touchStartX = e.changedTouches[0].screenX;
                    this.touchStartY = e.changedTouches[0].screenY;
                }, { passive: true });

                this.elements.pageContent.addEventListener('touchend', (e) => {
                    this.touchEndX = e.changedTouches[0].screenX;
                    this.touchEndY = e.changedTouches[0].screenY;
                    this.handleSwipeGesture();
                }, { passive: true });
            }
        }

        handleSwipeGesture() {
            const xDiff = this.touchStartX - this.touchEndX;
            const yDiff = this.touchStartY - this.touchEndY;
            
            if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > 50) {
                if (xDiff > 0) {
                    this.nextPage();
                } else {
                    this.previousPage();
                }
            }
        }

        applyScaling() {
            const bookContent = document.querySelector('.book-content');
            if (!bookContent) return;

            if (window.innerWidth >= 1024) {
                const baseWidth = 1414;
                const baseHeight = 1000;
                
                const availableWidth = window.innerWidth * 0.9; 
                const availableHeight = window.innerHeight * 0.9;

                const scale = Math.min(availableWidth / baseWidth, availableHeight / baseHeight);
                
                bookContent.style.transform = `translate(-50%, -50%) scale(${scale})`;
                bookContent.style.width = `${baseWidth}px`;
                bookContent.style.height = `${baseHeight}px`;
                
                bookContent.style.position = 'absolute';
                bookContent.style.top = '50%';
                bookContent.style.left = '50%';
            } else {
                bookContent.style.transform = 'none';
                bookContent.style.width = '100%';
                bookContent.style.height = '100%';
                bookContent.style.position = 'relative';
                bookContent.style.top = 'auto';
                bookContent.style.left = 'auto';
            }
        }

        // =====================
        // 모바일 메뉴
        // =====================
        toggleMobileMenu() {
            if (this.elements.hamburgerBtn) {
                this.elements.hamburgerBtn.classList.toggle('active');
            }
            if (this.elements.mobileMenu) {
                this.elements.mobileMenu.classList.toggle('active');
            }
        }
        
        closeMobileMenu() {
            if(this.elements.hamburgerBtn) this.elements.hamburgerBtn.classList.remove('active');
            if(this.elements.mobileMenu) this.elements.mobileMenu.classList.remove('active');
        }
        
        // =====================
        // 테마 색상
        // =====================
        applyColorTheme(pageNum) {
            let themeColor = this.colorThemes.black;
            if (pageNum >= 3 && pageNum <= 51) themeColor = this.colorThemes.red;
            else if (pageNum >= 52 && pageNum <= 54) themeColor = this.colorThemes.blue;
            else if (pageNum >= 55 && pageNum <= 93) themeColor = this.colorThemes.yellow;
            else if (pageNum >= 94 && pageNum <= 107) themeColor = this.colorThemes.green;
            
            document.documentElement.style.setProperty('--theme-color', themeColor);
            
            const r = parseInt(themeColor.slice(1, 3), 16);
            const g = parseInt(themeColor.slice(3, 5), 16);
            const b = parseInt(themeColor.slice(5, 7), 16);
            document.documentElement.style.setProperty('--theme-color-rgb', `${r}, ${g}, ${b}`);
        }

        // =====================
        // 페이지 네비게이션
        // =====================
        goToPage(pageNum) {
            if (pageNum >= 1 && pageNum <= this.totalPages) {
                this.saveReadingTime();
                this.currentPage = pageNum;
                this.loadPage(pageNum);
                this.updateUI();
                this.saveProgress();
                this.visitedPages.add(pageNum);
                this.saveToStorage('visited_pages', [...this.visitedPages]);
                this.pageStartTime = Date.now();
            }
        }
        
        previousPage() { 
            if (this.currentPage > 1) this.goToPage(this.currentPage - 1); 
        }
        
        nextPage() { 
            if (this.currentPage < this.totalPages) this.goToPage(this.currentPage + 1); 
        }

        loadInitialPage() {
            const match = window.location.hash.match(/#page=(\d+)/);
            if (match) {
                this.currentPage = parseInt(match[1]);
            } else {
                const savedPage = this.loadFromStorage('currentPage', 1);
                this.currentPage = savedPage;
            }
            this.goToPage(this.currentPage);
        }

        updateUI() {
            if (this.elements.currentPage) this.elements.currentPage.textContent = this.currentPage;
            if (this.elements.pageSelector) this.elements.pageSelector.value = this.currentPage;
            if (this.elements.prevButton) this.elements.prevButton.disabled = this.currentPage === 1;
            if (this.elements.nextButton) this.elements.nextButton.disabled = this.currentPage === this.totalPages;
            window.history.replaceState({}, '', `#page=${this.currentPage}`);
            this.applyColorTheme(this.currentPage);
            this.updateBookmarkButton();
            this.updateProgressDisplay();
            
            setTimeout(() => this.applyScaling(), 50);
        }

        // =====================
        // 페이지 로딩
        // =====================
        async loadPage(pageNum) {
            if (!this.elements.pageContent) return;
            
            this.elements.pageContent.classList.remove('special-page-container');
            const bookContent = document.querySelector('.book-content');
            if (bookContent) bookContent.classList.remove('full-image-view');

            if (pageNum === 1 || pageNum === 2 || pageNum === 108) {
                this.renderSpecialPage(pageNum);
                return;
            }

            this.elements.pageContent.innerHTML = '<div class="loading">페이지 불러오는 중...</div>';
            
            try {
                const response = await fetch(`data/page${pageNum}.json`);
                if (response.ok) {
                    const data = await response.json();
                    this.pagesData[pageNum] = data;
                    this.renderPageContent(data);
                } else {
                    throw new Error('No Data');
                }
            } catch (error) {
                this.renderPageImage(pageNum);
            }
        }

        renderPageContent(data) {
            // [수정] h1 태그에 page-title 클래스 추가
            let html = `
                <div class="header">
                    <h1 class="page-title">${data.title || ''}</h1>
                    <button class="header-button" data-link="${data.headerLink || data.mainlink || '#'}">${data.headerButton || '자세히 보기'}</button>
                </div>
                <div class="main-content">
                    <div class="main-image">
                        <a href="${data.mainlink || '#'}" target="_blank">
                            <img src="${data.mainImage || ''}" alt="${data.title || ''}">
                        </a>
                        <div class="button-container">
                            <button class="more-button" data-link="${data.mainlink || '#'}">${data.moreButtonText || '더 알아보기'}</button>
                        </div>
                    </div>
                    <div class="main-info">
                        <div class="info-group">
                            <p>${data.description || ''}</p>
                            <div class="tags">${(data.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
                            <div class="location"><span class="location-icon">📍</span> ${data.location || ''}</div>
                        </div>
            `;

            if (data.questions && data.questions.length > 0) {
                html += `<div class="questions">`;
                data.questions.forEach(q => {
                    const answers = q.answers || (Array.isArray(q.answer) ? q.answer : [q.answer]);
                    html += `
                        <div class="question">
                            <div class="question-title">${q.title || ''}</div>
                            <div class="question-answer">
                                ${answers.map(a => `<p class="question-txt">${a}</p>`).join('')}
                            </div>
                        </div>`;
                });
                html += `</div>`;
            }
            html += `</div></div>`; 

            // Cards
            if (data.sections && data.sections.length > 0) {
                html += `<div class="cards-wrapper">`;
                data.sections.forEach(section => {
                    html += `<div class="card-container"><div class="section-title">${section.title || ''}</div>`;
                    (section.cards || []).forEach(card => {
                        if (card.mapimage) {
                            html += `<div class="card"><div class="map-image"><iframe src="${card.mapimage}"></iframe></div><div class="card-content"><a href="${card.maplink || '#'}" class="more-button" target="_blank">${card.moreButtonText || '자세히 보기'}</a></div></div>`;
                        } else {
                            html += `<div class="card"><div class="card-image" style="background-image: url('${card.image || ''}')"></div><div class="card-content"><a href="${card.sectionlink || '#'}" class="more-button" target="_blank">${card.moreButtonText || '자세히 보기'}</a></div></div>`;
                        }
                    });
                    html += `</div>`;
                });
                html += `</div>`;
            }

            this.elements.pageContent.innerHTML = html;
            this.addPageEventListeners();
            
            const imgs = this.elements.pageContent.querySelectorAll('img');
            imgs.forEach(img => img.onload = () => this.applyScaling());
        }

        renderPageImage(pageNum) {
            const paddedNum = String(pageNum).padStart(3, '0');
            const html = `
                <div style="height: 100%; display: flex; justify-content: center; align-items: center;">
                    <img src="img/mpva${paddedNum}.png" style="max-width: 100%; max-height: 100%; object-fit: contain;"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div style="display: none; color: #666; text-align: center;">
                        <h3>📄 페이지 ${pageNum}</h3><p>이미지가 없습니다.</p>
                    </div>
                </div>`;
            this.elements.pageContent.innerHTML = html;
        }

        renderSpecialPage(pageNum) {
            let html = '';
            const bookContent = document.querySelector('.book-content');
            
            if (pageNum === 1) {
                html = `<div class="full-image-page"><img src="img/mpva001.png" alt="표지"></div>`;
                if (bookContent) bookContent.classList.add('full-image-view');
            } else if (pageNum === 108) {
                html = `<div class="full-image-page"><img src="img/mpva108.png" alt="마지막 페이지"></div>`;
                if (bookContent) bookContent.classList.add('full-image-view');
            } else if (pageNum === 2) {
                this.renderTocPage();
                return;
            }
            
            this.elements.pageContent.innerHTML = html;
            this.elements.pageContent.classList.add('special-page-container');
        }
        
        renderTocPage() {
            // [수정] h1 태그에 page-title 클래스 추가
            const html = `
                <div class="header">
                    <h1 class="page-title">목차</h1>
                    <button class="header-button" onclick="window.ebookViewer.goToPage(1)">표지로 이동</button>
                </div>
                <div class="toc-main-content">
                    <div class="toc-left-section">
                        <div class="toc-intro">
                            <p class="toc-description">방방곡곡 나라사랑은 대한민국의 독립, 호국, 민주 역사를 담은 보훈시설들을 소개합니다.</p>
                            <div class="toc-legend">
                                <div class="legend-item"><span class="legend-dot" style="background-color: #d95c55;"></span><span>독립 보훈시설</span></div>
                                <div class="legend-item"><span class="legend-dot" style="background-color: #009EFF;"></span><span>독립/호국 보훈시설</span></div>
                                <div class="legend-item"><span class="legend-dot" style="background-color: #FFBA0D;"></span><span>호국 보훈시설</span></div>
                                <div class="legend-item"><span class="legend-dot" style="background-color: #16A53E;"></span><span>민주 보훈시설</span></div>
                            </div>
                        </div>
                        <div class="toc-image-wrapper">
                            <img src="./img/toc_image.png" alt="방방곡곡 나라사랑" onerror="this.style.display='none';">
                        </div>
                    </div>
                    <div class="toc-right-section">
                        <div class="accordion-container">
                            ${this.createAccordionItem('독립 보훈시설', 'd95c55', '3-51', '독립')}
                            ${this.createAccordionItem('독립/호국 보훈시설', '009EFF', '52-54', '독립/호국')}
                            ${this.createAccordionItem('호국 보훈시설', 'FFBA0D', '55-93', '호국')}
                            ${this.createAccordionItem('민주 보훈시설', '16A53E', '94-107', '민주')}
                        </div>
                    </div>
                </div>`;
            this.elements.pageContent.innerHTML = html;
            this.elements.pageContent.classList.add('special-page-container');
            this.elements.pageContent.classList.add('toc-page-container');
            document.querySelector('.book-content').classList.remove('full-image-view');
            
            // 아코디언 이벤트 바인딩
            document.querySelectorAll('.accordion-header').forEach(header => {
                header.addEventListener('click', () => this.toggleAccordion(header));
            });
        }

        createAccordionItem(title, color, pages, section) {
            return `
                <div class="accordion-item">
                    <button class="accordion-header">
                        <span class="accordion-icon" style="color: #${color};">●</span>
                        <span class="accordion-title">${title}</span>
                        <span class="accordion-arrow">▼</span>
                    </button>
                    <div class="accordion-content" data-pages="${pages}" data-section="${section}"></div>
                </div>`;
        }
        
        toggleAccordion(header) {
            const item = header.parentElement;
            const content = item.querySelector('.accordion-content');
            const isActive = item.classList.contains('active');
            
            // 다른 아코디언 닫기
            document.querySelectorAll('.accordion-item.active').forEach(activeItem => {
                if (activeItem !== item) {
                    activeItem.classList.remove('active');
                }
            });
            
            item.classList.toggle('active');
            
            // 컨텐츠 로드 (처음 열 때만)
            if (!isActive && content.innerHTML === '') {
                const pages = content.dataset.pages;
                const [start, end] = pages.split('-').map(Number);
                
                // 로딩 표시
                content.innerHTML = '<div class="toc-loading">목차를 불러오는 중...</div>';
                
                // 모든 페이지의 JSON 데이터를 가져옴
                this.loadTocItems(start, end, content);
            }
        }
        
        async loadTocItems(start, end, content) {
            const items = [];
            
            for (let i = start; i <= end; i++) {
                try {
                    const response = await fetch(`data/page${i}.json`);
                    if (response.ok) {
                        const data = await response.json();
                        items.push({
                            page: i,
                            title: data.title || `페이지 ${i}`,
                            mainImage: data.mainImage || ''
                        });
                        // 캐시에 저장
                        this.pagesData[i] = data;
                    } else {
                        items.push({
                            page: i,
                            title: `페이지 ${i}`,
                            mainImage: ''
                        });
                    }
                } catch (error) {
                    items.push({
                        page: i,
                        title: `페이지 ${i}`,
                        mainImage: ''
                    });
                }
            }
            
            // 링크 생성
            let links = '';
            items.forEach(item => {
                links += `<a href="#" class="toc-link" data-page="${item.page}" data-image="${item.mainImage}">
                    <span class="toc-page-num">p.${item.page}</span>
                    <span class="toc-page-title">${item.title}</span>
                </a>`;
            });
            content.innerHTML = links;
            
            // 링크 이벤트
            content.querySelectorAll('.toc-link').forEach(link => {
                // 클릭 이벤트 - 페이지 이동
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = parseInt(link.dataset.page);
                    this.goToPage(page);
                });
                
                // 마우스 오버 이벤트 - 이미지 표시
                link.addEventListener('mouseenter', () => {
                    const imageUrl = link.dataset.image;
                    this.updateTocImage(imageUrl);
                });
            });
            
            // 첫 번째 항목의 이미지를 기본으로 표시
            if (items.length > 0 && items[0].mainImage) {
                this.updateTocImage(items[0].mainImage);
            }
        }
        
        updateTocImage(imageUrl) {
            const imageWrapper = document.querySelector('.toc-image-wrapper');
            if (!imageWrapper) return;
            
            if (imageUrl) {
                imageWrapper.innerHTML = `<img src="${imageUrl}" alt="미리보기" onerror="this.parentElement.innerHTML='<div class=\\'toc-no-image\\'>이미지 없음</div>';">`;
            } else {
                imageWrapper.innerHTML = '<div class="toc-no-image">이미지 없음</div>';
            }
        }

        addPageEventListeners() {
            // more-button 클릭 이벤트
            document.querySelectorAll('.more-button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const link = btn.getAttribute('data-link') || btn.getAttribute('href');
                    if(link && link !== '#') {
                        window.open(link, '_blank');
                    }
                });
            });
            
            // header-button 클릭 이벤트 - 2페이지(목차)로 이동
            document.querySelectorAll('.header-button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.goToPage(2);
                });
            });
        }

        // =====================
        // 북마크 기능
        // =====================
        toggleBookmark() {
            const pageNum = this.currentPage;
            const index = this.bookmarks.indexOf(pageNum);
            
            if (index > -1) {
                this.bookmarks.splice(index, 1);
                this.showNotification(`페이지 ${pageNum} 북마크가 삭제되었습니다.`);
            } else {
                this.bookmarks.push(pageNum);
                this.bookmarks.sort((a, b) => a - b);
                this.showNotification(`페이지 ${pageNum}이(가) 북마크에 추가되었습니다.`);
            }
            
            this.saveToStorage('ebook_bookmarks', this.bookmarks);
            this.updateBookmarkButton();
        }
        
        updateBookmarkButton() {
            if (!this.elements.bookmarkBtn) return;
            
            const isBookmarked = this.bookmarks.includes(this.currentPage);
            const icon = this.elements.bookmarkBtn.querySelector('.menu-icon');
            const span = this.elements.bookmarkBtn.querySelector('span:not(.menu-icon)');
            
            if (isBookmarked) {
                this.elements.bookmarkBtn.classList.add('active');
                if (span) span.textContent = '북마크 해제';
            } else {
                this.elements.bookmarkBtn.classList.remove('active');
                if (span) span.textContent = '북마크';
            }
        }
        
        openBookmarkModal() {
            if (!this.elements.bookmarkModal) return;
            
            this.renderBookmarkList();
            this.elements.bookmarkModal.classList.add('active');
        }
        
        // [수정] 북마크 목록 렌더링 (제목 표시 기능 추가)
        async renderBookmarkList() {
            if (!this.elements.bookmarkList) return;
            
            if (this.bookmarks.length === 0) {
                this.elements.bookmarkList.innerHTML = '<p style="text-align: center; color: #666;">북마크가 없습니다.</p>';
                return;
            }

            // 로딩 표시
            this.elements.bookmarkList.innerHTML = '<div class="loading" style="height:100px; font-size:14px;">북마크 정보를 불러오는 중...</div>';
            
            let html = '';
            
            // 모든 북마크 페이지에 대해 제목 데이터 확인
            for (const page of this.bookmarks) {
                let title = '';
                
                // 1. 이미 로드된 페이지 데이터가 있는지 확인
                if (this.pagesData[page] && this.pagesData[page].title) {
                    title = this.pagesData[page].title;
                } else {
                    // 2. 데이터가 없으면 JSON 파일 fetch 시도
                    try {
                        // 특수 페이지(표지, 목차 등) 처리
                        if (page === 1) title = "표지";
                        else if (page === 2) title = "목차";
                        else if (page === 108) title = "뒤표지";
                        else {
                            const response = await fetch(`data/page${page}.json`);
                            if (response.ok) {
                                const data = await response.json();
                                this.pagesData[page] = data; // 캐시에 저장
                                title = data.title;
                            } else {
                                title = '제목 없음';
                            }
                        }
                    } catch (e) {
                        title = '정보를 불러올 수 없음';
                    }
                }

                html += `
                    <div class="bookmark-item" data-page="${page}">
                        <div class="bookmark-info" style="flex:1; display:flex; flex-direction:column; gap:4px;">
                            <span class="page-num" style="font-size:12px; color:var(--theme-color); font-weight:bold;">p.${page}</span>
                            <span class="page-title" style="font-size:15px; font-weight:500; color:#333;">${title || '제목 없음'}</span>
                        </div>
                        <button class="remove-btn" data-page="${page}" style="margin-left:10px;">삭제</button>
                    </div>`;
            }
            
            this.elements.bookmarkList.innerHTML = html;
            
            // 이벤트 바인딩
            this.elements.bookmarkList.querySelectorAll('.bookmark-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('remove-btn')) {
                        const page = parseInt(item.dataset.page);
                        this.closeModals();
                        this.goToPage(page);
                    }
                });
            });
            
            this.elements.bookmarkList.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const page = parseInt(btn.dataset.page);
                    this.bookmarks = this.bookmarks.filter(p => p !== page);
                    this.saveToStorage('ebook_bookmarks', this.bookmarks);
                    this.updateBookmarkButton();
                    this.renderBookmarkList(); // 목록 다시 그리기
                });
            });
        }
        
        // =====================
        // 메모 기능
        // =====================
        openMemoDialog() {
            const existingMemo = this.memos[this.currentPage] || '';
            const memo = prompt(`페이지 ${this.currentPage} 메모:`, existingMemo);
            
            if (memo !== null) {
                if (memo.trim() === '') {
                    delete this.memos[this.currentPage];
                    this.showNotification('메모가 삭제되었습니다.');
                } else {
                    this.memos[this.currentPage] = memo;
                    this.showNotification('메모가 저장되었습니다.');
                }
                this.saveToStorage('ebook_memos', this.memos);
            }
        }

        // =====================
        // 검색 기능
        // =====================
        openSearchModal() {
            if (!this.elements.searchModal) return;
            this.elements.searchModal.classList.add('active');
            if (this.elements.searchInput) {
                this.elements.searchInput.focus();
            }
        }
        
        buildSearchIndex() {
            // 검색 인덱스 빌드 (실제로는 JSON 데이터 로드 후 빌드)
            console.log('검색 인덱스 빌드 중...');
        }
        
        performSearch() {
            const query = this.elements.searchInput?.value?.trim().toLowerCase();
            if (!query) {
                this.showNotification('검색어를 입력해주세요.');
                return;
            }
            
            if (!this.elements.searchResults) return;
            
            // 간단한 페이지 번호 검색
            const pageMatch = query.match(/^(\d+)$/);
            if (pageMatch) {
                const pageNum = parseInt(pageMatch[1]);
                if (pageNum >= 1 && pageNum <= this.totalPages) {
                    this.elements.searchResults.innerHTML = `
                        <div class="search-result-item" data-page="${pageNum}">
                            <strong>페이지 ${pageNum}</strong>
                            <p>해당 페이지로 이동합니다.</p>
                        </div>`;
                    
                    this.elements.searchResults.querySelector('.search-result-item').addEventListener('click', () => {
                        this.closeModals();
                        this.goToPage(pageNum);
                    });
                    return;
                }
            }
            
            // 저장된 페이지 데이터에서 검색
            let results = [];
            for (const [pageNum, data] of Object.entries(this.pagesData)) {
                const searchText = [
                    data.title || '',
                    data.description || '',
                    data.location || '',
                    ...(data.tags || [])
                ].join(' ').toLowerCase();
                
                if (searchText.includes(query)) {
                    results.push({
                        page: parseInt(pageNum),
                        title: data.title || `페이지 ${pageNum}`,
                        excerpt: data.description?.substring(0, 100) || ''
                    });
                }
            }
            
            if (results.length === 0) {
                this.elements.searchResults.innerHTML = '<p style="text-align: center; color: #666;">검색 결과가 없습니다.</p>';
            } else {
                let html = '';
                results.forEach(result => {
                    html += `
                        <div class="search-result-item" data-page="${result.page}">
                            <strong>${result.title}</strong>
                            <p>${result.excerpt}...</p>
                        </div>`;
                });
                this.elements.searchResults.innerHTML = html;
                
                this.elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const page = parseInt(item.dataset.page);
                        this.closeModals();
                        this.goToPage(page);
                    });
                });
            }
        }

        // =====================
        // 설정 모달
        // =====================
        openSettingsModal() {
            if (!this.elements.settingsModal) return;
            this.updateProgressDisplay();
            this.elements.settingsModal.classList.add('active');
        }

        // =====================
        // 진행 상황 추적
        // =====================
        initializeProgressTracking() {
            this.pageStartTime = Date.now();
            this.updateProgressDisplay();
        }
        
        saveReadingTime() {
            const elapsed = Math.floor((Date.now() - this.pageStartTime) / 1000);
            if (elapsed > 0 && elapsed < 3600) { // 1시간 미만만 저장
                this.readingTime[this.currentPage] = (this.readingTime[this.currentPage] || 0) + elapsed;
                this.saveToStorage('reading_time', this.readingTime);
            }
        }
        
        updateProgressDisplay() {
            const visitedCount = this.visitedPages.size;
            const progressPercent = Math.round((visitedCount / this.totalPages) * 100);
            
            let totalSeconds = 0;
            for (const time of Object.values(this.readingTime)) {
                totalSeconds += time;
            }
            const totalMinutes = Math.floor(totalSeconds / 60);
            
            if (this.elements.visitedCount) {
                this.elements.visitedCount.textContent = visitedCount;
            }
            if (this.elements.progressPercent) {
                this.elements.progressPercent.textContent = progressPercent + '%';
            }
            if (this.elements.totalReadingTime) {
                this.elements.totalReadingTime.textContent = totalMinutes + '분';
            }
        }
        
        saveProgress() {
            this.saveToStorage('currentPage', this.currentPage);
            this.saveReadingTime();
        }
        
        handleVisibilityChange() {
            if (document.hidden) {
                this.saveProgress();
            } else {
                this.pageStartTime = Date.now();
            }
        }

        // =====================
        // 다운로드 & 전체화면
        // =====================
        downloadPDF() {
            const pdfPath = './img/download.pdf'; // 같은 폴더 내 PDF 파일명

            fetch(pdfPath)
                .then(response => {
                    if (!response.ok) {
                        this.showNotification('다운로드 가능한 파일이 없습니다.');
                        return;
                    }

                    const link = document.createElement('a');
                    link.href = pdfPath;
                    link.download = 'download.pdf';
                    link.click();

                })
                .catch(() => {
                    this.showNotification('다운로드 가능한 파일이 없습니다.');
                });
        }
        
        toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    this.showNotification('전체화면 모드를 사용할 수 없습니다.');
                });
            } else {
                document.exitFullscreen();
            }
        }

        // =====================
        // 모달 관리
        // =====================
        closeModals() { 
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); 
            this.closeMobileMenu();
        }
        
        // =====================
        // 키보드 단축키
        // =====================
        handleKeyboard(e) {
            // 모달이 열려있으면 ESC로 닫기
            if (e.key === 'Escape') {
                this.closeModals();
                return;
            }
            
            // 입력 필드에서는 단축키 무시
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch(e.key) {
                case 'ArrowLeft':
                    this.previousPage();
                    break;
                case 'ArrowRight':
                    this.nextPage();
                    break;
                case 'b':
                case 'B':
                    this.toggleBookmark();
                    break;
                case 'm':
                case 'M':
                    this.openMemoDialog();
                    break;
                case 'f':
                case 'F':
                    if (e.key === 'f' && !e.ctrlKey) {
                        this.openSearchModal();
                    }
                    break;
                case 'F11':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
                case 'Home':
                    this.goToPage(1);
                    break;
                case 'End':
                    this.goToPage(this.totalPages);
                    break;
            }
        }
        
        // =====================
        // 알림
        // =====================
        showNotification(message) {
            // 기존 알림 제거
            const existing = document.querySelector('.notification');
            if (existing) existing.remove();
            
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                z-index: 9999;
                font-size: 14px;
                animation: fadeInOut 2.5s ease forwards;
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => notification.remove(), 2500);
        }
    }

    // CSS 애니메이션 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, 10px); }
            15% { opacity: 1; transform: translate(-50%, 0); }
            85% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -10px); }
        }
        
        .accordion-item { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
        .accordion-header { width: 100%; padding: 15px 20px; display: flex; align-items: center; gap: 12px; background: #f8f9fa; border: none; cursor: pointer; font-size: 16px; transition: background 0.2s; }
        .accordion-header:hover { background: #e9ecef; }
        .accordion-arrow { margin-left: auto; transition: transform 0.3s; }
        .accordion-item.active .accordion-arrow { transform: rotate(180deg); }
        .accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; padding: 0 20px; }
        .accordion-item.active .accordion-content { max-height: 300px; padding: 15px 20px; overflow-y: auto; }
        .toc-link { display: block; padding: 8px 12px; color: #333; text-decoration: none; border-radius: 4px; margin-bottom: 4px; }
        .toc-link:hover { background: rgba(var(--theme-color-rgb), 0.1); color: var(--theme-color); }
        
        .menu-item.active { background: rgba(var(--theme-color-rgb), 0.1); }
        .menu-item.active .menu-icon { filter: hue-rotate(180deg); }
        
        .toc-main-title { text-align: center; font-size: 28px; font-weight: 700; margin-bottom: 30px; color: #333; }
        .toc-page { padding: 40px; max-width: 800px; margin: 0 auto; }
    `;
    document.head.appendChild(style);

    try {
        window.ebookViewer = new EnhancedEbookViewer();
    } catch (e) { 
        console.error('전자책 뷰어 초기화 오류:', e); 
    }
});

window.goToPage = (n) => window.ebookViewer && window.ebookViewer.goToPage(n);