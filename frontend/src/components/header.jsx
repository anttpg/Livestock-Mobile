import React, { useState, useEffect } from 'react';
import { useUser } from '../UserContext';
import { Link } from 'react-router-dom';
import Settings from './settings';

const SIDEBAR_WIDTH = 150;
const HEADER_HEIGHT  = 60;
const BREAKPOINT     = 800;
const BASE_T         = 0.5; // seconds — all transitions derive from this

const t  = (x = 1)    => `${(BASE_T * x).toFixed(2)}s`;
const ease = 'ease-in-out';

function Header({ children }) {
  const { user } = useUser();
  const [menuOpen, setMenuOpen]     = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [hoveredItem, setHoveredItem] = useState(null);

  const devMode = user?.permissions?.includes('dev') || false;
  const isWide  = windowWidth > BREAKPOINT;

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleMenu = () => setMenuOpen(prev => !prev);
  const closeMenu  = () => setMenuOpen(false);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      if (res.ok) window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navLinks = [
    { to: '/overview',      label: 'Overview',          type: 'link'   },
    { to: '/herds',         label: 'Herds',              type: 'link'   },
    { to: '/animal',        label: 'Animal Records',     type: 'link'   },
    { to: '/breeding',      label: 'Breeding Plan',      type: 'link'   },
    { to: '/equipment',     label: 'Equipment',          type: 'link'   },
    { href: '/pastures', label: 'Pastures', type: 'anchor' },
    { href: '/fieldsheets', label: 'Fieldsheets', type: 'anchor' },
  ];

  const styles = {
    header: {
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: `${HEADER_HEIGHT}px`,
      backgroundColor: '#2c3e50',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 15px',
      zIndex: 1000,
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    },

    // Always in the DOM — slides in/out via transform
    sidebar: {
      position: 'fixed',
      top: `${HEADER_HEIGHT}px`,
      left: 0,
      width: `${SIDEBAR_WIDTH}px`,
      bottom: 0,
      backgroundColor: '#2c3e50',
      zIndex: 999,
      overflowY: 'auto',
      boxShadow: '2px 0 6px rgba(0,0,0,0.15)',
      transform: isWide ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
      transition: `transform ${t(1)} ${ease}`,
    },

    // Narrow-screen dropdown
    dropdown: {
      position: 'fixed',
      top: `${HEADER_HEIGHT}px`,
      left: 0,
      backgroundColor: '#34495e',
      minWidth: '250px',
      maxHeight: menuOpen ? '400px' : '0',
      overflow: 'hidden',
      transition: `max-height ${t(0.6)} ${ease}`,
      boxShadow: menuOpen ? '2px 2px 10px rgba(0,0,0,0.2)' : 'none',
      zIndex: 999,
    },

    // Content shifts right in sync with the sidebar sliding in
    contentArea: {
      paddingTop: `${HEADER_HEIGHT}px`,
      paddingLeft: isWide ? `${SIDEBAR_WIDTH}px` : '0',
      minHeight: '100vh',
      transition: `padding-left ${t(1)} ${ease}`,
    },

    menuList: { listStyle: 'none', padding: 0, margin: 0 },
    menuItem:  { borderBottom: '1px solid rgba(255,255,255,0.07)' },
    menuLink: {
      display: 'block',
      padding: '14px 20px',
      color: 'white',
      textDecoration: 'none',
      fontSize: '15px',
      transition: `background-color ${t(0.2)} ease`,
    },
    menuLinkHover: { backgroundColor: '#3d5166' },

    menuButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      width: '60px',
      height: '60px',
    },
    menuLine: {
      width: '100%',
      height: '4px',
      backgroundColor: 'white',
      transition: `all ${t(0.5)} ${ease}`,
      transformOrigin: 'left',
      borderRadius: '2px',
    },

    title: { color: 'white', fontSize: '20px', fontWeight: 'bold', margin: 0 },

    logoutButton: {
      background: 'none',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: `background-color ${t(0.25)} ease`,
    },

    overlay: {
      position: 'fixed',
      top: `${HEADER_HEIGHT}px`,
      left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: menuOpen ? 'block' : 'none',
      zIndex: 998,
    },
  };

  const renderNavLinks = (onClick) =>
    navLinks.map(({ to, href, label, type }) => {
      const linkStyle = {
        ...styles.menuLink,
        ...(hoveredItem === label ? styles.menuLinkHover : {}),
      };
      const hoverProps = {
        onMouseEnter: () => setHoveredItem(label),
        onMouseLeave: () => setHoveredItem(null),
        onClick,
      };
      return (
        <li key={label} style={styles.menuItem}>
          {type === 'anchor'
            ? <a href={href} style={linkStyle} {...hoverProps}>{label}</a>
            : <Link to={to} style={linkStyle} {...hoverProps}>{label}</Link>
          }
        </li>
      );
    });

  return (
    <>
      {/* Top bar */}
      <header style={styles.header}>
        {!isWide && (
          <button style={styles.menuButton} onClick={toggleMenu} aria-label="Toggle menu">
            <span style={{ ...styles.menuLine, transform: menuOpen ? 'rotate(45deg)'  : 'rotate(0)' }} />
            <span style={{ ...styles.menuLine, opacity:   menuOpen ? 0               : 1           }} />
            <span style={{ ...styles.menuLine, transform: menuOpen ? 'rotate(-45deg)' : 'rotate(0)' }} />
          </button>
        )}
        {isWide && <div style={{ width: `${SIDEBAR_WIDTH}px` }} />}

        <h1 style={styles.title}>
          {devMode ? `Width: ${windowWidth}px` : ''}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings />
          <button
            style={styles.logoutButton}
            onClick={handleLogout}
            aria-label="Logout"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </header>

      {/* Sidebar — always rendered, slides in/out */}
      <nav style={styles.sidebar} aria-label="Main navigation">
        <ul style={styles.menuList}>{renderNavLinks(undefined)}</ul>
      </nav>

      {/* Dropdown + overlay — narrow screens only */}
      {!isWide && (
        <>
          <nav style={styles.dropdown} aria-label="Main navigation">
            <ul style={styles.menuList}>{renderNavLinks(closeMenu)}</ul>
          </nav>
          <div style={styles.overlay} onClick={closeMenu} />
        </>
      )}

      {/* Content area — shifts in sync with sidebar */}
      <div style={styles.contentArea}>
        {children}
      </div>
    </>
  );
}

export default Header;