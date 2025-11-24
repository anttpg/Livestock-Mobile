import React from 'react';
import Popup from './popup';

/**
 * Simple message display component
 */
function SimpleMessage({ message, onClose }) {
  return (
    <div style={{ 
      padding: '20px',
      fontSize: '16px',
      lineHeight: '1.5',
      color: '#333'
    }}>
      {typeof message === 'string' ? <p>{message}</p> : message}
      <button 
        onClick={onClose}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        OK
      </button>
    </div>
  );
}

function PopupNotify({ 
  isOpen, 
  onClose, 
  component: Component,
  componentProps = {},
  message,
  title,
  width = '500px',
  height,
  maxWidth,
  maxHeight,
  fullscreen
}) {
  // Don't check for component/message if popup is not open
  if (!isOpen) {
    return null;
  }

  // If message is provided, use SimpleMessage component
  const DisplayComponent = message ? SimpleMessage : Component;
  const displayProps = message ? { message, onClose } : { ...componentProps, onClose };

  if (!DisplayComponent) {
    console.warn('PopupNotify: No component or message provided');
    return null;
  }

  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      width={width}
      height={height}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      fullscreen={fullscreen}
    >
      <DisplayComponent {...displayProps} />
    </Popup>
  );
}

export default PopupNotify;