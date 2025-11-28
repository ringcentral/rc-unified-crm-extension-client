function renderGoogleSheetsPage({ manifest, userSettings }) {
    const existingGoogleSheetsName = userSettings?.googleSheetsName?.value ?? "";
    const existingGoogleSheetsUrl = userSettings?.googleSheetsUrl?.value ?? "";
    const isAdminManaged = userSettings?.googleSheetsName?.adminManaged || userSettings?.googleSheetsName?.customizable === false;
    const isForceForAllUsers = userSettings?.googleSheetsName?.forceForAllUsers;
    const page = {
        id: 'googleSheetsPage',
        title: "Google Sheets Config",
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                warning: {
                    type: "string",
                    description: isAdminManaged ? 
                        (isForceForAllUsers ? 
                            "This Google Sheets configuration is enforced by your administrator." : 
                            "This Google Sheets configuration is managed by your administrator.") :
                        "Only one sheet can be used at the same time."
                }
            }
        },
        uiSchema: {
            warning: {
                "ui:field": "admonition",
                "ui:severity": isAdminManaged ? "info" : "warning",  // "warning", "info", "error", "success"
            }
        },
        formData: {

        }
    }
    if (existingGoogleSheetsName) {
        page.schema.properties.sheetInfoButton = {
            type: "string",
            title: `Sheet name: ${existingGoogleSheetsName}${isAdminManaged ? ' (Admin managed)' : ''}`
        }
        page.uiSchema.sheetInfoButton = {
            "ui:field": "button",
            "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": true
        }
        page.schema.properties.removeSheetButton = {
            type: "string",
            title: isAdminManaged ? "Remove sheet (Disabled - Admin managed)" : "Remove sheet"
        }
        page.uiSchema.removeSheetButton = {
            "ui:field": "button",
            "ui:variant": "contained", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": true,
            "ui:color": "danger.b03",
            "ui:disabled": isAdminManaged
        }
        page.formData.sheetUrl = existingGoogleSheetsUrl;
    }
    else {
        if (isAdminManaged) {
            // When admin is managing but no sheet is configured yet
            page.schema.properties.adminManagedMessage = {
                type: "string",
                description: "Google Sheets configuration is managed by your administrator. Please contact your administrator to configure a sheet."
            }
            page.uiSchema.adminManagedMessage = {
                "ui:field": "admonition",
                "ui:severity": "info"
            }
        } else {
            // Normal user flow when not admin managed
            page.schema.properties.newSheetName = {
                type: "string",
                title: "New sheet name"
            }
            page.schema.required = ["newSheetName"];
            page.schema.properties.newSheetButton = {
                type: "string",
                title: "Create new sheet"
            }
            page.uiSchema.newSheetName = {
                "ui:placeholder": 'Enter name...',
            }
            page.uiSchema.newSheetButton = {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true,
                "ui:disabled": true
            }
            page.schema.properties.selectExistingSheetButton = {
                type: "string",
                title: "Select existing sheet"
            }
            page.uiSchema.selectExistingSheetButton = {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            }
        }
    }
    return page;
}

function getUpdatedGoogleSheetsPage({ page, formData }) {
    const updatedPage = { ...page };
    updatedPage.formData = formData;
    if(formData.newSheetName){
        delete updatedPage.uiSchema.newSheetButton["ui:disabled"];
    }
    else{
        updatedPage.uiSchema.newSheetButton["ui:disabled"] = true;
    }
    return updatedPage;

}

exports.renderGoogleSheetsPage = renderGoogleSheetsPage;
exports.getUpdatedGoogleSheetsPage = getUpdatedGoogleSheetsPage;