import React, { type CSSProperties, useState, useEffect, useRef } from 'react';
import QuickAccessButton from './quickAccessButton';
import { RcButton, RcIconButton } from '@ringcentral/juno';
import SetupButton from './setupButton';
import DragImage from '../../images/dragImage_orange.png';
import { ArrowUp2, ArrowDown2 } from '@ringcentral/juno-icon';
import { isObjectEmpty } from '../../lib/util';
import Navigator from './navigator';

type DragState = {
    startY: number;
    startTop: number;
};

const quickAccessButtonContainerStyle: CSSProperties = {
    right: '0',
    position: 'fixed',
    zIndex: '99999'
}
const menuContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
}

const navigatorBadgeStyle: CSSProperties = {
    position: 'absolute',
    top: '-4px',
    right: '20px',
    background: '#FF7A00',
    borderRadius: ' 50%',
    height: '16px',
    width: '16px',
    color: 'white',
    border: 'solid 2px white'
}

const QUICK_ACCESS_POSITION_KEY = 'rcQuickAccessButtonTop';
const QUICK_ACCESS_LEGACY_POSITION_KEY = 'rcQuickAccessButtonTransform';
const FIXED_BOTTOM_OFFSET = 100;
const VIEWPORT_THRESHOLD = 80;
const BUGGY_TOP_SENTINEL = VIEWPORT_THRESHOLD;

function App() {
    const [state, setState] = useState('quick_access');
    const [isSetup, setIsSetup] = useState<boolean | string>(false);
    const [top, setTop] = useState<number | null>(null);
    const [showNavigator, setShowNavigator] = useState(false);
    const [buttonSize, setButtonSize] = useState('large');
    const menuContainerRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<DragState | null>(null);

    useEffect(() => {
        async function checkSetup() {
            const platformInfo: Record<string, any> = await chrome.storage.local.get('platform-info');
            setIsSetup(!isObjectEmpty(platformInfo) && platformInfo['platform-info'].platformName);
        }
        async function loadButtonSize() {
            const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings?: Record<string, any> };
            const size = userSettings?.quickAccessButtonSize?.value ?? 'large';
            setButtonSize(size);
        }
        checkSetup();
        loadButtonSize();

        // Listen for storage changes to update button size in real-time
        const storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area === 'local' && changes.userSettings) {
                const newUserSettings = changes.userSettings.newValue as Record<string, any>;
                const size = newUserSettings?.quickAccessButtonSize?.value ?? 'large';
                setButtonSize(size);
            }
        };
        chrome.storage.onChanged.addListener(storageListener);

        const resizeListener = () => {
            window.requestAnimationFrame(() => {
                updateTop();
            });
        };
        window.addEventListener('resize', resizeListener);

        // Cleanup listener on unmount
        return () => {
            chrome.storage.onChanged.removeListener(storageListener);
            window.removeEventListener('resize', resizeListener);
        };
    }, []);

    useEffect(() => {
        const rafId = window.requestAnimationFrame(() => {
            updateTop();
        });
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [buttonSize, showNavigator, state, isSetup]);

    useEffect(() => {
        function onPointerMove(event: PointerEvent) {
            const dragState = dragStateRef.current;
            if (!dragState) {
                return;
            }

            const nextTop = clampTop(dragState.startTop + event.clientY - dragState.startY);
            setTop(nextTop);
        }

        function onPointerUp() {
            if (dragStateRef.current === null) {
                return;
            }

            dragStateRef.current = null;
            persistTop(top);
        }

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);

        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [top]);

    function getMenuHeight() {
        return menuContainerRef.current?.getBoundingClientRect().height ?? 0;
    }

    function getDefaultTop(menuHeight = getMenuHeight()) {
        return Math.max(VIEWPORT_THRESHOLD, window.innerHeight - FIXED_BOTTOM_OFFSET - menuHeight);
    }

    function getLegacySavedY() {
        const savedValue = localStorage.getItem(QUICK_ACCESS_LEGACY_POSITION_KEY);
        if (!savedValue) {
            return null;
        }

        const numericValue = Number(savedValue);
        if (!Number.isNaN(numericValue)) {
            return numericValue;
        }

        const matchedValue = savedValue.match(/translate\(\s*[-\d.]+px,\s*([-\d.]+)px\)/);
        return matchedValue ? Number(matchedValue[1]) : null;
    }

    function clampTop(nextTop: number) {
        const menuHeight = getMenuHeight();
        const minTop = VIEWPORT_THRESHOLD;
        const maxTop = window.innerHeight - VIEWPORT_THRESHOLD - menuHeight;

        if (maxTop < minTop) {
            return minTop;
        }

        return Math.min(Math.max(nextTop, minTop), maxTop);
    }

    function getSavedTop() {
        const storedTop = localStorage.getItem(QUICK_ACCESS_POSITION_KEY);
        const savedTop = storedTop === null ? null : Number(storedTop);
        if (savedTop !== null && !Number.isNaN(savedTop) && savedTop !== BUGGY_TOP_SENTINEL) {
            return clampTop(savedTop);
        }

        const legacySavedY = getLegacySavedY();
        if (legacySavedY === null) {
            return clampTop(getDefaultTop());
        }

        return clampTop(getDefaultTop() + legacySavedY);
    }

    function persistTop(nextTop: number | null) {
        localStorage.setItem(QUICK_ACCESS_POSITION_KEY, String(nextTop));
        localStorage.removeItem(QUICK_ACCESS_LEGACY_POSITION_KEY);
    }

    function updateTop() {
        const nextTop = top === null ? getSavedTop() : clampTop(top);
        setTop(nextTop);
        persistTop(nextTop);
    }

    function onDragStart(event: React.PointerEvent<HTMLDivElement>) {
        event.preventDefault();
        dragStateRef.current = {
            startY: event.clientY,
            startTop: top ?? getSavedTop()
        };
    }

    return (
        <div>
            <div style={{ ...quickAccessButtonContainerStyle, top: top === null ? VIEWPORT_THRESHOLD : top }}>
                <div ref={menuContainerRef} style={menuContainerStyle}>
                    {state === 'quick_access' && <QuickAccessButton
                        isSetup={isSetup}
                        setState={setState}
                        size={buttonSize}
                    />}
                    {state === 'setup' && <SetupButton
                        setIsSetup={setIsSetup}
                        setState={setState}
                    />}
                    {isSetup &&
                        <RcIconButton
                            size='small'
                            symbol={showNavigator ? ArrowDown2 : ArrowUp2}
                            onClick={() => { setShowNavigator(!showNavigator) }}
                            style={navigatorBadgeStyle}
                        />}
                    {showNavigator &&
                        <Navigator size={buttonSize} />
                    }
                    <div
                        style={{ cursor: 'grab', display: 'inherit' }}
                        onPointerDown={onDragStart}
                    >
                        <RcButton
                            className="rc-huddle-menu-handle"
                            variant="plain"
                            size='large'
                            style={{ padding: '0px' }}
                        >
                            <img style={{ pointerEvents: 'none', width: '20px', height: '20px' }} src={DragImage} />
                        </RcButton>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App;
