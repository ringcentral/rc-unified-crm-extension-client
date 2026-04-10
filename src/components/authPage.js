import { t } from '../i18n';

function getAuthPageRender({ manifest, platformName, visibleFieldConsts = null, warningMessage = '' }) {
    const authPage = manifest.platforms[platformName].auth.apiKey.page;
    const pageTitle = authPage.title;
    const filteredContent = visibleFieldConsts
        ? authPage.content.filter(c => visibleFieldConsts.includes(c.const) && !c.hidden)
        : authPage.content.filter(c => !c.hidden);
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
        content[c.const] = {
            title: c.title,
            type: c.type,
            description: c.description
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
        if (c.uiSchema) {
            uiSchema[c.const] = c.uiSchema;
        }
    }
    let formData = {};
    for (const c of filteredContent) {
        if (c.defaultValue) {
            formData[c.const] = c.defaultValue;
        }
    }
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

exports.getAuthPageRender = getAuthPageRender;
