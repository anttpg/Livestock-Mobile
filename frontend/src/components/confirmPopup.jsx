import React, { useState, useEffect } from 'react';
import Popup from './popup';

function ConfirmPopup({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action", 
  message = "Are you sure?", 
  requireDelay = false,
  confirmText = "Confirm",
  cancelText = "Cancel"
}) {
  const [countdown, setCountdown] = useState(requireDelay ? 5 : 0);
  const [canConfirm, setCanConfirm] = useState(!requireDelay);

  useEffect(() => {
    if (isOpen && requireDelay) {
      setCountdown(5);
      setCanConfirm(false);
      
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setCanConfirm(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else if (isOpen) {
      setCanConfirm(true);
      setCountdown(0);
    }
  }, [isOpen, requireDelay]);

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
    }
  };

  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      width="400px"
      height="200px"
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '20px' }}>
          {typeof message === 'string' ? (
            <p dangerouslySetInnerHTML={{ __html: message }} />
          ) : (
            message
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              padding: '10px 20px',
              backgroundColor: canConfirm ? '#dc3545' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              opacity: canConfirm ? 1 : 0.6
            }}
          >
            {canConfirm ? confirmText : `${confirmText} (${countdown})`}
          </button>
        </div>
      </div>
    </Popup>
  );
}

export default ConfirmPopup;