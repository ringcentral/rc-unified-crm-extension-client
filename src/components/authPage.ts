import { t } from '../i18n';
import {
    AUTH_OPTIONS_ACTION,
    getDynamicManagedAuthSchema,
    getDynamicManagedAuthUiSchema,
    getManagedAuthOptionsButtonId,
    getManagedAuthOptionsButtonTitle,
    getUpdateListButtonUiSchema,
    isDynamicUserManagedField,
} from './managedAuthField';

function getAuthPageRender({
    manifest,
    platformName,
    isAdmin,
    visibleFieldConsts = null,
    warningMessage = '',
    formData: submittedFormData = {},
    dynamicOptions = {},
}) {
    const authPage = manifest.platforms[platformName].auth.apiKey.page;
    const pageTitle = authPage.title;
    const filteredContent = isAdmin ?
        authPage.content :
        (visibleFieldConsts
            ? authPage.content.filter(c => visibleFieldConsts.includes(c.const) && !c.hidden)
            : authPage.content.filter(c => !c.hidden));
    const required = filteredContent.filter(c => c.required).map(c => { return c.const });
    const warningText = warningMessage || authPage.warning;
    const warning = warningText ? {
        warning: {
            type: 'string',
            description: warningText,
        }
    } : {};
    let content = {};
    for (const c of filteredContent) {
        content[c.const] = isDynamicUserManagedField(c) ?
            getDynamicManagedAuthSchema(c, dynamicOptions[c.const] ?? []) :
            {
                title: c.title,
                type: c.type,
                description: c.description
            };
        if (isAdmin && isDynamicUserManagedField(c)) {
            const buttonId = getManagedAuthOptionsButtonId(AUTH_OPTIONS_ACTION, c.const);
            content[buttonId] = {
                type: 'string',
                title: getManagedAuthOptionsButtonTitle(c),
            };
        }
    }
    let uiSchema = {
        submitButtonOptions: { // optional if you don't want to show submit button
            submitText: t('common.buttons.connect'),
        },
        warning: {
            "ui:field": "admonition",
            "ui:severity": "warning",  // "warning", "info", "error", "success"
        }
    };
    for (const c of filteredContent) {
        if (isDynamicUserManagedField(c)) {
            uiSchema[c.const] = getDynamicManagedAuthUiSchema(c, dynamicOptions[c.const] ?? []);
            if (isAdmin) {
                uiSchema[getManagedAuthOptionsButtonId(AUTH_OPTIONS_ACTION, c.const)] = getUpdateListButtonUiSchema();
            }
        }
        else if (c.uiSchema) {
            uiSchema[c.const] = c.uiSchema;
        }
    }
    let formData = {};
    for (const c of filteredContent) {
        if (c.defaultValue) {
            formData[c.const] = c.defaultValue;
        }
    }
    formData = {
        ...formData,
        ...submittedFormData,
    };
    const page = {
        id: 'authPage',
        title: pageTitle,
        schema: {
            type: 'object',
            required,
            properties: {
                ...warning,
                ...content
            }
        },
        uiSchema,
        formData
    }
    return page;
}

export { getAuthPageRender };
export default {
    getAuthPageRender,
};
