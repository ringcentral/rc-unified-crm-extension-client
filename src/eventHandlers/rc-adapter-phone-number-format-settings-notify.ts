import userCore from '../core/user';

type EventOptions = {
  data: {
    formatType?: unknown;
    readOnly?: boolean;
    template?: unknown;
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  //formatType, readOnly, template
  await userCore.refreshUserSettings({
    changedSettings: {
      phoneNumberDisplayFormatType:
      {
        value: data.formatType,
        customizable: !data.readOnly,
      },
      phoneNumberDisplayFormatTemplate: {
        value: data.template,
        customizable: !data.readOnly,
      },
    },
  });
}

export default {
  onEvent,
};
