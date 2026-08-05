import adminCore from '../../../../core/admin';
import managedAuthUserPage from '../../../../components/admin/managedAuthUserPage';
import { getRcContactInfo, showNotification } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

function getRcUserName(selectedRcUser?: UnknownRecord): string {
  return selectedRcUser?.name || `${selectedRcUser?.firstName ?? ''} ${selectedRcUser?.lastName ?? ''}`.trim();
}

export async function onEvent({ data, manifest }: EventOptions): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null }) as { managedAuthSettings?: UnknownRecord | null };
    const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
    const selectedRcExtensionId = data.body.button.formData.rcExtensionId;
    const selectedRcUser = rcExtensions.find(extension => extension.id === selectedRcExtensionId);
    const selectedStoredEntry = (managedAuthSettings?.userValues ?? []).find((user: UnknownRecord) => user.rcExtensionId === selectedRcExtensionId);
    const values: UnknownRecord = {};
    const fieldsToRemove: string[] = [];
    (managedAuthSettings?.userFields ?? []).forEach((field: UnknownRecord) => {
      const submittedValue = data.body.button.formData[field.const];
      if (submittedValue !== undefined && submittedValue !== '') {
        values[field.const] = submittedValue;
        return;
      }
      if (selectedStoredEntry?.fields?.[field.const]?.hasValue) {
        fieldsToRemove.push(field.const);
      }
    });
    await adminCore.saveManagedAuthSettings({
      serverUrl: manifest.serverUrl,
      scope: 'user',
      rcExtensionId: selectedRcExtensionId,
      rcUserName: getRcUserName(selectedRcUser),
      values,
      fieldsToRemove,
      refreshAfterSave: false,
    });
    const nextUserValues = [...(managedAuthSettings?.userValues ?? [])];
    const existingIndex = nextUserValues.findIndex((user: UnknownRecord) => user.rcExtensionId === selectedRcExtensionId);
    const existingEntry = existingIndex >= 0
      ? nextUserValues[existingIndex]
      : {
          rcExtensionId: selectedRcExtensionId,
          rcUserName: getRcUserName(selectedRcUser),
          fields: {},
        };
    const nextFields: UnknownRecord = {
      ...(existingEntry.fields ?? {}),
    };
    Object.keys(values).forEach((key) => {
      nextFields[key] = {
        hasValue: true,
        value: values[key],
      };
    });
    fieldsToRemove.forEach((key) => {
      delete nextFields[key];
    });
    const nextEntry = {
      ...existingEntry,
      rcExtensionId: selectedRcExtensionId,
      rcUserName: getRcUserName(selectedRcUser),
      fields: nextFields,
    };
    if (existingIndex >= 0) {
      nextUserValues[existingIndex] = nextEntry;
    }
    else {
      nextUserValues.push(nextEntry);
    }
    const nextManagedAuthSettings: UnknownRecord = {
      ...(managedAuthSettings ?? {}),
      userValues: nextUserValues,
    };
    await chrome.storage.local.set({ managedAuthSettings: nextManagedAuthSettings });
    const listPage = managedAuthUserPage.getManagedAuthUserPageRender({
      userFields: nextManagedAuthSettings?.userFields ?? [],
      userValues: nextManagedAuthSettings?.userValues ?? [],
      rcExtensions,
      searchWord: data.body.button.formData?.searchWord ?? '',
      filter: data.body.button.formData?.filter ?? 'All',
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: listPage,
    });
  }
  catch (error) {
    void error;
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'error', message: 'Failed to update user managed authentication. Please try again.', ttl: 3000 });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: 'goBack',
    }, '*');
    return;
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  showNotification({ level: 'success', message: 'User managed authentication updated.', ttl: 3000 });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack',
  }, '*');
}

export default {
  onEvent,
};
