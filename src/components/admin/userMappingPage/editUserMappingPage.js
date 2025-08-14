const CONTENT_MARGIN_TOP = '-20px';
const SECTION_MARGIN_TOP = '-5px';

function renderEditUserMappingPage({ userMapping, platformName, rcExtensions }) {
    return {
        id: 'editUserMappingPage',
        title: `Edit mapping for ${userMapping.crmUser.name}`,
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                crmUserIdTitle: {
                    type: 'string',
                    description: 'ID'
                },
                crmUserId: {
                    type: 'string',
                    const: userMapping.crmUser.id,
                    description: userMapping.crmUser.id
                },
                crmUserNameTitle: {
                    type: 'string',
                    description: 'Name'
                },
                crmUserName: {
                    type: 'string',
                    const: userMapping.crmUser.name,
                    description: userMapping.crmUser.name
                },
                crmUserEmailTitle: {
                    type: 'string',
                    description: 'Email'
                },
                crmUserEmail: {
                    type: 'string',
                    const: userMapping.crmUser.email,
                    description: userMapping.crmUser.email
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
            crmUserId: userMapping.crmUser.id,
            crmUserName: userMapping.crmUser.name,
            crmUserEmail: userMapping.crmUser.email,
            rcExtensionList: rcExtensions.find(rc => rc.id === userMapping?.rcUser?.extensionId)?.id || 'none'
        }
    }
}

exports.renderEditUserMappingPage = renderEditUserMappingPage;