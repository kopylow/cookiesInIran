document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const manuscriptContainer = document.getElementById('manuscript-container');
    const mainContent = document.getElementById('main-content');
    const chapterIndex = document.getElementById('chapter-index');
    const langToggle = document.getElementById('lang-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const topBar = document.getElementById('top-bar');
    
    // Drawers
    const btnBook = document.getElementById('btn-book');
    const btnComments = document.getElementById('btn-comments');
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
            manuscriptContainer.innerHTML = html;
            
            // Post-load setup
            updateLangDirection(lang);
            buildChapterIndex();
            setupIntersectionObserver();
            setupDiscussButtons();
        } catch (error) {
            manuscriptContainer.innerHTML = `<div class="error">Error loading manuscript: ${error.message}</div>`;
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
            // Assign IDs to headers for linking and observing
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
                const chapterId = e.target.dataset.chapter;
                // Here you would normally update the comments drawer content 
                // to load the specific thread for `chapterId`.
                // For now, we just open the drawer.
                openCommentsDrawer();
            });
        });
    }

    // --- 2. Tense-Driven UI State Machine (Intersection Observer) ---

    function setupIntersectionObserver() {
        const headers = manuscriptContainer.querySelectorAll('h1');
        
        const observerOptions = {
            root: null,
            rootMargin: '-20% 0px -50% 0px', // Trigger when header is in the upper half of the viewport
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const tense = entry.target.dataset.tense || 'past';
                    document.body.dataset.state = tense;
                }
            });
        }, observerOptions);

        headers.forEach(h1 => observer.observe(h1));
    }

    // --- 3. UI Interactions ---

    // Theme Toggle
    themeToggle.addEventListener('click', () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.dataset.theme = currentTheme;
    });

    // Language Toggle
    langToggle.addEventListener('change', (e) => {
        currentLang = e.target.value;
        loadManuscript(currentLang);
    });

    // Smart Top Bar Hide/Show on Scroll
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (window.scrollY > lastScrollY && window.scrollY > 100) {
            topBar.classList.add('hidden');
        } else {
            topBar.classList.remove('hidden');
        }
        lastScrollY = window.scrollY;
    }, { passive: true });

    // Drawers
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

    closeBtns.forEach(btn => btn.addEventListener('click', closeAllDrawers));
    drawerOverlay.addEventListener('click', closeAllDrawers);

    // --- Initialize ---
    loadManuscript(currentLang);
});