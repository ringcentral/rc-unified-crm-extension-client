import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import App from '../../src/components/embedded/index.jsx';
import Navigator from '../../src/components/embedded/navigator.jsx';
import QuickAccessButton from '../../src/components/embedded/quickAccessButton.jsx';
import SetupButton from '../../src/components/embedded/setupButton.jsx';
import { sendMessageToExtension } from '../../src/lib/sendMessage.js';
import { trackMissingServiceWorker } from '../../src/lib/analytics.js';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('@ringcentral/juno', async () => {
  const React = await vi.importActual('react');
  const buttonFor = (displayName) => function MockButton({
    children,
    onClick,
    onPointerEnter,
    onPointerLeave,
    onPointerDown,
    style,
    size,
    variant,
    symbol,
    className,
  }) {
    return React.createElement(
      'button',
      {
        type: 'button',
        className,
        'data-component': displayName,
        'data-size': size,
        'data-variant': variant,
        'data-symbol': typeof symbol === 'string' ? symbol : symbol?.name ?? '',
        onClick,
        onPointerEnter,
        onPointerLeave,
        onPointerDown,
        style,
      },
      children,
    );
  };
  return {
    RcButton: buttonFor('RcButton'),
    RcIconButton: buttonFor('RcIconButton'),
    RcIcon: ({ symbol }) => React.createElement('span', { 'data-icon': symbol?.name ?? symbol ?? '' }),
  };
});

vi.mock('@ringcentral/juno-icon', () => ({
  ArrowUp2: 'ArrowUp2',
  ArrowDown2: 'ArrowDown2',
  Feedback: 'Feedback',
  Logout: 'Logout',
  People: 'People',
  RcCloudContact: 'RcCloudContact',
  Settings: 'Settings',
}));

vi.mock('../../src/lib/sendMessage.js', () => ({
  sendMessageToExtension: vi.fn(),
}));

vi.mock('../../src/lib/analytics.js', () => ({
  trackMissingServiceWorker: vi.fn(),
}));

vi.mock('../../src/lib/util.js', () => ({
  isObjectEmpty: vi.fn((obj) => Object.keys(obj || {}).length === 0),
}));

vi.mock('../../src/i18n/index.js', () => ({
  t: vi.fn((key) => key),
}));

async function renderIntoContainer(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    ReactDOM.render(element, container);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

describe('embedded components', () => {
  let container;

  beforeEach(() => {
    localStorage.clear();
    globalThis.alert = vi.fn();
    vi.mocked(sendMessageToExtension).mockReset();
    vi.mocked(trackMissingServiceWorker).mockReset();
  });

  afterEach(() => {
    if (container) {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
      container = null;
    }
  });

  it('navigates from the embedded navigator buttons', async () => {
    container = await renderIntoContainer(<Navigator size="medium" />);

    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(3);
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();

    expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(1, {
      type: 'openPopupWindow',
      navigationPath: '/settings',
    });
    expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(2, {
      type: 'openPopupWindow',
      navigationPath: '/support',
    });
    expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(3, {
      type: 'openPopupWindow',
      navigationPath: '/settings',
    });
  });

  it('opens the popup from quick access and reports missing service worker', async () => {
    vi.mocked(sendMessageToExtension).mockImplementation((_message, callback) => callback(undefined));
    const setState = vi.fn();
    container = await renderIntoContainer(
      <QuickAccessButton isSetup setState={setState} size="small" />,
    );

    const button = container.querySelector('button');
    await act(async () => {
      button.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    button.click();
    await act(async () => {
      button.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });

    expect(sendMessageToExtension).toHaveBeenCalledWith({ type: 'openPopupWindow' }, expect.any(Function));
    expect(trackMissingServiceWorker).toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('It seems that RingCentral App Connect service worker has just crashed.');
    expect(setState).not.toHaveBeenCalled();

    ReactDOM.unmountComponentAtNode(container);
    container.innerHTML = '';
    await act(async () => {
      ReactDOM.render(<QuickAccessButton isSetup={false} setState={setState} />, container);
    });
    container.querySelector('button').dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    expect(setState).toHaveBeenCalledWith('setup');
  });

  it('opens setup flow and returns to quick access on pointer leave', async () => {
    const setIsSetup = vi.fn();
    const setState = vi.fn();
    container = await renderIntoContainer(
      <SetupButton setIsSetup={setIsSetup} setState={setState} />,
    );

    const button = container.querySelector('button');
    button.click();
    button.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));

    expect(setIsSetup).toHaveBeenCalledWith(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'openPopupWindow' });
    expect(setState).toHaveBeenCalledWith('quick_access');
  });

  it('loads setup state, reacts to size changes, toggles navigator, and persists drag position', async () => {
    seedStorage({
      'platform-info': {
        platformName: 'salesforce',
      },
      userSettings: {
        quickAccessButtonSize: { value: 'small' },
      },
    });
    localStorage.setItem('rcQuickAccessButtonTransform', 'translate(0px, 25px)');
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return setTimeout(() => callback(performance.now()), 0);
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id);
    });

    container = await renderIntoContainer(<App />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let buttons = container.querySelectorAll('button');
    expect(buttons[0].dataset.size).toBe('small');
    expect(localStorage.getItem('rcQuickAccessButtonTop')).not.toBeNull();
    expect(localStorage.getItem('rcQuickAccessButtonTransform')).toBeNull();

    const storageListener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0][0];
    await act(async () => {
      storageListener({
        userSettings: {
          newValue: {
            quickAccessButtonSize: { value: 'xlarge' },
          },
        },
      }, 'local');
    });
    buttons = container.querySelectorAll('button');
    expect(buttons[0].dataset.size).toBe('xlarge');

    await act(async () => {
      buttons[1].click();
    });
    expect(container.querySelectorAll('button')).toHaveLength(6);

    const handleButton = container.querySelector('.rc-huddle-menu-handle');
    await act(async () => {
      handleButton.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientY: 120,
      }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientY: 180 }));
      window.dispatchEvent(new PointerEvent('pointerup'));
    });
    expect(Number(localStorage.getItem('rcQuickAccessButtonTop'))).toBeGreaterThanOrEqual(80);

    window.dispatchEvent(new Event('resize'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(cancelAnimationFrameSpy).not.toHaveBeenCalledWith(undefined);
  });
});
