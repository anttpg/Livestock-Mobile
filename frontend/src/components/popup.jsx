import React, { useEffect, useRef } from 'react';

function Popup({ 
  isOpen, 
  onClose, 
  children, 
  title,
  width = '600px', 
  height = 'auto',
  maxWidth = '95vw',
  maxHeight = '95vh'
}) {
  const popupRef = useRef(null);
  const isNestedRef = useRef(false);

  // Handle escape key to close popup
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      // Check how many popups are currently open by counting backdrop elements
      const existingBackdrops = document.querySelectorAll('[data-popup-backdrop]').length;
      isNestedRef.current = existingBackdrops > 0;
      
      document.addEventListener('keydown', handleEscape);
      
      // Only prevent background scrolling if this is the first popup
      if (!isNestedRef.current) {
        document.body.style.overflow = 'hidden';
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      
      // Use setTimeout to ensure cleanup happens after all popups have updated
      setTimeout(() => {
        const remainingBackdrops = document.querySelectorAll('[data-popup-backdrop]').length;
        if (remainingBackdrops === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 10); // Small delay to ensure DOM updates are processed
    };
  }, [isOpen, onClose]);

  // Notify parent layout about popup state
  useEffect(() => {
    // Dispatch custom event to tell Layout about popup state
    window.dispatchEvent(new CustomEvent('popupStateChange', { 
      detail: { isOpen } 
    }));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    // Only close if clicking on the backdrop, not the popup content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Calculate actual available height accounting for header and padding
  const headerHeight = title ? 50 : 35; // Reduced header height
  const contentPadding = 30; // 15px top + 15px bottom (reduced)
  const backdropPadding = 40; // 20px top + 20px bottom  
  const bufferSpace = 120; // Increased buffer space
  
  // CHANGE: Always use auto-sizing - ignore height parameter
  const maxContentHeight = `calc(${maxHeight} - ${headerHeight + contentPadding + backdropPadding + bufferSpace}px)`;

  // Dynamic z-index based on nesting level
  const backdropCount = document.querySelectorAll('[data-popup-backdrop]').length;
  const zIndex = 1000 + (backdropCount * 10);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={handleBackdropClick}
    >
      {/* Popup Content */}
      <div
        ref={popupRef}
        style={{
          backgroundColor: '#f4f4f4', // Same as Layout background
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          width: width,
          height: 'auto', // CHANGE: Always use auto instead of height prop
          maxWidth: maxWidth,
          maxHeight: maxHeight,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden' // Changed from 'auto' to 'hidden' on outer container
        }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* Header Bar with Title and Close Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 15px', // Reduced padding
          borderBottom: title ? '1px solid #ddd' : 'none',
          minHeight: '35px', // Reduced min height
          flexShrink: 0 // Prevent header from shrinking
        }}>
          {title && (
            <h3 style={{
              margin: 0,
              fontSize: '16px', // Reduced font size
              fontWeight: 'bold',
              color: '#333'
            }}>
              {title}
            </h3>
          )}
          
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '3px', // Reduced padding
              borderRadius: '50%',
              width: '26px', // Reduced size
              height: '26px', // Reduced size
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              marginLeft: 'auto'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            <img 
              src="/images/close.png" 
              alt="Close" 
              style={{ 
                width: '16px',  // Reduced size
                height: '16px'  // Reduced size
              }} 
            />
          </button>
        </div>

        {/* Popup Content - Now with proper overflow handling */}
        <div style={{ 
          padding: '15px', // Reduced padding to match header
          overflow: 'auto', // Moved overflow handling here
          flex: 1, // Take up remaining space
          maxHeight: maxContentHeight // Apply calculated max height
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Popup;