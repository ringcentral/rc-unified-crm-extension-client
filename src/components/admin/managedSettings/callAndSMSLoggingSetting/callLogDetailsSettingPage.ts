import { t } from '../../../../i18n';

type UnknownRecord = Record<string, any>;

function getCallLogDetailsSettingPageRender({ adminUserSettings, userPermissions, serverSideLoggingSubscribed }: UnknownRecord): UnknownRecord {
    return {
        id: 'callLogDetailsSettingPage',
        title: t('settings.callLogDetails.groupName'),
        type: 'page',
        schema: {
            type: 'object',
            required: [],
            properties: {
                addCallLogNote: {
                    type: 'object',
                    title: t('settings.callLogDetails.agentNotes'),
                    description: t('settings.callLogDetails.agentNotesDescAdmin'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallSessionId: {
                    type: 'object',
                    title: t('settings.callLogDetails.callSessionId'),
                    description: t('settings.callLogDetails.callSessionIdDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addRingCentralUserName: {
                    type: 'object',
                    title: t('settings.callLogDetails.rcUserName'),
                    description: t('settings.callLogDetails.rcUserNameDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addRingCentralNumber: {
                    type: 'object',
                    title: t('settings.callLogDetails.rcNumber'),
                    description: t('settings.callLogDetails.rcNumberDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogSubject: {
                    type: 'object',
                    title: t('settings.callLogDetails.callSubject'),
                    description: t('settings.callLogDetails.callSubjectDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogContactNumber: {
                    type: 'object',
                    title: t('settings.callLogDetails.contactNumber'),
                    description: t('settings.callLogDetails.contactNumberDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogDateTime: {
                    type: 'object',
                    title: t('settings.callLogDetails.dateTime'),
                    description: t('settings.callLogDetails.dateTimeDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                logDateFormat: {
                    type: 'object',
                    title: t('settings.callLogDetails.dateFormat'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'string',
                            title: t('common.labels.value'),
                            oneOf: [
                                {
                                    const: 'YYYY-MM-DD HH:mm:ss',
                                    title: t('settings.callLogDetails.dateFormatGlobal24H')
                                },
                                {
                                    const: 'YYYY-MM-DD hh:mm:ss A',
                                    title: t('settings.callLogDetails.dateFormatGlobal12H')
                                },
                                {
                                    const: 'MM/DD/YYYY hh:mm:ss A',
                                    title: t('settings.callLogDetails.dateFormatUS12H')
                                },
                                {
                                    const: 'MM/DD/YYYY HH:mm:ss',
                                    title: t('settings.callLogDetails.dateFormatUS24H')
                                },
                                {
                                    const: 'DD/MM/YYYY HH:mm:ss',
                                    title: t('settings.callLogDetails.dateFormatEU24H')
                                },
                                {
                                    const: 'DD/MM/YYYY hh:mm:ss A',
                                    title: t('settings.callLogDetails.dateFormatEU12H')
                                }
                            ]
                        }
                    }
                },
                addCallLogDuration: {
                    type: 'object',
                    title: t('settings.callLogDetails.callDuration'),
                    description: t('settings.callLogDetails.callDurationDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogResult: {
                    type: 'object',
                    title: t('settings.callLogDetails.callResult'),
                    description: t('settings.callLogDetails.callResultDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogRecording: {
                    type: 'object',
                    title: t('settings.callLogDetails.recordingLink'),
                    description: t('settings.callLogDetails.recordingLinkDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogAiNote: {
                    type: 'object',
                    title: t('settings.callLogDetails.smartSummary'),
                    description: t('settings.callLogDetails.smartSummaryDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value'),
                            description: userPermissions.aiNote ? '' : t('settings.callLogDetails.aiAssistantRequired')
                        }
                    }
                },
                addCallLogTranscript: {
                    type: 'object',
                    title: t('settings.callLogDetails.transcript'),
                    description: t('settings.callLogDetails.transcriptDesc'),
                    properties: {
                        customizable: {
                            type: 'boolean',
                            title: t('common.labels.customizableByUser')
                        },
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value'),
                            description: userPermissions.aiNote ? '' : t('settings.callLogDetails.aiAssistantRequired')
                        }
                    }
                },
                addCallLogRingSenseRecordingTranscript: {
                    type: 'object',
                    title: t('settings.callLogDetails.ringSenseTranscript'),
                    description: t('settings.callLogDetails.ringSenseTranscriptDesc'),
                    properties: {
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogRingSenseRecordingAIScore: {
                    type: 'object',
                    title: t('settings.callLogDetails.ringSenseCallScore'),
                    description: t('settings.callLogDetails.ringSenseCallScoreDesc'),
                    properties: {
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogRingSenseRecordingSummary: {
                    type: 'object',
                    title: t('settings.callLogDetails.ringSenseSummary'),
                    description: t('settings.callLogDetails.ringSenseSummaryDesc'),
                    properties: {
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogRingSenseRecordingBulletedSummary: {
                    type: 'object',
                    title: t('settings.callLogDetails.ringSenseBulletedSummary'),
                    description: t('settings.callLogDetails.ringSenseBulletedSummaryDesc'),
                    properties: {
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogRingSenseRecordingLink: {
                    type: 'object',
                    title: t('settings.callLogDetails.ringSenseRecordingLink'),
                    description: t('settings.callLogDetails.ringSenseRecordingLinkDesc'),
                    properties: {
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value')
                        }
                    }
                },
                addCallLogLegs: {
                    type: 'object',
                    title: t('settings.callLogDetails.callJourney'),
                    description: t('settings.callLogDetails.callJourneyDesc'),
                    properties: {
                        value: {
                            type: 'boolean',
                            title: t('common.labels.value'),
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
                "ui:disabled": !userPermissions.ringSenseInsights || !serverSideLoggingSubscribed,
            },
            addCallLogRingSenseRecordingAIScore: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.ringSenseInsights || !serverSideLoggingSubscribed,
            },
            addCallLogRingSenseRecordingSummary: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.ringSenseInsights || !serverSideLoggingSubscribed,
            },
            addCallLogRingSenseRecordingBulletedSummary: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.ringSenseInsights || !serverSideLoggingSubscribed,
            },
            addCallLogRingSenseRecordingLink: {
                "ui:collapsible": true,
                "ui:disabled": !userPermissions.ringSenseInsights || !serverSideLoggingSubscribed,
            },
            addCallLogLegs: {
                "ui:collapsible": true,
                "ui:disabled": !serverSideLoggingSubscribed,
            },
            submitButtonOptions: {
                submitText: t('common.buttons.save'),
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

export { getCallLogDetailsSettingPageRender };
export default {
    getCallLogDetailsSettingPageRender,
};
