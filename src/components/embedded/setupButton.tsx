import React from 'react';
import { RcButton, RcIcon } from '@ringcentral/juno';
import { People, RcCloudContact } from '@ringcentral/juno-icon';
import { t } from '../../i18n';

type SetupButtonProps = {
    setIsSetup: (isSetup: boolean) => void;
    setState: (state: string) => void;
};

function SetupButton({
    setIsSetup,
    setState
}: SetupButtonProps) {
    return (
        <div style={{ height: '48px' }}>
            <RcButton
                startIcon={<RcIcon  size='xxxlarge' symbol={People} />}
                endIcon={<RcIcon size='xxxlarge' symbol={RcCloudContact} />}
                radius="round"
                size='xlarge'
                onClick={() => {
                    setIsSetup(true);
                    chrome.runtime.sendMessage({ type: "openPopupWindow" });
                    // Unique: Pipedrive
                    if(window.location.origin.includes('pipedrive'))
                    {
                        window.open('https://www.pipedrive.com/en/marketplace/app/ring-central-crm-extension/5d4736e322561f57');
                    }
                }
                }
                onPointerLeave={() => { setState('quick_access'); }}
            >
                {t('misc.setup')}
            </RcButton>
        </div>
    )
}


export default SetupButton;
