function getCallLogDetailsSettingPageRender({ adminUserSettings }) {
    return {
        id: 'callLogDetailsSettingPage',
        title: 'Call log details',
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                addCallLogNote: {
                    type: 'object',
                    title: 'Agent-entered notes',
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
                addCallSessionId: {
                    type: 'object',
                    title: 'Call session id',
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
                addRingCentralUserName: {
                    type: 'object',
                    title: 'RingCentral user name',
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
                addRingCentralNumber: {
                    type: 'object',
                    title: 'RingCentral phone number',
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
                addCallLogSubject: {
                    type: 'object',
                    title: 'Call subject',
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
                addCallLogContactNumber: {
                    type: 'object',
                    title: 'Contact\'s phone number',
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
                addCallLogDateTime: {
                    type: 'object',
                    title: 'Date and time',
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
                logDateFormat: {
                    type: 'object',
                    title: 'Date format',
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
                                    const: 'YYYY-MM-DD HH:mm:ss',
                                    title: 'Global - 24H (e.g. 2024-01-15 14:30:45)'
                                },
                                {
                                    const: 'YYYY-MM-DD hh:mm:ss A',
                                    title: 'Global - 12H (e.g. 2024-01-15 02:30:45 PM)'
                                },
                                {
                                    const: 'MM/DD/YYYY hh:mm:ss A',
                                    title: 'US - 12H (e.g. 01/15/2024 02:30:45 PM)'
                                },
                                {
                                    const: 'MM/DD/YYYY HH:mm:ss',
                                    title: 'US - 24H (e.g. 01/15/2024 14:30:45)'
                                },
                                {
                                    const: 'DD/MM/YYYY HH:mm:ss',
                                    title: 'EU - 24H (e.g. 15/01/2024 14:30:45)'
                                },
                                {
                                    const: 'DD/MM/YYYY hh:mm:ss A',
                                    title: 'EU - 12H (e.g. 15/01/2024 02:30:45 PM)'
                                }
                            ]
                        }
                    }
                },
                addCallLogDuration: {
                    type: 'object',
                    title: 'Call duration',
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
                addCallLogResult: {
                    type: 'object',
                    title: 'Call result',
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
                addCallLogRecording: {
                    type: 'object',
                    title: 'Link to the recording',
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
                addCallLogAiNote: {
                    type: 'object',
                    title: 'Smart summary',
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
                addCallLogTranscript: {
                    type: 'object',
                    title: 'Call transcript',
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
            addCallLogNote: {
                "ui:collapsible": true,
            },
            addCallSessionId: {
                "ui:collapsible": true,
            },
            addRingCentralUserName: {
                "ui:collapsible": true,
            },
            addRingCentralNumber: {
                "ui:collapsible": true,
            },
            addCallLogSubject: {
                "ui:collapsible": true,
            },
            addCallLogContactNumber: {
                "ui:collapsible": true,
            },
            addCallLogDateTime: {
                "ui:collapsible": true,
            },
            logDateFormat: {
                "ui:collapsible": true,
            },
            addCallLogDuration: {
                "ui:collapsible": true,
            },
            addCallLogResult: {
                "ui:collapsible": true,
            },
            addCallLogRecording: {
                "ui:collapsible": true,
            },
            addCallLogAiNote: {
                "ui:collapsible": true,
            },
            addCallLogTranscript: {
                "ui:collapsible": true,
            },
            submitButtonOptions: {
                submitText: 'Save',
            }
        },
        formData: {
            addCallLogNote: {
                customizable: adminUserSettings?.addCallLogNote?.customizable ?? true,
                value: adminUserSettings?.addCallLogNote?.value ?? false
            },
            addCallSessionId: {
                customizable: adminUserSettings?.addCallSessionId?.customizable ?? true,
                value: adminUserSettings?.addCallSessionId?.value ?? false
            },
            addRingCentralUserName: {
                customizable: adminUserSettings?.addRingCentralUserName?.customizable ?? true,
                value: adminUserSettings?.addRingCentralUserName?.value ?? false
            },
            addRingCentralNumber: {
                customizable: adminUserSettings?.addRingCentralNumber?.customizable ?? true,
                value: adminUserSettings?.addRingCentralNumber?.value ?? false
            },
            addCallLogSubject: {
                customizable: adminUserSettings?.addCallLogSubject?.customizable ?? true,
                value: adminUserSettings?.addCallLogSubject?.value ?? false
            },
            addCallLogContactNumber: {
                customizable: adminUserSettings?.addCallLogContactNumber?.customizable ?? true,
                value: adminUserSettings?.addCallLogContactNumber?.value ?? false
            },
            addCallLogDateTime: {
                customizable: adminUserSettings?.addCallLogDateTime?.customizable ?? true,
                value: adminUserSettings?.addCallLogDateTime?.value ?? false
            },
            logDateFormat: {
                customizable: adminUserSettings?.logDateFormat?.customizable ?? true,
                value: adminUserSettings?.logDateFormat?.value ?? 'YYYY-MM-DD hh:mm:ss A'
            },
            addCallLogDuration: {
                customizable: adminUserSettings?.addCallLogDuration?.customizable ?? true,
                value: adminUserSettings?.addCallLogDuration?.value ?? false
            },
            addCallLogResult: {
                customizable: adminUserSettings?.addCallLogResult?.customizable ?? true,
                value: adminUserSettings?.addCallLogResult?.value ?? false
            },
            addCallLogRecording: {
                customizable: adminUserSettings?.addCallLogRecording?.customizable ?? true,
                value: adminUserSettings?.addCallLogRecording?.value ?? false
            },
            addCallLogAiNote: {
                customizable: adminUserSettings?.addCallLogAiNote?.customizable ?? true,
                value: adminUserSettings?.addCallLogAiNote?.value ?? false
            },
            addCallLogTranscript: {
                customizable: adminUserSettings?.addCallLogTranscript?.customizable ?? true,
                value: adminUserSettings?.addCallLogTranscript?.value ?? false
            }
        }
    }
}

exports.getCallLogDetailsSettingPageRender = getCallLogDetailsSettingPageRender;