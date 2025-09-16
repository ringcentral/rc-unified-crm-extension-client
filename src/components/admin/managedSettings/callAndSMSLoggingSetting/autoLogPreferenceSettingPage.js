function getAutoLogPreferenceSettingPageRender({ adminUserSettings, contactTypes }) {
    const newContactTypes = contactTypes.map(contactType => ({
        const: contactType.value,
        title: contactType.display
    }));
    const page = {
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
                newContactType: {
                    type: 'object',
                    title: 'Contact type',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Value',
                            oneOf: newContactTypes
                        }
                    }
                },
                newContactNamePrefix: {
                    type: 'object',
                    title: 'New contact name prefix',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Value'
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
            newContactType: {
                "ui:collapsible": true,
            },
            multipleContactsPreference: {
                "ui:collapsible": true,
            },
            newContactNamePrefix: {
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
            newContactType: {
                customizable: adminUserSettings?.newContactType?.customizable ?? true,
                value: adminUserSettings?.newContactType?.value ?? contactTypes[0]
            },
            multipleContactsPreference: {
                customizable: adminUserSettings?.multipleContactsPreference?.customizable ?? true,
                value: adminUserSettings?.multipleContactsPreference?.value ?? 'skipLogging'
            },
            newContactNamePrefix: {
                customizable: adminUserSettings?.newContactNamePrefix?.customizable ?? true,
                value: adminUserSettings?.newContactNamePrefix?.value ?? 'PlaceholderContact'
            }
        }
    }
    return page;
}

exports.getAutoLogPreferenceSettingPageRender = getAutoLogPreferenceSettingPageRender;