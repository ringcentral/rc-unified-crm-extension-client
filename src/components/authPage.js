function getAuthPageRender({ manifest, platformName }) {
    const authPage = manifest.platforms[platformName].auth.apiKey.page;
    const pageTitle = authPage.title;
    const required = authPage.content.filter(c => c.required).map(c => { return c.const });
    const warning = authPage.warning ? {
        warning: {
            type: 'string',
            description: authPage.warning,
        }
    } : {};
    let content = {};
    for (const c of authPage.content) {
        content[c.const] = {
            title: c.title,
            type: c.type,
            description: c.description
        }
    }
    let uiSchema = {
        submitButtonOptions: { // optional if you don't want to show submit button
            submitText: 'Connect',
        },
        warning: {
            "ui:field": "admonition",
            "ui:severity": "warning",  // "warning", "info", "error", "success"
        }
    };
    for (const c of authPage.content) {
        if (c.uiSchema) {
            uiSchema[c.const] = c.uiSchema;
        }
    }
    let formData = {};
    for (const c of authPage.content) {
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