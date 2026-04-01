import React, { useState, useEffect } from 'react';
import AnimalCombobox from './animalCombobox';
import { StatusBadge } from './animalCombobox';

function SubmitHerdAnimals({ herdName, isOpen, onClose, onSubmit, loading }) {

    // Selected tags (ordered list submitted on create)
    const [selectedTags, setSelectedTags] = useState([]);
    // Full animal pool for combobox — [{ tag, status }]
    const [animalPool,   setAnimalPool]   = useState([]);
    // Status lookup for rendering badges in the selected list
    const [statusMap,    setStatusMap]    = useState({});
    const [searchValue,  setSearchValue]  = useState('');
    const [fetching,     setFetching]     = useState(false);

    useEffect(() => {
        if (!isOpen || !herdName) return;
        setSearchValue('');
        setSelectedTags([]);
        setAnimalPool([]);
        setStatusMap({});
        loadAnimals();
    }, [isOpen, herdName]);

    const loadAnimals = async () => {
        setFetching(true);
        try {
            const [herdRes, allRes] = await Promise.all([
                fetch(`/api/herds/${encodeURIComponent(herdName)}/animals`, { credentials: 'include' }),
                fetch('/api/animals', { credentials: 'include' }),
            ]);

            // Build status map from all animals
            if (allRes.ok) {
                const data = await allRes.json();
                const map = {};
                (data.cows  || []).forEach(a => { if (a.CowTag)  map[a.CowTag]  = a.Status; });
                (data.goats || []).forEach(a => { if (a.GoatTag) map[a.GoatTag] = a.Status; });
                setStatusMap(map);

                const cowTags  = (data.cows  || []).map(a => a.CowTag).filter(Boolean);
                const goatTags = (data.goats || []).map(a => a.GoatTag).filter(Boolean);
                setAnimalPool([...cowTags, ...goatTags]);
            }

            // Pre-select herd animals
            if (herdRes.ok) {
                const data = await herdRes.json();
                const animals = data.animals || [];
                setSelectedTags(animals.map(a => a.CowTag).filter(Boolean));
            }
        } catch (e) {
            console.error('Error loading animals:', e);
        } finally {
            setFetching(false);
        }
    };

    const comboOptions = animalPool
        .filter(tag => !selectedTags.includes(tag))
        .map(tag => ({ name: tag, value: tag, status: statusMap[tag] }));

    const handleSearchChange = (val) => {
        const match = comboOptions.find(o => o.value === val);
        if (match) {
            setSelectedTags(prev => [...prev, val]);
            setSearchValue('');
        } else {
            setSearchValue(val);
        }
    };

    const handleRemove = (tag) => {
        setSelectedTags(prev => prev.filter(t => t !== tag));
    };

    if (!isOpen) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '420px' }}>

            {/* Toolbar */}
            <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#666' }}>
                    {fetching ? 'Loading...' : `${selectedTags.length} animal${selectedTags.length !== 1 ? 's' : ''} selected`}
                </span>
            </div>

            {/* Search to add */}
            <div style={{ marginBottom: '10px' }}>
                <AnimalCombobox
                    options={comboOptions}
                    value={searchValue}
                    onChange={handleSearchChange}
                    placeholder="Search to add an animal..."
                    allowCustomValue={false}
                />
            </div>

            {/* Selected animals list */}
            <div style={{
                flex: 1, overflowY: 'auto', border: '1px solid #ddd',
                borderRadius: '4px', backgroundColor: '#fafafa',
                minHeight: '260px', maxHeight: '400px',
            }}>
                {fetching ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
                        Loading animals...
                    </div>
                ) : selectedTags.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
                        No animals selected. Use the search box above to add animals.
                    </div>
                ) : (
                    selectedTags.map(tag => (
                        <div key={tag} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '7px 12px', borderBottom: '1px solid #eee', backgroundColor: 'white',
                        }}>
                            <input
                                type="checkbox"
                                checked
                                onChange={() => handleRemove(tag)}
                                style={{ cursor: 'pointer', flexShrink: 0 }}
                            />
                            <span style={{ fontSize: '13px', flex: 1 }}>{tag}</span>
                            <StatusBadge status={statusMap[tag]} />
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                    onClick={onClose}
                    disabled={loading}
                    className="button"
                    style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white' }}
                >
                    Back
                </button>
                <button
                    onClick={() => onSubmit(selectedTags)}
                    disabled={loading || fetching || selectedTags.length === 0}
                    className="button"
                    style={{
                        padding: '10px 20px',
                        opacity: (loading || fetching || selectedTags.length === 0) ? 0.6 : 1,
                        cursor:  (loading || fetching || selectedTags.length === 0) ? 'not-allowed' : 'pointer',
                    }}
                >
                    {loading ? 'Creating...' : `Create with ${selectedTags.length} animal${selectedTags.length !== 1 ? 's' : ''}`}
                </button>
            </div>
        </div>
    );
}

export default SubmitHerdAnimals;