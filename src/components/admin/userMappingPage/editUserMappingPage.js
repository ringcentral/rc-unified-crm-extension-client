const CONTENT_MARGIN_TOP = '-20px';
const SECTION_MARGIN_TOP = '-5px';

function renderEditUserMappingPage({ userMapping, platformName, rcExtensions, selectedRcExtensionId }) {
    return {
        id: 'editUserMappingPage',
        title: `Edit mapping for ${userMapping.crmUser.name}`,
        type: 'page',
        schema: {
            type: 'object',
            required: ['rcExtensionList'],
            properties: {
                crmUserIdTitle: {
                    type: 'string',
                    description: `${platformName} ID`
                },
                crmUserId: {
                    type: 'string',
                    const: userMapping.crmUser.id,
                    description: userMapping.crmUser.id
                },
                crmUserNameTitle: {
                    type: 'string',
                    description: `${platformName} Username`
                },
                crmUserName: {
                    type: 'string',
                    const: userMapping.crmUser.name,
                    description: userMapping.crmUser.name
                },
                crmUserEmailTitle: {
                    type: 'string',
                    description: `${platformName} User Email`
                },
                crmUserEmail: {
                    type: 'string',
                    const: userMapping.crmUser.email,
                    description: userMapping.crmUser.email
                },
                rcExtensionList: {
                    type: 'string',
                    title: 'RingCentral user',
                    description: 'Link to a RingCentral user',
                    enum: rcExtensions.map(rc => rc.id),
                    enumNames: rcExtensions.map(rc => rc.name ?
                        `${rc.name} ${rc.email ? `- ${rc.email}` : ''} ${rc.extensionNumber ? `(ext: ${rc.extensionNumber})` : ''}` :
                        `${rc.firstName} ${rc.lastName} ${rc.email ? `- ${rc.email}` : ''} ${rc.extensionNumber ? `(ext: ${rc.extensionNumber})` : ''}`)
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
            rcExtensionList: {
                "ui:widget": "AutocompleteWidget",
                "ui:placeholder": "Start typing a RingCentral user name..."
            },
            submitButtonOptions: {
                submitText: 'Save'
            }
        },
        formData: {
            userMapping,
            rcExtensions,
            crmUserId: userMapping.crmUser.id,
            crmUserName: userMapping.crmUser.name,
            crmUserEmail: userMapping.crmUser.email,
            rcExtensionList: selectedRcExtensionId || rcExtensions.find(rc => rc.id === userMapping?.rcUser?.extensionId)?.id
        }
    }
}

exports.renderEditUserMappingPage = renderEditUserMappingPage;