async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const formData = data.body.formData || {};
    const isNew = formData.contact === 'newContact';
    const enabled = !!formData.callbackDateTime && (!isNew || (formData.newContactName && formData.newContactName.trim() !== ''));
    const page = data.body.page;
    const keys = Array.isArray(data.body.keys) ? data.body.keys : [];
    const contactChanged = keys.includes('contact');
    const needsToggle = contactChanged && isNew;
    if (needsToggle) {
        const ct = manifest.platforms[platformName]?.contactTypes || [];
        // If switched to new contact and type exists, set a default value
        if (isNew && ct.length > 0 && !formData.newContactType) {
            formData.newContactType = ct[0].value;
        }
        // If switched away from new contact, clear name/type
        if (!isNew) {
            formData.newContactName = '';
            if (ct.length > 0) formData.newContactType = '';
        }
        const updated = {
            id: page.id,
            title: page.title,
            type: page.type,
            schema: page.schema,
            uiSchema: {
                ...page.uiSchema,
                newContactName: isNew ? { 'ui:widget': 'text', 'ui:placeholder': 'Enter name...' } : { 'ui:widget': 'hidden' },
                ...(ct.length > 0 ? { newContactType: isNew ? {} : { 'ui:widget': 'hidden' } } : {}),
                scheduleSubmit: { ...(page.uiSchema?.scheduleSubmit || {}), 'ui:disabled': !enabled }
            },
            formData: formData
        };
        document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: updated
        }, '*');
    }
}

exports.onEvent = onEvent;