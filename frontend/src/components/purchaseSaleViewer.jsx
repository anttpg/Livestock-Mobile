import React, { useState, useEffect } from 'react';
import ColorTable from './colorTable';
import PopupConfirm from './popupConfirm';
import Popup from './popup';
import CustomerViewer from './customerViewer';

function PurchaseSaleViewer({ 
  mode, // 'sale' or 'purchase'
  records, 
  onClose, 
  onAddRecord, 
  onUpdateRecord, 
  recordsLoading,
  onLink, // Callback when a record is linked to a cow
  initialEditRecordId = null, // If provided, go directly to edit mode for this record
  initialIndividualData = null // Individual animal data from cow record
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    description: '',
    date: '',
    price: '',
    paymentMethod: '',
    customerOrOrigin: '',
    commission: '',
    notes: '',
    // Individual animal fields
    individualPrice: '',
    weightAtSale: '',
    reasonSold: ''
  });

  // Validation errors
  const [validationErrors, setValidationErrors] = useState({
    date: '',
    price: ''
  });

  // Dropdown data from API
  const [dropdownData, setDropdownData] = useState({
    paymentMethods: [],
    customers: []
  });
  const [dropdownLoading, setDropdownLoading] = useState(true);

  // Customer viewer popup
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [customersForPopup, setCustomersForPopup] = useState([]);
  const [customersPopupLoading, setCustomersPopupLoading] = useState(false);

  // Link confirmation states
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [linkingRecord, setLinkingRecord] = useState(null);
  const [linkFormData, setLinkFormData] = useState({
    individualPrice: '',
    weightAtSale: '',
    reasonSold: ''
  });

  const isSaleMode = mode === 'sale';
  const recordType = isSaleMode ? 'Sale' : 'Purchase';
  const dateField = isSaleMode ? 'SaleDate' : 'PurchaseDate';
  const priceField = isSaleMode ? 'SalePrice' : 'PurchasePrice';
  const notesField = isSaleMode ? 'SaleNotes' : 'PurchaseNotes';
  const customerOriginField = isSaleMode ? 'Customer' : 'Origin';

  // Load dropdown data on mount
  useEffect(() => {
    loadDropdownData();
  }, []);

  // If initialEditRecordId is provided, load that record and go to edit mode
  useEffect(() => {
    if (initialEditRecordId && records && records.length > 0) {
      const record = records.find(r => r.ID === initialEditRecordId);
      if (record) {
        handleEdit(record);
      }
    }
  }, [initialEditRecordId, records]);



    const loadDropdownData = async () => {
        setDropdownLoading(true);
        try {
            // Load form dropdown data (includes payment methods)
            const response = await fetch('/api/form-dropdown-data', {
                credentials: 'include'
            });

            // Load customers (for sales)
            const custResponse = await fetch('/api/customers', {
                credentials: 'include'
            });

            const data = await response.json();
            const customers = custResponse.ok ? await custResponse.json() : [];

            setDropdownData({
                paymentMethods: data.paymentMethods || [],
                customers: customers.map(c => c.NameFirstLast)
            });
        } catch (error) {
            console.error('Error loading dropdown data:', error);
        } finally {
            setDropdownLoading(false);
        }
    };


  const loadCustomersForPopup = async () => {
    setCustomersPopupLoading(true);
    try {
      const response = await fetch('/api/customers', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomersForPopup(data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setCustomersPopupLoading(false);
    }
  };

  const handleOpenCustomerPopup = () => {
    loadCustomersForPopup();
    setShowCustomerPopup(true);
  };

  const handleAddCustomer = async (customerData) => {
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(customerData)
      });

      if (response.ok) {
        await loadDropdownData();
        await loadCustomersForPopup();
        // Set the newly added customer as selected
        handleInputChange('customerOrOrigin', customerData.NameFirstLast);
        setShowCustomerPopup(false);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add customer');
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer: ' + error.message);
      throw error;
    }
  };

  const handleUpdateCustomer = async (nameFirstLast, customerData) => {
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(nameFirstLast)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(customerData)
      });

      if (response.ok) {
        await loadDropdownData();
        await loadCustomersForPopup();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update customer');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Failed to update customer: ' + error.message);
      throw error;
    }
  };

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    
    const absNum = Math.abs(num);
    const formatted = absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    if (num < 0) {
      return `(${formatted})`;
    }
    return formatted;
  };

  const formatPriceForTable = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const formatted = formatPrice(value);
    return formatted ? `$${formatted}` : '';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const validateField = (field, value) => {
    switch (field) {
      case 'date':
        return !value || value.trim() === '' ? `${recordType} date is required` : '';
      case 'price':
        if (!value || value === '') return `${recordType} price is required`;
        if (isNaN(parseFloat(value))) return 'Price must be a valid number';
        // Only for sale mode, check if positive
        if (isSaleMode && parseFloat(value) < 0) return 'Price must be a valid positive number';
        return '';
      default:
        return '';
    }
  };

    const handleEdit = (record) => {
    setSelectedRecord(record);
    
    // Use initialIndividualData if editing the initial record, otherwise try to load from record
    const isInitialRecord = initialEditRecordId && record.ID === initialEditRecordId;
    
    setFormData({
        id: record.ID || '',
        description: record.Description || '',
        date: formatDate(record[dateField]),
        price: Math.abs(parseFloat(record[priceField]) || 0).toString(),
        paymentMethod: record.PaymentMethod || '',
        customerOrOrigin: record[customerOriginField] || '',
        commission: isSaleMode ? (record.Commission || '') : '',
        notes: record[notesField] || '',
        
        // Individual animal fields 
        individualPrice: isInitialRecord && initialIndividualData?.individualPrice 
        ? Math.abs(parseFloat(initialIndividualData.individualPrice)).toString()
        : (record.IndividualPrice ? Math.abs(parseFloat(record.IndividualPrice)).toString() : ''),
        weightAtSale: isInitialRecord && initialIndividualData?.weightAtSale !== undefined
        ? (initialIndividualData.weightAtSale || '')
        : (isSaleMode ? (record.WeightAtSale || '') : ''),
        reasonSold: isInitialRecord && initialIndividualData?.reasonSold !== undefined
        ? (initialIndividualData.reasonSold || '')
        : (isSaleMode ? (record.ReasonSold || '') : '')
    });
    setValidationErrors({
        date: '',
        price: ''
    });
    setIsEditing(true);
    setIsCreating(false);
    };

  const handleCreate = () => {
    setSelectedRecord(null);
    setFormData({
      id: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      price: '',
      paymentMethod: '',
      customerOrOrigin: '',
      commission: '',
      notes: '',
      // Individual animal fields
      individualPrice: '',
      weightAtSale: '',
      reasonSold: ''
    });
    setValidationErrors({
      date: '',
      price: ''
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedRecord(null);
    setValidationErrors({
      date: '',
      price: ''
    });
  };

  const handleSave = async () => {
    // Validate required fields
    const errors = {
      date: validateField('date', formData.date),
      price: validateField('price', formData.price)
    };

    setValidationErrors(errors);

    // Check if there are any errors
    if (Object.values(errors).some(error => error !== '')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      let priceValue = parseFloat(formData.price);
      
      // For purchases, ensure price is negative
      if (!isSaleMode) {
        priceValue = -Math.abs(priceValue);
      }

      const submitData = {
        Description: formData.description,
        [dateField]: formData.date,
        [priceField]: priceValue,
        PaymentMethod: formData.paymentMethod,
        [customerOriginField]: formData.customerOrOrigin,
        [notesField]: formData.notes
      };

      if (isSaleMode) {
        submitData.Commission = formData.commission ? parseFloat(formData.commission) : null;
      }

      // Add individual animal fields
      if (formData.individualPrice) {
        let individualPriceValue = parseFloat(formData.individualPrice);
        if (!isSaleMode) {
          individualPriceValue = -Math.abs(individualPriceValue);
        }
        submitData.IndividualPrice = individualPriceValue;
      }

      if (isSaleMode) {
        if (formData.weightAtSale) {
          submitData.WeightAtSale = parseInt(formData.weightAtSale);
        }
        if (formData.reasonSold) {
          submitData.ReasonSold = formData.reasonSold;
        }
      }

      if (isCreating) {
        await onAddRecord(submitData);
      } else if (isEditing) {
        submitData.ID = selectedRecord.ID;
        await onUpdateRecord(selectedRecord.ID, submitData);
      }
      handleCancel();
      // No success alert - only show on error
    } catch (error) {
      console.error(`Error saving ${recordType.toLowerCase()} record:`, error);
      alert(`Failed to save ${recordType.toLowerCase()} record: ` + error.message);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validate in real-time for required fields
    if (field === 'date' || field === 'price') {
      const error = validateField(field, value);
      setValidationErrors(prev => ({
        ...prev,
        [field]: error
      }));
    }
  };

  const handleLinkClick = (record) => {
    setLinkingRecord(record);
    setLinkFormData({
      individualPrice: record.IndividualPrice ? Math.abs(parseFloat(record.IndividualPrice)).toString() : Math.abs(parseFloat(record[priceField]) || 0).toString(),
      weightAtSale: isSaleMode ? (record.WeightAtSale || '') : '',
      reasonSold: isSaleMode ? (record.ReasonSold || '') : ''
    });
    setShowLinkPrompt(true);
  };

  const handleConfirmLink = () => {
    if (onLink && linkingRecord) {
      const linkData = {
        recordID: linkingRecord.ID,
        individualPrice: !isSaleMode ? -Math.abs(parseFloat(linkFormData.individualPrice)) : parseFloat(linkFormData.individualPrice),
        ...(isSaleMode && {
          weightAtSale: linkFormData.weightAtSale ? parseInt(linkFormData.weightAtSale) : null,
          reasonSold: linkFormData.reasonSold
        })
      };
      onLink(linkData);
      setShowLinkPrompt(false);
      setLinkingRecord(null);
    }
  };

  const handleCancelLink = () => {
    setShowLinkPrompt(false);
    setLinkingRecord(null);
    setLinkFormData({
      individualPrice: '',
      weightAtSale: '',
      reasonSold: ''
    });
  };

  // Sort records by date (most recent first)
  const sortedRecords = [...records].sort((a, b) => {
    const dateA = new Date(a[dateField]);
    const dateB = new Date(b[dateField]);
    return dateB - dateA; // Descending order
  });

  const columns = [
    {
      key: dateField,
      header: 'Date',
      width: '80px',
      render: (value) => formatDate(value)
    },
    {
      key: 'Description',
      header: 'Description',
      autoWidth: true
    },
    {
      key: priceField,
      header: 'Price',
      width: '80px',
      customRender: (value) => {
        const isNegative = parseFloat(value) < 0;
        return (
          <div style={{
            backgroundColor: 'inherit',
            color: isNegative ? 'red' : 'inherit',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            minHeight: '30px',
            padding: 'var(--table-padding, 8px)',
            boxSizing: 'border-box'
          }}>
            {formatPriceForTable(value)}
          </div>
        );
      }
    },
    {
      key: customerOriginField,
      header: isSaleMode ? 'Customer' : 'Origin',
      width: '100px'
    },
    {
      key: 'PaymentMethod',
      header: 'Payment Method',
      width: '150px'
    }
  ];

  if (isSaleMode) {
    columns.push({
      key: 'Commission',
      header: 'Commission',
      width: '100px',
      customRender: (value) => {
        const isNegative = parseFloat(value) < 0;
        return (
          <div style={{
            backgroundColor: 'inherit',
            color: isNegative ? 'red' : 'inherit',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            minHeight: '30px',
            padding: 'var(--table-padding, 8px)',
            boxSizing: 'border-box'
          }}>
            {value ? formatPriceForTable(value) : ''}
          </div>
        );
      }
    });
  }

  // Add individual animal columns
  columns.push({
    key: 'IndividualPrice',
    header: `Individual ${recordType} Price`,
    width: '120px',
    customRender: (value) => {
      const isNegative = parseFloat(value) < 0;
      return (
        <div style={{
          backgroundColor: 'inherit',
          color: isNegative ? 'red' : 'inherit',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          minHeight: '30px',
          padding: 'var(--table-padding, 8px)',
          boxSizing: 'border-box'
        }}>
          {value ? formatPriceForTable(value) : ''}
        </div>
      );
    }
  });

  if (isSaleMode) {
    columns.push({
      key: 'WeightAtSale',
      header: 'Weight at Sale',
      width: '100px',
      render: (value) => value ? `${value} lbs` : ''
    });
    columns.push({
      key: 'ReasonSold',
      header: 'Reason Sold',
      width: '120px'
    });
  }

    // Add custom Actions column
    columns.push({
        key: '_actions',
        header: 'Actions',
        width: '60px',
        customRender: (value, row) => (
            <div style={{
                backgroundColor: 'inherit',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                minHeight: '30px',
                padding: 'var(--table-padding, 8px)',
                boxSizing: 'border-box'
            }}>
                <button
                    onClick={() => handleEdit(row)}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        width: '100%'
                    }}
                >
                    Edit
                </button>
                {onLink && (
                    <button
                        onClick={() => handleLinkClick(row)}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            width: '100%'
                        }}
                    >
                        Link
                    </button>
                )}
            </div>
        )
    });



  // Define column priorities
  const columnPriority = isSaleMode 
    ? ['_actions', 'Description', dateField, customerOriginField, priceField, 'PaymentMethod', 'Commission', 'IndividualPrice', 'WeightAtSale', 'ReasonSold']
    : ['_actions', 'Description', dateField, customerOriginField, priceField, 'PaymentMethod', 'IndividualPrice'];

  if (recordsLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Loading {recordType.toLowerCase()} records...
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
                    + Add {recordType}
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
            data={sortedRecords}
            columns={columns}
            columnPriority={columnPriority}
            cssVariableName="--salepurchase-table-columns"
            showActionColumn={false}
            alternatingRows={true}
            evenRowColor="#fff"
            oddRowColor="#f4f4f4"
            emptyMessage={`No ${recordType.toLowerCase()} records found`}
            headerColors={{
              [dateField]: '#d0e7ff',
              'Description': '#d0e7ff',
              [priceField]: '#d0e7ff',
              [customerOriginField]: '#d0e7ff',
              'PaymentMethod': '#d0e7ff',
              'Commission': '#d0e7ff',
              'IndividualPrice': '#ffe0b2',
              'WeightAtSale': '#ffe0b2',
              'ReasonSold': '#ffe0b2',
              '_actions': '#d0e7ff'
            }}
          />
        </>
      ) : (
        <div>
          <h2>{isCreating ? `Add New ${recordType}` : `Edit ${recordType}`}</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Record ID
              </label>
              <input
                type="text"
                value={formData.id}
                disabled={true}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: '#f0f0f0',
                  boxSizing: 'border-box'
                }}
                placeholder="Auto-generated"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                {recordType} Date <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: `1px solid ${validationErrors.date ? '#dc3545' : '#ccc'}`,
                  borderRadius: '4px',
                  backgroundColor: validationErrors.date ? '#fff5f5' : 'white',
                  boxSizing: 'border-box'
                }}
              />
              {validationErrors.date && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                  {validationErrors.date}
                </div>
              )}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  minHeight: '100px',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
                placeholder={`Description of ${recordType.toLowerCase()}`}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                {recordType} Price <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: `1px solid ${validationErrors.price ? '#dc3545' : '#ccc'}`,
                  borderRadius: '4px',
                  backgroundColor: validationErrors.price ? '#fff5f5' : 'white',
                  boxSizing: 'border-box'
                }}
                placeholder="0.00"
              />
              {validationErrors.price && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                  {validationErrors.price}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                disabled={dropdownLoading}
              >
                <option value="">Select payment method...</option>
                {dropdownData.paymentMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            {isSaleMode ? (
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Commission
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.commission}
                    onChange={(e) => handleInputChange('commission', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Customer
                  </label>
                  <select
                    value={formData.customerOrOrigin}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        handleOpenCustomerPopup();
                      } else {
                        handleInputChange('customerOrOrigin', e.target.value);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      boxSizing: 'border-box'
                    }}
                    disabled={dropdownLoading}
                  >
                    <option value="ADD_NEW" style={{ 
                      backgroundColor: '#e7f3ff', 
                      fontWeight: 'bold'
                    }}>
                      + Add New Customer
                    </option>
                    <option value="">Select customer...</option>
                    {dropdownData.customers.map(customer => (
                      <option key={customer} value={customer}>{customer}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Origin
                </label>
                <select
                  value={formData.customerOrOrigin}
                  onChange={(e) => {
                    if (e.target.value === 'ADD_NEW') {
                      handleOpenCustomerPopup();
                    } else {
                      handleInputChange('customerOrOrigin', e.target.value);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxSizing: 'border-box'
                  }}
                  disabled={dropdownLoading}
                >
                  <option value="ADD_NEW" style={{ 
                    backgroundColor: '#e7f3ff', 
                    fontWeight: 'bold'
                  }}>
                    + Add New Customer
                  </option>
                  <option value="">Select origin...</option>
                  {dropdownData.customers.map(customer => (
                    <option key={customer} value={customer}>{customer}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  minHeight: '100px',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
                placeholder="Additional notes..."
              />
            </div>

            {/* Divider and Individual Animal Data Section */}
            <div style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
              <div style={{
                borderTop: '2px solid #007bff',
                paddingTop: '20px'
              }}>
                <h3 style={{ 
                  margin: '0 0 10px 0', 
                  color: '#007bff',
                  fontSize: '16px'
                }}>
                  Individual Animal Data
                </h3>
                <p style={{
                  margin: '0 0 20px 0',
                  color: '#666',
                  fontSize: '14px'
                }}>
                  These fields are specific to individual animals in this {recordType.toLowerCase()} record.
                </p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Individual {recordType} Price
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.individualPrice}
                onChange={(e) => handleInputChange('individualPrice', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                placeholder="0.00"
              />
            </div>

            {isSaleMode && (
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Weight at Sale (lbs)
                  </label>
                  <input
                    type="number"
                    value={formData.weightAtSale}
                    onChange={(e) => handleInputChange('weightAtSale', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Weight in lbs"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Reason Animal Sold
                  </label>
                  <input
                    type="text"
                    value={formData.reasonSold}
                    onChange={(e) => handleInputChange('reasonSold', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Reason for sale"
                  />
                </div>
              </>
            )}
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
              {isCreating ? `Create ${recordType}` : 'Save Changes'}
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

      {/* Customer Viewer Popup */}
      <Popup
        isOpen={showCustomerPopup}
        onClose={() => setShowCustomerPopup(false)}
        title="Add New Customer"
        fullscreen={true}
      >
        <CustomerViewer
          customers={customersForPopup}
          onClose={() => setShowCustomerPopup(false)}
          onAddCustomer={handleAddCustomer}
          onUpdateCustomer={handleUpdateCustomer}
          customersLoading={customersPopupLoading}
        />
      </Popup>

      {/* Link Confirmation Popup */}
      <Popup
        isOpen={showLinkPrompt}
        onClose={handleCancelLink}
        title={`Link ${recordType} Record to Animal`}
        width="500px"
      >
        <div style={{ padding: '20px' }}>
          <p>Set animal-specific properties for this {recordType.toLowerCase()}:</p>
          
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Individual {recordType} Price
            </label>
            <input
              type="number"
              step="0.01"
              value={linkFormData.individualPrice}
              onChange={(e) => setLinkFormData(prev => ({ ...prev, individualPrice: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="0.00"
            />
          </div>

          {isSaleMode && (
            <>
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Weight at Sale (lbs)
                </label>
                <input
                  type="number"
                  value={linkFormData.weightAtSale}
                  onChange={(e) => setLinkFormData(prev => ({ ...prev, weightAtSale: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  placeholder="Weight in lbs"
                />
              </div>

              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Reason Animal Sold
                </label>
                <input
                  type="text"
                  value={linkFormData.reasonSold}
                  onChange={(e) => setLinkFormData(prev => ({ ...prev, reasonSold: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  placeholder="Reason for sale"
                />
              </div>
            </>
          )}

          <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancelLink}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmLink}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Confirm Link
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
}

export default PurchaseSaleViewer;