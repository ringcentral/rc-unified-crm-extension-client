import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';

vi.mock('@ringcentral/juno', async () => {
  const React = await vi.importActual('react');
  return {
    RcDrawer: ({ children, open, onClose, style }) => (
      <div data-component="RcDrawer" data-open={open ? 'true' : 'false'} style={style}>
        <button type="button" data-component="RcDrawerClose" onClick={onClose}>close</button>
        {open ? children : null}
      </div>
    ),
    RcIconButton: ({ symbol, onClick, style, color, variant }) => (
      <button
        type="button"
        data-component="RcIconButton"
        data-symbol={symbol?.name ?? symbol ?? ''}
        data-color={color}
        data-variant={variant}
        onClick={onClick}
        style={style}
      />
    ),
    RcTextarea: ({ label, onChange, value, style, size }) => (
      <textarea
        aria-label={label}
        data-component="RcTextarea"
        data-size={size}
        onChange={onChange}
        style={style}
        value={value}
      />
    ),
  };
});

vi.mock('@ringcentral/juno-icon', () => ({
  Note: 'Note',
  Check: 'Check',
}));

vi.mock('../../src/core/log.ts', () => {
  const logCore = {
    cacheCallNote: vi.fn(),
    getLog: vi.fn(),
  };
  return {
    default: logCore,
    cacheCallNote: logCore.cacheCallNote,
  };
});

vi.mock('../../src/lib/logUtil.ts', () => ({
  getCachedLogPageData: vi.fn(),
}));

vi.mock('../../src/components/logPage.ts', () => ({
  default: {
    getLogPageRender: vi.fn(),
  },
}));

async function loadComponent() {
  vi.resetModules();
  const componentModule = await import('../../src/components/note/expandableNote.tsx');
  const logCore = await import('../../src/core/log.ts');
  const logUtil = await import('../../src/lib/logUtil.ts');
  const logPage = await import('../../src/components/logPage.ts');
  return {
    ExpandableNote: componentModule.default,
    logCore: logCore.default,
    cacheCallNote: logCore.cacheCallNote,
    logUtil,
    logPage: logPage.default,
  };
}

async function renderIntoContainer(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    ReactDOM.render(element, container);
  });
  return container;
}

describe('ExpandableNote', () => {
  let container;

  afterEach(() => {
    if (container) {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
      container = null;
    }
  });

  it('opens a simple note drawer when server-side logging is enabled and caches note changes', async () => {
    const { ExpandableNote, cacheCallNote } = await loadComponent();
    container = await renderIntoContainer(<ExpandableNote />);

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'rc-server-side-logging-enabled',
          enabled: true,
        },
      }));
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'rc-expandable-call-note-open',
          sessionId: 'session-1',
        },
      }));
    });

    const noteButton = container.querySelector('button[data-symbol="Note"]');
    expect(noteButton).not.toBeNull();

    await act(async () => {
      noteButton.click();
    });

    expect(container.querySelector('[data-component="RcDrawer"]').dataset.open).toBe('true');
    const textarea = container.querySelector('textarea');
    await act(async () => {
      Simulate.change(textarea, { target: { value: 'Follow up next week' } });
    });

    expect(cacheCallNote).toHaveBeenCalledWith({
      sessionId: 'session-1',
      note: 'Follow up next week',
    });

    await act(async () => {
      container.querySelector('button[data-symbol="Check"]').click();
    });
    expect(container.querySelector('[data-component="RcDrawer"]').dataset.open).toBe('false');

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'rc-expandable-call-note-terminate',
        },
      }));
    });
    expect(container.querySelector('button[data-symbol="Note"]')).toBeNull();
  });

  it('opens the full call log page when server-side logging is disabled', async () => {
    const { ExpandableNote, logCore, logUtil, logPage } = await loadComponent();
    vi.mocked(logUtil.getCachedLogPageData).mockResolvedValue({
      id: 'session-2',
      manifest: {
        serverUrl: 'https://server.example',
      },
      platformName: 'salesforce',
      direction: 'Inbound',
      contactInfo: [{ id: 'contact-1' }],
    });
    vi.mocked(logCore.getLog).mockResolvedValue({
      callLogs: [
        {
          sessionId: 'session-2',
          matched: true,
          logData: { subject: 'Existing call' },
          contact: { id: 'contact-1' },
        },
      ],
    });
    vi.mocked(logPage.getLogPageRender).mockReturnValue({ id: 'callLogPage' });
    container = await renderIntoContainer(<ExpandableNote />);

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'rc-expandable-call-note-open',
          sessionId: 'session-2',
        },
      }));
    });
    await act(async () => {
      container.querySelector('button[data-symbol="Note"]').click();
      await Promise.resolve();
    });

    expect(logCore.getLog).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      logType: 'Call',
      sessionIds: 'session-2',
      requireDetails: false,
    });
    expect(logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-2',
      triggerType: 'editLog',
      logInfo: { subject: 'Existing call' },
      loggedContactId: 'contact-1',
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-update-call-log-page',
          page: { id: 'callLogPage' },
        },
      }),
      expect.objectContaining({
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/log/call/session-2',
        },
      }),
    ]));
  });

  it('ignores malformed messages and renders create-log data when no existing call is matched', async () => {
    const { ExpandableNote, logCore, logUtil, logPage } = await loadComponent();
    const cachedData = {
      id: 'session-3',
      manifest: {
        serverUrl: 'https://server.example',
      },
      platformName: 'salesforce',
      direction: 'Outbound',
      contactInfo: [],
    };
    vi.mocked(logUtil.getCachedLogPageData).mockResolvedValue(cachedData);
    vi.mocked(logCore.getLog).mockResolvedValue({
      callLogs: [
        {
          sessionId: 'session-3',
          matched: false,
        },
      ],
    });
    vi.mocked(logPage.getLogPageRender).mockReturnValue({ id: 'newCallLogPage' });
    container = await renderIntoContainer(<ExpandableNote />);

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: null }));
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'unknown' } }));
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'rc-expandable-call-note-open',
          sessionId: 'session-3',
        },
      }));
    });
    await act(async () => {
      container.querySelector('button[data-symbol="Note"]').click();
      await Promise.resolve();
    });

    expect(logPage.getLogPageRender).toHaveBeenCalledWith(cachedData);
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-update-call-log-page',
          page: { id: 'newCallLogPage' },
        },
      }),
    ]));
  });
});
