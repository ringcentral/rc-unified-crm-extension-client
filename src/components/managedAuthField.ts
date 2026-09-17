type UnknownRecord = Record<string, any>;

const AUTH_OPTIONS_ACTION = 'managedAuthOptionsAuth';
const USER_OPTIONS_ACTION = 'managedAuthOptionsUser';

function isDynamicUserManagedField(field: UnknownRecord): boolean {
  return field?.managed === true && field?.managedScope === 'user' && field?.managedFieldType === 'dynamic';
}

function getManagedAuthOptionsButtonId(action: string, fieldConst: string): string {
  return `${action}-${encodeURIComponent(fieldConst)}-action`;
}

function getManagedAuthOptionsButtonTitle(_field: UnknownRecord): string {
  return 'Refresh User List';
}

function getDynamicManagedAuthSchema(field: UnknownRecord, options: UnknownRecord[] = []): UnknownRecord {
  return {
    title: field.title,
    type: 'string',
    description: field.description,
    enum: options.map(option => option.value),
    enumNames: options.map(option => option.label),
  };
}

function getDynamicManagedAuthUiSchema(field: UnknownRecord, options: UnknownRecord[] = []): UnknownRecord {
  return {
    ...(field.uiSchema ?? {}),
    'ui:widget': 'AutocompleteWidget',
    'ui:placeholder': field.uiSchema?.['ui:placeholder'] || 'Start typing to search...',
    'ui:options': {
      ...(field.uiSchema?.['ui:options'] ?? {}),
      multiple: false,
      enumOptions: options,
    },
  };
}

function getUpdateListButtonUiSchema(): UnknownRecord {
  return {
    'ui:field': 'button',
    'ui:variant': 'outlined',
    'ui:fullWidth': true,
  };
}

export {
  AUTH_OPTIONS_ACTION,
  USER_OPTIONS_ACTION,
  getDynamicManagedAuthSchema,
  getDynamicManagedAuthUiSchema,
  getManagedAuthOptionsButtonId,
  getManagedAuthOptionsButtonTitle,
  getUpdateListButtonUiSchema,
  isDynamicUserManagedField,
};
