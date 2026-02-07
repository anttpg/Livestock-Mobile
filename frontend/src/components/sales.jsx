import React, { useState, useEffect } from 'react';
import Popup from './popup';
import CustomerViewer from './customerViewer';
import PurchaseSaleViewer from './purchaseSaleViewer';

function Sales({ cowTag }) {
  const [accountingData, setAccountingData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Customer viewer state
  const [showCustomerViewer, setShowCustomerViewer] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  
  // Purchase/Sale viewer state
  const [showPurchaseViewer, setShowPurchaseViewer] = useState(false);
  const [showSaleViewer, setShowSaleViewer] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    loadAccountingData();
  }, [cowTag]);

  const loadAccountingData = async () => {
    if (!cowTag) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/cow/accounting/${cowTag}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAccountingData(data);
      } else {
        console.error('Failed to load accounting data');
      }
    } catch (error) {
      console.error('Error loading accounting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    setCustomersLoading(true);
    try {
      const response = await fetch('/api/customers', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setCustomersLoading(false);
    }
  };

  const loadPurchases = async () => {
    setRecordsLoading(true);
    try {
      const response = await fetch('/api/purchases', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setPurchases(data);
      }
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadSales = async () => {
    setRecordsLoading(true);
    try {
      const response = await fetch('/api/sales', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSales(data);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleViewCustomers = () => {
    loadCustomers();
    setShowCustomerViewer(true);
  };

  const handleCloseCustomerViewer = () => {
    setShowCustomerViewer(false);
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
        await loadCustomers();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add customer');
      }
    } catch (error) {
      console.error('Error adding customer:', error);
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
        await loadCustomers();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update customer');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  };

  const handleManagePurchase = () => {
    loadPurchases();
    setShowPurchaseViewer(true);
  };

  const handleClosePurchaseViewer = () => {
    setShowPurchaseViewer(false);
  };

  const handleManageSale = () => {
    loadSales();
    setShowSaleViewer(true);
  };

  const handleCloseSaleViewer = () => {
    setShowSaleViewer(false);
  };

  const handleAddPurchase = async (purchaseData) => {
    try {
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(purchaseData)
      });

      if (response.ok) {
        const newRecordID = await response.json();
        await loadPurchases();
        return newRecordID;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create purchase record');
      }
    } catch (error) {
      console.error('Error creating purchase:', error);
      throw error;
    }
  };

  const handleUpdatePurchase = async (id, purchaseData) => {
    try {
      // First update the purchase record
      const response = await fetch(`/api/purchases/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(purchaseData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update purchase record');
      }

      // If we have individual animal data and this is the linked record, update cow record
      if (id === accountingData?.purchaseRecordID && purchaseData.IndividualPrice !== undefined) {
        await fetch(`/api/cow/${cowTag}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            PurchasePrice: purchaseData.IndividualPrice
          })
        });
      }

      await loadPurchases();
      await loadAccountingData();
    } catch (error) {
      console.error('Error updating purchase:', error);
      throw error;
    }
  };

  const handleAddSale = async (saleData) => {
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(saleData)
      });

      if (response.ok) {
        const newRecordID = await response.json();
        await loadSales();
        return newRecordID;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create sale record');
      }
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  };

  const handleUpdateSale = async (id, saleData) => {
    try {
      // First update the sale record
      const response = await fetch(`/api/sales/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(saleData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update sale record');
      }

      // If we have individual animal data and this is the linked record, update cow record
      if (id === accountingData?.saleRecordID) {
        const cowUpdateData = {};
        
        if (saleData.IndividualPrice !== undefined) {
          cowUpdateData.SalePrice = saleData.IndividualPrice;
        }
        if (saleData.WeightAtSale !== undefined) {
          cowUpdateData.WeightAtSale = saleData.WeightAtSale;
        }
        if (saleData.ReasonSold !== undefined) {
          cowUpdateData.ReasonAnimalSold = saleData.ReasonSold;
        }

        if (Object.keys(cowUpdateData).length > 0) {
          await fetch(`/api/cow/${cowTag}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(cowUpdateData)
          });
        }
      }

      await loadSales();
      await loadAccountingData();
    } catch (error) {
      console.error('Error updating sale:', error);
      throw error;
    }
  };

  const handleLinkPurchase = async (linkData) => {
    try {
      // Update cow table with purchase record info
      const updateResponse = await fetch(`/api/cow/${cowTag}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          PurchaseRecordID: linkData.recordID,
          PurchasePrice: linkData.individualPrice
        })
      });

      if (updateResponse.ok) {
        setShowPurchaseViewer(false);
        await loadAccountingData();
      } else {
        throw new Error('Failed to update cow record');
      }
    } catch (error) {
      console.error('Error linking purchase:', error);
      alert('Failed to link purchase record: ' + error.message);
    }
  };

  const handleLinkSale = async (linkData) => {
    try {
      // Update cow table with sale record info and mark as sold
      const updateData = {
        SaleRecordID: linkData.recordID,
        SalePrice: linkData.individualPrice,
        Status: 'Sold'
      };

      if (linkData.weightAtSale) {
        updateData.WeightAtSale = linkData.weightAtSale;
      }
      if (linkData.reasonSold) {
        updateData.ReasonAnimalSold = linkData.reasonSold;
      }

      const updateResponse = await fetch(`/api/cow/${cowTag}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      if (updateResponse.ok) {
        setShowSaleViewer(false);
        await loadAccountingData();
      } else {
        throw new Error('Failed to update cow record');
      }
    } catch (error) {
      console.error('Error linking sale:', error);
      alert('Failed to link sale record: ' + error.message);
    }
  };

  const formatPrice = (value) => {
    if (value === null || value === undefined) return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    
    const absNum = Math.abs(num);
    const formatted = absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    if (num < 0) {
      return `($${formatted})`;
    }
    return `$${formatted}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          Loading accounting data...
        </div>
      </div>
    );
  }

  return (
    <div className="bubble-container">
      {/* Purchase Record Section */}
      <div className="bubble-container" style={{
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
          Purchase Record
        </h3>
        
        {accountingData?.purchaseRecord ? (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>
                Purchase Record Details
              </h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '15px',
                marginBottom: '15px'
              }}>
                <div>
                  <strong>Record ID:</strong> {accountingData.purchaseRecordID}
                </div>
                <div>
                  <strong>Purchase Date:</strong> {formatDate(accountingData.purchaseRecord.PurchaseDate)}
                </div>
                <div>
                  <strong>Record Price:</strong> <span style={{ color: 'red' }}>{formatPrice(accountingData.purchaseRecord.PurchasePrice)}</span>
                </div>
                <div>
                  <strong>Origin:</strong> {accountingData.purchaseRecord.Origin || 'N/A'}
                </div>
                <div>
                  <strong>Payment Method:</strong> {accountingData.purchaseRecord.PaymentMethod || 'N/A'}
                </div>
              </div>
              {accountingData.purchaseRecord.Description && (
                <div style={{ marginBottom: '10px' }}>
                  <strong>Description:</strong> {accountingData.purchaseRecord.Description}
                </div>
              )}
              {accountingData.purchaseRecord.PurchaseNotes && (
                <div>
                  <strong>Notes:</strong> {accountingData.purchaseRecord.PurchaseNotes}
                </div>
              )}
            </div>

            <div style={{
              borderTop: '2px solid #007bff',
              paddingTop: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#007bff', fontSize: '14px' }}>
                Individual Animal Data
              </h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '15px'
              }}>
                <div>
                  <strong>Individual Price:</strong> {formatPrice(accountingData.cowPurchasePrice)}
                </div>
              </div>
            </div>

            <button
              onClick={handleManagePurchase}
              style={{
                marginTop: '15px',
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              View/Edit Purchase Record
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ color: '#6c757d', marginBottom: '15px' }}>
              No purchase record linked to this animal
            </p>
            <button
              onClick={handleManagePurchase}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Create or Link Purchase Record
            </button>
          </div>
        )}
      </div>

      {/* Sale Record Section */}
      <div className="bubble-container" style={{
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
          Sale Record
        </h3>
        
        {accountingData?.saleRecord ? (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>
                Sale Record Details
              </h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '15px',
                marginBottom: '15px'
              }}>
                <div>
                  <strong>Record ID:</strong> {accountingData.saleRecordID}
                </div>
                <div>
                  <strong>Sale Date:</strong> {formatDate(accountingData.saleRecord.SaleDate)}
                </div>
                <div>
                  <strong>Record Price:</strong> {formatPrice(accountingData.saleRecord.SalePrice)}
                </div>
                <div>
                  <strong>Customer:</strong> {accountingData.saleRecord.Customer || 'N/A'}
                </div>
                <div>
                  <strong>Payment Method:</strong> {accountingData.saleRecord.PaymentMethod || 'N/A'}
                </div>
                {accountingData.saleRecord.Commission && (
                  <div>
                    <strong>Commission:</strong> {formatPrice(accountingData.saleRecord.Commission)}
                  </div>
                )}
              </div>
              {accountingData.saleRecord.Description && (
                <div style={{ marginBottom: '10px' }}>
                  <strong>Description:</strong> {accountingData.saleRecord.Description}
                </div>
              )}
              {accountingData.saleRecord.SaleNotes && (
                <div>
                  <strong>Notes:</strong> {accountingData.saleRecord.SaleNotes}
                </div>
              )}
            </div>

            <div style={{
              borderTop: '2px solid #007bff',
              paddingTop: '15px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#007bff', fontSize: '14px' }}>
                Individual Animal Data
              </h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '15px'
              }}>
                <div>
                  <strong>Individual Price:</strong> {formatPrice(accountingData.cowSalePrice)}
                </div>
                <div>
                  <strong>Weight at Sale:</strong> {accountingData.weightAtSale ? `${accountingData.weightAtSale} lbs` : 'N/A'}
                </div>
                <div>
                  <strong>Reason Sold:</strong> {accountingData.reasonAnimalSold || 'N/A'}
                </div>
              </div>
            </div>

            <div style={{ 
              padding: '10px', 
              backgroundColor: accountingData.status === 'Sold' ? '#d4edda' : '#fff3cd',
              borderRadius: '4px',
              border: `1px solid ${accountingData.status === 'Sold' ? '#c3e6cb' : '#ffeeba'}`
            }}>
              <strong>Status:</strong> {accountingData.status || 'Unknown'}
            </div>

            <button
              onClick={handleManageSale}
              style={{
                marginTop: '15px',
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              View/Edit Sale Record
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ color: '#6c757d', marginBottom: '15px' }}>
              No sale record linked to this animal
            </p>
            <button
              onClick={handleManageSale}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Create or Link Sale Record
            </button>
          </div>
        )}
      </div>

      {/* Customer Database Section */}
      <div className="bubble-container" style={{
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
          Customer Database
        </h3>
        <p style={{ color: '#6c757d', marginBottom: '15px' }}>
          View and manage your customer records
        </p>
        <button
          onClick={handleViewCustomers}
          style={{
            padding: '10px 20px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          View Customer Database
        </button>
      </div>

      {/* Customer Viewer Popup */}
      <Popup
        isOpen={showCustomerViewer}
        onClose={handleCloseCustomerViewer}
        title="Customer Database"
        fullscreen={true}
      >
        <CustomerViewer
          customers={customers}
          onClose={handleCloseCustomerViewer}
          onAddCustomer={handleAddCustomer}
          onUpdateCustomer={handleUpdateCustomer}
          customersLoading={customersLoading}
        />
      </Popup>

      {/* Purchase Viewer Popup */}
      <Popup
        isOpen={showPurchaseViewer}
        onClose={handleClosePurchaseViewer}
        title="Purchase Records"
        fullscreen={true}
      >
        <PurchaseSaleViewer
          mode="purchase"
          records={purchases}
          onClose={handleClosePurchaseViewer}
          onAddRecord={handleAddPurchase}
          onUpdateRecord={handleUpdatePurchase}
          recordsLoading={recordsLoading}
          onLink={handleLinkPurchase}
          initialEditRecordId={accountingData?.purchaseRecordID || null}
          initialIndividualData={accountingData?.purchaseRecordID ? {
            individualPrice: accountingData.cowPurchasePrice
          } : null}
        />
      </Popup>

      {/* Sale Viewer Popup */}
      <Popup
        isOpen={showSaleViewer}
        onClose={handleCloseSaleViewer}
        title="Sale Records"
        fullscreen={true}
      >
        <PurchaseSaleViewer
          mode="sale"
          records={sales}
          onClose={handleCloseSaleViewer}
          onAddRecord={handleAddSale}
          onUpdateRecord={handleUpdateSale}
          recordsLoading={recordsLoading}
          onLink={handleLinkSale}
          initialEditRecordId={accountingData?.saleRecordID || null}
          initialIndividualData={accountingData?.saleRecordID ? {
            individualPrice: accountingData.cowSalePrice,
            weightAtSale: accountingData.weightAtSale,
            reasonSold: accountingData.reasonAnimalSold
          } : null}
        />
      </Popup>
    </div>
  );
}

export default Sales;