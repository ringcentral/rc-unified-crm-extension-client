import { t } from '../i18n';

function getHostnameInputPageRender({ platform, inputUrl, selection, isUrlValid, submitText, readyMessage = '', connectorId = '', isPrivate = false }) {
    const platformName = platform.displayName ?? platform.name;
    const url = platform.environment.url;
    const overrides = platform.overrides;
    const page = {
        id: 'hostnameInputPage',
        type: 'page',
        title: t('pages.hostname.setup'),
        schema: {
            type: 'object',
            properties: {},
            required: []
        },
        uiSchema: {
            submitButtonOptions: { // optional if you don't want to show submit button
                submitText: submitText ?? t('pages.hostname.next'),
            }
        },
        formData: {
            url: inputUrl ?? '',
            platformId: platform.name,
            selection: selection ?? '',
            platformDisplayName: platform.displayName ?? platform.name,
            connectorId,
            isPrivate
        }
    }
    if (platform.environment?.instructions?.length > 0) {
        page.schema.properties.instructionTitle = {
            type: 'string',
            description: t('pages.hostname.instructionTitle', { platform: platformName })
        }
        page.uiSchema.instructionTitle = {
            "ui:field": "typography", // or typography to show raw text,
            "ui:variant": "body2"
        }
        for (let i = 0; i < platform.environment.instructions.length; i++) {
            page.schema.properties[`instruction${i + 1}`] = {
                type: 'string',
                description: platform.environment.instructions[i]
            }
            page.uiSchema[`instruction${i + 1}`] = {
                "ui:field": "typography", // or typography to show raw text
                "ui:bulletedList": true
            }
        }
    }
    if (readyMessage) {
        page.schema.properties.readyMessage = {
            type: 'string',
            description: readyMessage
        }
        page.uiSchema.readyMessage = {
            'ui:field': 'typography',
            'ui:variant': 'body2'
        }
    }
    switch (platform.environment.type) {
        case 'selectable':
            page.title = t('pages.hostname.select');
            page.schema.properties.selection = {
                type: 'string',
                oneOf: platform.environment.selections.map(selection => {
                    return {
                        const: selection.const,
                        title: selection.name
                    }
                })
            }
            page.schema.required.push('selection');
            break;
        case 'dynamic':
            page.title = t('pages.hostname.inputHostname');
            page.schema.properties.url = {
                type: 'string',
                title: t('pages.hostname.url', { platform: platformName })
            }
            page.schema.required.push('url');
            page.uiSchema.url = {
                "ui:placeholder": t('pages.hostname.urlPlaceholder'),
                "ui:help": isUrlValid ? '' : t('pages.hostname.invalidUrl', { format: url })
            }
            break;
    }


    if (overrides) {
        page.schema.properties = overrides.schema.properties;
        page.uiSchema = overrides.uiSchema;
    }
    return page;
}

exports.getHostnameInputPageRender = getHostnameInputPageRender;
