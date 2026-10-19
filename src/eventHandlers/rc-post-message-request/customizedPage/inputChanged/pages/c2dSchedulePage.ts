type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  const formData = data.body.formData || {};
  const isNew = formData.contact === 'newContact';

  if (formData.callbackDateTime) {
    const selectedDate = new Date(formData.callbackDateTime);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (selectedDate < todayStart) {
      formData.callbackDateTime = '';
    }
  }

  const isSubmitButtonEnabled = !!formData.callbackDateTime && (!isNew || (formData.newContactName && formData.newContactName.trim() !== ''));
  const page = data.body.page;
  const keys = Array.isArray(data.body.keys) ? data.body.keys : [];
  void keys;
  const ct = manifest.platforms[platformName!]?.contactTypes || [];

  if (isNew && ct.length > 0 && !formData.newContactType) {
    formData.newContactType = ct[0].value;
  }
  if (!isNew) {
    formData.newContactName = '';
    if (ct.length > 0) formData.newContactType = '';
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const updatedSchema = {
    ...page.schema,
    properties: {
      ...page.schema.properties,
      callbackDateTime: {
        ...page.schema.properties.callbackDateTime,
        minimum: todayStart.toISOString(),
      },
    },
  };

  const updatedUiSchema = {
    ...page.uiSchema,
    callbackDateTime: {
      'ui:widget': 'datetime',
      'ui:options': {
        minimum: todayStart.toISOString(),
      },
    },
    newContactName: isNew ? { 'ui:widget': 'text', 'ui:placeholder': 'Enter name...' } : { 'ui:widget': 'hidden' },
    ...(ct.length > 0 ? { newContactType: isNew ? {} : { 'ui:widget': 'hidden' } } : {}),
    scheduleSubmit: { ...(page.uiSchema?.scheduleSubmit || {}), 'ui:disabled': !isSubmitButtonEnabled },
  };
  const updated = {
    id: page.id,
    title: page.title,
    type: page.type,
    schema: updatedSchema,
    uiSchema: updatedUiSchema,
    formData,
  };
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: updated,
  }, '*');
}

export default {
  onEvent,
};
