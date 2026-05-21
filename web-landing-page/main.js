if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const manuscriptContainer = document.getElementById('manuscript-container');
    const pageWrapper = document.getElementById('page-wrapper');
    const langToggle = document.getElementById('lang-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const topBar = document.getElementById('top-bar');
    const bottomBar = document.getElementById('bottom-bar');
    
    // Drawers
    const bookTitle = document.getElementById('book-title');
    const btnComments = document.getElementById('btn-comments');
    const btnCommentsMobile = document.getElementById('btn-comments-mobile');
    const btnSupport = document.getElementById('btn-support');
    const btnSupportMobile = document.getElementById('btn-support-mobile');
    const btnContact = document.getElementById('btn-contact');
    const btnContactMobile = document.getElementById('btn-contact-mobile');
    const drawerBook = document.getElementById('drawer-book');
    const drawerComments = document.getElementById('drawer-comments');
    const drawerSupport = document.getElementById('drawer-support');
    const drawerContact = document.getElementById('drawer-contact');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const closeBtns = document.querySelectorAll('.close-drawer');

    // State
    const supportedLangs = ['de', 'en', 'ru'];
    const browserLang = (navigator.language || navigator.userLanguage || 'de').slice(0, 2).toLowerCase();
    let currentLang = supportedLangs.includes(browserLang) ? browserLang : 'de';
    
    // Set initial toggle value
    langToggle.value = currentLang;

    let currentTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.body.dataset.theme = currentTheme;

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        currentTheme = event.matches ? 'dark' : 'light';
        document.body.dataset.theme = currentTheme;
    });

    const i18n = {
        de: { title: "Kekse im Iran", author: "Anton Kopylow", book: "Buch", comments: "Kommentare", support: "Support", contact: "Kontakt", index: "Inhaltsverzeichnis" },
        en: { title: "Cookies in Iran", author: "Anton Kopylow", book: "Book", comments: "Comments", support: "Support", contact: "Contact", index: "Index" },
        ru: { title: "Печенье в Иране", author: "Антон Копылов", book: "Книга", comments: "Комментарии", support: "Поддержка", contact: "Контакты", index: "Оглавление" },
        fa: { title: "کلوچه‌ها در ایران", author: "آنتون کپیلوف", book: "کتاب", comments: "نظرات", support: "پشتیبانی", contact: "تماس", index: "فهرست" }
    };

    function updateUI(lang) {
        const t = i18n[lang];
        if (!t) return;
        document.title = t.title;
        document.querySelector('.hero-content h1').textContent = t.title;
        document.querySelector('.hero-content .subtitle').textContent = t.author;
        
        bookTitle.textContent = t.title;
        btnComments.textContent = t.comments;
        btnSupport.textContent = t.support;
        btnContact.textContent = t.contact;
        
        if (btnCommentsMobile) btnCommentsMobile.textContent = t.comments;
        if (btnSupportMobile) btnSupportMobile.textContent = t.support;
        if (btnContactMobile) btnContactMobile.textContent = t.contact;
        
        drawerComments.querySelector('.drawer-header h2').textContent = t.comments;
        drawerSupport.querySelector('.drawer-header h2').textContent = t.support;
        drawerContact.querySelector('.drawer-header h2').textContent = t.contact;
    }

    // --- 1. Dynamic Content Loading ---
    
    async function loadManuscript(lang) {
        manuscriptContainer.innerHTML = '<div class="loading">Loading manuscript...</div>';
        try {
            const response = await fetch(`manuscript_${lang}.html`);
            if (!response.ok) throw new Error('Failed to load manuscript');
            const html = await response.text();
            
            // Simple preloading
            const imageUrls = [...html.matchAll(/url\(['"]?(.*?)['"]?\)/g)].map(m => m[1]);
            preloadImages(imageUrls);

            manuscriptContainer.innerHTML = html;

            // Post-load setup
            updateLangDirection(lang);
            updateUI(lang);
            buildChapterIndex();
            setupDiscussButtons();
            setupPredictivePreload();
            setupAirlockInteractions();
            window.scrollTo(0, 0);
        } catch (error) {
            manuscriptContainer.innerHTML = `<div class="error">Error loading manuscript: ${error.message}</div>`;
        }
    }

    function preloadImages(urls) {
        urls.forEach(url => {
            const img = new Image();
            img.src = url;
        });
    }

    function setupPredictivePreload() {
        const chapters = manuscriptContainer.querySelectorAll('.chapter');
        const airlocks = manuscriptContainer.querySelectorAll('.airlock');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const currentChapter = entry.target;
                    const allChapters = Array.from(chapters);
                    const index = allChapters.indexOf(currentChapter);

                    // Preload the next airlock's image (index + 1)
                    if (index >= 0 && airlocks[index]) {
                        const nextAirlock = airlocks[index];
                        const isMobile = window.matchMedia('(max-width: 768px)').matches;
                        const src = isMobile
                            ? (nextAirlock.dataset.imgMobile || nextAirlock.dataset.img)
                            : (nextAirlock.dataset.img || nextAirlock.dataset.imgMobile);
                        if (src) {
                            preloadNextImage(src);
                        }
                    }
                }
            });
        }, { threshold: 0.1 });

        chapters.forEach(ch => observer.observe(ch));
    }

    function preloadNextImage(url) {
        const img = new Image();
        img.src = url;
        if (img.decode) {
            img.decode().catch(() => {});
        }
    }

    function updateLangDirection(lang) {
        const htmlDoc = document.documentElement;
        htmlDoc.lang = lang;
        if (lang === 'fa') {
            htmlDoc.dir = 'rtl';
        } else {
            htmlDoc.dir = 'ltr';
        }
    }

    let scrollHandler = null;
    function setupScrollTracking() {
        const chapters = manuscriptContainer.querySelectorAll('.chapter');
        const segments = document.querySelectorAll('.progress-segment');
        
        if (!chapters.length || !segments.length) return;

        if (scrollHandler) {
            window.removeEventListener('scroll', scrollHandler);
        }

        scrollHandler = () => {
            let currentChapterIndex = 0;
            let currentTense = 'past';
            const triggerPoint = window.innerHeight * 0.5;

            chapters.forEach((chapter, index) => {
                const rect = chapter.getBoundingClientRect();
                if (rect.top < triggerPoint) {
                    currentChapterIndex = index;
                    currentTense = chapter.dataset.tense || 'past';
                }
            });

            document.body.dataset.state = currentTense;

            segments.forEach((seg, idx) => {
                if (idx < currentChapterIndex) {
                    seg.classList.add('passed');
                    seg.classList.remove('active');
                } else if (idx === currentChapterIndex) {
                    seg.classList.add('active');
                    seg.classList.remove('passed');
                } else {
                    seg.classList.remove('passed', 'active');
                }
            });
        };

        window.addEventListener('scroll', scrollHandler, { passive: true });
        scrollHandler();
    }

    function buildChapterIndex() {
        const progressIndicator = document.getElementById('progress-indicator');
        if (progressIndicator) progressIndicator.innerHTML = '';

        const headers = manuscriptContainer.querySelectorAll('h1');
        headers.forEach((h1, index) => {
            h1.id = `chapter-${index}`;
            h1.dataset.index = index;

            if (progressIndicator) {
                const segment = document.createElement('div');
                segment.className = 'progress-segment';
                segment.dataset.target = `chapter-${index}`;
                segment.dataset.title = h1.textContent;
                
                segment.addEventListener('click', () => {
                    const target = document.getElementById(`chapter-${index}`);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                });
                
                progressIndicator.appendChild(segment);
            }
        });

        // Add touch scrubbing support for mobile tooltips
        if (progressIndicator) {
            let lastTouchedSegment = null;

            const handleTouch = (e) => {
                const touch = e.touches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const segment = target ? target.closest('.progress-segment') : null;
                
                // Remove active state from all
                document.querySelectorAll('.progress-segment').forEach(s => s.classList.remove('touch-active'));
                
                if (segment) {
                    segment.classList.add('touch-active');
                    lastTouchedSegment = segment;
                    if (e.cancelable) e.preventDefault(); // Prevent scrolling the whole page while scrubbing the bar
                } else {
                    lastTouchedSegment = null;
                }
            };

            progressIndicator.addEventListener('touchstart', handleTouch, { passive: false });
            progressIndicator.addEventListener('touchmove', handleTouch, { passive: false });
            
            progressIndicator.addEventListener('touchend', (e) => {
                if (lastTouchedSegment) {
                    const targetId = lastTouchedSegment.dataset.target;
                    const targetElement = document.getElementById(targetId);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }
                document.querySelectorAll('.progress-segment').forEach(s => s.classList.remove('touch-active'));
                lastTouchedSegment = null;
            });
        }

        setupScrollTracking();
    }
    
    function setupDiscussButtons() {
        const buttons = manuscriptContainer.querySelectorAll('.discuss-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                openCommentsDrawer();
            });
        });
    }

    function setupAirlockInteractions() {
        const airlocks = manuscriptContainer.querySelectorAll('.airlock');
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = lightbox.querySelector('img');
        const lightboxClose = document.getElementById('lightbox-close');

        airlocks.forEach(airlock => {
            airlock.addEventListener('click', () => {
                const isMobile = window.matchMedia('(max-width: 768px)').matches;
                const src = isMobile
                    ? (airlock.dataset.imgMobile || airlock.dataset.img)
                    : (airlock.dataset.img || airlock.dataset.imgMobile);
                if (src) {
                    lightboxImg.src = src;
                    lightbox.classList.add('visible');
                    lightbox.setAttribute('aria-hidden', 'false');
                    document.body.style.overflow = 'hidden'; // Prevent scrolling
                }
            });
        });

        const closeLightbox = () => {
            lightbox.classList.remove('visible');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        };

        lightbox.addEventListener('click', closeLightbox);
        lightboxClose.addEventListener('click', closeLightbox);
    }

    // --- 3. UI Interactions ---

    themeToggle.addEventListener('click', () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.dataset.theme = currentTheme;
    });

    langToggle.addEventListener('change', (e) => {
        currentLang = e.target.value;
        loadManuscript(currentLang);
    });
// Smart Top Bar Hide/Show on Scroll
let lastScrollY = window.scrollY;

// Initial check: hide if at top
if (window.scrollY < 50) {
    topBar.classList.add('hidden');
    if (bottomBar) bottomBar.classList.add('hidden');
}

window.addEventListener('scroll', () => {
    // If a drawer is open, don't hide the top bar
    if (pageWrapper.classList.contains('drawer-open-book') || 
        pageWrapper.classList.contains('drawer-open-fullscreen')) {
        return;
    }

    const currentScrollY = window.scrollY;

    if (currentScrollY < 50) {
        // Stay hidden at the very top (Hero section)
        topBar.classList.add('hidden');
        if (bottomBar) bottomBar.classList.add('hidden');
    } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Hiding when scrolling down
        topBar.classList.add('hidden');
        if (bottomBar) bottomBar.classList.add('hidden');
    } else {
        // Showing when scrolling up
        topBar.classList.remove('hidden');
        if (bottomBar) bottomBar.classList.remove('hidden');
    }
    lastScrollY = currentScrollY;
}, { passive: true });

    function closeAllDrawers() {
        drawerComments.classList.remove('open');
        drawerSupport.classList.remove('open');
        drawerContact.classList.remove('open');
        drawerOverlay.classList.remove('visible');
        pageWrapper.classList.remove('drawer-open-fullscreen');
    }

    function openCommentsDrawer() {
        closeAllDrawers();
        topBar.classList.remove('hidden');
        drawerComments.classList.add('open');
        drawerOverlay.classList.add('visible');
        pageWrapper.classList.add('drawer-open-fullscreen');
    }

    function openSupportDrawer() {
        closeAllDrawers();
        topBar.classList.remove('hidden');
        drawerSupport.classList.add('open');
        drawerOverlay.classList.add('visible');
        pageWrapper.classList.add('drawer-open-fullscreen');
    }

    function openContactDrawer() {
        closeAllDrawers();
        topBar.classList.remove('hidden');
        drawerContact.classList.add('open');
        drawerOverlay.classList.add('visible');
        pageWrapper.classList.add('drawer-open-fullscreen');
    }

    btnComments.addEventListener('click', openCommentsDrawer);
    btnSupport.addEventListener('click', openSupportDrawer);
    btnContact.addEventListener('click', openContactDrawer);

    if (btnCommentsMobile) btnCommentsMobile.addEventListener('click', openCommentsDrawer);
    if (btnSupportMobile) btnSupportMobile.addEventListener('click', openSupportDrawer);
    if (btnContactMobile) btnContactMobile.addEventListener('click', openContactDrawer);

    closeBtns.forEach(btn => btn.addEventListener('click', closeAllDrawers));
    drawerOverlay.addEventListener('click', closeAllDrawers);

    // --- Pinch-to-zoom font scaling ---
    // Two-finger pinch scales the document root font-size instead of triggering
    // browser pixel-zoom. All rem-based text/spacing rescales proportionally.
    const MIN_ROOT_FONT_PX = 8;
    const MAX_ROOT_FONT_PX = 32;
    const FONT_SIZE_STORAGE_KEY = 'rootFontSize';

    const savedRootFontPx = parseFloat(localStorage.getItem(FONT_SIZE_STORAGE_KEY));
    if (savedRootFontPx >= MIN_ROOT_FONT_PX && savedRootFontPx <= MAX_ROOT_FONT_PX) {
        document.documentElement.style.fontSize = savedRootFontPx + 'px';
    }

    let pinchStartDistance = null;
    let pinchStartFontPx = null;

    const pinchDistance = (touches) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };

    document.addEventListener('touchstart', (e) => {
        const lightbox = document.getElementById('lightbox');
        if (lightbox && lightbox.classList.contains('visible')) return;
        if (e.touches.length === 2) {
            pinchStartDistance = pinchDistance(e.touches);
            pinchStartFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (pinchStartDistance === null || e.touches.length !== 2) return;
        const scale = pinchDistance(e.touches) / pinchStartDistance;
        const clamped = Math.max(MIN_ROOT_FONT_PX, Math.min(MAX_ROOT_FONT_PX, pinchStartFontPx * scale));
        document.documentElement.style.fontSize = clamped + 'px';
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    const endPinch = () => {
        if (pinchStartDistance !== null) {
            const currentPx = parseFloat(document.documentElement.style.fontSize);
            if (currentPx) localStorage.setItem(FONT_SIZE_STORAGE_KEY, currentPx);
        }
        pinchStartDistance = null;
        pinchStartFontPx = null;
    };
    document.addEventListener('touchend', endPinch);
    document.addEventListener('touchcancel', endPinch);

    // --- Initialize ---
    window.scrollTo(0, 0);
    loadManuscript(currentLang);
});