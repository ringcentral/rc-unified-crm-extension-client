function getCallLogDetailsSettingPageRender({ adminUserSettings, userPermissions }) {
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
                    description: 'Log the notes manually entered by agent user',
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
                    description: 'Log RingCentral call session id',
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
                    description: 'Log the RingCentral user name',
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
                    description: 'Log the RingCentral phone number',
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
                    description: "Log a short phrase to summarize call, e.g. 'Inbound call from...'",
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
                    description: 'Log the contact information of the other participant',
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
                    description: 'Log the call\'s explicit start and end date/times',
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
                    description: 'Log the call duration, noted in minutes and seconds',
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
                    description: 'Log the result of the call, e.g. Call connected',
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
                    description: 'Provide a link to the call\'s recording, if it exists',
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
                    description: 'Log the AI-generated summary of the call, if it exists',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value',
                            description: userPermissions.aiNote ? '' : 'AI Assistant required'
                        }
                    }
                },
                addCallLogTranscript: {
                    type: 'object',
                    title: 'Call transcript',
                    description: 'Log the AI-generated transcript of the call, if it exists',
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: 'Customizable by user'
                        },
                        value: {
                            type: 'boolean',
                            title: 'Value',
                            description: userPermissions.aiNote ? '' : 'AI Assistant required'
                        }
                    }
                },
                addCallLogRingSenseRecordingTranscript: {
                    type: 'object',
                    title: 'RingSense transcript',
                    description: '[RingSense license](https://www.ringcentral.com/ringsense.html?ref=AppConnect) required. Server-side logging only.',
                    properties: {
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                addCallLogRingSenseRecordingAIScore: {
                    type: 'object',
                    title: 'RingSense call score',
                    description: '[RingSense license](https://www.ringcentral.com/ringsense.html?ref=AppConnect) required. Server-side logging only.',
                    properties: {
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                addCallLogRingSenseRecordingSummary: {
                    type: 'object',
                    title: 'RingSense summary',
                    description: '[RingSense license](https://www.ringcentral.com/ringsense.html?ref=AppConnect) required. Server-side logging only.',
                    properties: {
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                addCallLogRingSenseRecordingBulletedSummary: {
                    type: 'object',
                    title: 'RingSense bulleted summary',
                    description: '[RingSense license](https://www.ringcentral.com/ringsense.html?ref=AppConnect) required. Server-side logging only.',
                    properties: {
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                addCallLogRingSenseRecordingLink: {
                    type: 'object',
                    title: 'RingSense recording link',
                    description: '[RingSense license](https://www.ringcentral.com/ringsense.html?ref=AppConnect) required. Server-side logging only.',
                    properties: {
                        value: {
                            type: 'boolean',
                            title: 'Value'
                        }
                    }
                },
                addCallLogLegs: {
                    type: 'object',
                    title: 'Call journey',
                    description: 'Server-side logging only.',
                    properties: {
                        value: {
                            type: 'boolean',
                            title: 'Value',
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
                "ui:disabled": !userPermissions.aiNote,
            },
            addCallLogTranscript: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.aiNote,
            },
            addCallLogRingSenseRecordingTranscript: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.ringSenseInsights,
            },
            addCallLogRingSenseRecordingAIScore: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.ringSenseInsights,
            },
            addCallLogRingSenseRecordingSummary: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.ringSenseInsights,
            },
            addCallLogRingSenseRecordingBulletedSummary: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.ringSenseInsights,
            },
            addCallLogRingSenseRecordingLink: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.ringSenseInsights,
            },
            addCallLogLegs: {
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
            },
            addCallLogRingSenseRecordingTranscript: {
                customizable: false,
                value: adminUserSettings?.addCallLogRingSenseRecordingTranscript?.value ?? false
            },
            addCallLogRingSenseRecordingAIScore: {
                customizable: false,
                value: adminUserSettings?.addCallLogRingSenseRecordingAIScore?.value ?? false
            },
            addCallLogRingSenseRecordingSummary: {
                customizable: false,
                value: adminUserSettings?.addCallLogRingSenseRecordingSummary?.value ?? false
            },
            addCallLogRingSenseRecordingBulletedSummary: {
                customizable: false,
                value: adminUserSettings?.addCallLogRingSenseRecordingBulletedSummary?.value ?? false
            },
            addCallLogRingSenseRecordingLink: {
                customizable: false,
                value: adminUserSettings?.addCallLogRingSenseRecordingLink?.value ?? false
            },
            addCallLogLegs: {
                customizable: false,
                value: adminUserSettings?.addCallLogLegs?.value ?? false
            }
        }
    }
}

exports.getCallLogDetailsSettingPageRender = getCallLogDetailsSettingPageRender;