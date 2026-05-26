const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('web-landing-page/index.html', 'utf8');
const js = fs.readFileSync('web-landing-page/main.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost" });
const window = dom.window;
const document = window.document;

// Mock fetch
window.fetch = () => Promise.resolve({
    ok: true,
    text: () => Promise.resolve('<h1>Test</h1><div class="airlock" style="background-image:url(test.jpg)"></div>')
});

// Mock IntersectionObserver
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };

// Mock matchMedia (jsdom has no layout engine, so this API is absent)
window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
});

const script = document.createElement('script');
script.textContent = js;
document.body.appendChild(script);

setTimeout(() => {
    try {
        const btnComments = document.getElementById('btn-comments');
        if (!btnComments) throw new Error("btnComments not found");
        btnComments.click();
        const drawer = document.getElementById('drawer-comments');
        console.log("Drawer open?", drawer.classList.contains('open'));
        const pageWrapper = document.getElementById('page-wrapper');
        console.log("Wrapper open?", pageWrapper.classList.contains('drawer-open-fullscreen'));
    } catch (e) {
        console.error(e);
    }
}, 500);

