function renderGoogleSheetsPage({ manifest, userSettings }) {
    const existingGoogleSheetsName = userSettings?.googleSheetsName?.value ?? "";
    const existingGoogleSheetsUrl = userSettings?.googleSheetsUrl?.value ?? "";
    const isManaged = userSettings?.googleSheetsName?.customizable === false && userSettings?.googleSheetsUrl?.customizable === false;
    
    const page = {
        id: 'googleSheetsPage',
        title: "Google Sheets Config",
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                warning: {
                    type: "string",
                    description: isManaged 
                        ? "This Google Sheet is managed by your administrator and cannot be changed."
                        : "Only one sheet can be used at the same time."
                }
            }
        },
        uiSchema: {
            warning: {
                "ui:field": "admonition",
                "ui:severity": isManaged ? "info" : "warning",  // "warning", "info", "error", "success"
            }
        },
        formData: {

        }
    }
    if (existingGoogleSheetsName) {
        let removeSheetButtonDisabled = isManaged;
        page.schema.properties = {
            ...page.schema.properties,
            sheetInfoButton: {
                type: "string",
                title: `Sheet name: ${existingGoogleSheetsName}`
            },
            removeSheetButton: {
                type: "string",
                title: "Remove sheet"
            }
        };
        page.uiSchema = {
            ...page.uiSchema,
            sheetInfoButton: {
                "ui:field": "button",
                "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            },
            removeSheetButton: {
                "ui:field": "button",
                "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true,
                "ui:color": "danger.b03",
                "ui:disabled": removeSheetButtonDisabled
            }
        };
        page.formData.sheetUrl = existingGoogleSheetsUrl;
    }
    else {
        // Only show create/select options if not managed by admin
        if (!isManaged) {
            page.schema.properties = {
                ...page.schema.properties,
                newSheetName: {
                    type: "string",
                    title: "New sheet name"
                },
                newSheetButton: {
                    type: "string",
                    title: "Create new sheet"
                },
                selectExistingSheetButton: {
                    type: "string",
                    title: "Select existing sheet"
                }
            };
            page.schema.required = ["newSheetName"];
            page.uiSchema = {
                ...page.uiSchema,
                newSheetName: {
                    "ui:placeholder": 'Enter name...',
                },
                newSheetButton: {
                    "ui:field": "button",
                    "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                    "ui:fullWidth": true,
                    "ui:disabled": true
                },
                selectExistingSheetButton: {
                    "ui:field": "button",
                    "ui:variant": "contained", // "text", "outlined", "contained", "plain"
                    "ui:fullWidth": true
                }
            };
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