const CONTENT_MARGIN_TOP = '-20px';
const SECTION_MARGIN_TOP = '-5px';

function renderEditUserMappingPage({ userMapping, platformName, rcExtensions, selectedRcExtensionId, searchWord = '' }) {
    const rcExtensionsToRender = searchWord ? rcExtensions.filter(rc =>
        rc.name && rc.name.toLowerCase().includes(searchWord.toLowerCase()) ||
        rc.firstName && rc.lastName && `${rc.firstName} ${rc.lastName}`.toLowerCase().includes(searchWord.toLowerCase()) ||
        rc.email && rc.email.toLowerCase().includes(searchWord.toLowerCase()) ||
        rc.extensionNumber && rc.extensionNumber.toLowerCase().includes(searchWord.toLowerCase())
    ) : rcExtensions;
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
                rcExtensionListTitle: {
                    type: 'string',
                    description: `Link to a RingCentral user: `
                },
                searchWord: {
                    type: 'string',
                    title: 'Search RingCentral Address Book'
                },
                rcExtensionList: {
                    type: 'string',
                    oneOf: rcExtensionsToRender.map(rc => (
                        {
                            const: rc.id,
                            title: rc.name ? `${rc.name} ${rc.extensionNumber ? `(ext: ${rc.extensionNumber})` : ''}` : `${rc.firstName} ${rc.lastName} ${rc.extensionNumber ? `(ext: ${rc.extensionNumber})` : ''}`,
                            description: rc.email
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
            rcExtensionListTitle: {
                "ui:field": "typography",
                "ui:variant": "body2",
                "ui:style": {
                    marginTop: SECTION_MARGIN_TOP,
                    marginBottom: '-5px'
                }
            },
            rcExtensionList: {
                "ui:field": "list",
                "ui:style": {
                    marginLeft: '5%',
                    marginRight: '5%'
                }
            },
            searchWord: {
                "ui:placeholder": "search...",
                "ui:style": {
                    marginLeft: '5%',
                    marginRight: '5%'
                }
            },
            submitButtonOptions: {
                submitText: 'Save'
            }
        },
        formData: {
            userMapping,
            rcExtensions,
            searchWord,
            crmUserId: userMapping.crmUser.id,
            crmUserName: userMapping.crmUser.name,
            crmUserEmail: userMapping.crmUser.email,
            rcExtensionList: selectedRcExtensionId || rcExtensions.find(rc => rc.id === userMapping?.rcUser?.extensionId)?.id || 'none'
        }
    }
}

exports.renderEditUserMappingPage = renderEditUserMappingPage;