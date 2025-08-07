function getHostnameInputPageRender({ platform, inputUrl, region, isUrlValid }) {
    const platformName = platform.displayName;
    const urlIdentifier = platform.environment.urlIdentifier;
    const overrides = platform.overrides;
    const page = {
        id: 'hostnameInputPage',
        type: 'page',
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
            region: region ?? ''
        }
    }
    switch (platform.environment.type) {
        case 'regional':
            page.title = 'Select region';
            page.schema.properties.region = {
                type: 'string',
                oneOf: platform.environment.regionOptions.map(region => {
                    return {
                        const: region.const,
                        title: region.name
                    }
                })
            }
            page.schema.required.push('region');
            break;
        case 'custom':
            page.title = 'Enter hostname';
            page.schema.properties.instructionTitle = {
                type: 'string',
                description: `Please setup your ${platformName} account url:`
            }
            page.uiSchema.instructionTitle = {
                "ui:field": "typography", // or typography to show raw text,
                "ui:variant": "body2"
            }
            if (platform.environment?.instructions?.length > 0) {
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
            page.schema.properties.url = {
                type: 'string',
                title: `${platformName} url`
            }
            page.schema.required.push('url');
            page.uiSchema.url = {
                "ui:placeholder": 'url...',
                "ui:help": isUrlValid ? '' : `Invalid url! Please enter it following format: "${urlIdentifier}"`
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