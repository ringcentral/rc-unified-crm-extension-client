function getInstalledProcessorListPageRender({ viewType, processorList }) {
    let processorListToRender = [];
    for (const processor of processorList) {
        const newProcessor = {
            const: `${processor.id}=${processor.access}`,
            title: processor.displayName ?? processor.name,
            icon: processor.iconUrl ? processor.iconUrl : 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
            description: `by ${processor.developer.name}`,
            authorAvatar: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
            actions: [
                {
                    id: 'selectProcessor',
                    title: 'Configure',
                    icon: 'connect'
                }
            ]
        };
        processorListToRender.push(newProcessor);
    }
    const page = {
        id: 'installedProcessorListPage',
        title: 'Installed processors',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                ...(processorListToRender.length > 0 ? {
                    processors: {
                        type: 'string',
                        title: 'Processors',
                        oneOf: processorListToRender
                    }
                } : {})
            }
        },
        uiSchema: {
            processors: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false
            },
            submitButtonOptions: {
                submitText: 'Explore'
            }
        },
        formData: {
            processorList,
            viewType
        }
    }
    if (processorList?.length === 0) {
        page.schema.properties.helperText = {
            type: 'string',
            description: 'No processors installed'
        },
            page.uiSchema.helperText = {
                "ui:field": "typography",
                "ui:variant": "body1",
            }
        page.schema.properties.exploreButton = {
            type: 'string',
            title: 'Explore'
        }
        page.uiSchema.exploreButton = {
            "ui:field": "button",
            "ui:variant": "outlined",
            "ui:fullWidth": true
        }
    }
    return page;
}
exports.getInstalledProcessorListPageRender = getInstalledProcessorListPageRender;