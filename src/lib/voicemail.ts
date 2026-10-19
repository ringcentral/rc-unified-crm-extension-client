import { RcAPI } from './rcAPI';
import { getRcAccessToken, refreshRCToken } from './util';

type UnknownRecord = Record<string, any>;

interface LinkedMessage {
  id?: string | number;
  type?: string;
  uri?: string;
}

interface CallWithLinkedMessage extends UnknownRecord {
  message?: LinkedMessage;
  legs?: Array<{ message?: LinkedMessage }>;
}

export function findLinkedVoicemailMessage(call: CallWithLinkedMessage): LinkedMessage | undefined {
  const messages = [
    call.message,
    ...(call.legs ?? []).map(leg => leg.message),
  ].filter((message): message is LinkedMessage => !!message);
  return messages.find(message => message.type?.toLowerCase() === 'voicemail');
}

export async function resolveVoicemailRecording(
  call: CallWithLinkedMessage,
): Promise<{ voicemailLink?: string; voicemailMessageId?: string }> {
  const linkedMessage = findLinkedVoicemailMessage(call);
  if (!linkedMessage?.uri) {
    return {};
  }

  try {
    await refreshRCToken();
    const message = await new RcAPI().getMessageByUri({
      uri: linkedMessage.uri,
      rcAccessToken: getRcAccessToken(),
    });
    const audioAttachment = message.attachments?.find(
      (attachment: UnknownRecord) => attachment.type === 'AudioRecording'
    );
    return {
      voicemailMessageId: String(linkedMessage.id ?? message.id ?? ''),
      voicemailLink: audioAttachment?.uri
        ? `https://ringcentral.github.io/ringcentral-media-reader/?media=${encodeURIComponent(String(audioAttachment.uri))}`
        : undefined,
    };
  } catch (error) {
    console.error('Failed to resolve linked voicemail', error);
    return {
      voicemailMessageId: linkedMessage.id === undefined ? undefined : String(linkedMessage.id),
    };
  }
}
