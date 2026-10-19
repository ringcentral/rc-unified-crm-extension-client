import React, { useState } from 'react';
import { RcIconButton } from '@ringcentral/juno';
import activeLogo from '../../images/activeLogo.svg';
import defaultLogo from '../../images/defaultLogo.svg';
import { trackMissingServiceWorker } from '../../lib/analytics';
import { sendMessageToExtension } from '../../lib/sendMessage';

type QuickAccessButtonProps = {
    isSetup: unknown;
    setState: (state: string) => void;
    size?: string;
};

function QuickAccessButton(
    {
        isSetup,
        setState,
        size = 'large'
    }: QuickAccessButtonProps
) {
    const [showDialer, setShowDialer] = useState(false);
    return (
        <RcIconButton
            symbol={showDialer ? activeLogo : defaultLogo}
            variant="contained"
            size={size as any}
            style={showDialer ? { padding: '0px', background: '#FF7A00' } : { padding: '0px', background: '#FFFFFF' }}
            onClick={() => {
                sendMessageToExtension(
                    {
                        type: 'openPopupWindow'
                    },
                    function (response: unknown) {
                        if (response === undefined) {
                            trackMissingServiceWorker();
                            alert('It seems that RingCentral App Connect service worker has just crashed.')
                        }
                    }
                );
            }}
            onPointerEnter={() => { isSetup ? setShowDialer(true) : setState('setup'); }}
            onPointerLeave={() => { setShowDialer(false) }}
        />
    )
}

export default QuickAccessButton;
