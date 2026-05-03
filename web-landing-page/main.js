document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const manuscriptContainer = document.getElementById('manuscript-container');
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

    // Chapters that represent high-tension "Präsens" (Bureaucratic/Crisis)
    // We match by index or text snippet since chapter titles might change per language
    const praesensChaptersIndices = [1, 4, 5, 6]; 

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
                // Smooth scroll via CSS or JS is optional, native anchor link works fine
            });

            chapterIndex.appendChild(link);
        });
    }

    // --- 2. Tense-Driven UI State Machine (Intersection Observer) ---

    function setupIntersectionObserver() {
        const headers = manuscriptContainer.querySelectorAll('h1');
        
        const observerOptions = {
            root: null,
            rootMargin: '-20% 0px -80% 0px', // Trigger when header hits top 20% of viewport
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = parseInt(entry.target.dataset.index, 10);
                    const isPraesens = praesensChaptersIndices.includes(index);
                    
                    if (isPraesens) {
                        document.body.dataset.state = 'praesens';
                    } else {
                        document.body.dataset.state = 'praeteritum';
                    }
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
    }

    btnBook.addEventListener('click', () => {
        drawerBook.classList.add('open');
        drawerOverlay.classList.add('visible');
    });

    btnComments.addEventListener('click', () => {
        drawerComments.classList.add('open');
        drawerOverlay.classList.add('visible');
    });

    closeBtns.forEach(btn => btn.addEventListener('click', closeAllDrawers));
    drawerOverlay.addEventListener('click', closeAllDrawers);

    // --- Initialize ---
    loadManuscript(currentLang);
});