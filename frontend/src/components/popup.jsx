import React, { useEffect, useRef, useState } from 'react';
import PopupErrorBoundary from './popupErrorBoundary';
import { Modal } from 'react-bootstrap';

function Popup({
  isOpen,
  onClose,
  children,
  title,
  width = '600px',
  height = null,
  maxWidth = '100vw',
  maxHeight = '95vh',
  fullscreen = false
}) {
  const popupRef = useRef(null);
  const headerRef = useRef(null);
  const isNestedRef = useRef(false);
  const [viewportHeight, setViewportHeight] = React.useState(window.innerHeight);

  // Static counter to track open popups
  if (typeof Popup.openCount === 'undefined') {
    Popup.openCount = 0;
  }

  // Track viewport height changes for iOS Safari
  useEffect(() => {
    const handleResize = () => {
      // Use a small delay to get the final viewport size after browser chrome animation
      setTimeout(() => {
        setViewportHeight(window.innerHeight);
      }, 100);
    };

    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        setTimeout(() => {
          setViewportHeight(window.visualViewport.height);
        }, 100);
      }
    };

    // Initial setup
    setViewportHeight(window.innerHeight);

    // Listen for viewport changes
    window.addEventListener('resize', handleResize);

    // Visual Viewport API (better for mobile browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
    }

    // Also listen for orientation changes
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
      }
    };
  }, []);

  // Handle popup counter and event dispatching
  useEffect(() => {
    if (isOpen) {
      try {
        const existingBackdrops = document.querySelectorAll('div[style*="position: fixed"][style*="rgba(0, 0, 0, 0.5)"]').length;
        isNestedRef.current = existingBackdrops > 0;

        // Increment popup counter
        Popup.openCount++;

        // Dispatch state change
        window.dispatchEvent(new CustomEvent('popupStateChange', {
          detail: { isOpen: true }
        }));

      } catch (error) {
        console.error('Error during popup setup:', error);
      }

      return () => {
        // Decrement counter
        Popup.openCount = Math.max(0, Popup.openCount - 1);
        
        if (Popup.openCount <= 0) {
          Popup.openCount = 0;
        }

        // Dispatch state change
        window.dispatchEvent(new CustomEvent('popupStateChange', {
          detail: { isOpen: false }
        }));
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Prevent scroll events on header from propagating
  const handleHeaderWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleHeaderTouchStart = (e) => {
    e.stopPropagation();
  };

  const handleHeaderTouchMove = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Helper function to convert CSS values to pixels
  const convertToPixels = (value, referenceSize) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return referenceSize;

    if (value.endsWith('vh')) {
      const percentage = parseFloat(value);
      return (percentage / 100) * viewportHeight;
    } else if (value.endsWith('vw')) {
      const percentage = parseFloat(value);
      return (percentage / 100) * window.innerWidth;
    } else if (value.endsWith('%')) {
      const percentage = parseFloat(value);
      return (percentage / 100) * referenceSize;
    } else if (value.endsWith('px')) {
      return parseFloat(value);
    } else {
      // Try to parse as number (assume pixels)
      const parsed = parseFloat(value);
      return isNaN(parsed) ? referenceSize : parsed;
    }
  };

  // Rest of popup styling logic
  const headerHeight = title ? 50 : 35;
  const contentPadding = 30;
  const backdropPadding = 40;
  const bufferSpace = 120;

  const maxContentHeight = `calc(${maxHeight} - ${headerHeight + contentPadding + backdropPadding + bufferSpace}px)`;
  const backdropCount = document.querySelectorAll('[data-popup-backdrop]').length;
  const zIndex = 1000 + (backdropCount * 10);

  // Convert maxHeight and maxWidth to pixels for proper calculations
  const maxHeightPx = convertToPixels(maxHeight, viewportHeight * 0.95);
  const maxWidthPx = convertToPixels(maxWidth, window.innerWidth * 0.95);

  const popupStyles = fullscreen ? {
    backgroundColor: '#f4f4f4',
    borderRadius: '0px',
    boxShadow: 'none',
    width: '100vw',
    height: '100vw', // Use height prop if provided
    maxWidth: '100vw',
    maxHeight: `${viewportHeight}px`,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    touchAction: 'none'
  } : {
    backgroundColor: '#f4f4f4',
    borderRadius: '10px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: width,
    height: height !== null ? height : 'auto', // Use height prop if provided
    maxWidth: `${maxWidthPx}px`,
    maxHeight: `${maxHeightPx}px`,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    touchAction: 'none'
  };

  const contentMaxHeight = fullscreen ?
    `${viewportHeight - headerHeight - contentPadding}px` : // Use dynamic height
    `${maxHeightPx - headerHeight - contentPadding - backdropPadding - bufferSpace}px`;

  const popupRoot = document.getElementById('popup-root');
  if (!popupRoot) {
    console.error('Popup root element not found. Make sure to add <div id="popup-root"></div> to your HTML.');
    return null;
  }

  return (
    <Modal
      show={isOpen}
      onHide={onClose}
      backdrop={false}
      keyboard={true}
      enforceFocus={false}
      container={popupRoot}
      style={{ display: 'contents' }}
    >
      <div
        data-popup-backdrop="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: zIndex,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: fullscreen ? '0px' : '20px',
          overflow: 'hidden',
          touchAction: 'none'
        }}
        onClick={handleBackdropClick}
      >
        <div
          ref={popupRef}
          style={{
            ...popupStyles,
            // Force reflow when viewport changes on mobile
            minHeight: fullscreen ? `${viewportHeight}px` : 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={headerRef}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 15px',
              borderBottom: title ? '1px solid #ddd' : 'none',
              minHeight: '35px',
              flexShrink: 0,
              touchAction: 'none', // Prevent mobile browser behaviors
              userSelect: 'none', // Prevent text selection
              WebkitUserSelect: 'none',
              position: 'relative',
              zIndex: 1
            }}
            onWheel={handleHeaderWheel}
            onTouchStart={handleHeaderTouchStart}
            onTouchMove={handleHeaderTouchMove}
          >
            {title && (
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#333',
                pointerEvents: 'none' // Prevent any interaction
              }}>
                {title}
              </h3>
            )}

            <button
              onClick={onClose}
              className="close-button"
              style={{
                touchAction: 'manipulation', // Allow button tap
                position: 'relative',
                zIndex: 2
              }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div style={{
            padding: '15px',
            overflow: 'auto',
            flex: 1,
            maxHeight: contentMaxHeight,
            touchAction: 'pan-y', // Allow only vertical scrolling
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            // Ensure content area adjusts to available space
            height: fullscreen ? `${viewportHeight - headerHeight - 30}px` : 'auto'
          }}>
            <PopupErrorBoundary onClose={onClose}>
              {children}
            </PopupErrorBoundary>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default Popup;