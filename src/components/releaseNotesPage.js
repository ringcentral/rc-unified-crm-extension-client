import axios from 'axios';

async function getReleaseNotesPageRender({ manifest, platformName, registeredVersion }) {
    try {
        const releaseNotesResponse = await axios.get(`${manifest.serverUrl}/releaseNotes`);
        const releaseNotes = releaseNotesResponse.data;
        const registeredVersionNumbers = registeredVersion.split('.').map(v => parseInt(v));
        const currentVersionNumbers = manifest.version.split('.').map(v => parseInt(v));
        if (!!releaseNotes[manifest.version] &&
            (currentVersionNumbers[0] > registeredVersionNumbers[0] ||
                currentVersionNumbers[0] === registeredVersionNumbers[0] && currentVersionNumbers[1] > registeredVersionNumbers[1] ||
                currentVersionNumbers[0] === registeredVersionNumbers[0] && currentVersionNumbers[1] === registeredVersionNumbers[1] && currentVersionNumbers[2] > registeredVersionNumbers[2])
        ) {
            const globalNotes = releaseNotes[manifest.version].global ?? [];
            const platformNotes = releaseNotes[manifest.version][platformName] ?? [];
            const allNotes = globalNotes.concat(platformNotes);
            const allTypes = allNotes.map(n => { return n.type }).filter((value, index, array) => { return array.indexOf(value) === index; });
            let notesRender = [];
            let notesUiSchema = [];
            for (const t of allTypes) {
                const targetNotes = allNotes.filter(n => { return n.type === t });
                notesRender.push({
                    type: 'string',
                    description: t
                });
                notesUiSchema.push({
                    "ui:field": "typography",
                    "ui:variant": "body2", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
                });
                for (const n of targetNotes) {
                    notesRender.push({
                        type: 'string',
                        description: n.description
                    })
                    notesUiSchema.push({
                        "ui:field": "typography",
                        "ui:variant": "body1", // "caption1", "caption2", "body1", "body2", "subheading2", "subheading1", "title2", "title1"
                        "ui:style": { margin: '-15px 0px 0px 20px' }
                    });
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
                formData: {}
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

exports.getReleaseNotesPageRender = getReleaseNotesPageRender;