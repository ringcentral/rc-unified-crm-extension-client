import userCore from '../core/user';

type EventOptions = {
  data: {
    showAiAssistantWidget?: unknown;
    autoStartAiAssistant?: unknown;
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  await userCore.refreshUserSettings({
    changedSettings: {
      showAiAssistantWidget: {
        value: data.showAiAssistantWidget,
      },
      autoStartAiAssistant: {
        value: data.autoStartAiAssistant,
      },
    },
    isAvoidForceChange: true,
  });
}

export default {
  onEvent,
};
