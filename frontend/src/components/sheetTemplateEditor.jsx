import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Popup from './popup';
import ConfirmPopup from './popupConfirm';
import SelectMedicine from './selectMedicine';
import '../screenSizing.css';

//  Visual meta for each source (purely cosmetic, no logic lives here)

const SOURCE_META = {
  CowTable:      { label: 'CowTable',       bg: '#e3f2fd', border: '#90caf9' },
  PregancyCheck: { label: 'Preg Check',     bg: '#e8f5e9', border: '#a5d6a7' },
  WeightRecords: { label: 'Weight Record',  bg: '#fff3e0', border: '#ffcc80' },
  MedicalTable:  { label: 'Medical / Vaxx', bg: '#fce4ec', border: '#f48fb1' },
};

const TYPE_COLORS = {
  text:      '#607d8b',
  select:    '#7b1fa2',
  date:      '#1565c0',
  number:    '#2e7d32',
  boolean:   '#e65100',
  reference: '#795548',
};


//  Local UID (stripped on save, never persisted)
let _seq = 0;
const uid = () => `_tmp_${++_seq}`;



//  Convert editor state → clean template JSON (strips runtime-only fields)

function fromEditorCols(editorCols) {
  return editorCols.map(col => {
    if (col.storage === 'record') {
      const out = {
        recordSlot: col.recordSlot,
        name: col.name,
        source: col.source,
        storage: 'record',
        fields: col.fields.map(({ _id, ...f }) => f),
      };
      if (col.medicineFilter) out.medicine = col.medicineFilter;
      return out;
    }
    const { _id, locked, ...rest } = col;
    return rest;
  });
}

//  Small reusable atoms

function TypeBadge({ type }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 'bold', padding: '1px 5px',
      borderRadius: '3px', backgroundColor: TYPE_COLORS[type] || '#aaa',
      color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px',
      whiteSpace: 'nowrap', flexShrink: 0,
      minWidth: '58px', textAlign: 'center', boxSizing: 'border-box',
      display: 'inline-block',
    }}>
      {type}
    </span>
  );
}

function EditableToggle({ value, onChange }) {
  return (
    <button
      onClick={onChange}
      title={value ? 'Click to make read-only' : 'Click to make editable'}
      style={{
        padding: '2px 0', fontSize: '11px', cursor: 'pointer',
        border: '1px solid', borderRadius: '3px', flexShrink: 0,
        backgroundColor: value ? '#e8f5e9' : '#f5f5f5',
        borderColor: value ? '#4caf50' : '#bbb',
        color: value ? '#2e7d32' : '#888',
        fontWeight: 'bold',
        minWidth: '76px', textAlign: 'center',
      }}
    >
      {value ? 'Editable' : 'Read-only'}
    </button>
  );
}

//  Main component

function SheetTemplateEditor({ isOpen, onClose, sheetId, sheetName: initialSheetName, locked = false }) {

  const [sheetName, setSheetName] = useState(initialSheetName || '');
  const [animalType, setAnimalType] = useState('cattle');
  const [columns, setColumns] = useState([]);
  const [requiredFieldKeys, setRequiredFieldKeys] = useState({});
  const [availableCols, setAvailableCols] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [showDerivative, setShowDerivative] = useState(false);
  const [derivativeName, setDerivativeName] = useState('');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const [addPanel, setAddPanel] = useState(false);
  const [newRec, setNewRec] = useState({ source: 'PregancyCheck', recordSlot: '', name: '', medicineFilter: '' });
  const [loadingSheet, setLoadingSheet] = useState(false);



  // Drag state
  const isDropping = useRef(false);
  const dragStateRef = useRef(null);
  const columnsRef = useRef(columns);
  const topRowRefs = useRef({});
  const fieldRowRefs = useRef({});
  const scrollRef = useRef(null);
  const [dragVisual, setDragVisual] = useState(null);

  //  Helpers

  //  Converts DB template columns to editor state.
  //  availableCols is passed in so required fields can be auto-injected on load
  const toEditorCols = (templateCols = [], availableCols = []) => {
    return templateCols.map(col => {
      if (col.storage === 'record') {
        const reqKey = requiredFieldKeys[col.source];
        let fields = (col.fields || []).map(f => ({ ...f, _id: uid() }));
        // Auto-inject required field at position 0 if missing (backwards compat)
        if (reqKey && !fields.some(f => f.key === reqKey)) {
          const reqDef = availableCols.find(c => c.key === reqKey && c.source === col.source);
          if (reqDef) {
            fields = [{ _id: uid(), key: reqDef.key, name: reqDef.name, type: reqDef.type, editable: true }, ...fields];
          }
        }
        return {
          _id: uid(),
          storage: 'record',
          recordSlot: col.recordSlot,
          name: col.name,
          source: col.source,
          medicineFilter: col.medicine || col.medicineFilter || '',
          fields,
        };
      }
      return {
        _id: uid(),
        storage: col.storage,
        key: col.key,
        name: col.name,
        editable: col.editable ?? false,
        type: col.type,
        ...(col.key === 'CowTag' && { locked: true }),
      };
    });
  };


  const generateSlotId = (source, currentCols) => {
    const prefixes = {
      PregancyCheck: 'PregCheck',
      WeightRecords: 'Weight',
      MedicalTable: 'Vaxx',
    };
    const prefix = prefixes[source] || source;
    const count = (currentCols || columns).filter(c => c.storage === 'record' && c.source === source).length + 1;
    return `${prefix}${count}`;
  };

  // Resolves a required field def from availableCols by key only.
  const getRequiredField = (source) => {
    const key = requiredFieldKeys[source];
    if (!key) return null;
    return availableCols.find(c => c.key === key && c.source === source) || null;
  };

  // Deduplicates medicine display names within the same source.
  // Compares by ID (medicineFilter), displays the human-readable name.
  const getMedicineDisplayName = (displayName, id, currentCols) => {
    if (!displayName) return '';
    const existingCount = (currentCols || columns).filter(c =>
      c.storage === 'record' &&
      c.source === 'MedicalTable' &&
      c.medicineFilter === id
    ).length;
    return existingCount === 0 ? displayName : `${displayName} (${existingCount + 1})`;
  };

  const openAddPanel = (panel, extraState) => {
    if (extraState) extraState();
    setAddPanel(panel);
  };

  //  Effects

  useEffect(() => {
    if (!isOpen) return;
    const init = async () => {
      const avail = await fetchAvailableCols();
      if (sheetId) {
        loadSheet(avail);
      } else {
        setSheetName(initialSheetName || '');
        setAnimalType('cattle');
        // Seed CowTag from availableCols so name/type are always from the API
        const cowTagDef = avail.find(c => c.key === 'CowTag');
        setColumns(cowTagDef ? [{
          _id: uid(),
          storage: cowTagDef.storageHint || 'snapshot',
          key: 'CowTag',
          name: cowTagDef.name,
          editable: false,
          type: cowTagDef.type,
          locked: true,
        }] : []);
        setHasChanges(false);
      }
    };
    init();
  }, [isOpen, sheetId]);

  useEffect(() => {
    const handleWidth = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleWidth);
    return () => window.removeEventListener('resize', handleWidth);
  }, []);

  // Returns the fetched list so callers can use it before state settles.
  const fetchAvailableCols = async () => {
    try {
      const res = await fetch('/api/sheets/available-columns', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const avail = data.columns || [];
        setAvailableCols(avail);
        setRequiredFieldKeys(data.requiredFieldKeys || {});
        return avail;
      }
    } catch (e) {
      console.error('Error fetching available columns:', e);
    }
    return [];
  };

  // avail is passed directly so toEditorCols doesn't race against state.
  const loadSheet = async (avail = []) => {
    setLoadingSheet(true);
    try {
      const res = await fetch(`/api/sheets/structure/${sheetId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const colConfig = JSON.parse(data.columns);
        setAnimalType(colConfig.animalType || 'cattle');
        setColumns(toEditorCols(colConfig.columns || [], avail));
        setSheetName(data.name || initialSheetName || '');
        setHasChanges(false);
      }
    } catch (e) {
      console.error('Error loading sheet:', e);
    } finally {
      setLoadingSheet(false);
    }
  };

  const mark = () => setHasChanges(true);

  useEffect(() => { columnsRef.current = columns; }, [columns]);

  //  Mouse drag system

const startDrag = (e, type, itemId, idx, colId = null) => {
    e.preventDefault();
    e.stopPropagation();
    columnsRef.current = columns;

    const el = type === 'top'
      ? topRowRefs.current[itemId]
      : fieldRowRefs.current[`${colId}::${itemId}`];
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const containerRect = scrollRef.current?.getBoundingClientRect();

    const item = type === 'top'
      ? columns.find(c => c._id === itemId)
      : columns.find(c => c._id === colId)?.fields.find(f => f._id === itemId);

    // Capture natural rects BEFORE any displacement occurs
    const naturalRects = {};
    if (type === 'top') {
      columnsRef.current.forEach(c => {
        const el = topRowRefs.current[c._id];
        if (el) naturalRects[c._id] = el.getBoundingClientRect();
      });
    } else {
      const parentCol = columnsRef.current.find(c => c._id === colId);
      parentCol?.fields.forEach(f => {
        const el = fieldRowRefs.current[`${colId}::${f._id}`];
        if (el) naturalRects[f._id] = el.getBoundingClientRect();
      });
    }

    const state = {
      type, itemId, idx, colId,
      startClientY: e.clientY,
      ghostStartY: rect.top,
      dragHeight: rect.height + 5,
      hoverIdx: idx,
      naturalRects,  // <-- stored here
    };
    dragStateRef.current = state;

    setDragVisual({
      type, itemId, colId,
      startIdx: idx,
      hoverIdx: idx,
      ghostY: rect.top,
      ghostX: containerRect ? containerRect.left + 10 : rect.left,
      ghostWidth: containerRect ? containerRect.width - 20 : rect.width,
      dragHeight: rect.height + 5,
      label: item?.name || '',
      isRecord: type === 'top' && item?.storage === 'record',
      source: item?.source || null,
      typeBadge: (type === 'top' && item?.storage !== 'record') ? item?.type : null,
    });

    const onMove = (moveE) => {
      const s = dragStateRef.current;
      if (!s) return;

      const deltaY = moveE.clientY - s.startClientY;
      const ghostY = s.ghostStartY + deltaY;

      const items = s.type === 'top'
        ? columnsRef.current
        : (columnsRef.current.find(c => c._id === s.colId)?.fields || []);

      let hoverIdx = 0;
      for (let i = 0; i < items.length; i++) {
        // Use captured natural rect — unaffected by displacement transforms
        const r = s.naturalRects[items[i]._id];
        if (!r) continue;
        if (moveE.clientY <= r.top + r.height / 2) { hoverIdx = i; break; }
        hoverIdx = i;
      }

      dragStateRef.current = { ...s, hoverIdx };
      setDragVisual(prev => prev ? { ...prev, ghostY, hoverIdx } : null);
    };

    const onUp = () => {
      const s = dragStateRef.current;
      isDropping.current = true;
      if (s && s.hoverIdx !== s.idx) {
        if (s.type === 'top') {
          setColumns(prev => {
            const next = [...prev];
            const [item] = next.splice(s.idx, 1);
            next.splice(s.hoverIdx, 0, item);
            return next;
          });
        } else {
          setColumns(prev => prev.map(col => {
            if (col._id !== s.colId) return col;
            const fields = [...col.fields];
            const [item] = fields.splice(s.idx, 1);
            fields.splice(s.hoverIdx, 0, item);
            return { ...col, fields };
          }));
        }
        mark();
      }
      dragStateRef.current = null;
      setDragVisual(null);
      requestAnimationFrame(() => { isDropping.current = false; });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const getTopDisp = (colId, idx) => {
    if (!dragVisual || dragVisual.type !== 'top') return 0;
    if (dragVisual.itemId === colId) return 0;
    const { startIdx, hoverIdx, dragHeight } = dragVisual;
    if (startIdx < hoverIdx && idx > startIdx && idx <= hoverIdx) return -dragHeight;
    if (startIdx > hoverIdx && idx >= hoverIdx && idx < startIdx) return dragHeight;
    return 0;
  };

  const getFieldDisp = (parentColId, fieldId, fi) => {
    if (!dragVisual || dragVisual.type !== 'field' || dragVisual.colId !== parentColId) return 0;
    if (dragVisual.itemId === fieldId) return 0;
    const { startIdx, hoverIdx, dragHeight } = dragVisual;
    if (startIdx < hoverIdx && fi > startIdx && fi <= hoverIdx) return -dragHeight;
    if (startIdx > hoverIdx && fi >= hoverIdx && fi < startIdx) return dragHeight;
    return 0;
  };

  //  Column mutations

  const deleteTopCol = (id) => {
    const col = columns.find(c => c._id === id);
    if (col?.locked) return;
    setColumns(p => p.filter(c => c._id !== id));
    mark();
  };

  const toggleTopEditable = (id) => {
    setColumns(p => p.map(c => c._id === id ? { ...c, editable: !c.editable } : c));
    mark();
  };

  const deleteField = (cid, fid) => {
    const col = columns.find(c => c._id === cid);
    const field = col?.fields.find(f => f._id === fid);
    if (field && requiredFieldKeys[col?.source] === field.key) return;
    setColumns(p => p.map(col => col._id !== cid ? col : { ...col, fields: col.fields.filter(f => f._id !== fid) }));
    mark();
  };

  const toggleFieldEditable = (cid, fid) => {
    setColumns(p => p.map(col => col._id !== cid ? col : {
      ...col,
      fields: col.fields.map(f => f._id === fid ? { ...f, editable: !f.editable } : f),
    }));
    mark();
  };

  //  Available columns filtered to what's not yet added

  const availableSnapshotInline = () => {
    const used = new Set(columns.filter(c => c.storage !== 'record').map(c => c.key));
    return availableCols.filter(c => (c.storageHint === 'snapshot' || c.storageHint === 'inline') && !used.has(c.key));
  };

  const availableFieldsFor = (colId) => {
    const col = columns.find(c => c._id === colId);
    if (!col) return [];
    const used = new Set(col.fields.map(f => f.key));
    const reqKey = requiredFieldKeys[col.source];
    return availableCols.filter(c => {
      if (c.source !== col.source) return false;
      if (used.has(c.key)) return false;
      if (c.key === reqKey) return false; // required field cannot be manually added/removed
      return true;
    });
  };

  //  Add actions

  const addSnapshotCol = (def) => {
    setColumns(p => [...p, {
      _id: uid(), storage: def.storageHint, key: def.key,
      name: def.name, editable: def.storageHint === 'inline', type: def.type,
    }]);
    setAddPanel(false); mark();
  };

  const commitAddRecord = () => {
    if (!newRec.name.trim()) return;
    const slot = newRec.recordSlot.trim() || generateSlotId(newRec.source, columns);
    const reqDef = getRequiredField(newRec.source);
    const fields = reqDef
      ? [{ _id: uid(), key: reqDef.key, name: reqDef.name, type: reqDef.type, editable: true }]
      : [];
    setColumns(p => [...p, {
      _id: uid(), storage: 'record', recordSlot: slot,
      name: newRec.name.trim(), source: newRec.source,
      medicineFilter: newRec.medicineFilter.trim(),
      fields,
    }]);
    setNewRec({ source: 'PregancyCheck', recordSlot: '', name: '', medicineFilter: '' });
    setAddPanel(false); mark();
  };

  const addField = (colId, def) => {
    setColumns(p => p.map(col => col._id !== colId ? col : {
      ...col,
      fields: [...col.fields, { _id: uid(), key: def.key, name: def.name, editable: false, type: def.type }],
    }));
    setAddPanel(false); mark();
  };

  //  Save

  const handleSave = async () => {
    if (locked && sheetId) { setShowDerivative(true); return; }
    await doSave(sheetName, sheetId, false);
  };

  const handleSaveDerivative = async () => {
    if (!derivativeName.trim()) return;
    await doSave(`${initialSheetName}/${derivativeName.trim()}`, null, true);
  };

  const doSave = async (name, id, isDerivative) => {
    setLoading(true);
    try {
      const body = {
        name,
        columns: { animalType, primaryKey: 'CowTag', columns: fromEditorCols(columns) },
        ...(isDerivative && sheetId ? { parentSheetId: sheetId } : {}),
      };
      const res = await fetch(
        id ? `/api/sheets/update-structure/${id}` : '/api/sheets/create',
        { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }
      );
      if (res.ok) {
        setHasChanges(false); setShowDerivative(false); onClose();
      } else {
        alert('Failed to save sheet');
      }
    } catch (e) {
      console.error(e); alert('Error saving sheet');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => { if (hasChanges) setShowDiscard(true); else onClose(); };

  //  Render

  const sRow = { display: 'flex', alignItems: 'center', gap: '8px' };
  const sDeleteBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545', fontSize: '20px', lineHeight: 1, padding: '0 2px', flexShrink: 0 };

  const DragHandle = ({ onMouseDown }) => (
    <span
      className="material-symbols-outlined"
      onMouseDown={onMouseDown}
      style={{ fontSize: '16px', cursor: 'grab', color: '#bbb', flexShrink: 0, userSelect: 'none' }}
    >drag_indicator</span>
  );

  const renderAddFieldPanel = (col) => {
    const fields = availableFieldsFor(col._id);
    return (
      <div style={{ margin: '6px 0 2px 0', backgroundColor: '#f0f4f8', border: '1px solid #cfd8dc', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ ...sRow, padding: '6px 10px', backgroundColor: '#eceff1', borderBottom: '1px solid #cfd8dc' }}>
          <span style={{ flex: 1, fontWeight: 'bold', fontSize: '12px', color: '#546e7a' }}>
            Add field from {SOURCE_META[col.source]?.label || col.source}
          </span>
          <button onClick={() => setAddPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#888' }}>×</button>
        </div>
        <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {fields.length === 0
            ? <div style={{ color: '#888', fontSize: '12px', padding: '8px', textAlign: 'center' }}>All available fields are already added.</div>
            : fields.map(def => (
              <button key={def.key} onClick={() => addField(col._id, def)} style={{ ...sRow, padding: '5px 8px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '3px', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}>
                <span style={{ flex: 1, color: 'black' }}>{def.name}</span>
                <TypeBadge type={def.type} />
              </button>
            ))
          }
        </div>
      </div>
    );
  };

  const renderSnapshotPanel = () => {
    const cols = availableSnapshotInline();
    const snapshots = cols.filter(c => c.storageHint === 'snapshot');
    const inlines = cols.filter(c => c.storageHint === 'inline');

    const renderGroup = (label, items, bg) => items.length === 0 ? null : (
      <div key={label}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#888', padding: '4px 6px 2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        {items.map(def => (
          <button key={def.key} onClick={() => addSnapshotCol(def)} style={{ ...sRow, width: '100%', padding: '5px 8px', backgroundColor: bg, border: '1px solid #e0e0e0', borderRadius: '3px', cursor: 'pointer', marginBottom: '3px', fontSize: '13px', textAlign: 'left', boxSizing: 'border-box' }}>
            <span style={{ flex: 1, color: 'black' }}>{def.name}</span>
            <span style={{ fontSize: '11px', color: '#999' }}>{def.key}</span>
            <TypeBadge type={def.type} />
          </button>
        ))}
      </div>
    );

    const body = () => {
      if (availableCols.length === 0) return (
        <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading columns...</div>
      );
      if (cols.length === 0) return (
        <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '16px' }}>All available columns are already added.</div>
      );
      return <>{renderGroup('Snapshot (CowTable)', snapshots, '#fafafa')}{renderGroup('Inline (stored in record)', inlines, '#fffde7')}</>;
    };

    return (
      <div style={{ border: '1px solid #90caf9', borderRadius: '4px', backgroundColor: 'white', overflow: 'hidden', marginTop: '4px' }}>
        <div style={{ ...sRow, padding: '7px 10px', backgroundColor: '#e3f2fd', borderBottom: '1px solid #90caf9' }}>
          <span style={{ flex: 1, fontWeight: 'bold', fontSize: '13px' }}>Add Snapshot / Inline Column</span>
          <button onClick={() => setAddPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#666' }}>×</button>
        </div>
        <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '8px' }}>
          {body()}
        </div>
      </div>
    );
  };

  const renderRecordPanel = () => {
    const slotPreview = newRec.recordSlot || generateSlotId(newRec.source, columns);
    return (
      <div style={{ border: '1px solid #a5d6a7', borderRadius: '4px', backgroundColor: 'white', overflow: 'hidden', marginTop: '4px' }}>
        <div style={{ ...sRow, padding: '7px 10px', backgroundColor: '#e8f5e9', borderBottom: '1px solid #a5d6a7' }}>
          <span style={{ flex: 1, fontWeight: 'bold', fontSize: '13px' }}>Add Record Slot</span>
          <button onClick={() => setAddPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#666' }}>×</button>
        </div>
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          <div>
            <label style={{ display: 'block', marginBottom: '3px', fontSize: '12px', fontWeight: 'bold' }}>Record Source</label>
            <select
              value={newRec.source}
              onChange={e => setNewRec(p => ({ ...p, source: e.target.value, recordSlot: '', medicineFilter: '', name: '' }))}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', backgroundColor: 'white' }}
            >
              <option value="PregancyCheck">Pregnancy Check</option>
              <option value="WeightRecords">Weight Record</option>
              <option value="MedicalTable">Medical / Vaccination</option>
            </select>
          </div>

          {/* {newRec.source === 'MedicalTable' && (
            <div>
              <label style={{ display: 'block', marginBottom: '3px', fontSize: '12px', fontWeight: 'bold' }}>
                Medicine &nbsp;<span style={{ fontWeight: 'normal', color: '#888' }}>(optional — if nothing selected, medicine is chosen per instance)</span>
              </label>
              <SelectMedicine
                value={newRec.medicineFilter}
                onChange={(id, _med, displayName) => {
                  const autoName = getMedicineDisplayName(displayName || id, id, columns);
                  setNewRec(p => ({ ...p, medicineFilter: id, name: autoName }));
                }}
              />
            </div>
          )} */}

          <div>
            <label style={{ display: 'block', marginBottom: '3px', fontSize: '12px', fontWeight: 'bold' }}>Display Name</label>
            <input
              type="text"
              value={newRec.name}
              onChange={e => !newRec.medicineFilter && setNewRec(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Preg Check, Last Weight, Vista 5 Vaccination"
              disabled={!!newRec.medicineFilter}
              style={{
                width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px',
                fontSize: '13px', boxSizing: 'border-box',
                backgroundColor: newRec.medicineFilter ? '#f5f5f5' : 'white',
                color: newRec.medicineFilter ? '#aaa' : 'inherit',
                cursor: newRec.medicineFilter ? 'not-allowed' : 'text',
              }}
            />
          </div>

          <div style={{ fontSize: '11px', color: '#999', backgroundColor: '#f5f5f5', padding: '5px 8px', borderRadius: '3px' }}>
            Slot ID (auto): <code style={{ fontFamily: 'monospace', color: '#555' }}>{slotPreview}</code>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setAddPanel(false)} className="button"
              style={{ padding: '6px 16px', backgroundColor: '#6c757d', color: 'white', fontSize: '13px' }}>
              Cancel
            </button>
            <button
              onClick={commitAddRecord}
              disabled={!newRec.name.trim()}
              className="button"
              style={{ padding: '6px 16px', fontSize: '13px', backgroundColor: !newRec.name.trim() ? '#aaa' : '#28a745', color: 'white', cursor: !newRec.name.trim() ? 'not-allowed' : 'pointer' }}
            >
              Add Slot
            </button>
          </div>

        </div>
      </div>
    );
  };

  const renderTypePicker = () => (
    <div style={{ border: '1px solid #007bff', borderRadius: '4px', backgroundColor: 'white', overflow: 'hidden', marginTop: '4px' }}>
      <div style={{ ...sRow, padding: '7px 10px', backgroundColor: '#e8f0fe', borderBottom: '1px solid #b0c4f8' }}>
        <span style={{ flex: 1, fontWeight: 'bold', fontSize: '13px' }}>What kind of column?</span>
        <button onClick={() => setAddPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#666' }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: '10px', padding: '12px' }}>
        <button onClick={() => openAddPanel('snapshot')} style={{ flex: 1, padding: '12px', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#e3f2fd', fontSize: '13px', textAlign: 'left' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'black' }}>Snapshot / Inline</div>
          <div style={{ color: '#555', fontSize: '12px' }}>Flat values from CowTable or free-text fields stored per record (e.g. Dam, Sex, Notes)</div>
        </button>
        <button
          onClick={() => openAddPanel('record', () => setNewRec({ source: 'PregancyCheck', recordSlot: '', name: '', medicineFilter: '' }))}
          style={{ flex: 1, padding: '12px', border: '1px solid #a5d6a7', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#e8f5e9', fontSize: '13px', textAlign: 'left' }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'black' }}>Record Slot</div>
          <div style={{ color: '#555', fontSize: '12px' }}>Links to an external record (Preg Check, Weight, Medical) with its own fields</div>
        </button>
      </div>
    </div>
  );

  //  Main render

  return (
    <>
      <Popup
        isOpen={isOpen}
        onClose={handleCancel}
        title={sheetId ? (locked ? `Locked: ${initialSheetName}` : `Edit: ${initialSheetName}`) : 'Create New Sheet Template'}
        maxWidth="820px"
        contentStyle={{ overflow: 'hidden', paddingBottom: '140px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>Template Name</label>
              <input type="text" value={sheetName}
                onChange={e => { setSheetName(e.target.value); mark(); }}
                disabled={!!sheetId}
                style={{ width: '100%', padding: '7px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: sheetId ? '#f5f5f5' : 'white' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>Animal Type</label>
              <select
                value={animalType}
                onChange={e => { setAnimalType(e.target.value); mark(); }}
                disabled={!!sheetId}
                style={{ width: '90%', padding: '7px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '14px', backgroundColor: sheetId ? '#f5f5f5' : 'white' }}
              >
                <option value="cattle">Cattle</option>
                <option value="goat">Goat</option>
              </select>
            </div>
          </div>

          {locked && (
            <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '3px', padding: '8px 12px', fontSize: '13px', color: '#856404' }}>
              This is a locked template. Saving will create a new derivative sheet.
            </div>
          )}

          <div style={{ border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f7f8fa', display: 'flex', flexDirection: 'column', maxHeight: '68vh' }}>

            <div ref={scrollRef} style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px', overflowY: 'auto', flex: 1 }}>

              {columns.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#aaa', padding: '24px', fontSize: '14px' }}>
                      {loadingSheet ? 'Loading template columns, please wait...' : 'No columns yet. Use the button below to add one.'}
                  </div>
              )}

              {columns.map((col, idx) => {
                const sm = col.source ? SOURCE_META[col.source] : null;

                //  Record slot
                if (col.storage === 'record') {
                  const topDisp = getTopDisp(col._id, idx);
                  const isDragging = dragVisual?.type === 'top' && dragVisual.itemId === col._id;
                  return (
                    <div key={col._id}
                      ref={el => { topRowRefs.current[col._id] = el; }}
                      style={{
                        border: `1px solid ${sm?.border || '#ccc'}`, borderRadius: '4px', backgroundColor: 'white',
                        transform: `translateY(${topDisp}px)`,
                        transition: isDropping.current ? 'none' : 'transform 0.15s ease',
                        opacity: isDragging ? 0 : 1,
                        position: 'relative', zIndex: isDragging ? 0 : 1,
                      }}
                    >
                      {/* Slot header */}
                      <div style={{ ...sRow, padding: '7px 10px', backgroundColor: sm?.bg || '#f5f5f5', borderBottom: `1px solid ${sm?.border || '#eee'}` }}>
                        <DragHandle onMouseDown={e => startDrag(e, 'top', col._id, idx)} />
                        <span style={{ flex: 1, fontWeight: 'bold', fontSize: '14px' }}>{col.name}</span>
                        {windowWidth >= 405 && (
                          <span style={{ fontSize: '11px', color: '#666', backgroundColor: 'white', padding: '1px 6px', borderRadius: '3px', border: '1px solid #ddd' }}>
                            {sm?.label || col.source}
                          </span>
                        )}
                        <button onClick={() => deleteTopCol(col._id)} style={sDeleteBtn}>×</button>
                      </div>

                      {/* Sub-fields */}
                      <div style={{ padding: '6px 10px 8px 30px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {col.fields.map((field, fi) => {
                          const fieldDisp = getFieldDisp(col._id, field._id, fi);
                          const fieldDragging = dragVisual?.type === 'field' && dragVisual.colId === col._id && dragVisual.itemId === field._id;
                          const isRequired = requiredFieldKeys[col.source] === field.key;
                          return (
                            <div key={field._id}
                              ref={el => { fieldRowRefs.current[`${col._id}::${field._id}`] = el; }}
                              style={{
                                ...sRow, padding: '4px 8px',
                                backgroundColor: '#f9f9f9',
                                border: '1px solid #eee',
                                borderRadius: '3px',
                                transform: `translateY(${fieldDisp}px)`,
                                transition: isDropping.current ? 'none' : 'transform 0.15s ease',
                                opacity: fieldDragging ? 0 : 1,
                                position: 'relative', zIndex: fieldDragging ? 0 : 1,
                              }}
                            >
                              <DragHandle onMouseDown={e => startDrag(e, 'field', field._id, fi, col._id)} />
                              <span style={{ flex: 1, fontSize: '13px' }}>{field.name}</span>
                              <TypeBadge type={field.type} />
                              <EditableToggle value={field.editable} onChange={() => toggleFieldEditable(col._id, field._id)} />
                              {isRequired
                                ? <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'black', flexShrink: 0 }}>lock</span>
                                : <button onClick={() => deleteField(col._id, field._id)} style={{ ...sDeleteBtn, fontSize: '20px' }}>×</button>
                              }
                            </div>
                          );
                        })}

                        {addPanel === col._id
                          ? renderAddFieldPanel(col)
                          : (
                            <button onClick={() => openAddPanel(col._id)}
                              style={{ marginTop: '3px', padding: '4px 10px', backgroundColor: 'transparent', border: '1px dashed #bbb', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', color: '#777', textAlign: 'left', alignSelf: 'flex-start' }}>
                              + Add Field
                            </button>
                          )
                        }
                      </div>
                    </div>
                  );
                }

                //  Snapshot / inline
                const topDisp = getTopDisp(col._id, idx);
                const isDragging = dragVisual?.type === 'top' && dragVisual.itemId === col._id;
                return (
                  <div key={col._id}
                    ref={el => { topRowRefs.current[col._id] = el; }}
                    style={{
                      ...sRow, padding: '7px 10px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '3px',
                      transform: `translateY(${topDisp}px)`,
                      transition: isDropping.current ? 'none' : 'transform 0.15s ease',
                      opacity: isDragging ? 0 : 1,
                      position: 'relative', zIndex: isDragging ? 0 : 1,
                    }}
                  >
                    <DragHandle onMouseDown={e => startDrag(e, 'top', col._id, idx)} />
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: col.key === 'CowTag' ? 'bold' : 'normal' }}>{col.name}</span>
                    {windowWidth >= 450 && (
                      <span style={{ fontSize: '11px', color: '#999', backgroundColor: '#f5f5f5', padding: '1px 5px', borderRadius: '3px', border: '1px solid #eee', minWidth: '56px', textAlign: 'center', boxSizing: 'border-box', display: 'inline-block' }}>
                        {col.storage}
                      </span>
                    )}
                    <TypeBadge type={col.type} />
                    <EditableToggle value={col.editable} onChange={() => toggleTopEditable(col._id)} />
                    {col.locked
                      ? <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'black', flexShrink: 0 }}>lock</span>
                      : <button onClick={() => deleteTopCol(col._id)} style={sDeleteBtn}>×</button>
                    }
                  </div>
                );
              })}

            </div>

            <div style={{ padding: '8px 10px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f7f8fa', flexShrink: 0 }}>
              {addPanel === 'pick' && renderTypePicker()}
              {addPanel === 'snapshot' && renderSnapshotPanel()}
              {addPanel === 'record' && renderRecordPanel()}
              {(addPanel === false || (typeof addPanel === 'string' && !['pick', 'snapshot', 'record'].includes(addPanel))) && (
                <button onClick={() => openAddPanel('pick')}
                  style={{ width: '100%', padding: '8px', border: '2px dashed #007bff', borderRadius: '3px', backgroundColor: 'transparent', color: '#007bff', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  + Add Column
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={handleCancel} disabled={loading} className="button"
              style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={loading || !sheetName.trim()} className="button"
              style={{ padding: '10px 20px', opacity: (loading || !sheetName.trim()) ? 0.6 : 1, cursor: (loading || !sheetName.trim()) ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Saving...' : (locked ? 'Save as Derivative' : 'Save')}
            </button>
          </div>

        </div>
      </Popup>

      {/* Save as Derivative popup */}
      <Popup isOpen={showDerivative} onClose={() => setShowDerivative(false)} title="Save as Derivative Sheet" width="500px">
        <div style={{ padding: '20px' }}>
          <p style={{ marginBottom: '16px', fontSize: '14px', lineHeight: '1.5' }}>
            This is a locked template. Your changes will be saved as a new derivative sheet that you can modify freely.
          </p>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>Derivative Name</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#888', whiteSpace: 'nowrap', fontSize: '14px' }}>{initialSheetName} /</span>
              <input type="text" value={derivativeName} onChange={e => setDerivativeName(e.target.value)}
                placeholder="Enter name for your version"
                style={{ flex: 1, padding: '7px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '14px' }}
                onKeyPress={e => { if (e.key === 'Enter') handleSaveDerivative(); }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowDerivative(false)} className="button"
              style={{ padding: '8px 18px', backgroundColor: '#6c757d', color: 'white' }}>Cancel</button>
            <button onClick={handleSaveDerivative} disabled={loading || !derivativeName.trim()} className="button"
              style={{ padding: '8px 18px', opacity: (loading || !derivativeName.trim()) ? 0.6 : 1 }}>
              {loading ? 'Creating...' : 'Create Derivative'}
            </button>
          </div>
        </div>
      </Popup>

      {/* Discard confirm */}
      <ConfirmPopup
        isOpen={showDiscard}
        onClose={() => setShowDiscard(false)}
        onConfirm={() => { setShowDiscard(false); setHasChanges(false); onClose(); }}
        title="Discard Changes"
        message="You have unsaved changes. Are you sure you want to discard them?"
        requireDelay={false}
        confirmText="Discard Changes"
        cancelText="Keep Editing"
      />

      {/* Drag ghost */}
      {dragVisual && createPortal(
        <div style={{
          position: 'fixed',
          top: dragVisual.ghostY,
          left: dragVisual.ghostX,
          width: dragVisual.ghostWidth,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.92,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          borderRadius: '4px',
          backgroundColor: dragVisual.isRecord ? (SOURCE_META[dragVisual.source]?.bg || '#f5f5f5') : 'white',
          border: `1px solid ${dragVisual.isRecord ? (SOURCE_META[dragVisual.source]?.border || '#ccc') : '#ddd'}`,
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '14px',
          fontWeight: dragVisual.isRecord ? 'bold' : 'normal',
          userSelect: 'none',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#bbb', flexShrink: 0 }}>drag_indicator</span>
          <span style={{ flex: 1 }}>{dragVisual.label}</span>
          {dragVisual.source && (
            <span style={{ fontSize: '11px', color: '#666', backgroundColor: 'white', padding: '1px 6px', borderRadius: '3px', border: '1px solid #ddd' }}>
              {SOURCE_META[dragVisual.source]?.label || dragVisual.source}
            </span>
          )}
          {dragVisual.typeBadge && <TypeBadge type={dragVisual.typeBadge} />}
        </div>,
        document.body
      )}
    </>
  );
}

export default SheetTemplateEditor;