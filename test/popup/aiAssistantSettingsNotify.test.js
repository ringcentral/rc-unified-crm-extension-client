import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadPopup } from './loadPopup';

const SIGNED_IN_STORAGE = {
    rcUnifiedCrmExtJwt: 'jwt-token',
    crmAuthed: true
};

const LOGIN_EVENT = {
    type: 'rc-login-status-notify',
    loggedIn: true,
    loginNumber: '+15005550006',
    features: { smartNote: true, sms: true }
};

function aiAssistantEvent({ showAiAssistantWidget, autoStartAiAssistant }) {
    return {
        type: 'rc-adapter-ai-assistant-settings-notify',
        showAiAssistantWidget,
        autoStartAiAssistant
    };
}

describe('popup rc-adapter-ai-assistant-settings-notify', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('ignores the widget notification that arrives before settings are synced', async () => {
        const { userCore, util, sendWidgetEvent } = await loadPopup({ storage: SIGNED_IN_STORAGE });

        await sendWidgetEvent(aiAssistantEvent({
            showAiAssistantWidget: false,
            autoStartAiAssistant: false
        }));

        expect(userCore.refreshUserSettings).not.toHaveBeenCalled();
        expect(util.showNotification).not.toHaveBeenCalled();
    });

    it('persists the user toggle once login has pushed settings to the widget', async () => {
        const persistedSettings = { showAiAssistantWidget: { value: true } };
        const { userCore, util, sendWidgetEvent } = await loadPopup({
            storage: SIGNED_IN_STORAGE,
            userSettings: persistedSettings
        });

        await sendWidgetEvent(LOGIN_EVENT);
        userCore.refreshUserSettings.mockClear();
        util.showNotification.mockClear();

        await sendWidgetEvent(aiAssistantEvent({
            showAiAssistantWidget: true,
            autoStartAiAssistant: false
        }));

        expect(userCore.refreshUserSettings).toHaveBeenCalledWith({
            changedSettings: {
                showAiAssistantWidget: { value: true },
                autoStartAiAssistant: { value: false }
            },
            isAvoidForceChange: true
        });
        expect(util.showNotification).toHaveBeenCalledWith({
            level: 'success',
            message: 'Settings saved.',
            ttl: 3000
        });
    });

    it('persists a toggle OFF without being overwritten by the widget default', async () => {
        const { userCore, sendWidgetEvent } = await loadPopup({ storage: SIGNED_IN_STORAGE });

        await sendWidgetEvent(aiAssistantEvent({
            showAiAssistantWidget: false,
            autoStartAiAssistant: false
        }));
        expect(userCore.refreshUserSettings).not.toHaveBeenCalled();

        await sendWidgetEvent(LOGIN_EVENT);
        userCore.refreshUserSettings.mockClear();

        await sendWidgetEvent(aiAssistantEvent({
            showAiAssistantWidget: false,
            autoStartAiAssistant: true
        }));

        expect(userCore.refreshUserSettings).toHaveBeenCalledTimes(1);
        expect(userCore.refreshUserSettings).toHaveBeenCalledWith({
            changedSettings: {
                showAiAssistantWidget: { value: false },
                autoStartAiAssistant: { value: true }
            },
            isAvoidForceChange: true
        });
    });

    it('stays gated when the user is not connected to the CRM at login', async () => {
        const { userCore, sendWidgetEvent } = await loadPopup({ storage: {} });

        await sendWidgetEvent(LOGIN_EVENT);
        userCore.refreshUserSettings.mockClear();

        await sendWidgetEvent(aiAssistantEvent({
            showAiAssistantWidget: true,
            autoStartAiAssistant: true
        }));

        expect(userCore.refreshUserSettings).not.toHaveBeenCalled();
    });
});
