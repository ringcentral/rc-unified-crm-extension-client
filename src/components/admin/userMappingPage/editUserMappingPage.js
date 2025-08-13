const CONTENT_MARGIN_TOP = '-20px';
const SECTION_MARGIN_TOP = '-5px';

function renderEditUserMappingPage({ crmUser, platformName, rcExtensions }) {
    return {
        id: 'editUserMappingPage',
        title: `Edit mapping for ${crmUser.crmUserName}`,
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                crmUserIdTitle: {
                    type: 'string',
                    description: 'User ID'
                },
                crmUserId: {
                    type: 'string',
                    const: crmUser.crmUserId,
                    description: crmUser.crmUserId
                },
                crmUserNameTitle: {
                    type: 'string',
                    description: 'User name'
                },
                crmUserName: {
                    type: 'string',
                    const: crmUser.crmUserName,
                    description: crmUser.crmUserName
                },
                crmUserEmailTitle: {
                    type: 'string',
                    description: 'User email'
                },
                crmUserEmail: {
                    type: 'string',
                    const: crmUser.crmUserEmail,
                    description: crmUser.crmUserEmail
                },
                rcExtensionList: {
                    type: 'string',
                    title: 'Mapped to RingCentral user:',
                    oneOf: rcExtensions.map(rc => (
                        {
                            const: rc.id,
                            title: rc.name ? `${rc.name} ${rc.extensionNumber ? `(ext: ${rc.extensionNumber})` : ''}` : `${rc.firstName} ${rc.lastName} ${rc.extensionNumber ? `(ext: ${rc.extensionNumber})` : ''}`
                        }
                    ))
                }
            }
        },
        uiSchema: {
            crmUserIdTitle: {
                "ui:field": "typography",
                "ui:variant": "body1"
            },
            crmUserId: {
                "ui:field": "typography",
                "ui:variant": "body2",
                "ui:style": { marginTop: CONTENT_MARGIN_TOP }
            },
            crmUserNameTitle: {
                "ui:field": "typography",
                "ui:variant": "body1",
                "ui:style": { marginTop: SECTION_MARGIN_TOP }
            },
            crmUserName: {
                "ui:field": "typography",
                "ui:variant": "body2",
                "ui:style": { marginTop: CONTENT_MARGIN_TOP }
            },
            crmUserEmailTitle: {
                "ui:field": "typography",
                "ui:variant": "body1",
                "ui:style": { marginTop: SECTION_MARGIN_TOP }
            },
            crmUserEmail: {
                "ui:field": "typography",
                "ui:variant": "body2",
                "ui:style": { marginTop: CONTENT_MARGIN_TOP }
            },
            submitButtonOptions: {
                submitText: 'Save'
            }
        },
        formData: {
            crmUserId: crmUser.crmUserId,
            crmUserName: crmUser.crmUserName,
            crmUserEmail: crmUser.crmUserEmail,
            rcExtensionList: rcExtensions.find(rc => rc.id === crmUser.rcExtensionId)?.id
        }
    }
}

exports.renderEditUserMappingPage = renderEditUserMappingPage;