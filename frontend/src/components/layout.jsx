import React from 'react';
import Header from './header';

function Layout({ children }) {
  const styles = {
    container: {
      paddingTop: '80px', // Space for fixed header (60px height + 20px padding)
      minHeight: '100vh',
      backgroundColor: '#f4f4f4'
    },
    content: {
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    }
  };

  return (
    <div style={styles.container}>
      <Header />
      <div style={styles.content}>
        {children}
      </div>
    </div>
  );
}

export default Layout;