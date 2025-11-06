import userCore from '../core/user';

async function onEvent({ data }) {
    //formatType, readOnly, template
    await userCore.refreshUserSettings({
      changedSettings: {
        phoneNumberDisplayFormatType:
        {
          value: data.formatType,
          customizable: !data.readOnly
        },
        phoneNumberDisplayFormatTemplate: {
          value: data.template,
          customizable: !data.readOnly
        }
      }
    });
}

exports.onEvent = onEvent;