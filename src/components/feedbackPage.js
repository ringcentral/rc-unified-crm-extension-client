function getFeedbackPageRender({ pageConfig }) {
    let properties = {};
    let uiSchema = {
        submitButtonOptions: {
            submitText: 'Submit'
        }
    };
    let required = [];
    for (const e of pageConfig.elements) {
        if (!!e.required) {
            required.push(e.const);
        }
        switch (e.type) {
            case 'string':
                properties[e.const] = {
                    type: 'string',
                    description: e.title
                };
                uiSchema[e.const] = {
                    "ui:field": "typography",
                    "ui:variant": e.bold ? "body2" : "body1", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
                }
                break;
            case 'inputField':
                properties[e.const] = {
                    type: 'string',
                    title: e.title
                };
                uiSchema[e.const] = {
                    "ui:placeholder": e.placeholder ?? "",
                    "ui:widget": "textarea",
                }
                break;
            case 'selection':
                properties[e.const] = {
                    title: e.title,
                    type: 'string',
                    oneOf: e.selections
                }
                break;
        }
    }
    return {
        id: 'feedbackPage',
        title: 'Feedback',
        schema: {
            type: 'object',
            required,
            properties
        },
        uiSchema,
        formData: {}
    }
}

exports.getFeedbackPageRender = getFeedbackPageRender;