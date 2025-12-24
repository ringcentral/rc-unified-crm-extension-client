function getProcessorConfigurePageRender({ processor }) {
    return {
        id: 'processorConfigurePage',
        title: 'Configure processor',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    title: processor.displayName ?? processor.name,
                }
            }
        }
    }
}

exports.getProcessorConfigurePageRender = getProcessorConfigurePageRender;