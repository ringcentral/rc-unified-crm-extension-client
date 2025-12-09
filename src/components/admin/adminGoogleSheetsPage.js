function renderAdminGoogleSheetsPage({ manifest, adminSettings }) {
    const existingGoogleSheetsName = adminSettings?.userSettings?.googleSheetsName?.value ?? "";
    const existingGoogleSheetsUrl = adminSettings?.userSettings?.googleSheetsUrl?.value ?? "";
    const isManaged = adminSettings?.userSettings?.googleSheetsName?.customizable === false;
    
    const page = {
        id: 'adminGoogleSheetsPage',
        title: "Admin Google Sheets Config",
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                warning: {
                    type: "string",
                    description: "Admin configuration will override all user settings. Only one sheet can be used at the same time."
                }
            }
        },
        uiSchema: {
            warning: {
                "ui:field": "admonition",
                "ui:severity": "warning",  // "warning", "info", "error", "success"
            }
        },
        formData: {

        }
    }
    
    if (existingGoogleSheetsName) {
        page.schema.properties.adminSheetInfoButton = {
            type: "string",
            title: `Current sheet: ${existingGoogleSheetsName}`
        }
        page.uiSchema.adminSheetInfoButton = {
            "ui:field": "button",
            "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": true
        }
        page.schema.properties.forceGoogleSheets = {
            type: 'object',
            title: 'Google Sheets Customizable',
            properties: {
                customizable: {
                    type: 'boolean',
                    title: 'Customizable by user',
                    description: 'When disabled, users will be forced to use this sheet and cannot change Google Sheets settings'
                }
            }
        }
        page.uiSchema.forceGoogleSheets = {
            "ui:collapsible": true,
        }
        page.schema.properties.adminRemoveSheetButton = {
            type: "string",
            title: "Remove sheet"
        }
        page.uiSchema.adminRemoveSheetButton = {
            "ui:field": "button",
            "ui:variant": "contained", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": true,
            "ui:color": "danger.b03"
        }
        page.formData.sheetUrl = existingGoogleSheetsUrl;
        page.formData.forceGoogleSheets = {
            customizable: !isManaged
        };
    }
    else {
        page.schema.properties.newSheetName = {
            type: "string",
            title: "New sheet name"
        }
        page.schema.required = ["newSheetName"];
        page.schema.properties.forceGoogleSheets = {
            type: 'object',
            title: 'Google Sheets Customizable',
            properties: {
                customizable: {
                    type: 'boolean',
                    title: 'Customizable by user',
                    description: 'When disabled, users will be forced to use this sheet and cannot change Google Sheets settings'
                }
            }
        }
        page.uiSchema.forceGoogleSheets = {
            "ui:collapsible": true,
        }
        page.schema.properties.adminNewSheetButton = {
            type: "string",
            title: "Create new sheet"
        }
        page.uiSchema.newSheetName = {
            "ui:placeholder": 'Enter name...',
        }
        page.uiSchema.adminNewSheetButton = {
            "ui:field": "button",
            "ui:variant": "contained", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": true,
            "ui:disabled": true
        }
        page.schema.properties.adminSelectExistingSheetButton = {
            type: "string",
            title: "Select existing sheet"
        }
        page.uiSchema.adminSelectExistingSheetButton = {
            "ui:field": "button",
            "ui:variant": "contained", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": true
        }
        page.formData.forceGoogleSheets = {
            customizable: true
        };
    }
    return page;
}

function getUpdatedAdminGoogleSheetsPage({ page, formData }) {
    const updatedPage = { ...page };
    updatedPage.formData = formData;
    if(formData.newSheetName){
        delete updatedPage.uiSchema.adminNewSheetButton["ui:disabled"];
    }
    else if (updatedPage.uiSchema.adminNewSheetButton) {
        updatedPage.uiSchema.adminNewSheetButton["ui:disabled"] = true;
    }
    return updatedPage;
}

exports.renderAdminGoogleSheetsPage = renderAdminGoogleSheetsPage;
exports.getUpdatedAdminGoogleSheetsPage = getUpdatedAdminGoogleSheetsPage;
