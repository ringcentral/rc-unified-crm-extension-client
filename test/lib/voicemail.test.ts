import { getRcAccessToken, refreshRCToken } from '../../src/lib/util.ts';
import { RcAPI } from '../../src/lib/rcAPI.ts';
import { resolveVoicemailRecording } from '../../src/lib/voicemail.ts';

const getMessageByUri = vi.fn();

vi.mock('../../src/lib/util.ts', () => ({
  getRcAccessToken: vi.fn(() => 'fresh-access-token'),
  refreshRCToken: vi.fn(async () => {}),
}));

vi.mock('../../src/lib/rcAPI.ts', () => ({
  RcAPI: vi.fn(function RcAPI() {
    return { getMessageByUri };
  }),
}));

describe('voicemail', () => {
  beforeEach(() => {
    getMessageByUri.mockReset();
    vi.mocked(getRcAccessToken).mockClear();
    vi.mocked(refreshRCToken).mockClear();
    vi.mocked(RcAPI).mockClear();
  });

  it('refreshes and rereads the access token before fetching a voicemail message', async () => {
    getMessageByUri.mockResolvedValue({
      id: '456',
      attachments: [{ type: 'AudioRecording', uri: 'https://media.ringcentral.com/456' }],
    });

    await expect(resolveVoicemailRecording({
      message: {
        id: '456',
        type: 'VoiceMail',
        uri: 'https://platform.ringcentral.com/restapi/v1.0/account/1/extension/2/message-store/456',
      },
    })).resolves.toMatchObject({ voicemailMessageId: '456' });

    expect(refreshRCToken).toHaveBeenCalledOnce();
    expect(getMessageByUri).toHaveBeenCalledWith({
      uri: 'https://platform.ringcentral.com/restapi/v1.0/account/1/extension/2/message-store/456',
      rcAccessToken: 'fresh-access-token',
    });
    expect(vi.mocked(refreshRCToken).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(getRcAccessToken).mock.invocationCallOrder[0]);
    expect(vi.mocked(getRcAccessToken).mock.invocationCallOrder[0]).toBeLessThan(getMessageByUri.mock.invocationCallOrder[0]);
  });

  it('does not refresh when the call has no linked voicemail', async () => {
    await expect(resolveVoicemailRecording({})).resolves.toEqual({});

    expect(refreshRCToken).not.toHaveBeenCalled();
    expect(RcAPI).not.toHaveBeenCalled();
  });
});
