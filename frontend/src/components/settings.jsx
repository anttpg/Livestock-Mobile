import React, { useState } from 'react';
import { useUser } from '../UserContext';
import Folder from './folder';
import Popup from './popup';
import UserManagement from './userManagement';
import DevMenu from './devMenu';

function Settings() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.permissions?.includes('admin') || false;
  const isDev = user?.permissions?.includes('dev') || false;

  const tabs = [
    { id: 'preferences', label: 'Preferences' },
    isAdmin && { id: 'user-management', label: 'User Management' },
    isDev   && { id: 'dev-console',     label: 'Dev Console' },
  ].filter(Boolean);

  const renderTab = (tabConfig) => {
    switch (tabConfig?.id) {
      case 'preferences':
        return (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '200px', color: '#7f8c8d', fontSize: '15px', fontStyle: 'italic',
            border: '1px solid #6a6a6a', borderRadius: '6px'
          }}>
            Preferences will be set here in the future!
          </div>
        );
      case 'user-management':
        return <UserManagement />;
      case 'dev-console':
        return <DevMenu />;
      default:
        return null;
    }
  };

  return (
    <>
      <button
        className="settings-icon-btn"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderRadius: '4px',
          color: 'white', transition: 'background-color 0.2s ease',
        }}
        onClick={() => setOpen(true)}
        aria-label="Open settings"
        title="Settings"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>settings</span>
      </button>

      <Popup
        isOpen={open}
        onClose={() => setOpen(false)}
        width="860px"
        maxWidth="95vw"
        title="Settings"
      >
        <Folder
          title=""
          tabs={tabs}
          renderTab={renderTab}
        />
      </Popup>
    </>
  );
}

export default Settings;