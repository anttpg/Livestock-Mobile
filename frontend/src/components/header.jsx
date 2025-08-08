import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const devMode = true;

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const styles = {
    header: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '60px',
      backgroundColor: '#2c3e50',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 15px',
      zIndex: 1000,
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
    },
    menuButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      width: '60px',
      height: '60px'
    },
    menuLine: {
      width: '100%',
      height: '4px',
      backgroundColor: 'white',
      transition: 'all 0.3s ease',
      transformOrigin: 'left',
      borderRadius: '2px'
    },
    menuLineTop: {
      transform: menuOpen ? 'rotate(45deg)' : 'rotate(0)'
    },
    menuLineMiddle: {
      opacity: menuOpen ? 0 : 1
    },
    menuLineBottom: {
      transform: menuOpen ? 'rotate(-45deg)' : 'rotate(0)'
    },
    dropdown: {
      position: 'fixed',
      top: '60px',
      left: 0,
      backgroundColor: '#34495e',
      minWidth: '250px',
      maxHeight: menuOpen ? '400px' : '0',
      overflow: 'hidden',
      transition: 'max-height 0.3s ease-in-out',
      boxShadow: menuOpen ? '2px 2px 10px rgba(0,0,0,0.2)' : 'none',
      zIndex: 999
    },
    menuList: {
      listStyle: 'none',
      padding: 0,
      margin: 0
    },
    menuItem: {
      borderBottom: '1px solid #2c3e50'
    },
    menuLink: {
      display: 'block',
      padding: '15px 20px',
      color: 'white',
      textDecoration: 'none',
      transition: 'background-color 0.2s ease',
      fontSize: '16px'
    },
    menuLinkHover: {
      backgroundColor: '#2c3e50'
    },
    title: {
      color: 'white',
      fontSize: '20px',
      fontWeight: 'bold',
      margin: 0
    },
    logoutButton: {
      backgroundColor: '#e74c3c',
      color: 'white',
      border: 'none',
      padding: '8px 20px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background-color 0.2s ease'
    },
    logoutButtonHover: {
      backgroundColor: '#c0392b'
    },
    overlay: {
      position: 'fixed',
      top: '60px',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: menuOpen ? 'block' : 'none',
      zIndex: 998
    }
  };

  const [hoveredItem, setHoveredItem] = useState(null);
  const [logoutHover, setLogoutHover] = useState(false);

  return (
    <>
      <header style={styles.header}>
        {/* Hamburger Menu Button */}
        <button
          style={styles.menuButton}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span style={{...styles.menuLine, ...styles.menuLineTop}}></span>
          <span style={{...styles.menuLine, ...styles.menuLineMiddle}}></span>
          <span style={{...styles.menuLine, ...styles.menuLineBottom}}></span>
        </button>

        {/* Title - switches based on devMode */}
        <h1 style={styles.title}>
          {devMode ? `DevMode, Width: ${windowWidth}px` : 'Ranch Management System'}
        </h1>

        {/* Logout Button */}
        <button
          style={{
            ...styles.logoutButton,
            ...(logoutHover ? styles.logoutButtonHover : {})
          }}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>

      {/* Dropdown Menu */}
      <nav style={styles.dropdown}>
        <ul style={styles.menuList}>
          <li style={styles.menuItem}>
          <Link
              to="/overview"
              style={{
                ...styles.menuLink,
                ...(hoveredItem === 'overview' ? styles.menuLinkHover : {})
              }}
              onMouseEnter={() => setHoveredItem('overview')}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={closeMenu}
            >
              Overview
            </Link>
            <Link
              to="/herds"
              style={{
                ...styles.menuLink,
                ...(hoveredItem === 'herds' ? styles.menuLinkHover : {})
              }}
              onMouseEnter={() => setHoveredItem('herds')}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={closeMenu}
            >
              Herds
            </Link>
          </li>
          <li style={styles.menuItem}>
            <Link
              to="/general"
              style={{
                ...styles.menuLink,
                ...(hoveredItem === 'general' ? styles.menuLinkHover : {})
              }}
              onMouseEnter={() => setHoveredItem('general')}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={closeMenu}
            >
              Find-A-Cow
            </Link>
          </li>
          <li style={styles.menuItem}>
            <Link
              to="/medical"
              style={{
                ...styles.menuLink,
                ...(hoveredItem === 'medical' ? styles.menuLinkHover : {})
              }}
              onMouseEnter={() => setHoveredItem('medical')}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={closeMenu}
            >
              Medical Records
            </Link>
          </li>
          <li style={styles.menuItem}>
            <a
              href="/breeding"
              style={{
                ...styles.menuLink,
                ...(hoveredItem === 'breeding' ? styles.menuLinkHover : {})
              }}
              onMouseEnter={() => setHoveredItem('breeding')}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={closeMenu}
            >
              Breeding Plan
            </a>
          </li>
          <li style={styles.menuItem}>
            <a
              href="/fieldsheets"
              style={{
                ...styles.menuLink,
                ...(hoveredItem === 'fieldsheets' ? styles.menuLinkHover : {})
              }}
              onMouseEnter={() => setHoveredItem('fieldsheets')}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={closeMenu}
            >
              Print Field Sheets
            </a>
          </li>
        </ul>
      </nav>

      {/* Overlay to close menu when clicking outside */}
      <div style={styles.overlay} onClick={closeMenu}></div>
    </>
  );
}

export default Header;