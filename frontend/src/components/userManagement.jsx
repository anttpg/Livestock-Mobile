import React, { useState, useEffect } from 'react';
import ConfirmPopup from './confirmPopup';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  
  // Pre-registration state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPermissions, setNewUserPermissions] = useState({
    view: true,
    add: false,
    admin: false,
    dev: false
  });
  const [addingUser, setAddingUser] = useState(false);
  
  const [confirmPopup, setConfirmPopup] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
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
        alert('Cannot remove admin permission - at least one admin must remain');
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
        alert(data.message || 'Failed to update permissions');
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('Network error');
    }
  };

  const handleResetPassword = (userEmail, userName) => {
    setConfirmPopup({
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
            alert(data.message || 'Failed to reset password');
          }
        } catch (error) {
          console.error('Error resetting password:', error);
          alert('Network error');
        }
        setConfirmPopup({ ...confirmPopup, isOpen: false });
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
        alert('Cannot block user - at least one active admin must remain');
        return;
      }
    }

    setConfirmPopup({
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
            alert(data.message || 'Failed to block user');
          }
        } catch (error) {
          console.error('Error blocking user:', error);
          alert('Network error');
        }
        setConfirmPopup({ ...confirmPopup, isOpen: false });
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
        alert(data.message || 'Failed to unblock user');
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert('Network error');
    }
  };

  const handlePreRegisterUser = async (e) => {
    e.preventDefault();
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
        alert(`User ${newUserEmail} has been pre-registered. They can now log in and set their password.`);
        setNewUserEmail('');
        setNewUserPermissions({ view: true, add: false, admin: false, dev: false });
        await fetchUsers();
      } else {
        alert(data.message || 'Failed to pre-register user');
      }
    } catch (error) {
      console.error('Error pre-registering user:', error);
      alert('Network error');
    } finally {
      setAddingUser(false);
    }
  };

  const activeUsers = users.filter(u => !u.blocked);
  const blockedUsers = users.filter(u => u.blocked);

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    header: {
      marginBottom: '20px'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '30px'
    },
    th: {
      backgroundColor: '#f8f9fa',
      padding: '12px',
      textAlign: 'left',
      fontWeight: '600',
      borderBottom: '2px solid #dee2e6',
      color: '#333'
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #dee2e6',
      color: '#333'
    },
    checkbox: {
      width: '18px',
      height: '18px',
      cursor: 'pointer'
    },
    button: {
      padding: '6px 12px',
      margin: '0 4px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500'
    },
    resetButton: {
      backgroundColor: '#ffc107',
      color: '#000'
    },
    blockButton: {
      backgroundColor: '#dc3545',
      color: 'white'
    },
    unblockButton: {
      backgroundColor: '#28a745',
      color: 'white'
    },
    blockedSection: {
      marginTop: '30px'
    },
    expandButton: {
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
    },
    arrow: {
      transition: 'transform 0.3s',
      transform: showBlockedUsers ? 'rotate(90deg)' : 'rotate(0deg)'
    },
    error: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '20px'
    },
    badge: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      marginLeft: '8px'
    },
    noPwdBadge: {
      backgroundColor: '#fff3cd',
      color: '#856404'
    },
    addUserSection: {
      backgroundColor: '#e7f3ff',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '30px',
      border: '2px solid #007bff'
    },
    addUserForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      maxWidth: '600px'
    },
    input: {
      padding: '8px',
      border: '1px solid #ced4da',
      borderRadius: '4px',
      fontSize: '14px'
    },
    permissionGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '10px'
    },
    permissionLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      cursor: 'pointer'
    },
    addButton: {
      padding: '10px 20px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '500'
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading users...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>User Management</h1>
        <p>Manage user permissions and access</p>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Pre-Register User Section */}
      <div style={styles.addUserSection}>
        <h3>Add New User (Pre-Registration)</h3>
        <p>Pre-register a user by adding their email and setting permissions. They will be prompted to create a password on first login.</p>
        <form style={styles.addUserForm} onSubmit={handlePreRegisterUser}>
          <input
            style={styles.input}
            type="email"
            placeholder="User Email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            required
          />
          
          <div>
            <strong>Permissions:</strong>
            <div style={styles.permissionGrid}>
              <label style={styles.permissionLabel}>
                <input
                  type="checkbox"
                  checked={newUserPermissions.view}
                  onChange={(e) => setNewUserPermissions({
                    ...newUserPermissions,
                    view: e.target.checked
                  })}
                />
                View
              </label>
              <label style={styles.permissionLabel}>
                <input
                  type="checkbox"
                  checked={newUserPermissions.add}
                  onChange={(e) => setNewUserPermissions({
                    ...newUserPermissions,
                    add: e.target.checked
                  })}
                />
                Add Records
              </label>
              <label style={styles.permissionLabel}>
                <input
                  type="checkbox"
                  checked={newUserPermissions.admin}
                  onChange={(e) => setNewUserPermissions({
                    ...newUserPermissions,
                    admin: e.target.checked
                  })}
                />
                Admin
              </label>
              <label style={styles.permissionLabel}>
                <input
                  type="checkbox"
                  checked={newUserPermissions.dev}
                  onChange={(e) => setNewUserPermissions({
                    ...newUserPermissions,
                    dev: e.target.checked
                  })}
                />
                Dev
              </label>
            </div>
          </div>
          
          <button
            style={styles.addButton}
            type="submit"
            disabled={addingUser}
          >
            {addingUser ? 'Adding User...' : 'Add User'}
          </button>
        </form>
      </div>

      <h2>Active Users ({activeUsers.length})</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Username</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>View</th>
            <th style={styles.th}>Add Records</th>
            <th style={styles.th}>Admin</th>
            <th style={styles.th}>Dev</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {activeUsers.map(user => (
            <tr key={user.id}>
              <td style={styles.td}>
                {user.username}
                {!user.hasPassword && (
                  <span style={{...styles.badge, ...styles.noPwdBadge}}>No Password</span>
                )}
              </td>
              <td style={styles.td}>{user.email}</td>
              <td style={styles.td}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={user.permissions.includes('view')}
                  onChange={() => handlePermissionToggle(user.email, 'view')}
                />
              </td>
              <td style={styles.td}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={user.permissions.includes('add')}
                  onChange={() => handlePermissionToggle(user.email, 'add')}
                />
              </td>
              <td style={styles.td}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={user.permissions.includes('admin')}
                  onChange={() => handlePermissionToggle(user.email, 'admin')}
                />
              </td>
              <td style={styles.td}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={user.permissions.includes('dev')}
                  onChange={() => handlePermissionToggle(user.email, 'dev')}
                />
              </td>
              <td style={styles.td}>
                <button
                  style={{...styles.button, ...styles.resetButton}}
                  onClick={() => handleResetPassword(user.email, user.username)}
                >
                  Reset Password
                </button>
                <button
                  style={{...styles.button, ...styles.blockButton}}
                  onClick={() => handleBlockUser(user.email, user.username)}
                >
                  Block
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {blockedUsers.length > 0 && (
        <div style={styles.blockedSection}>
          <button
            style={styles.expandButton}
            onClick={() => setShowBlockedUsers(!showBlockedUsers)}
          >
            <span style={styles.arrow}>▶</span>
            Blocked Users ({blockedUsers.length})
          </button>

          {showBlockedUsers && (
            <table style={{...styles.table, marginTop: '10px'}}>
              <thead>
                <tr>
                  <th style={styles.th}>Username</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Permissions</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blockedUsers.map(user => (
                  <tr key={user.id}>
                    <td style={styles.td}>{user.username}</td>
                    <td style={styles.td}>{user.email}</td>
                    <td style={styles.td}>{user.permissions.join(', ')}</td>
                    <td style={styles.td}>
                      <button
                        style={{...styles.button, ...styles.unblockButton}}
                        onClick={() => handleUnblockUser(user.email)}
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

      <ConfirmPopup
        isOpen={confirmPopup.isOpen}
        onClose={() => setConfirmPopup({ ...confirmPopup, isOpen: false })}
        onConfirm={confirmPopup.onConfirm}
        title={confirmPopup.title}
        message={confirmPopup.message}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </div>
  );
}

export default UserManagement;