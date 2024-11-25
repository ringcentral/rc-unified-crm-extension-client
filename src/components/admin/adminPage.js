const adminIcon = require('../../images/adminIcon.png');

function getAdminPageRender() {
    return {
        id: 'adminPage',
        title: 'Admin Settings',
        type: 'tab',
        priority: 5,
        iconUri: adminIcon, // icon for tab, 24x24
        activeIconUri: adminIcon, // icon for tab in active status, 24x24
        schema: {
            type: 'object',
            reuiqred: [],
            properties: {
                section: {
                    type: "string",
                    oneOf: [{
                        const: "customAdapter",
                        title: "Custom adapter",
                    }, {
                        const: "managedSettings",
                        title: "Managed settings",
                    }]
                }
            }
        },
        uiSchema: {
            section: {
                "ui:field": "list",
                "ui:navigation": true,
            }
        }
    }
}

exports.getAdminPageRender = getAdminPageRender;