function getAutoLogPreferenceSettingPageRender({ adminUserSettings }) {
    return {
        id: 'autoLogPreferenceSettingPage',
        title: 'Auto log preferences',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                unknownContactPreference: {
                    type: 'object',
                    title: 'Unknown contact',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Value',
                            oneOf: [
                                {
                                    const: 'skipLogging',
                                    title: 'Skip logging'
                                },
                                {
                                    const: 'createNewPlaceholderContact',
                                    title: 'Create new placeholder contact'
                                }
                            ]
                        }
                    }
                },
                multipleContactsPreference: {
                    type: 'object',
                    title: 'Multiple contacts',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Value',
                            oneOf: [
                                {
                                    const: 'skipLogging',
                                    title: 'Skip logging'
                                },
                                {
                                    const: 'firstAlphabetical',
                                    title: 'First alphabetical'
                                },
                                {
                                    const: 'mostRecentActivity',
                                    title: 'Most recent activity'
                                }
                            ]
                        }
                    }
                }
            }
        },
        uiSchema: {
            unknownContactPreference: {
                "ui:collapsible": true,
            },
            multipleContactsPreference: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            unknownContactPreference: {
                customizable: adminUserSettings?.unknownContactPreference?.customizable ?? true,
                value: adminUserSettings?.unknownContactPreference?.value ?? 'skipLogging'
            },
            multipleContactsPreference: {
                customizable: adminUserSettings?.multipleContactsPreference?.customizable ?? true,
                value: adminUserSettings?.multipleContactsPreference?.value ?? 'skipLogging'
            }
        }
    }
}

exports.getAutoLogPreferenceSettingPageRender = getAutoLogPreferenceSettingPageRender;