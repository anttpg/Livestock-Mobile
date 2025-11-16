import React, { useEffect, useRef, useState } from 'react';
import PopupErrorBoundary from './popupErrorBoundary';
import ReactDOM from 'react-dom';

function Popup({ 
  isOpen, 
  onClose, 
  children, 
  title,
  width = '600px', 
  height = 'auto',
  maxWidth = '100vw',
  maxHeight = '105vh',
  fullscreen = false
}) {
  const popupRef = useRef(null);
  const headerRef = useRef(null);
  const isNestedRef = useRef(false);
  const cleanupRef = useRef(null);
  const [viewportHeight, setViewportHeight] = React.useState(window.innerHeight);

  // Static counter to track open popups
  if (typeof Popup.openCount === 'undefined') {
    Popup.openCount = 0;
  }

  // Defensive cleanup function
  const performCleanup = () => {
    if (cleanupRef.current) {
      try {
        // Remove all event listeners
        document.removeEventListener('keydown', cleanupRef.current.escapeHandler);
        if (cleanupRef.current.touchStartHandler) {
          document.removeEventListener('touchstart', cleanupRef.current.touchStartHandler, { passive: false });
        }
        if (cleanupRef.current.touchMoveHandler) {
          document.removeEventListener('touchmove', cleanupRef.current.touchMoveHandler, { passive: false });
        }
        
        // Decrement counter and restore scroll if needed
        Popup.openCount = Math.max(0, Popup.openCount - 1);
        
        if (Popup.openCount <= 0) {
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
          document.body.style.position = '';
          document.body.style.touchAction = '';
          Popup.openCount = 0;
        }

        // Dispatch state change
        window.dispatchEvent(new CustomEvent('popupStateChange', { 
          detail: { isOpen: false } 
        }));
      } catch (error) {
        console.error('Error during popup cleanup:', error);
        // Force cleanup even if there are errors
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.style.position = '';
        document.body.style.touchAction = '';
        Popup.openCount = 0;
      }
      cleanupRef.current = null;
    }
  };

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

  // Handle escape key to close popup
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    // Prevent body scrolling on mobile
    const handleTouchStart = (e) => {
      if (isOpen && !popupRef.current?.contains(e.target)) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e) => {
      if (isOpen && !popupRef.current?.contains(e.target)) {
        e.preventDefault();
      }
    };

    if (isOpen) {
      try {
        const existingBackdrops = document.querySelectorAll('div[style*="position: fixed"][style*="rgba(0, 0, 0, 0.5)"]').length;
        isNestedRef.current = existingBackdrops > 0;
        
        // Increment popup counter
        Popup.openCount++;
        
        document.addEventListener('keydown', handleEscape);
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        
        if (!isNestedRef.current) {
          const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
          document.body.style.overflow = 'hidden';
          document.body.style.paddingRight = `${scrollbarWidth}px`;
          document.body.style.position = 'fixed';
          document.body.style.touchAction = 'none';
          document.body.style.width = '100%';
        }

        // Store cleanup handlers
        cleanupRef.current = { 
          escapeHandler: handleEscape,
          touchStartHandler: handleTouchStart,
          touchMoveHandler: handleTouchMove
        };

        // Dispatch state change
        window.dispatchEvent(new CustomEvent('popupStateChange', { 
          detail: { isOpen: true } 
        }));

      } catch (error) {
        console.error('Error during popup setup:', error);
      }
    }

    // Return cleanup function
    return () => {
      if (isOpen) {
        performCleanup();
      }
    };
  }, [isOpen, onClose]);

  // Global error handler for this popup
  useEffect(() => {
    const handleGlobalError = (event) => {
      if (isOpen) {
        console.error('Global error while popup open:', event.error);
        // Ensure cleanup happens
        setTimeout(performCleanup, 0);
      }
    };

    const handleUnhandledRejection = (event) => {
      if (isOpen) {
        console.error('Unhandled promise rejection while popup open:', event.reason);
        // Ensure cleanup happens
        setTimeout(performCleanup, 0);
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
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
    height: `${viewportHeight}px`, // Use dynamic height instead of 100vh
    maxWidth: '100vw',
    maxHeight: `${viewportHeight}px`, // Use dynamic height instead of 100vh
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    touchAction: 'none' // Prevent mobile browser behaviors
  } : {
    backgroundColor: '#f4f4f4',
    borderRadius: '10px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: width,
    height: 'auto',
    maxWidth: `${maxWidthPx}px`,
    maxHeight: `${maxHeightPx}px`, // Use converted pixel value
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    touchAction: 'none'
  };

  const contentMaxHeight = fullscreen ? 
    `${viewportHeight - headerHeight - contentPadding}px` : // Use dynamic height
    `${maxHeightPx - headerHeight - contentPadding - backdropPadding - bufferSpace}px`;

  const popupElement = (
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
  );

  const popupRoot = document.getElementById('popup-root');
  if (!popupRoot) {
    console.error('Popup root element not found. Make sure to add <div id="popup-root"></div> to your HTML.');
    return null;
  }

  return ReactDOM.createPortal(popupElement, popupRoot);
}

export default Popup;