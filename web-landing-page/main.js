document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const manuscriptContainer = document.getElementById('manuscript-container');
    const mainContent = document.getElementById('main-content');
    const chapterIndex = document.getElementById('chapter-index');
    const langToggle = document.getElementById('lang-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const topBar = document.getElementById('top-bar');
    const bottomBar = document.getElementById('bottom-bar');
    
    // Drawers
    const btnBook = document.getElementById('btn-book');
    const btnComments = document.getElementById('btn-comments');
    const btnCommentsMobile = document.getElementById('btn-comments-mobile');
    const drawerBook = document.getElementById('drawer-book');
    const drawerComments = document.getElementById('drawer-comments');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const closeBtns = document.querySelectorAll('.close-drawer');

    // State
    let currentLang = 'de';
    let currentTheme = 'light';

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
            buildChapterIndex();
            setupDiscussButtons();
            setupPredictivePreload();
            setupAirlockInteractions();
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
                        // The index matches because the first chapter has no airlock before it.
                        // So Chapter 0 (Index 0) should trigger preload for Airlock 0 (which is before Ch 1)
                        const nextAirlock = airlocks[index];
                        const style = nextAirlock.getAttribute('style') || '';
                        const match = style.match(/url\(['"]?(.*?)['"]?\)/);
                        if (match && match[1]) {
                            preloadNextImage(match[1]);
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

    function buildChapterIndex() {
        chapterIndex.innerHTML = '';
        const headers = manuscriptContainer.querySelectorAll('h1');
        headers.forEach((h1, index) => {
            h1.id = `chapter-${index}`;
            h1.dataset.index = index;

            const link = document.createElement('a');
            link.href = `#chapter-${index}`;
            link.className = 'chapter-link';
            link.textContent = h1.textContent;
            
            link.addEventListener('click', (e) => {
                closeAllDrawers();
            });

            chapterIndex.appendChild(link);
        });
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
                const style = airlock.getAttribute('style') || '';
                const match = style.match(/url\(['"]?(.*?)['"]?\)/);
                if (match && match[1]) {
                    lightboxImg.src = match[1];
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
        drawerBook.classList.remove('open');
        drawerComments.classList.remove('open');
        drawerOverlay.classList.remove('visible');
        mainContent.classList.remove('drawer-open-book');
        mainContent.classList.remove('drawer-open-comments');
    }

    function openCommentsDrawer() {
        closeAllDrawers();
        drawerComments.classList.add('open');
        drawerOverlay.classList.add('visible');
        mainContent.classList.add('drawer-open-comments');
    }

    btnBook.addEventListener('click', () => {
        closeAllDrawers();
        drawerBook.classList.add('open');
        drawerOverlay.classList.add('visible');
        mainContent.classList.add('drawer-open-book');
    });

    btnComments.addEventListener('click', openCommentsDrawer);
    if (btnCommentsMobile) {
        btnCommentsMobile.addEventListener('click', openCommentsDrawer);
    }

    closeBtns.forEach(btn => btn.addEventListener('click', closeAllDrawers));
    drawerOverlay.addEventListener('click', closeAllDrawers);

    // --- Initialize ---
    window.scrollTo(0, 0);
    loadManuscript(currentLang);
});