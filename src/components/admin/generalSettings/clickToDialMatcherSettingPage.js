function getClickToDialMatcherSettingPageRender({ adminUserSettings }) {
    return {
        id: 'clickToDialMatcherSettingPage',
        title: 'Click-to-dial Matcher',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                c2dMatcherType: {
                    type: 'object',
                    title: 'Click-to-dial Matcher',
                    description: 'Choose how App Connect detects phone numbers on webpages before showing the click-to-dial or click-to-SMS widget.',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Matcher type',
                            oneOf: [
                                {
                                    const: 'libPhone',
                                    title: 'Region-focused matcher',
                                    description: 'Focus on phone-number variations that align with the selected region.'
                                },
                                {
                                    const: 'regExp',
                                    title: 'All matcher',
                                    description: 'Match any number sequence that looks like a phone number.'
                                }
                            ],
                            default: 'libPhone'
                        }
                    }
                }
            }
        },
        uiSchema: {
            c2dMatcherType: {
                "ui:collapsible": true
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            c2dMatcherType: {
                customizable: adminUserSettings?.c2dMatcherType?.customizable ?? true,
                value: adminUserSettings?.c2dMatcherType?.value ?? 'libPhone'
            }
        }
    }
}

exports.getClickToDialMatcherSettingPageRender = getClickToDialMatcherSettingPageRender;
