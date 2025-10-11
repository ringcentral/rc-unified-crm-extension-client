function getPhoneNumberFormatPageRender({ adminUserSettings }) {
    return {
        id: 'phoneNumberFormatPage',
        title: 'Phone number format',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                phoneNumberDisplayFormatType: {
                    type: 'object',
                    title: 'Phone number format type',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Value',
                            enum: ['national', 'international', 'e164', 'customized']
                        }
                    }
                },
                phoneNumberDisplayFormatTemplate: {
                    type: 'object',
                    title: 'Phone number format template',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'string',
                            title: 'Value',
                            description: 'You can use # and * to represent the digits. x represents masked digit.'
                        }
                    }
                }
            }
        },
        uiSchema: {
            phoneNumberDisplayFormatType: {
                "ui:collapsible": true,
            },
            phoneNumberDisplayFormatTemplate: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            phoneNumberDisplayFormatType: {
                customizable: adminUserSettings?.phoneNumberDisplayFormatType?.customizable ?? true,
                value: adminUserSettings?.phoneNumberDisplayFormatType?.value ?? 'international'
            },
            phoneNumberDisplayFormatTemplate: {
                customizable: adminUserSettings?.phoneNumberDisplayFormatTemplate?.customizable ?? true,
                value: adminUserSettings?.phoneNumberDisplayFormatTemplate?.value ?? ''
            }
        }
    }
}

exports.getPhoneNumberFormatPageRender = getPhoneNumberFormatPageRender;