import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

vi.mock('@ringcentral/juno', async () => {
  const React = await vi.importActual('react');
  return {
    RcLoading: ({ loading }) => (
      <div data-component="RcLoading" data-loading={loading ? 'true' : 'false'} />
    ),
    RcThemeProvider: ({ children }) => (
      <section data-component="RcThemeProvider">{children}</section>
    ),
  };
});

describe('Loading component and root entrypoint', () => {
  let container;

  afterEach(() => {
    if (container) {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
      container = null;
    }
  });

  it('toggles the Juno loading state from widget postMessage events', async () => {
    vi.resetModules();
    const Loading = (await import('../../src/components/loading.jsx')).default;
    container = document.createElement('div');
    document.body.appendChild(container);

    await act(async () => {
      ReactDOM.render(<Loading />, container);
    });
    expect(container.querySelector('[data-component="RcLoading"]').dataset.loading).toBe('false');

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'rc-log-modal-loading-on',
        },
      }));
    });
    expect(container.querySelector('[data-component="RcLoading"]').dataset.loading).toBe('true');

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'rc-log-modal-loading-off',
        },
      }));
      window.dispatchEvent(new MessageEvent('message', { data: {} }));
    });
    expect(container.querySelector('[data-component="RcLoading"]').dataset.loading).toBe('false');
  });

  it('restores locale before rendering the root application shell', async () => {
    vi.resetModules();
    container = document.createElement('div');
    container.id = 'react-container';
    document.body.appendChild(container);
    const restoreLocale = vi.fn(() => Promise.resolve());
    vi.doMock('../../src/i18n/index.js', () => ({
      default: {
        restoreLocale,
      },
    }));
    vi.doMock('../../src/components/note/expandableNote.jsx', () => ({
      default: () => <div data-component="ExpandableNote" />,
    }));

    await import('../../src/root.jsx');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(restoreLocale).toHaveBeenCalled();
    expect(container.querySelector('[data-component="RcThemeProvider"]')).not.toBeNull();
    expect(container.querySelector('[data-component="RcLoading"]')).not.toBeNull();
    expect(container.querySelector('[data-component="ExpandableNote"]')).not.toBeNull();
  });
});
