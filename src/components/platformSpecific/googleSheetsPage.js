function renderGoogleSheetsPage({ manifest, userSettings }) {
    const existingGoogleSheetsName = userSettings?.googleSheetsName?.value ?? "";
    const existingGoogleSheetsUrl = userSettings?.googleSheetsUrl?.value ?? "";
    const page = {
        id: 'googleSheetsPage',
        title: "Google Sheets Config",
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                warning: {
                    type: "string",
                    description: "Only one sheet can be used at the same time."
                }
            }
        },
        uiSchema: {
            warning: {
                "ui:field": "admonition",
                "ui:severity": "warning",  // "warning", "info", "error", "success"
            }
        },
        formData:{

        }
    }
    if (existingGoogleSheetsName) {
        page.schema.properties.sheetInfoButton = {
            type: "string",
            title: `Sheet name: ${existingGoogleSheetsName}`
        }
        page.uiSchema.sheetInfoButton = {
            "ui:field": "button",
            "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": true
        }
        page.schema.properties.removeSheetButton = {
            type: "string",
            title: "Remove sheet"
        }
        page.uiSchema.removeSheetButton = {
            "ui:field": "button",
            "ui:variant": "contained", // "text", "outlined", "contained", "plain"
            "ui:fullWidth": true,
            "ui:color": "danger.b03"
        }
        page.formData.sheetUrl = existingGoogleSheetsUrl;
    }
    else {
        page.schema.properties.newSheetName ={
            type: "string",
            title: "New sheet name"
        }
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
            "ui:fullWidth": true
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
    return page;
}

exports.renderGoogleSheetsPage = renderGoogleSheetsPage;