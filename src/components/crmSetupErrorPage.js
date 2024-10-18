function getCRMSetupErrorPageRender() {
    const crmSetupErrorPage = {
        id: 'crmSetupErrorPage',
        title: 'Unable to detect CRM',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                warning:{
                    type: 'string',
                    description: 'We were unable to detect a supported CRM',
                },
                message:{
                    type: 'string',
                    description: "We couldn't detect a supported CRM. To properly identify your CRM, please follow these steps:",
                },
                step1:{
                    type: 'string',
                    description: 'Close the Unified CRM extension window.'
                },
                step2:{
                    type: 'string',
                    description: 'Navigate to your CRM and login.'
                },
                step3:{
                    type: 'string',
                    description: 'From within the CRM, click the orange badge to launch the Unified CRM extension.'
                },
                helperMessage:{
                    type: 'string',
                    description: 'If your CRM is detected successfully, this message will not appear.'
                },
                resourceTitle:{
                    type: 'string',
                    description: 'Resources:'
                },
                supportedCRMLink:{
                    type: 'string',
                    description: 'Supported CRMs'
                },
                documentationLink:{
                    type: 'string',
                    description: 'Documentation'
                },
                communityLink:{
                    type: 'string',
                    description: 'Community'
                }
            }
        },
        uiSchema: {
            warning: {
              "ui:field": "admonition",
              "ui:severity": "warning",  // "warning", "info", "error", "success"
            },
            message: {
              "ui:field": "typography",
              "ui:variant": "body1", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
            },
            step1: {
              "ui:field": "typography",
              "ui:variant": "body1", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
              "ui:bulletedList": true, // show text as list item // supported from v2.0.1
            },
            step2: {
              "ui:field": "typography",
              "ui:variant": "body1", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
              "ui:bulletedList": true, // show text as list item // supported from v2.0.1
            },
            step3: {
              "ui:field": "typography",
              "ui:variant": "body1", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
              "ui:bulletedList": true, // show text as list item // supported from v2.0.1
            },
            helperMessage: {
              "ui:field": "typography",
              "ui:variant": "body1", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
            },
            resourceTitle: {
              "ui:field": "typography",
              "ui:variant": "body1", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
            },
            supportedCRMLink:{
                "ui:field": "link", // supported from v2.0.1
                "ui:variant": "body1",
                "ui:underline": true,
                "ui:href": "https://ringcentral.github.io/rc-unified-crm-extension/crm/",  
                "ui:bulletedList": true, // show text as list item // supported from v2.0.1      
            },
            documentationLink:{
                "ui:field": "link", // supported from v2.0.1
                "ui:variant": "body1",
                "ui:underline": true,
                "ui:href": "https://ringcentral.github.io/rc-unified-crm-extension/users/access/",        
                "ui:bulletedList": true, // show text as list item // supported from v2.0.1
            },
            communityLink:{
                "ui:field": "link", // supported from v2.0.1
                "ui:variant": "body1",
                "ui:underline": true,
                "ui:href": "https://community.ringcentral.com/groups/unified-crm-extension-22",        
                "ui:bulletedList": true, // show text as list item // supported from v2.0.1
            }
        }
    };
    return crmSetupErrorPage;
}

exports.getCRMSetupErrorPageRender = getCRMSetupErrorPageRender;