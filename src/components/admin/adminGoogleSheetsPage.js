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
            title: `Current sheet: ${existingGoogleSheetsName} ${isManaged ? '(Admin managed)' : ''}`
        }
        page.uiSchema.adminSheetInfoButton = {
            "ui:field": "button",
            "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": true
        }
        page.schema.properties.managedToggle = {
            type: "boolean",
            title: "Force this sheet for all users"
        }
        page.uiSchema.managedToggle = {
            "ui:description": "When enabled, users cannot change Google Sheets settings"
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
        page.formData.managedToggle = !isManaged ? false : true;
    }
    else {
        page.schema.properties.newSheetName = {
            type: "string",
            title: "New sheet name"
        }
        page.schema.required = ["newSheetName"];
        page.schema.properties.managedToggle = {
            type: "boolean",
            title: "Force this sheet for all users"
        }
        page.uiSchema.managedToggle = {
            "ui:description": "When enabled, users cannot change Google Sheets settings"
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
        page.formData.managedToggle = false;
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
