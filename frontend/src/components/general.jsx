import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SearchBar from './searchBar';
import Notes from './notes';
import Minimap from './minimap';
import ColorTable from './colorTable';
import AnimalPhotoViewer from './animalPhotoViewer';
import HerdSplitter from './herdSplitter';
import Popup from './popup';
import PopupConfirm from './popupConfirm';
import PopupNotify from './popupNotify';
import AddWeightRecord from './addWeightRecord';
import { useUser } from '../UserContext';
import { toUTC, toLocalDisplayLong } from '../utils/dateUtils';

function General({ cowTag, cowData, onRefresh }) {
    const { user } = useUser();
    const currentUser = user?.username;
    const [, setSearchParams] = useSearchParams();

    const [statuses, setStatuses] = useState([]);
    const [allHerds, setAllHerds] = useState([]);
    const [showHerdSplitter, setShowHerdSplitter] = useState(false);
    const [showAddWeightPopup, setShowAddWeightPopup] = useState(false);

    const [newTemperament, setNewTemperament] = useState('');
    const [temperaments, setTemperaments] = useState([]);
    const [showNewTemperamentPopup, setShowNewTemperamentPopup] = useState(false);

    const [showDeathPopup, setShowDeathPopup] = useState(false);
    const [regCerts, setRegCerts] = useState([]);
    
    const [deathData, setDeathData] = useState({ dateOfDeath: '', causeOfDeath: '' });
    const [showConfirmPopup, setShowConfirmPopup] = useState(false);
    const [pendingUpdate, setPendingUpdate] = useState(null);

    const [editableDescription, setEditableDescription] = useState('');
    const [editableRegCertNumber, setEditableRegCertNumber] = useState('');

    useEffect(() => {
        const fetchDropdownData = async () => {
            try {
                const response = await fetch('/api/form-dropdown-data', { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setTemperaments(data.temperaments || []);
                    setStatuses(data.statuses || []);
                    setRegCerts(data.regCerts || []);
                }
            } catch (error) {
                console.error('Error fetching dropdown data:', error);
            }
        };
        fetchDropdownData();
    }, []);

    useEffect(() => {
        if (cowData?.availableHerds) {
            setAllHerds(cowData.availableHerds);
        }
    }, [cowData]);

    useEffect(() => {
        setEditableDescription(cowData?.cowData?.Description || '');
        setEditableRegCertNumber(cowData?.cowData?.RegCertNumber || '');
    }, [cowData]);

    const handleHerdChange = async (newHerd) => {
        try {
            const response = await fetch('/api/cows/herd', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cowTags: cowTag, herdName: newHerd })
            });
            if (response.ok) {
                onRefresh();
            } else {
                const errorData = await response.json();
                alert(`Failed to update herd: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error updating herd:', error);
            alert('Error updating herd');
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (newStatus === 'Dead') {
            setShowDeathPopup(true);
        } else if (newStatus === 'Sold') {
            setSearchParams({ tab: 'sales', search: cowTag });
        } else {
            await updateCowData({ Status: newStatus });
        }
    };


    const handleDeathSubmit = async () => {
        if (!deathData.dateOfDeath || !deathData.causeOfDeath) {
            alert('Please provide both date of death and cause of death');
            return;
        }
        await updateCowData({
            Status: 'Dead',
            DateOfDeath: toUTC(deathData.dateOfDeath),
            CauseOfDeath: deathData.causeOfDeath
        });
        setShowDeathPopup(false);
        setDeathData({ dateOfDeath: '', causeOfDeath: '' });
    };

    const handleTemperamentChange = async (newTemperament) => {
        if (newTemperament === '+ New Temperament') {
            setShowNewTemperamentPopup(true);
        } else {
            await updateCowData({ Temperament: newTemperament });
        }
    };

    const handleNewTemperamentSubmit = () => {
        if (!newTemperament.trim()) {
            alert('Please enter a temperament name');
            return;
        }
        setPendingUpdate({ type: 'newTemperament', value: newTemperament });
        setShowConfirmPopup(true);
    };

    const handleConfirmNewTemperament = async () => {
        try {
            const response = await fetch('/api/form-dropdown-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ table: 'Temperament', value: newTemperament })
            });
            if (response.ok) {
                const tempResponse = await fetch('/api/form-dropdown-data', { credentials: 'include' });
                if (tempResponse.ok) {
                    const data = await tempResponse.json();
                    setTemperaments(data.temperaments || []);
                }
                await updateCowData({ Temperament: newTemperament });
                setShowNewTemperamentPopup(false);
                setNewTemperament('');
            } else {
                alert('Failed to add new temperament');
            }
        } catch (error) {
            console.error('Error adding temperament:', error);
            alert('Error adding temperament');
        }
        setShowConfirmPopup(false);
        setPendingUpdate(null);
    };

    const handleDescriptionChange = async () => {
        if (editableDescription !== cow?.Description) {
            await updateCowData({ Description: editableDescription });
        }
    };

    const updateCowData = async (updates) => {
        try {
            const response = await fetch(`/api/cow/${encodeURIComponent(cowTag)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates)
            });
            if (response.ok) {
                onRefresh();
            } else {
                const errorData = await response.json();
                alert(`Failed to update: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error updating cow data:', error);
            alert('Error updating cow data');
        }
    };

    const handleCalfView = (calfData) => {
        if (!calfData?.CalfTag) return;
        setSearchParams({ tab: 'general', search: calfData.CalfTag });
    };

    const cow = cowData?.cowData;
    const minimap = cowData?.minimap;
    const currentWeight = cowData?.currentWeight;

    const calfColumns = [
        { key: 'CalfTag', header: 'Calf Tag', width: '120px', type: 'text' },
        { key: 'DOB', header: 'DOB', type: 'date' }
    ];


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', zIndex: -1 }}>

            {/* Images and Basic Info */}
            <div className="bubble-container" style={{ display: 'flex', minHeight: '20px' }}>

                {/* If animal doesnt exist... */}
                {!cow ? (
                <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    fontStyle: 'italic',
                    color: '#666',
                    border: '2px dashed #ccc',
                    borderRadius: '5px',
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box'
                }}>
                    Animal Not Found
                </div>
                ) : (
                    <>
                        {/* Left side - Photo Viewers (responsive sizing) */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            flex: 1,
                            minWidth: '200px',
                            maxWidth: '400px',
                            aspectRatio: '1 / 1',
                            width: '100%'
                        }}>
                            <AnimalPhotoViewer
                                cowTag={cowTag}
                                imageType="headshot"
                                style={{
                                    flex: 1,
                                    borderRadius: '5px',
                                    minHeight: '0',
                                    width: '100%'
                                }}
                            />
                            <AnimalPhotoViewer
                                cowTag={cowTag}
                                imageType="body"
                                style={{
                                    flex: 1,
                                    borderRadius: '5px',
                                    minHeight: '0',
                                    width: '100%'
                                }}
                            />
                        </div>

                        {/* Right side - Minimap and Info (fixed width) */}
                        <div style={{
                            width: '200px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '15px',
                            flexShrink: 1
                        }}>
                            {/* Minimap Component */}
                            <div style={{
                                width: 'var(--minimap)',
                                height: 'var(--minimap)'
                            }}>
                                <Minimap
                                    pastureName={cow?.PastureName}
                                    minimapSrc={minimap?.path}
                                />
                            </div>

                            {/* Basic Info */}
                            <div>
                                {/* Location Information */}
                                {cow?.IsActive && cow?.PastureName && (
                                    <>
                                        <b>Location:</b>
                                        <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
                                            <br />{cow.PastureName}
                                        </span>
                                        <br /><br />
                                    </>
                                )}

                                {/* Current Herd with dropdown - Only show if animal is active */}
                                {cow?.IsActive && (
                                    <>
                                        <b>Herd:</b><br />
                                        <select
                                            value={cow?.CurrentHerd || ''}
                                            onChange={(e) => {
                                                if (e.target.value === '+ New Herd') {
                                                    setShowHerdSplitter(true);
                                                } else {
                                                    handleHerdChange(e.target.value);
                                                }
                                            }}
                                            style={{
                                                marginLeft: '10px',
                                                padding: '2px 5px',
                                                fontSize: '14px',
                                                border: '1px solid #ccc',
                                                borderRadius: '3px'
                                            }}
                                        >
                                            <option value="">Select Herd</option>
                                            {allHerds.map((herd, index) => (
                                                <option key={index} value={herd}>
                                                    {herd}
                                                </option>
                                            ))}
                                            <option value="+ New Herd">+ New Herd</option>
                                        </select>
                                        <br /><br />
                                    </>
                                )}

                                {/* Status selector */}
                                <b>Status:</b><br />
                                <select
                                    value={cow?.Status || ''}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    style={{ marginLeft: '10px' }}
                                >
                                    <option value="">Select Status</option>
                                    {statuses
                                        .filter(status => status !== 'CULL LIST, Current')
                                        .map((status, index) => (
                                            <option key={index} value={status}>
                                                {status}
                                            </option>
                                        ))
                                    }
                                </select>
                                <br /><br />


                                <b>Sex:</b>
                                <br />
                                <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
                                    {cow?.Sex ? (
                                        cow.Sex === 'Male' ? (
                                            cow.Castrated ? 'Steer' : 'Bull'
                                        ) : 'Heifer'
                                    ) : 'Not recorded'}
                                </span>
                                <br /><br />

                                <b>Date of Birth:</b>
                                <br />
                                <span style={{ marginLeft: '10px', fontStyle: cow ? 'normal' : 'italic' }}>
                                    {cow?.DateOfBirth ? toLocalDisplayLong(cow.DateOfBirth) : 'Not recorded'}
                                </span>
                                <br /><br />

                                <b>Last Weight:</b>
                                <br />
                                <span style={{ marginLeft: '10px', fontStyle: currentWeight ? 'normal' : 'italic' }}>
                                    {currentWeight ? (
                                        <>
                                            {currentWeight.weight} lbs
                                            <br />
                                            ({toLocalDisplayLong(currentWeight.date)})
                                        </>
                                    ) : (
                                        'No weight recorded'
                                    )}
                                    <span
                                        className="material-symbols-outlined"
                                        onClick={() => setShowAddWeightPopup(true)}
                                        title="Add weight record"
                                        style={{
                                            marginLeft: '8px',
                                            fontSize: '18px',
                                            verticalAlign: 'middle',
                                            cursor: 'pointer',
                                            color: '#4CAF50',
                                            userSelect: 'none'
                                        }}
                                    >
                                        add_circle
                                    </span>
                                </span>
                                <br /><br />

                                <b>Temperament:</b>
                                <select
                                    value={cow?.Temperament || ''}
                                    onChange={(e) => handleTemperamentChange(e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    {temperaments.map((temp, index) => (
                                        <option key={index} value={temp}>
                                            {temp}
                                        </option>
                                    ))}
                                    <option value="+ New Temperament">+ Add New</option>
                                </select>
                                <br /><br />

                                <b>Description:</b>
                                <textarea
                                    value={editableDescription}
                                    onChange={(e) => setEditableDescription(e.target.value)}
                                    onBlur={handleDescriptionChange}
                                    placeholder="Enter description..."
                                    style={{
                                        marginLeft: '10px',
                                        width: 'calc(100% - 20px)',
                                        minHeight: '60px',
                                        padding: '5px',
                                        fontSize: '14px',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        fontFamily: 'inherit',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="bubble-container">
                <h3 style={{ margin: 0 }}>Registration & Certification</h3>
                <div style={{ marginTop: ".4rem" }}>
                    {!cow ? (
                        <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            fontStyle: 'italic',
                            color: '#666',
                            border: '2px dashed #ccc',
                            borderRadius: '5px',
                            width: '100%',
                            height: '100%',
                            boxSizing: 'border-box'
                        }}>
                            Animal Not Found
                        </div>
                    ) : (
                        <>
                            {/* Reg / Cert status */}

                            <span>Status:</span>
                            <select
                                value={cow?.RegCert || ''}
                                onChange={(e) => updateCowData({ RegCert: e.target.value })}
                                style={{ marginLeft: '.8rem' }}
                            >
                                <option value="">None</option>
                                {regCerts
                                    .filter((val) => val != "None")
                                    .map((temp, index) => (
                                        <option key={index} value={temp}>
                                            {temp}
                                        </option>
                                    ))}
                            </select>
                            <br />
                            <span> Number:</span>
                            <input
                                type="text"
                                style={{ width: "8.5rem", marginLeft: '.8rem' }}
                                value={editableRegCertNumber}
                                onChange={(e) => setEditableRegCertNumber(e.target.value)}
                                onBlur={() => {
                                    if (editableRegCertNumber !== cow?.RegCertNumber) {
                                        updateCowData({ RegCertNumber: editableRegCertNumber });
                                    }
                                }}
                                placeholder="Enter value..."
                            />


                        </>
                    )}
                </div>
            </div>


            {/* Notes */}
            <div className="bubble-container">
                <Notes
                    cowTag={cowTag}
                    currentUser={currentUser}
                />
            </div>


            {/*  Current Calves */}
            <div className="bubble-container">
                <h3 style={{ margin: '0px', paddingBottom: '10px' }}>Calves:</h3>

                <ColorTable
                    data={cowData?.calves || []}
                    columns={calfColumns}
                    showActionColumn={false}
                    alternatingRows={true}
                    evenRowColor="#fff"
                    oddRowColor="#f4f4f4"
                    emptyMessage="No calves on record for selected cow"
                    maxWidth="100%"
                />
            </div>

            {/* HerdSplitter Modal */}
            {showHerdSplitter && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        width: '90vw',
                        height: '90vh',
                        maxWidth: '1200px'
                    }}>
                        <HerdSplitter
                            isOpen={showHerdSplitter}
                            onClose={() => setShowHerdSplitter(false)}
                            onSave={() => {
                                setShowHerdSplitter(false);
                                handleRefresh();
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Death Popup */}
            <Popup
                isOpen={showDeathPopup}
                onClose={() => setShowDeathPopup(false)}
                title="Record Death"
                width="500px"
            >
                <div style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Date of Death:
                        </label>
                        <input
                            type="date"
                            value={deathData.dateOfDeath}
                            onChange={(e) => setDeathData({ ...deathData, dateOfDeath: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '14px',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Cause of Death:
                        </label>
                        <textarea
                            value={deathData.causeOfDeath}
                            onChange={(e) => setDeathData({ ...deathData, causeOfDeath: e.target.value })}
                            placeholder="Enter cause of death..."
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                padding: '8px',
                                fontSize: '14px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setShowDeathPopup(false)}
                            style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: '#b4b2b2ff',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeathSubmit}
                            style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                border: 'none',
                                borderRadius: '4px',
                                backgroundColor: '#d32f2f',
                                color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </Popup>

            {/* New Temperament Popup */}
            <Popup
                isOpen={showNewTemperamentPopup}
                onClose={() => {
                    setShowNewTemperamentPopup(false);
                    setNewTemperament('');
                }}
                title="Add New Temperament"
                width="400px"
            >
                <div style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Temperament Name:
                        </label>
                        <input
                            type="text"
                            value={newTemperament}
                            onChange={(e) => setNewTemperament(e.target.value)}
                            placeholder="Enter temperament name..."
                            style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '14px',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => {
                                setShowNewTemperamentPopup(false);
                                setNewTemperament('');
                            }}
                            style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleNewTemperamentSubmit}
                            style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                border: 'none',
                                borderRadius: '4px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </Popup>

            {/* Confirmation Popup */}
            <PopupConfirm
                isOpen={showConfirmPopup}
                onClose={() => {
                    setShowConfirmPopup(false);
                    setPendingUpdate(null);
                }}
                onConfirm={handleConfirmNewTemperament}
                title="Confirm New Temperament"
                message={`Are you sure you want to add "${pendingUpdate?.value}" as a new temperament option?`}
                confirmText="Add Temperament"
                cancelText="Cancel"
            />


            {/* Weight Record Popup */}
            <Popup
                isOpen={showAddWeightPopup}
                onClose={() => setShowAddWeightPopup(false)}
                title="Add Weight Record"
                width="420px"
            >
                <AddWeightRecord
                    cowTag={cowTag}
                    onSuccess={() => {
                        setShowAddWeightPopup(false);
                        onRefresh();
                    }}
                    onCancel={() => setShowAddWeightPopup(false)}
                />
            </Popup>
        </div>
    );
}

export default General;