import React, { useState, useEffect } from 'react';
import ColorTable from './colorTable';

function CustomerViewer({ customers, onClose, onAddCustomer, onUpdateCustomer, customersLoading }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState({
    nameFirstLast: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    dateAdded: ''
  });

  // Validation errors
  const [validationErrors, setValidationErrors] = useState({
    nameFirstLast: '',
    email: ''
  });

  const validateField = (field, value) => {
    switch (field) {
      case 'nameFirstLast':
        return !value.trim() ? 'Customer name is required' : '';
      case 'email':
        if (value && value.trim() !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return !emailRegex.test(value) ? 'Invalid email format' : '';
        }
        return '';
      default:
        return '';
    }
  };

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setFormData({
      nameFirstLast: customer.NameFirstLast || '',
      address: customer.Address || '',
      city: customer.City || '',
      state: customer.State || '',
      zip: customer.Zip || '',
      phone: customer.Phone || '',
      email: customer.Email || '',
      dateAdded: customer.DateAdded || ''
    });
    setValidationErrors({
      nameFirstLast: '',
      email: ''
    });
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setSelectedCustomer(null);
    setFormData({
      nameFirstLast: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      email: '',
      dateAdded: new Date().toISOString()
    });
    setValidationErrors({
      nameFirstLast: '',
      email: ''
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedCustomer(null);
    setValidationErrors({
      nameFirstLast: '',
      email: ''
    });
  };

  const handleSave = async () => {
    // Validate required fields
    const errors = {
      nameFirstLast: validateField('nameFirstLast', formData.nameFirstLast),
      email: validateField('email', formData.email)
    };

    setValidationErrors(errors);

    // Check if there are any errors
    if (Object.values(errors).some(error => error !== '')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      const submitData = {
        NameFirstLast: formData.nameFirstLast,
        Address: formData.address,
        City: formData.city,
        State: formData.state,
        Zip: formData.zip,
        Phone: formData.phone,
        Email: formData.email,
        DateAdded: formData.dateAdded
        // HasSoldTo and HasPurchasedFrom are dynamically set, not user-editable
      };

      if (isCreating) {
        await onAddCustomer(submitData);
      } else if (isEditing) {
        await onUpdateCustomer(selectedCustomer.NameFirstLast, submitData);
      }
      handleCancel();
      // No success popup
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Failed to save customer: ' + error.message);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validate in real-time for certain fields
    if (field === 'nameFirstLast' || field === 'email') {
      const error = validateField(field, value);
      setValidationErrors(prev => ({
        ...prev,
        [field]: error
      }));
    }
  };

  const columns = [
    {
      key: 'NameFirstLast',
      header: 'Name',
      width: '100px'
    },
    {
      key: 'Phone',
      header: 'Phone',
      width: '100px'
    },
    {
      key: 'Email',
      header: 'Email',
      autoWidth: true
    },
    {
      key: 'City',
      header: 'City',
      width: '100px'
    },
    {
      key: 'State',
      header: 'State',
      width: '40px'
    }
  ];

  const columnPriority = ['NameFirstLast', 'Email', 'Phone', 'State', 'City'];

  if (customersLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Loading customers...
      </div>
    );
  }

  return (
    <div>
      {!isEditing && !isCreating ? (
        <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <button
                        onClick={handleCreate}
                        className='resizing-button'
                        style={{
                        padding: '20px 15px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginRight: 'var(--folder-gap)',
                        fontSize: '14px'
                        }}
                    >
                        + Add New Customer
                    </button>
                    <button
                        onClick={onClose}
                        className='resizing-button'
                        style={{
                        padding: '20px 15px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                        }}
                    >
                        Close
                    </button>
                    </div>
            </div>


          <ColorTable
            data={customers}
            columns={columns}
            columnPriority={columnPriority}
            cssVariableName="--customer-table-columns"
            showActionColumn={true}
            actionButtonText="Edit"
            actionButtonColor="#007bff"
            onActionClick={handleEdit}
            alternatingRows={true}
            evenRowColor="#fff"
            oddRowColor="#f4f4f4"
            emptyMessage="No customers in database"
            headerColors={{
              'NameFirstLast': '#d0e7ff',
              'Phone': '#d0e7ff',
              'Email': '#d0e7ff',
              'City': '#d0e7ff',
              'State': '#d0e7ff'
            }}
            
          />
        </>
      ) : (
        <div>
          <h2>{isCreating ? 'Add New Customer' : 'Edit Customer'}</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Customer Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.nameFirstLast}
                onChange={(e) => handleInputChange('nameFirstLast', e.target.value)}
                disabled={isEditing}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: `1px solid ${validationErrors.nameFirstLast ? '#dc3545' : '#ccc'}`,
                  borderRadius: '4px',
                  backgroundColor: isEditing ? '#f0f0f0' : (validationErrors.nameFirstLast ? '#fff5f5' : 'white')
                }}
                placeholder="First and Last Name"
              />
              {validationErrors.nameFirstLast && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                  {validationErrors.nameFirstLast}
                </div>
              )}
              {isEditing && (
                <div style={{ color: '#6c757d', fontSize: '12px', marginTop: '5px' }}>
                  Customer name cannot be changed after creation
                </div>
              )}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                placeholder="Street Address"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                placeholder="City"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                State
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                placeholder="State"
                maxLength="2"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                ZIP Code
              </label>
              <input
                type="text"
                value={formData.zip}
                onChange={(e) => handleInputChange('zip', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                placeholder="ZIP Code"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                placeholder="Phone Number"
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: `1px solid ${validationErrors.email ? '#dc3545' : '#ccc'}`,
                  borderRadius: '4px',
                  backgroundColor: validationErrors.email ? '#fff5f5' : 'white'
                }}
                placeholder="email@example.com"
              />
              {validationErrors.email && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                  {validationErrors.email}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSave}
              style={{
                padding: '10px 30px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {isCreating ? 'Create Customer' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              style={{
                padding: '10px 30px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerViewer;