class CustomC2DWidget {
    constructor() {
        this._root = null;
        this._callBtn = null;
        this._smsBtn = null;
        this._scheduleBtn = null;
        this._events = new Map();
        this._widgetHovering = false;
        this._currentTarget = undefined;
        this._lastContext = undefined;
        this._hideTimer = null;
        this._injectDOM();
    }

    on(eventName, handler) {
        if (!this._events.has(eventName)) this._events.set(eventName, []);
        this._events.get(eventName).push(handler);
    }

    emit(eventName, ...args) {
        const handlers = this._events.get(eventName) || [];
        handlers.forEach(h => {
            try { h(...args); } catch (e) { /* ignore */ }
        });
    }

    _getFullNumber(context) {
        const ctx = context || this._lastContext;
        if (!ctx) return '';
        return ctx.ext ? `${ctx.phoneNumber}*${ctx.ext}` : ctx.phoneNumber;
    }

    setTarget(item) {
        // Cancel any previous pending hide
        if (this._hideTimer) {
            clearTimeout(this._hideTimer);
            this._hideTimer = null;
        }
        this._currentTarget = item;
        if (!item) {
            // If user is currently hovering the widget, do not arm a hide timer
            if (this._widgetHovering) {
                return;
            }
            // Delay hiding to allow mouse to travel from number to widget
            this._hideTimer = setTimeout(() => {
                if (!this._widgetHovering) {
                    this._root.style.display = 'none';
                }
            }, 800);
            return;
        }
        this._lastContext = item.context || this._lastContext;
        this._root.style.display = 'flex';
        const rect = item.rect;
        // place to the right, vertically centered
        const left = Math.floor(rect.right - 10); // overlap more to ensure pointer enters widget
        const top = Math.floor(rect.top + (rect.startLineHeight || rect.height) / 2 - this._root.offsetHeight / 2);
        this._root.style.transform = `translate(${left}px, ${top}px)`;
    }

    _injectDOM() {
        if (this._root) return;
        const root = document.createElement('div');
        root.style.cssText = 'position:fixed;left:0;top:0;display:none;z-index:2147483646;background:#fff;border:1px solid rgba(0,0,0,0.12);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.16);padding:4px 5px;gap:4px;align-items:center;';
        root.style.position = 'fixed';
        root.style.pointerEvents = 'auto';
        // Helper: attempt multiple icon locations (public/c2d and public/images/c2d)
        const getIconUrl = (name) => chrome.runtime.getURL(`c2d/${name}.svg`);
        const BRAND_BLUE = '#0A77C4';
        const LIGHT_BLUE = '#3BA2E8';

        const mkBtn = (title, iconKey) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.title = title;
            b.textContent = '';
            b.style.cssText = 'cursor:pointer;border:none;background:#fff;padding:0;border-radius:8px;font-size:12px;line-height:12px;display:flex;align-items:center;justify-content:center;width:36px;height:36px;color:#0A77C4;transition:background .12s, box-shadow .12s, color .12s;';
            b.addEventListener('mouseenter', () => { this._widgetHovering = true; if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; } b.style.background = '#F7FBFF'; b.style.boxShadow = '0 2px 6px rgba(10,119,196,0.15)'; b.style.color = LIGHT_BLUE; });
            b.addEventListener('mouseleave', () => { /* keep hovering true while inside widget; root will manage hide */ b.style.background = '#fff'; b.style.boxShadow = 'none'; b.style.color = BRAND_BLUE; });
            // Load SVG inline and force brand blue color
            const url = getIconUrl(iconKey);
            const applyBlue = (el) => {
                const svgEl = el;
                try {
                    svgEl.setAttribute('width', '20');
                    svgEl.setAttribute('height', '20');
                    svgEl.style.display = 'block';
                    // Make icon inherit button color so hover can tint
                    svgEl.setAttribute('fill', 'currentColor');
                    const toBlue = svgEl.querySelectorAll('[fill]');
                    toBlue.forEach(n => { if (n.getAttribute('fill') !== 'none') { n.setAttribute('fill', 'currentColor'); } });
                    const stroked = svgEl.querySelectorAll('[stroke]');
                    stroked.forEach(n => { if (n.getAttribute('stroke') !== 'none') { n.setAttribute('stroke', 'currentColor'); } });
                } catch (e) { /* ignore */ }
                return svgEl;
            };
            const insertSvg = (text) => {
                const span = document.createElement('span');
                span.innerHTML = text;
                const svg = span.querySelector('svg');
                if (svg) {
                    b.appendChild(applyBlue(svg));
                }
            };
            fetch(url).then(r => r.text()).then(insertSvg).catch(() => { /* ignore if icon missing */ });
            return b;
        };
        // RC logo badge (visual only)
        const logo = document.createElement('div');
        logo.setAttribute('aria-label', 'RingCentral');
        // Remove outer border; show the image on a subtle white tile
        logo.style.cssText = 'width:36px;height:36px;border:0;border-radius:10px;display:flex;align-items:center;justify-content:center;background:transparent;';
        // Inner white tile to create inset look
        const logoTile = document.createElement('div');
        logoTile.style.cssText = 'width:32px;height:32px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;';
        // Use RC.png image (from public/c2d or public/images/c2d)
        (() => {
            const img = document.createElement('img');
            img.alt = 'RingCentral';
            img.style.cssText = 'width:22px;height:22px;display:block;';
            img.src = chrome.runtime.getURL('c2d/RC.png');
            logoTile.appendChild(img);
            logo.appendChild(logoTile);
        })();

        // Left arrow pointer to anchor on number
        const arrow = document.createElement('div');
        arrow.style.cssText = 'position:absolute;left:-6px;top:50%;transform:translateY(-50%) rotate(45deg);width:12px;height:12px;background:#fff;border-left:1px solid rgba(0,0,0,0.12);border-top:1px solid rgba(0,0,0,0.12);box-shadow:-3px -3px 6px rgba(0,0,0,0.04)';

        this._callBtn = mkBtn('Call with RingCentral', 'call');
        this._smsBtn = mkBtn('SMS with RingCentral', 'sms');
        this._scheduleBtn = mkBtn('Call later', 'calendar');
        const onPress = (handler) => (e) => {
            // Fire immediately before any hover-out occurs
            this._widgetHovering = true;
            if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
            e.stopPropagation();
            e.preventDefault();
            handler();
        };
        this._scheduleBtn.addEventListener('pointerdown', onPress(() => this.emit('schedule', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
        this._callBtn.addEventListener('pointerdown', onPress(() => this.emit('call', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
        this._smsBtn.addEventListener('pointerdown', onPress(() => this.emit('text', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
        // Keep click as a fallback for browsers that might not deliver pointerdown
        this._scheduleBtn.addEventListener('click', onPress(() => this.emit('schedule', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
        this._callBtn.addEventListener('click', onPress(() => this.emit('call', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
        this._smsBtn.addEventListener('click', onPress(() => this.emit('text', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
        root.appendChild(logo);
        // Vertical divider like reference
        const divider = document.createElement('div');
        divider.style.cssText = 'width:1px;height:24px;background:#E3E7EB;border-radius:1px;';
        root.appendChild(this._callBtn);
        root.insertBefore(divider, this._callBtn);
        root.appendChild(this._smsBtn);
        root.appendChild(this._scheduleBtn);
        root.appendChild(arrow);
        root.addEventListener('mouseenter', () => { this._widgetHovering = true; if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; } });
        root.addEventListener('mouseleave', () => { this._widgetHovering = false; if (this._hideTimer) { clearTimeout(this._hideTimer); } this._hideTimer = setTimeout(() => { if (!this._widgetHovering && !this._currentTarget) { this._root.style.display = 'none'; } }, 250); });
        // Prevent page click handlers from firing and causing hover-out side effects
        root.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this._widgetHovering = true; if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; } });
        root.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });
        document.body.appendChild(root);
        this._root = root;
    }
}

export default CustomC2DWidget;


