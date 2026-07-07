// @ts-nocheck
import CustomC2DWidget from '../../src/misc/CustomC2DWidget.ts';

async function flushIconLoad() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('CustomC2DWidget', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      text: async () => '<svg><path fill="#000" stroke="#111"></path><path fill="none"></path></svg>',
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('injects controls, updates SMS visibility, and emits full phone numbers', async () => {
    const widget = new CustomC2DWidget();
    await flushIconLoad();

    const callHandler = vi.fn();
    const textHandler = vi.fn();
    const scheduleHandler = vi.fn();
    const throwingHandler = vi.fn(() => {
      throw new Error('ignored');
    });
    widget.on('call', throwingHandler);
    widget.on('call', callHandler);
    widget.on('text', textHandler);
    widget.on('schedule', scheduleHandler);

    widget.update({ enableC2Text: false });
    expect(widget._smsBtn.style.display).toBe('none');
    widget.update({ enableC2Text: true });
    expect(widget._smsBtn.style.display).toBe('flex');
    widget.update({ enableC2Text: 'yes' });
    expect(widget._smsBtn.style.display).toBe('flex');

    widget.setTarget({
      context: {
        phoneNumber: '+16505550100',
        ext: '123',
      },
      rect: {
        right: 200,
        top: 80,
        height: 40,
      },
    });

    expect(widget._root.style.display).toBe('flex');
    expect(widget._root.style.transform).toBe('translate(190px, 100px)');

    widget._callBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    widget._smsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    widget._scheduleBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(callHandler).toHaveBeenCalledWith('+16505550100*123', {
      phoneNumber: '+16505550100',
      ext: '123',
    });
    expect(textHandler).toHaveBeenCalledWith('+16505550100*123', expect.any(Object));
    expect(scheduleHandler).toHaveBeenCalledWith('+16505550100*123', expect.any(Object));
    expect(throwingHandler).toHaveBeenCalled();

    const insertedSvg = widget._callBtn.querySelector('svg');
    expect(insertedSvg).not.toBeNull();
    expect(insertedSvg.getAttribute('fill')).toBe('currentColor');
  });

  it('delays hiding when the target disappears and keeps visible while hovered', async () => {
    vi.useFakeTimers();
    const widget = new CustomC2DWidget();
    widget.setTarget({
      context: { phoneNumber: '+16505550100' },
      rect: { right: 100, top: 50, startLineHeight: 20, height: 40 },
    });

    widget._root.dispatchEvent(new MouseEvent('mouseenter'));
    widget.setTarget(null);
    await vi.advanceTimersByTimeAsync(900);
    expect(widget._root.style.display).toBe('flex');

    widget._root.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.advanceTimersByTimeAsync(250);
    expect(widget._root.style.display).toBe('none');

    widget.setTarget({
      context: { phoneNumber: '+16505550200' },
      rect: { right: 120, top: 40, height: 20 },
    });
    widget.setTarget(null);
    await vi.advanceTimersByTimeAsync(799);
    expect(widget._root.style.display).toBe('flex');
    await vi.advanceTimersByTimeAsync(1);
    expect(widget._root.style.display).toBe('none');
  });

  it('ignores missing icon fetches and returns empty numbers without context', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('missing icon'));
    const widget = new CustomC2DWidget();
    const callHandler = vi.fn();
    widget.on('call', callHandler);
    await flushIconLoad();

    widget._callBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(callHandler).toHaveBeenCalledWith('', undefined);
  });
});
