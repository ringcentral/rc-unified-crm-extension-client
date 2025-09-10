function getHostnameInputPageRender({ platform, inputUrl, selection, isUrlValid }) {
    const platformName = platform.displayName ?? platform.name;
    const url = platform.environment.url;
    const overrides = platform.overrides;
    const page = {
        id: 'hostnameInputPage',
        type: 'page',
        title: 'Setup',
        schema: {
            type: 'object',
            properties: {},
            required: []
        },
        uiSchema: {
            submitButtonOptions: { // optional if you don't want to show submit button
                submitText: 'Next',
            }
        },
        formData: {
            url: inputUrl ?? '',
            platformId: platform.name,
            selection: selection ?? '',
            platformDisplayName: platform.displayName ?? platform.name
        }
    }
    if (platform.environment?.instructions?.length > 0) {
        page.schema.properties.instructionTitle = {
            type: 'string',
            description: `Please follow instructions below to setup your ${platformName} account:`
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
    switch (platform.environment.type) {
        case 'selectable':
            page.title = 'Select';
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
            page.title = 'Input hostname';
            page.schema.properties.url = {
                type: 'string',
                title: `${platformName} url`
            }
            page.schema.required.push('url');
            page.uiSchema.url = {
                "ui:placeholder": 'url...',
                "ui:help": isUrlValid ? '' : `Invalid url! Please enter it following format: "${url}"`
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