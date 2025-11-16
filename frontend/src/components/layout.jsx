import React, { useState, useEffect } from 'react';
import Header from './header';

function Layout({ children }) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  useEffect(() => {
    // Listen for popup state changes from child components
    const handlePopupStateChange = (event) => {
      // Use setTimeout to ensure we get the final state after all popups have processed
      setTimeout(() => {
        // Check if any popups are actually still open by counting backdrop elements
        const activePopups = document.querySelectorAll('[data-popup-backdrop="true"]').length;
        setIsPopupOpen(activePopups > 0);
      }, 15); // Slightly longer delay than popup cleanup
    };

    window.addEventListener('popupStateChange', handlePopupStateChange);

    return () => {
      window.removeEventListener('popupStateChange', handlePopupStateChange);
    };
  }, []);

  const styles = {
    container: {
      paddingTop: '80px', // Space for fixed header (60px height + 20px padding)
      minHeight: '100vh',
      backgroundColor: '#f4f4f4',
      position: 'relative'
    },
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)', // 30% dim
      zIndex: 999,
      pointerEvents: isPopupOpen ? 'auto' : 'none',
      opacity: isPopupOpen ? 1 : 0,
      transition: 'opacity 0.2s ease-in-out'
    }
  };

  return (
    <div style={styles.container}>
      <Header />
      <div className="layout-content" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {children}
      </div>
      
      {/* Overlay for dimming background when popup is open */}
      <div style={styles.overlay} />
    </div>
  );
}

export default Layout;