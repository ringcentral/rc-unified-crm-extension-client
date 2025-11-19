import userCore from '../core/user';

async function onEvent({ data }) {
    await userCore.refreshUserSettings({
      changedSettings: {
        autoStartAiAssistant: {
          value: data.autoStartAiAssistant
        }
      },
      isAvoidForceChange: true
    });
}

exports.onEvent = onEvent;