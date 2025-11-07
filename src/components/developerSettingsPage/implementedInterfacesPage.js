function getImplementedInterfacesPageRender({ implementedInterfaces }) {
    // implementedInterfaces is an object that holds interface names and statuses
    const implementedInterfacesOptions = Object.entries(implementedInterfaces).map(([name, status]) => ({
        const: name,
        title: name,
        meta: status ? 'Implemented' : 'Not implemented'
    }));
    return {
        id: 'implementedInterfacesPage',
        title: 'Implemented interfaces',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                implementedInterfaces: {
                    type: "string",
                    title: "Implemented interfaces",
                    oneOf: implementedInterfacesOptions
                }
            }
        },
        uiSchema: {
            implementedInterfaces: {
                "ui:field": "list"
            }
        },
        formData: {}
    }
}

exports.getImplementedInterfacesPageRender = getImplementedInterfacesPageRender;