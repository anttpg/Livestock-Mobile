import React, { useState } from 'react';
import AnimalForm from './animalForm';
import EquipmentForm from './equipmentForm';
import EquipmentMaintenanceForm from './equipmentMaintenanceForm';
import PastureForm from './pastureForm';
import PastureActivityForm from './pastureActivityForm';
import PastureSprayForm from './pastureSprayForm';
import PastureHayForm from './pastureHayForm';


const FORMS = [
    {
        key:       'animal',
        label:     'Animal',
        editKey:   'cowTag',
        editLabel: 'Cow Tag',
        editFetch: (val) => `/api/cow/${encodeURIComponent(val)}`,
        editData:  (data) => data.cow ?? data,
    },
    {
        key:       'equipment',
        label:     'Equipment',
        editKey:   'id',
        editLabel: 'Equipment ID',
        editFetch: (val) => `/api/equipment/${val}`,
        editData:  (data) => data.equipment ?? data,
    },
    {
        key:       'equipmentMaintenance',
        label:     'Equipment Maintenance',
        editKey:   'id',
        editLabel: 'Record ID',
        editFetch: (val) => `/api/equipment-maintenance/${val}`,
        editData:  (data) => data.record ?? data,
    },
    {
        key:       'pasture',
        label:     'Pasture',
        editKey:   'pastureName',
        editLabel: 'Pasture Name',
        editFetch: (val) => `/api/pastures/${encodeURIComponent(val)}`,
        editData:  (data) => data.pasture ?? data,
    },
    {
        key:       'pastureActivity',
        label:     'Pasture Activity',
        editKey:   'id',
        editLabel: 'Record ID',
        editFetch: (val) => `/api/pasture-activity/${val}`,
        editData:  (data) => data.record ?? data,
    },
    {
        key:       'pastureSpray',
        label:     'Pasture Spray',
        editKey:   'id',
        editLabel: 'Record ID',
        editFetch: (val) => `/api/pasture-spray/${val}`,
        editData:  (data) => data.record ?? data,
    },
    {
        key:       'pastureHay',
        label:     'Pasture Hay',
        editKey:   'id',
        editLabel: 'Record ID',
        editFetch: (val) => `/api/pasture-hay/${val}`,
        editData:  (data) => data.record ?? data,
    },
];


function renderForm(key, { initialData, onSuccess }) {
    const shared = { initialData, onSuccess, onClose: () => {} };
    switch (key) {
        case 'animal':              return <AnimalForm             {...shared} showTwinsOption />;
        case 'equipment':           return <EquipmentForm          {...shared} />;
        case 'equipmentMaintenance':return <EquipmentMaintenanceForm {...shared} />;
        case 'pasture':             return <PastureForm            {...shared} />;
        case 'pastureActivity':     return <PastureActivityForm    {...shared} />;
        case 'pastureSpray':        return <PastureSprayForm       {...shared} />;
        case 'pastureHay':          return <PastureHayForm         {...shared} />;
        default:                    return null;
    }
}


function EditLoader({ formConfig, onLoaded }) {
    const [inputVal,  setInputVal]  = useState('');
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState('');

    const handleLoad = async () => {
        if (!inputVal.trim()) { setError(`${formConfig.editLabel} is required`); return; }
        setLoading(true);
        setError('');
        try {
            const res = await fetch(formConfig.editFetch(inputVal.trim()), { credentials: 'include' });
            if (!res.ok) { setError('Record not found.'); return; }
            const data = await res.json();
            onLoaded(formConfig.editData(data));
        } catch {
            setError('Failed to fetch record.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '32px', maxWidth: '400px', margin: '0 auto' }}>
            <p style={{ marginBottom: '16px', color: '#555', fontSize: '14px' }}>
                Enter the {formConfig.editLabel.toLowerCase()} of the record you want to edit.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    className="form-input"
                    value={inputVal}
                    onChange={e => { setInputVal(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLoad()}
                    placeholder={formConfig.editLabel}
                    autoFocus
                />
                <button className="button" onClick={handleLoad} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
                    {loading ? 'Loading...' : 'Load Record'}
                </button>
            </div>
            {error && <div className="form-error" style={{ marginTop: '8px' }}>{error}</div>}
        </div>
    );
}


function Playhouse() {
    const [activeKey,    setActiveKey]    = useState(FORMS[0].key);
    const [mode,         setMode]         = useState('add');  // 'add' | 'edit'
    const [initialData,  setInitialData]  = useState(null);
    const [successMsg,   setSuccessMsg]   = useState('');

    const activeForm = FORMS.find(f => f.key === activeKey);

    const switchForm = (key) => {
        setActiveKey(key);
        setMode('add');
        setInitialData(null);
        setSuccessMsg('');
    };

    const switchMode = (m) => {
        setMode(m);
        setInitialData(null);
        setSuccessMsg('');
    };

    const handleSuccess = () => {
        setSuccessMsg('Submitted successfully.');
        if (mode === 'add') setInitialData(null);
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'inherit', background: '#f4f5f7' }}>

            {/* ── Sidebar ── */}
            <div style={{
                width: '200px', flexShrink: 0,
                background: '#1e2a38', color: '#c8d3e0',
                display: 'flex', flexDirection: 'column',
                padding: '24px 0'
            }}>
                <div style={{ padding: '0 20px 20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a6080' }}>
                    Playhouse
                </div>
                {FORMS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => switchForm(f.key)}
                        style={{
                            background: activeKey === f.key ? '#2d3f53' : 'none',
                            border: 'none',
                            borderLeft: activeKey === f.key ? '3px solid #4d9de0' : '3px solid transparent',
                            color: activeKey === f.key ? '#fff' : '#8da4be',
                            padding: '10px 20px',
                            textAlign: 'left',
                            fontSize: '13px',
                            cursor: 'pointer',
                            width: '100%',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* ── Main ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* Header */}
                <div style={{
                    background: '#fff', borderBottom: '1px solid #e0e4ea',
                    padding: '16px 28px', display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e2a38', marginRight: 'auto' }}>
                        {activeForm.label}
                    </span>

                    {/* Mode toggle */}
                    <div style={{ display: 'flex', gap: '0', border: '1px solid #ccd3dc', borderRadius: '4px', overflow: 'hidden' }}>
                        {['add', 'edit'].map(m => (
                            <button
                                key={m}
                                onClick={() => switchMode(m)}
                                style={{
                                    padding: '6px 18px', fontSize: '13px', border: 'none', cursor: 'pointer',
                                    background: mode === m ? '#1e2a38' : '#fff',
                                    color:      mode === m ? '#fff'     : '#555',
                                    fontWeight: mode === m ? 600        : 400,
                                }}
                            >
                                {m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Success banner */}
                {successMsg && (
                    <div style={{ background: '#d4edda', color: '#155724', padding: '10px 28px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{successMsg}</span>
                        <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#155724', fontWeight: 700 }}>×</button>
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                    <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e0e4ea', overflow: 'hidden' }}>
                        {mode === 'add'
                            ? renderForm(activeKey, { initialData: null, onSuccess: handleSuccess })
                            : initialData
                                ? renderForm(activeKey, { initialData, onSuccess: handleSuccess })
                                : <EditLoader formConfig={activeForm} onLoaded={setInitialData} />
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Playhouse;