import React, { useState, useEffect } from 'react';
import PopupConfirm from './popupConfirm';
import PopupNotify from './popupNotify';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  
  // Pre-registration state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPermissions, setNewUserPermissions] = useState({
    view: true,
    add: true,  // Changed: default to true
    admin: false,
    dev: false
  });
  const [addingUser, setAddingUser] = useState(false);
  
  // Fixed: Renamed from PopupConfirm to confirmDialog to avoid naming conflict
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Notify popup state
  const [notify, setNotify] = useState({
    isOpen: false,
    message: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        setError('Failed to load users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = async (userEmail, permission) => {
    const user = users.find(u => u.email === userEmail);
    const currentPermissions = user.permissions;
    const newPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter(p => p !== permission)
      : [...currentPermissions, permission];

    if (permission === 'admin' && currentPermissions.includes('admin')) {
      const activeAdmins = users.filter(u => 
        !u.blocked && u.permissions.includes('admin')
      );
      
      if (activeAdmins.length === 1) {
        setNotify({
          isOpen: true,
          message: 'Cannot remove admin permission - at least one admin must remain'
        });
        return;
      }
    }

    try {
      const response = await fetch('/api/users/update-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          permissions: newPermissions
        })
      });

      if (response.ok) {
        await fetchUsers();
      } else {
        const data = await response.json();
        setNotify({
          isOpen: true,
          message: data.message || 'Failed to update permissions'
        });
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      setNotify({
        isOpen: true,
        message: 'Network error'
      });
    }
  };

  const handleResetPassword = (userEmail, userName) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Password',
      message: (
        <div>
          <p>Are you sure you want to reset the password for <strong>{userName}</strong>?</p>
          <p style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
            <strong>Note:</strong> The user's password will be cleared. On their next login, they will be prompted to create a new password.
          </p>
        </div>
      ),
      onConfirm: async () => {
        try {
          const response = await fetch('/api/users/reset-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email: userEmail })
          });

          const data = await response.json();
          
          if (response.ok) {
            await fetchUsers();
          } else {
            setNotify({
              isOpen: true,
              message: data.message || 'Failed to reset password'
            });
          }
        } catch (error) {
          console.error('Error resetting password:', error);
          setNotify({
            isOpen: true,
            message: 'Network error'
          });
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleBlockUser = (userEmail, userName) => {
    const user = users.find(u => u.email === userEmail);
    if (user.permissions.includes('admin')) {
      const activeAdmins = users.filter(u => 
        !u.blocked && u.permissions.includes('admin')
      );
      
      if (activeAdmins.length === 1) {
        setNotify({
          isOpen: true,
          message: 'Cannot block user - at least one active admin must remain'
        });
        return;
      }
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Block User',
      message: `Are you sure you want to block ${userName}? They will no longer be able to access the system.`,
      onConfirm: async () => {
        try {
          const response = await fetch('/api/users/block', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email: userEmail })
          });

          if (response.ok) {
            await fetchUsers();
          } else {
            const data = await response.json();
            setNotify({
              isOpen: true,
              message: data.message || 'Failed to block user'
            });
          }
        } catch (error) {
          console.error('Error blocking user:', error);
          setNotify({
            isOpen: true,
            message: 'Network error'
          });
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleUnblockUser = async (userEmail) => {
    try {
      const response = await fetch('/api/users/unblock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: userEmail })
      });

      if (response.ok) {
        await fetchUsers();
      } else {
        const data = await response.json();
        setNotify({
          isOpen: true,
          message: data.message || 'Failed to unblock user'
        });
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      setNotify({
        isOpen: true,
        message: 'Network error'
      });
    }
  };

  const handlePreRegisterUser = async () => {
    if (!newUserEmail) {
      setNotify({
        isOpen: true,
        message: 'Please enter an email address'
      });
      return;
    }

    setAddingUser(true);

    const permissions = Object.keys(newUserPermissions).filter(
      key => newUserPermissions[key]
    );

    try {
      const response = await fetch('/api/users/pre-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: newUserEmail,
          permissions
        })
      });

      const data = await response.json();

      if (response.ok) {
        setNotify({
          isOpen: true,
          message: `User ${newUserEmail} has been pre-registered. They can now log in and set their password.`
        });
        setNewUserEmail('');
        setNewUserPermissions({ view: true, add: true, admin: false, dev: false });
        await fetchUsers();
      } else {
        setNotify({
          isOpen: true,
          message: data.message || 'Failed to pre-register user'
        });
      }
    } catch (error) {
      console.error('Error pre-registering user:', error);
      setNotify({
        isOpen: true,
        message: 'Network error'
      });
    } finally {
      setAddingUser(false);
    }
  };

  const activeUsers = users.filter(u => !u.blocked);
  const blockedUsers = users.filter(u => u.blocked);

  if (loading) {
    return <div className="layout-content">Loading users...</div>;
  }

  return (
    <div className="layout-content">
      <div style={{ marginBottom: '20px' }}>
        <h1>User Management</h1>
        <p>Manage user permissions and access</p>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Pre-Register User Section */}
      <div className="bubble-container" style={{ 
        marginBottom: '30px',
        backgroundColor: '#e7f3ff',
        borderColor: '#007bff'
      }}>
        <h3>Add New User (Pre-Registration)</h3>
        <p>Pre-register a user by adding their email and setting permissions. They will be prompted to create a password and username on first login.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px' }}>
          <input
            type="email"
            placeholder="User Email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
          />
          
          <div>
            <strong>Permissions:</strong>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              marginTop: '10px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newUserPermissions.view}
                  onChange={(e) => setNewUserPermissions({
                    ...newUserPermissions,
                    view: e.target.checked
                  })}
                  style={{ width: '18px', height: '18px' }}
                />
                View
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newUserPermissions.add}
                  onChange={(e) => setNewUserPermissions({
                    ...newUserPermissions,
                    add: e.target.checked
                  })}
                  style={{ width: '18px', height: '18px' }}
                />
                Add Records
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newUserPermissions.admin}
                  onChange={(e) => setNewUserPermissions({
                    ...newUserPermissions,
                    admin: e.target.checked
                  })}
                  style={{ width: '18px', height: '18px' }}
                />
                Admin
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newUserPermissions.dev}
                  onChange={(e) => setNewUserPermissions({
                    ...newUserPermissions,
                    dev: e.target.checked
                  })}
                  style={{ width: '18px', height: '18px' }}
                />
                Dev
              </label>
            </div>
          </div>
          
          <button
            onClick={handlePreRegisterUser}
            disabled={addingUser}
            style={{ width: 'fit-content' }}
          >
            {addingUser ? 'Adding User...' : 'Add User'}
          </button>
        </div>
      </div>

      <h2>Active Users ({activeUsers.length})</h2>
      <table className="bubble-container" style={{ marginBottom: '30px' }}>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>View</th>
            <th>Add Records</th>
            <th>Admin</th>
            <th>Dev</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {activeUsers.map(user => (
            <tr key={user.id}>
              <td>
                {user.username}
                {user.username === 'PREREGISTERED' && (
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    marginLeft: '8px',
                    backgroundColor: '#ff9800',
                    color: 'white'
                  }}>
                    Awaiting first login
                  </span>
                )}
              </td>
              <td>{user.email}</td>
              <td>
                <input
                  type="checkbox"
                  checked={user.permissions.includes('view')}
                  onChange={() => handlePermissionToggle(user.email, 'view')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={user.permissions.includes('add')}
                  onChange={() => handlePermissionToggle(user.email, 'add')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={user.permissions.includes('admin')}
                  onChange={() => handlePermissionToggle(user.email, 'admin')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={user.permissions.includes('dev')}
                  onChange={() => handlePermissionToggle(user.email, 'dev')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </td>
              <td>
                <button
                  onClick={() => handleResetPassword(user.email, user.username)}
                  style={{ 
                    backgroundColor: '#ffc107',
                    color: '#000',
                    margin: '0 4px',
                    padding: '6px 12px',
                    fontSize: '14px'
                  }}
                >
                  Reset Password
                </button>
                <button
                  onClick={() => handleBlockUser(user.email, user.username)}
                  style={{ 
                    backgroundColor: '#dc3545',
                    margin: '0 4px',
                    padding: '6px 12px',
                    fontSize: '14px'
                  }}
                >
                  Block
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {blockedUsers.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <button
            onClick={() => setShowBlockedUsers(!showBlockedUsers)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              fontSize: '16px',
              fontWeight: '600',
              color: '#333'
            }}
          >
            <span style={{
              transition: 'transform 0.3s',
              transform: showBlockedUsers ? 'rotate(90deg)' : 'rotate(0deg)'
            }}>
              ▶
            </span>
            Blocked Users ({blockedUsers.length})
          </button>

          {showBlockedUsers && (
            <table className="bubble-container" style={{ marginTop: '10px' }}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Permissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blockedUsers.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{user.permissions.join(', ')}</td>
                    <td>
                      <button
                        onClick={() => handleUnblockUser(user.email)}
                        style={{ 
                          padding: '6px 12px',
                          fontSize: '14px'
                        }}
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <PopupConfirm
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Confirm"
        cancelText="Cancel"
      />

      <PopupNotify
        isOpen={notify.isOpen}
        onClose={() => setNotify({ ...notify, isOpen: false })}
        message={notify.message}
        title="Notice"
      />
    </div>
  );
}

export default UserManagement;