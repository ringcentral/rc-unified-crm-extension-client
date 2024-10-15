import React, { useState } from 'react';
import { RcIconButton } from '@ringcentral/juno';
import activeLogo from '../../images/activeLogo.svg';
import defaultLogo from '../../images/defaultLogo.svg';
import { trackMissingServiceWorker } from '../../lib/analytics';

function QuickAccessButton(
    {
        isSetup,
        setState
    }
) {
    const [showDialer, setShowDialer] = useState(false);
    return (
        <RcIconButton
            symbol={showDialer ? activeLogo : defaultLogo}
            variant="contained"
            size='large'
            style={showDialer ? { padding: '0px', background: '#FF7A00' } : { padding: '0px', background: '#FFFFFF' }}
            onClick={() => {
                chrome.runtime.sendMessage(
                    {
                        type: 'openPopupWindow'
                    },
                    function (response) {
                        if (response === undefined) {
                            trackMissingServiceWorker();
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