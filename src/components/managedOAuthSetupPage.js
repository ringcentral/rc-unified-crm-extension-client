const DEFAULT_REDIRECT_URI = 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html';

const MANAGED_OAUTH_FIELDS = {
    clientId: {
        title: 'Client ID',
        type: 'string',
    },
    clientSecret: {
        title: 'Client Secret',
        type: 'string',
    },
    accessTokenUri: {
        title: 'Access Token URI',
        type: 'string',
    },
    authorizationUri: {
        title: 'Authorization URI',
        type: 'string',
    },
    redirectUri: {
        title: 'Redirect URI',
        type: 'string',
    },
    scopes: {
        title: 'Scopes',
        type: 'string',
    },
    hostname: {
        title: 'Hostname',
        type: 'string',
    },
};

function getManagedOAuthSetupPageRender({ platform, pendingValues = {} }) {
    const setupNotes = platform?.auth?.oauth?.adminManaged?.setupNotes;
    const notes = setupNotes ? {
        setupNotes: {
            type: 'string',
            description: setupNotes,
        }
    } : {};
    return {
        id: 'managedOAuthSetupPage',
        title: 'Admin-managed OAuth credentials',
        schema: {
            type: 'object',
            required: [
                'clientId',
                'clientSecret',
                'accessTokenUri',
                'authorizationUri',
                'redirectUri',
                'hostname'
            ],
            properties: {
                ...notes,
                ...MANAGED_OAUTH_FIELDS
            }
        },
        uiSchema: {
            submitButtonOptions: {
                submitText: 'Save and connect'
            },
            setupNotes: {
                'ui:field': 'admonition',
                'ui:severity': 'warning',
            },
            clientSecret: {
                'ui:widget': 'password'
            }
        },
        formData: {
            redirectUri: DEFAULT_REDIRECT_URI,
            ...pendingValues
        }
    };
}

exports.getManagedOAuthSetupPageRender = getManagedOAuthSetupPageRender;
