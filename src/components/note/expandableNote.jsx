import {
    RcDrawer,
    RcIconButton,
    RcTextarea
} from '@ringcentral/juno';
import { Note, Check } from '@ringcentral/juno-icon';
import React, { useState, useEffect } from 'react';
import { cacheCallNote } from '../../core/log';
import { getCachedLogPageData } from '../../lib/logUtil';
import logPage from '../../components/logPage';
import logCore from '../../core/log';

export default () => {
    const componentStyle = {
        position: 'relative',
        zIndex: '100',
    }
    const drawerStyle = {
        display: 'flex',
        justifyContent: 'flex-start',
        flexDirection: 'column',
        alignItems: 'flex-start'
    };
    const noteAreaStyle = {
        height: '150px',
        width: '90%',
        margin: '5% 5% 0% 5%'
    }
    const buttonStyle = {
        position: 'fixed',
        zIndex: '10',
        bottom: '10px',
        right: '10px',
    };

    const [isOpen, setIsOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isServerSideLoggingEnabled, setIsServerSideLoggingEnabled] = useState(false);
    const [note, setNote] = useState('');
    const [sessionId, setSessionId] = useState('');

    async function onEvent(e) {
        if (!e || !e.data || !e.data.type) {
            return;
        }
        switch (e.data.type) {
            case 'rc-expandable-call-note-open':
                if (!isOpen) {
                    setIsOpen(true);
                    setNote('');
                    if (!!e.data.sessionId) {
                        setSessionId(e.data.sessionId);
                    }
                }
                break;
            case 'rc-expandable-call-note-terminate':
                setIsDrawerOpen(false);
                setIsOpen(false);
                break;
            case 'rc-server-side-logging-enabled':
                setIsServerSideLoggingEnabled(e.data.enabled);
                break;
            default:
                break;
        }
    }
    useEffect(() => {
        window.addEventListener('message', onEvent);
        return () => {
            window.removeEventListener('message', onEvent)
        }
    }, [])

    function onChangeNote(e) {
        setNote(e.target.value);
        cacheCallNote({ sessionId, note: e.target.value });
    }

    return (
        <div>
            {
                isOpen && (
                    <div style={componentStyle} >
                        <RcIconButton
                            symbol={Note}
                            style={buttonStyle}
                            color='action.primary'
                            variant='contained'
                            onClick={async () => {
                                // if SSCL is enabled, open simple note drawer
                                if (isServerSideLoggingEnabled) {
                                    setIsDrawerOpen(true)
                                }
                                // if not, open whole log form page
                                else {
                                    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                                    const cachedLogPageData = await getCachedLogPageData();
                                    const existingCalls = (await logCore.getLog({
                                        serverUrl: cachedLogPageData.manifest.serverUrl,
                                        logType: 'Call',
                                        sessionIds: sessionId,
                                        requireDetails: true
                                    })).callLogs;
                                    let logPageRender = null;
                                    if (existingCalls.length > 0 && existingCalls.find(l => l.sessionId == sessionId)?.matched) {
                                        const logInfo = existingCalls[0].logData;
                                        const loggedContactId = existingCalls[0].contact?.id ?? null;
                                        logPageRender = logPage.getLogPageRender({
                                            id: sessionId,
                                            manifest: cachedLogPageData.manifest,
                                            logType: 'Call',
                                            triggerType: 'editLog',
                                            platformName: cachedLogPageData.platformName,
                                            direction: cachedLogPageData.direction,
                                            contactInfo: cachedLogPageData.contactInfo,
                                            logInfo,
                                            loggedContactId
                                        });
                                    }
                                    else {
                                        logPageRender = logPage.getLogPageRender(cachedLogPageData);
                                    }
                                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                                        type: 'rc-adapter-update-call-log-page',
                                        page: logPageRender,
                                    }, '*');
                                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                                        type: 'rc-adapter-navigate-to',
                                        path: `/log/call/${cachedLogPageData.id}`,
                                    }, '*');
                                    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                                    setIsDrawerOpen(false);
                                }
                            }}
                        />
                        <RcDrawer
                            radius='zero'
                            style={drawerStyle}
                            anchor="bottom"
                            open={isDrawerOpen}
                            onClose={() => { setIsDrawerOpen(false) }}
                        >
                            <RcTextarea
                                style={noteAreaStyle}
                                label='Note'
                                onChange={onChangeNote}
                                value={note}
                                size='large'
                            />
                            <RcIconButton
                                symbol={Check}
                                style={buttonStyle}
                                color='action.primary'
                                variant='contained'
                                onClick={() => { setIsDrawerOpen(false) }}
                            />
                        </RcDrawer>
                    </div>
                )
            }
        </div>
    )
}