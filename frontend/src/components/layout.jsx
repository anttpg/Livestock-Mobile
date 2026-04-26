import React, { useState, useEffect } from 'react';
import Header from './header';

function Layout({ children }) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  useEffect(() => {
    const handlePopupStateChange = () => {
      setTimeout(() => {
        const activePopups = document.querySelectorAll('[data-popup-backdrop="true"]').length;
        setIsPopupOpen(activePopups > 0);
      }, 15);
    };

    window.addEventListener('popupStateChange', handlePopupStateChange);
    return () => window.removeEventListener('popupStateChange', handlePopupStateChange);
  }, []);

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 999,
    pointerEvents: isPopupOpen ? 'auto' : 'none',
    opacity: isPopupOpen ? 1 : 0,
    transition: 'opacity 0.2s ease-in-out',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <Header>
        <div className="layout-content" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {children}
        </div>
      </Header>

      <div style={overlayStyle} />
    </div>
  );
}

export default Layout;