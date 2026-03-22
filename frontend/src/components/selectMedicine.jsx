import React, { useState, useEffect, useCallback } from 'react';
import Popup from './popup';
import MedicationViewer from './MedicationViewer';

/**
 * SelectMedicine
 *
 * A fully self-contained medicine picker. Fetches its own medicine list,
 * owns add/update routes, and manages the MedicationViewer popup internally.
 *
 * Props:
 *   value    {string}   - Controlled medicine ID (empty string = none selected)
 *   onChange {function} - Called as onChange(medicineID, medicineObject | null)
 *                         medicineObject is null when selection is cleared.
 *   disabled {boolean}  - Optional. Disables the select.
 *   style    {object}   - Optional extra styles merged onto the <select>.
 */
function SelectMedicine({ value = '', onChange, disabled = false, style = {} }) {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const selectStyle = {
    width: '100%',
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: 'white',
    ...style
  };

  //  Data fetching 

  const loadMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/medical/medicines', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMedicines(data.medicines || []);
      } else {
        console.error('SelectMedicine: failed to load medicines', response.status);
        setMedicines([]);
      }
    } catch (error) {
      console.error('SelectMedicine: error loading medicines', error);
      setMedicines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  //  Medicine CRUD (owned internally so MedicationViewer works standalone) 

  const addMedicine = async (medicineData) => {
    const response = await fetch('/api/medical/medicines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(medicineData)
    });
    if (!response.ok) throw new Error('Failed to add medicine');
    await loadMedicines();
    return true;
  };

  const updateMedicine = async (medicineID, medicineData) => {
    const response = await fetch(`/api/medical/medicines/${medicineID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(medicineData)
    });
    if (!response.ok) throw new Error('Failed to update medicine');
    await loadMedicines();
    return true;
  };


  const getDisplayName = (med) =>
    med.BrandName || med.GenericName || med.Shorthand || med.ID;


const handleChange = (e) => {
    const selectedID = e.target.value;
    if (selectedID === 'OPEN_VIEWER') { setShowViewer(true); return; }
    if (!onChange) return;
    if (selectedID === '') {
        onChange('', null, '');
    } else {
        const medicine = medicines.find((m) => String(m.ID) === String(selectedID)) || null;
        const displayName = medicine ? getDisplayName(medicine) : '';
        onChange(selectedID, medicine, displayName);  // <-- added third arg
    }
};

  const handleViewerClose = () => {
    setShowViewer(false);
    loadMedicines(); // Refresh list in case medicines were added or edited
  };

  //  Render 

  return (
    <>
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled || loading}
        style={selectStyle}
      >
        <option value="">
          {loading ? 'Loading medicines...' : 'Select a medicine...'}
        </option>
        {!loading && medicines.map((med) => (
          <option key={med.ID} value={med.ID}>
            {getDisplayName(med)} ({med.Shorthand || med.ID})
          </option>
        ))}
        {!loading && (
          <option value="OPEN_VIEWER" style={{ backgroundColor: '#e7f3ff', fontWeight: 'bold', borderTop: '2px solid #007bff' }}>
            View/Manage All Medicines...
          </option>
        )}
      </select>

      <Popup
        isOpen={showViewer}
        onClose={handleViewerClose}
        title="Medicine Database"
        fullscreen={true}
      >
        <MedicationViewer
          medicines={medicines}
          onClose={handleViewerClose}
          onAddMedicine={addMedicine}
          onUpdateMedicine={updateMedicine}
          medicinesLoading={loading}
        />
      </Popup>
    </>
  );
}

export default SelectMedicine;