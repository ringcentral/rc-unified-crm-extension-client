function getTempLogNotePageRender({ cachedNote, sessionId }) {
    const tempLogNotePage = {
        id: 'tempLogNotePage',
        title: 'Custom Note',
        type: 'page',
        schema: {
            type: 'object',
            properties: {
                note: {
                    title: "Note",
                    type: "string"
                },
                saveTempNoteButton: {
                    type: "string",
                    title: "Save",
                }
            }
        },
        uiSchema: {
            note: {
                "ui:placeholder": 'Enter note...',
                "ui:widget": "textarea",
            },
            saveTempNoteButton: {
                "ui:field": "button",
                "ui:variant": "outlined", // "text", "outlined", "contained", "plain"
                "ui:fullWidth": true
            }
        },
        formData: {
            note: cachedNote || '',
            sessionId
        }
    }
    return tempLogNotePage;
}

exports.getTempLogNotePageRender = getTempLogNotePageRender;