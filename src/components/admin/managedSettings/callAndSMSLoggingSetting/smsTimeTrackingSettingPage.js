function getSmsTimeTrackingSettingPageRender({ adminUserSettings }) {
    return {
        id: 'smsTimeTrackingSettingPage',
        title: 'SMS Time Tracking',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                smsTimeTrackingEnabled: {
                    type: 'object',
                    title: 'Enable SMS Time Tracking',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                smsTimeTrackingMinimumDuration: {
                    type: 'object',
                    title: 'Minimum Billable Time Duration (seconds)',
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
                smsTimeTrackingDefaultBillable: {
                    type: 'object',
                    title: 'Default Time Entries to Billable',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                }
            }
        },
        uiSchema: {
            smsTimeTrackingEnabled: {
                "ui:collapsible": true,
            },
            smsTimeTrackingMinimumDuration: {
                "ui:collapsible": true,
            },
            smsTimeTrackingDefaultBillable: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            smsTimeTrackingEnabled: {
                customizable: adminUserSettings?.smsTimeTrackingEnabled?.customizable ?? true,
                value: adminUserSettings?.smsTimeTrackingEnabled?.value ?? false
            },
            smsTimeTrackingMinimumDuration: {
                customizable: adminUserSettings?.smsTimeTrackingMinimumDuration?.customizable ?? true,
                value: adminUserSettings?.smsTimeTrackingMinimumDuration?.value ?? '30'
            },
            smsTimeTrackingDefaultBillable: {
                customizable: adminUserSettings?.smsTimeTrackingDefaultBillable?.customizable ?? true,
                value: adminUserSettings?.smsTimeTrackingDefaultBillable?.value ?? true
            }
        }
    }
}

exports.getSmsTimeTrackingSettingPageRender = getSmsTimeTrackingSettingPageRender;


