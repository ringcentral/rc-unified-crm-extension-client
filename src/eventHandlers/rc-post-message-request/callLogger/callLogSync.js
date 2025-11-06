import logService from '../../../core/log';
import { trackUpdateCallRecordingLink } from '../../../lib/analytics';
import { removePendingRecordingSessionId } from '../../../lib/logUtil';

async function onEvent({ data, manifest, platformInfo, platformName, platform, existingCalls }) {
    if (data.body.call?.recording?.link) {
        trackUpdateCallRecordingLink({ processState: 'start' });
    }
    // If there is existing call log, update it
    if (existingCalls?.length > 0 && existingCalls[0]?.matched) {
        await logService.syncCallData({
            serverUrl: manifest.serverUrl,
            dataBody: data.body
        });
        if (data.body.call?.recording?.link) {
            trackUpdateCallRecordingLink({ processState: 'finish' });
            // remove pending recording link mark from storage
            await removePendingRecordingSessionId({ sessionId: data.body.call.sessionId });
        }
    }
}

exports.onEvent = onEvent;