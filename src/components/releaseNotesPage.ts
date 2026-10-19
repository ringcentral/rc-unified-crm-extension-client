import axios from 'axios';

type UnknownRecord = Record<string, any>;

async function getReleaseNotesPageRender({ manifest, platformName, registeredVersion }: UnknownRecord): Promise<UnknownRecord | null> {
    try {
        const releaseNotesResponse = await axios.get(`${manifest.serverUrl}/releaseNotes`);
        const releaseNotes = releaseNotesResponse.data;
        const registeredVersionNumbers = registeredVersion.split('.').map(v => parseInt(v));
        const currentVersionNumbers = manifest.version.split('.').map(v => parseInt(v));
        if (!!releaseNotes[manifest.version] &&
            (
                currentVersionNumbers[0] === registeredVersionNumbers[0] && currentVersionNumbers[1] === registeredVersionNumbers[1] && currentVersionNumbers[2] > registeredVersionNumbers[2])
        ) {
            const globalNotes = releaseNotes[manifest.version].global ?? [];
            const platformNotes = releaseNotes[manifest.version][platformName] ?? [];
            const allNotes = globalNotes.concat(platformNotes);
            const allTypes = allNotes.map(n => { return n.type }).filter((value, index, array) => { return array.indexOf(value) === index; });
            let notesRender: UnknownRecord = {};
            let notesUiSchema: UnknownRecord = {};
            let noteFormData: UnknownRecord = {};
            for (const t of allTypes) {
                const targetNotes = allNotes.filter(n => { return n.type === t });
                notesRender[t] = {
                    type: 'string',
                    description: t
                };
                notesUiSchema[t] = {
                    "ui:field": "typography",
                    "ui:variant": "body2", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
                };
                for (const n of targetNotes) {
                    // check for link button render
                    let description = n.description;
                    let buttonText = '';
                    let buttonUrl = '';
                    if (n.description.includes('[Button]')) {
                        description = n.description.split('[Button]')[0];
                        const buttonInfo = n.description.split('[Button]')[1];
                        buttonText = buttonInfo.split('|')[0];
                        buttonUrl = buttonInfo.split('|')[1];
                    }
                    notesRender[`${t}-${targetNotes.indexOf(n)}`] = {
                        type: 'string',
                        description
                    };
                    notesUiSchema[`${t}-${targetNotes.indexOf(n)}`] = {
                        "ui:field": "typography",
                        "ui:variant": "body1", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
                        "ui:style": { margin: '-15px 0px 0px 20px' }
                    };
                    if (buttonText && buttonUrl) {
                        notesRender[`link-button-${buttonText}`] = {
                            type: 'string',
                            title: buttonText
                        };
                        notesUiSchema[`link-button-${buttonText}`] = {
                            "ui:field": "button",
                            "ui:variant": "contained",
                            // "text", "outlined", "contained", "plain"
                            "ui:fullWidth": false
                        };
                        noteFormData[`link-button-${buttonText}`] = buttonUrl;
                    }
                }
            }
            return {
                id: 'releaseNotesPage',
                title: `Release Notes (v${manifest.version})`,
                schema: {
                    type: 'object',
                    properties: notesRender
                },
                uiSchema: notesUiSchema,
                formData: noteFormData
            }
        }
        else {
            return null;
        }
    }
    catch (e) {
        return null;
    }
}

export { getReleaseNotesPageRender };
export default {
    getReleaseNotesPageRender,
};
