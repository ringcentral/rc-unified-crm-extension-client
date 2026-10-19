import React, { type CSSProperties } from 'react';
import { RcIconButton } from '@ringcentral/juno';
import { Logout, Feedback, Settings } from '@ringcentral/juno-icon';

type EmbeddedButtonSize = 'small' | 'medium' | 'large' | 'xlarge' | string;

const containerStyle: CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column-reverse',
    bottom: '55px',
    gap: '5px'
}

// Map size to pixel dimensions
const sizeMap: Record<string, string> = {
    small: '32px',
    medium: '40px',
    large: '48px',
    xlarge: '56px'
};

function Navigator({ size = 'large' }: { size?: EmbeddedButtonSize }) {
    const buttonSize = sizeMap[size] || '48px';
    
    return (
        <div style={containerStyle}>
            <RcIconButton
                size={size as any}
                symbol={Settings}
                onClick={() => {
                    chrome.runtime.sendMessage({
                        type: "openPopupWindow",
                        navigationPath: "/settings"
                    });
                }}
                style={{
                    backgroundColor: '#7A7A7A',
                    height: buttonSize,
                    width: buttonSize,
                }}
                variant='contained'
            >
            </RcIconButton >
            <RcIconButton
                size={size as any}
                symbol={Feedback}
                onClick={() => {
                    chrome.runtime.sendMessage({
                        type: "openPopupWindow",
                        navigationPath: "/support"
                    });
                }}
                style={{
                    backgroundColor: '#00B1A7',
                    height: buttonSize,
                    width: buttonSize,
                }}
                variant='contained'
            >
            </RcIconButton >
            <RcIconButton
                size={size as any}
                symbol={Logout}
                onClick={() => {
                    chrome.runtime.sendMessage({
                        type: "openPopupWindow",
                        navigationPath: "/settings"
                    });
                }}
                style={{
                    backgroundColor: '#E6413C',
                    height: buttonSize,
                    width: buttonSize,
                }}
                variant='contained'
            >
            </RcIconButton >
        </div>
    )
}

export default Navigator;
