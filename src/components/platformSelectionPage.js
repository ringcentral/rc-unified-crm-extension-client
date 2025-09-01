function getPlatformSelectionPageRender({ manifest }) {
    const platformList = [];

    // put the new element as the last element that has the same developer
    // if there's no same developer, put it at the last of the array
    for (const platform of Object.values(manifest.platforms)) {
        const newPlatform = {
            const: platform.name,
            title: platform.displayName,
            icon: platform.logoUrl,
            description: `by ${platform.developer.name}`,
            meta: 'Public'
        };
        platformList.push(newPlatform);
    }
    return {
        id: 'platformSelectionPage',
        title: 'Select platform',
        type: 'page',
        hideBackButton: true,
        schema: {
            type: 'object',
            properties: {
                platforms: {
                    type: 'string',
                    title: 'Platforms',
                    oneOf: platformList
                }
            },
            required: ['platforms']
        },
        uiSchema: {
            platforms: {
                "ui:field": "list",
                "ui:showIconAsAvatar": false
            },
            submitButtonOptions: { // optional if you don't want to show submit button
                submitText: 'Select',
            }
        },
        formData: {
            platforms: ''
        }
    }
}

function getUpdatedPlatformSelectionPageRender({ page, formData }) {
    const updatedPage = { ...page };
    updatedPage.formData.platforms = formData.platforms;
    return updatedPage;
}

exports.getPlatformSelectionPageRender = getPlatformSelectionPageRender;
exports.getUpdatedPlatformSelectionPageRender = getUpdatedPlatformSelectionPageRender;