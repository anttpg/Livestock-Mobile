import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toLocalDisplay, toAge, toLocalMonthYear } from '../utils/dateUtils';

import ColorTable from './colorTable';
import AnimalPhotoViewer from './animalPhotoViewer';
import Popup from './popup';
import AutoCombobox from './autoCombobox';
import AnimalForm from './animalForm';


// ---------------------------------------------------------------------------
// ParentLink
// Renders the dam/sire label in the family tree header.
//   - tag falsy          → plain "Unknown"
//   - tag valid (in DB)  → blue underline button (navigate)
//   - tag set but broken → red underline + info icon (open repair popup)
// ---------------------------------------------------------------------------
function ParentLink({ label, tag, tagExists, onNavigate, onFix }) {
  const [hovered, setHovered] = useState(false);

  if (!tag) {
    return (
      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#666' }}>
        {label}: Unknown
      </span>
    );
  }

  if (tagExists) {
    return (
      <button
        onClick={() => onNavigate(tag)}
        style={{
          background: 'none',
          border: 'none',
          color: '#007bff',
          textDecoration: 'underline',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '10px',
          padding: 0
        }}
      >
        {label}: {tag}
      </button>
    );
  }

  // Tag is set but doesn't exist in the DB
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
      <button
        onClick={() => onFix(tag)}
        style={{
          background: 'none',
          border: 'none',
          color: '#c0392b',
          textDecoration: 'underline',
          textDecorationColor: '#c0392b',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          padding: 0
        }}
      >
        {label}: {tag}
      </button>
      <span
        className="material-symbols-outlined"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          fontSize: '18px',
          color: '#c0392b',
          cursor: 'default',
          position: 'relative',
          userSelect: 'none'
        }}
      >
        info
        {hovered && (
          <span style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#333',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 999,
            pointerEvents: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            fontFamily: 'sans-serif'
          }}>
            Tag "{tag}" not found in database. Click to fix.
          </span>
        )}
      </span>
    </div>
  );
}


// ---------------------------------------------------------------------------
// FixParentPopup
// Lets the user reassign a broken dam/sire tag.
// Footer has "+ Don't see the animal? Create one!" which opens AnimalForm.
// ---------------------------------------------------------------------------
function FixParentPopup({ isOpen, onClose, brokenTag, field, cowTag, cowOptions, onFixed }) {
  const [selectedTag, setSelectedTag] = useState(brokenTag || '');
  const [submitting, setSubmitting] = useState(false);
  const [showAddAnimal, setShowAddAnimal] = useState(false);
  const [addAnimalTag, setAddAnimalTag] = useState('');

  // Reset selection whenever the popup opens for a new broken tag
  useEffect(() => {
    if (isOpen) {
      setSelectedTag(brokenTag || '');
      setShowAddAnimal(false);
    }
  }, [isOpen, brokenTag]);

  const DB_FIELD_MAP = { dam: 'Dam', sire: 'Sire' };

  const handleSubmit = async () => {
    if (!selectedTag) return;
    setSubmitting(true);
    try {
      const dbField = DB_FIELD_MAP[field] || field;
      const body = { [dbField]: selectedTag };
      const response = await fetch(`/api/cow/${encodeURIComponent(cowTag)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (response.ok) {
        if (onFixed) onFixed(selectedTag);
        onClose();
      } else {
        const err = await response.json().catch(() => ({}));
        alert(`Failed to update: ${err.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert('Error updating animal');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNew = () => {
    setAddAnimalTag(selectedTag || brokenTag || '');
    setShowAddAnimal(true);
  };

  const handleAddAnimalSuccess = () => {
    setShowAddAnimal(false);
    // After creating, close the fix popup and trigger a refresh so the new
    // tag shows up in the family tree immediately.
    if (onFixed) onFixed();
    onClose();
  };

  const fieldLabel = field === 'dam' ? 'Dam (Mother)' : 'Sire (Father)';

  return (
    <>
      <Popup
        isOpen={isOpen && !showAddAnimal}
        onClose={onClose}
        title={`Fix ${fieldLabel}`}
        width="420px"
        contentStyle={{paddingBottom: '5rem'}}
      >
        <div style={{ padding: '4px 0 0 0' }}>
          {/* Context */}
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '5px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '13px',
            color: '#856404'
          }}>
            Tag <strong>"{brokenTag}"</strong> is recorded as the {fieldLabel} of <strong>{cowTag}</strong>,
            but cannot be found in the database. Select the correct animal below.
          </div>

          {/* Combobox */}
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
            Correct {fieldLabel} tag
          </label>
          <AutoCombobox
            options={cowOptions}
            value={selectedTag}
            onChange={setSelectedTag}
            onSelect={setSelectedTag}
            clearOnOpen={false}
            placeholder="Search by tag..."
            allowCustomValue={true}
            style={{ fontSize: '14px' }}
            searchPlaceholder="Search all animals..."
            emptyMessage="No animals found"
          />

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!selectedTag || submitting}
            className="button"
            style={{
              marginTop: '18px',
              width: '100%',
              padding: '10px',
              fontSize: '15px',
              opacity: (!selectedTag || submitting) ? 0.5 : 1,
              cursor: (!selectedTag || submitting) ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>

          {/* Divider */}
          <div style={{
            borderTop: '1px solid #eee',
            marginTop: '18px',
            paddingTop: '14px',
            textAlign: 'center'
          }}>
            <button
              onClick={handleCreateNew}
              style={{
                background: 'none',
                border: 'none',
                color: '#007bff',
                cursor: 'pointer',
                fontSize: '13px',
                textDecoration: 'underline',
                padding: 0
              }}
            >
              + Don't see the animal? Create one!
            </button>
          </div>
        </div>
      </Popup>

      {/* AnimalForm popup — rendered on top of FixParentPopup */}
      {showAddAnimal && (
        <Popup
          isOpen={showAddAnimal}
          onClose={() => setShowAddAnimal(false)}
          title="Add New Animal"
          width="900px"
        >
          <AnimalForm
            // Lock in the tag that was in the broken field so the user can
            // immediately create the missing animal with the correct tag.
            // AnimalForm accepts cowTag as a locked prop only via motherTag/fatherTag
            // patterns; since there's no direct "lockedTag" prop we pass the
            // tag through via a wrapper that pre-fills and disables cowTag.
            // We achieve this by passing a custom initialTag prop handled below.
            initialTag={addAnimalTag}
            onClose={() => setShowAddAnimal(false)}
            onSuccess={handleAddAnimalSuccess}
          />
        </Popup>
      )}
    </>
  );
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function BreedingFitness({ 
  cowTag, 
  cowData, 
  loading = false
}) {
  const [epdData, setEpdData] = useState(null);
  const [loadingEpds, setLoadingEpds] = useState(false);
  const [, setSearchParams] = useSearchParams();
  const [showEpdInfoPopup, setShowEpdInfoPopup] = useState(false);
  const [svgDimensions, setSvgDimensions] = useState({ width: 400, height: 60 });
  const [linePositions, setLinePositions] = useState({
    leftX: 75,
    rightX: 325,
    centerX: 200
  });

  // All known cow tags — used to detect broken parent links
  const [allCowTags, setAllCowTags] = useState(null); // null = loading, [] = loaded
  const [cowOptions, setCowOptions] = useState([]);
  const [damTagOverride,  setDamTagOverride]  = useState(null);
  const [sireTagOverride, setSireTagOverride] = useState(null);


  // Fix-parent popup state
  const [fixPopup, setFixPopup] = useState({ open: false, field: null, brokenTag: null });

  // ---------------------------------------------------------------------------
  // Fetch all cow tags once on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchCows = async () => {
      try {
        const response = await fetch('/api/animals', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          const cows = data.cows || [];
          setAllCowTags(cows.map(c => c.CowTag));
          setCowOptions(cows.map(c => ({ name: c.CowTag, value: c.CowTag })));
        } else {
          setAllCowTags([]);
        }
      } catch {
        setAllCowTags([]);
      }
    };
    fetchCows();
  }, []);

  // ---------------------------------------------------------------------------
  // SVG layout
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const calculateSvgLayout = () => {
      const rootStyles = getComputedStyle(document.documentElement);
      const treeGap = parseInt(rootStyles.getPropertyValue('--tree-gap').trim());
      const imageSize = parseInt(rootStyles.getPropertyValue('--image-size').trim()) || 150;
      
      const leftImageCenter = imageSize / 2;
      const rightImageCenter = imageSize + treeGap + (imageSize / 2);
      const centerPoint = imageSize + (treeGap / 2);
      const totalWidth = (2 * imageSize) + treeGap;
      
      setSvgDimensions({ width: totalWidth, height: 60 });
      setLinePositions({ leftX: leftImageCenter, rightX: rightImageCenter, centerX: centerPoint });
    };

    calculateSvgLayout();
    window.addEventListener('resize', calculateSvgLayout);
    return () => window.removeEventListener('resize', calculateSvgLayout);
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch EPD data
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (cowTag) fetchEpdData();
  }, [cowTag]);

  const fetchEpdData = async () => {
    if (!cowTag) return;
    setLoadingEpds(true);
    try {
      const response = await fetch(`/api/cow/${encodeURIComponent(cowTag)}/epds`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setEpdData(data);
      } else {
        setEpdData(null);
      }
    } catch {
      setEpdData(null);
    } finally {
      setLoadingEpds(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const handleAnimalNavigation = (targetCowTag) => {
    if (!targetCowTag) return;
    setSearchParams({ tab: 'general', search: targetCowTag });
  };

  const parseDelimitedData = (dataString) => {
    if (!dataString) return {};
    const result = {};
    dataString.split('|').forEach(pair => {
      const [key, value] = pair.split(':');
      if (key && value) result[key] = value === 'N/A' ? null : parseFloat(value);
    });
    return result;
  };



  // ---------------------------------------------------------------------------
  // EPD table
  // ---------------------------------------------------------------------------
  const prepareEpdData = () => {
    const epd = epdData?.epds?.[0] || {};
    const accuracy = epd.Accuracy ? parseDelimitedData(epd.Accuracy) : {};
    const range = epd.Range ? parseDelimitedData(epd.Range) : {};

    const traitKeyMap = {
      'Calving Ease Direct': 'CalvingEaseDirect',
      'Birth Weight': 'BirthWeight', 
      'Weaning Weight': 'WeaningWeight',
      'Yearling Weight': 'YearlingWeight',
      'Milk': 'Milk',
      'Carcass Weight': 'CarcassWeight',
      'Marbling': 'Marbling'
    };

    const getAccuracy = (traitName) => {
      const key = traitKeyMap[traitName];
      return key && accuracy[key] !== null ? accuracy[key] : 'N/A';
    };
    const getRange = (traitName) => {
      const key = traitKeyMap[traitName];
      return key && range[key] !== null ? `±${range[key]}` : 'N/A';
    };

    return [
      { trait: 'Calving Ease Direct',     value: epd.CalvingEaseDirect || 'N/A',     accuracy: getAccuracy('Calving Ease Direct'),  range: getRange('Calving Ease Direct') },
      { trait: 'Birth Weight',            value: epd.BirthWeight || 'N/A',            accuracy: getAccuracy('Birth Weight'),         range: getRange('Birth Weight') },
      { trait: 'Weaning Weight',          value: epd.WeaningWeight || 'N/A',          accuracy: getAccuracy('Weaning Weight'),       range: getRange('Weaning Weight') },
      { trait: 'Yearling Weight',         value: epd.YearlingWeight || 'N/A',         accuracy: getAccuracy('Yearling Weight'),      range: getRange('Yearling Weight') },
      { trait: 'Dry Matter Intake',       value: epd.DryMatterIntake || 'N/A',        accuracy: 'N/A', range: 'N/A' },
      { trait: 'Scrotal Circumference',   value: epd.ScrotalCircumference || 'N/A',   accuracy: 'N/A', range: 'N/A' },
      { trait: 'Sustained Cow Fertility', value: epd.SustainedCowFertility || 'N/A',  accuracy: 'N/A', range: 'N/A' },
      { trait: 'Milk',                    value: epd.Milk || 'N/A',                   accuracy: getAccuracy('Milk'),                 range: getRange('Milk') },
      { trait: 'Milk & Growth',           value: epd['Milk&Growth'] || 'N/A',         accuracy: 'N/A', range: 'N/A' },
      { trait: 'Calving Ease Maternal',   value: epd.CalvingEaseMaternal || 'N/A',    accuracy: 'N/A', range: 'N/A' },
      { trait: 'Mature Weight',           value: epd.MatureWeight || 'N/A',           accuracy: 'N/A', range: 'N/A' },
      { trait: 'Udder Suspension',        value: epd.UdderSuspension || 'N/A',        accuracy: 'N/A', range: 'N/A' },
      { trait: 'Teat Size',               value: epd.TeatSize || 'N/A',               accuracy: 'N/A', range: 'N/A' },
      { trait: 'Carcass Weight',          value: epd.CarcassWeight || 'N/A',          accuracy: getAccuracy('Carcass Weight'),       range: getRange('Carcass Weight') },
      { trait: 'Fat',                     value: epd.Fat || 'N/A',                    accuracy: 'N/A', range: 'N/A' },
      { trait: 'Ribeye Area',             value: epd.RibeyeArea || 'N/A',             accuracy: 'N/A', range: 'N/A' },
      { trait: 'Marbling',                value: epd.Marbling || 'N/A',               accuracy: getAccuracy('Marbling'),             range: getRange('Marbling') },
      { trait: 'Beef Merit Index',        value: epd.BeefMeritIndex || 'N/A',         accuracy: 'N/A', range: 'N/A' },
      { trait: 'Brahman Influence Index', value: epd.BrahmanInfluenceIndex || 'N/A',  accuracy: 'N/A', range: 'N/A' },
      { trait: 'Certified Hereford Beef', value: epd.CertifiedHerefordBeef || 'N/A',  accuracy: 'N/A', range: 'N/A' },
    ];
  };

  const epdColumns = [
    { key: 'trait',    header: 'Trait',                                               width: '50%' },
    { key: 'value',    header: 'Value',                                               width: '15%', align: 'center' },
    { key: 'accuracy', header: window.innerWidth < 550 ? 'Acc.' : 'Accuracy',        width: '15%', align: 'center' },
    { key: 'range',    header: 'Range',                                               width: '20%', align: 'center' }
  ];

  const calvesColumns = [
    {
      key: 'CalfTag', header: 'Tag', width: '15%',
      customRender: (value) => (
        <button onClick={() => handleAnimalNavigation(value)} style={{
          background: 'none', border: 'none', color: '#007bff',
          textDecoration: 'underline', cursor: 'pointer',
          fontSize: 'var(--table-text-size, 14px)', padding: '0', margin: '0'
        }}>
          {value}
        </button>
      )
    },
    { key: 'DOB',           header: 'DOB',   width: '16%', customRender: (v) => toLocalMonthYear(v) || 'N/A' },
    { key: 'Sex',           header: 'Sex',   width: '8%',  customRender: (v) => v === 'Male' ? 'M' : v === 'Female' ? 'F' : v },
    {
      key: 'SireTag', header: 'Sire', width: '15%',
      customRender: (value) => value ? (
        <button onClick={() => handleAnimalNavigation(value)} style={{
          background: 'none', border: 'none', color: '#007bff',
          textDecoration: 'underline', cursor: 'pointer',
          fontSize: 'var(--table-text-size, 14px)', padding: '0', margin: '0'
        }}>
          {value}
        </button>
      ) : 'N/A'
    },
    { key: 'Breed',         header: 'Breed', width: '18%' },
    { key: 'Birthweight',   header: 'BW',    width: '8%' },
    { key: 'WeaningWeight', header: 'WW',    width: '8%' },
    { key: 'IsAI',          header: 'AI?',   width: '10%', customRender: (v) => v ? 'Yes' : 'No' }
  ];

  // ---------------------------------------------------------------------------
  // Derive cow, dam, sire
  // ---------------------------------------------------------------------------
  const cow = cowData?.cowData;
  const calvesData = cowData?.calves || [];

  const damTag  = cow?.Dam  || null;
  const sireTag = cow?.Sire || null;

  // Once allCowTags is loaded, check existence. While loading treat as valid
  // so we don't flash the broken-tag style unnecessarily.
  const tagsLoaded  = allCowTags !== null;
  const damExists   = !tagsLoaded || !damTag  || allCowTags.includes(damTag);
  const sireExists  = !tagsLoaded || !sireTag || allCowTags.includes(sireTag);

  const openFixPopup = (field, brokenTag) => {
    setFixPopup({ open: true, field, brokenTag });
  };

  // After a successful fix, trigger a page-level refresh by reloading search params
  const handleFixed = (correctedTag) => {
    if (fixPopup.field === 'dam')  setDamTagOverride(correctedTag);
    if (fixPopup.field === 'sire') setSireTagOverride(correctedTag);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('search', cowTag);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '200px', fontSize: '18px', color: '#666'
      }}>
        Loading breeding fitness data...
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="multibubble-page">

      {/* Fix-parent popup */}
      <FixParentPopup
        isOpen={fixPopup.open}
        onClose={() => setFixPopup({ open: false, field: null, brokenTag: null })}
        brokenTag={fixPopup.brokenTag}
        field={fixPopup.field}
        cowTag={cowTag}
        cowOptions={cowOptions}
        onFixed={handleFixed}
      />

      {/* Section 1: Family Tree Photos */}
      <div className="bubble-container">
        <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>Family Tree</h3>
        
        {/* Parents Row */}
        <div style={{ 
          display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
          gap: 'var(--tree-gap)', marginBottom: '30px'
        }}>
          {/* Dam */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ParentLink
              label="Dam"
              tag={damTagOverride ?? damTag}
              tagExists={damTagOverride ? true : damExists}
              onNavigate={handleAnimalNavigation}
              onFix={(tag) => openFixPopup('dam', tag)}
            />
            <div style={{ width: 'var(--image-size)', height: 'var(--image-size)' }}>
              <AnimalPhotoViewer
                cowTag={damTag}
                imageType="body"
                style={{
                  width: '100%', height: '100%', borderRadius: '5px',
                  border: damTag ? 'none' : '2px dashed #ccc'
                }}
              />
            </div>
          </div>

          {/* Sire */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ParentLink
              label="Sire"
              tag={sireTagOverride ?? sireTag}
              tagExists={sireTagOverride ? true : sireExists}
              onNavigate={handleAnimalNavigation}
              onFix={(tag) => openFixPopup('sire', tag)}
            />
            <div style={{ width: 'var(--image-size)', height: 'var(--image-size)' }}>
              <AnimalPhotoViewer
                cowTag={sireTag}
                imageType="body"
                alternateDefaultPhoto={!sireTag}
                style={{
                  width: '100%', height: '100%', borderRadius: '5px',
                  border: sireTag ? 'none' : '2px dashed #ccc'
                }}
              />
            </div>
          </div>
        </div>

        {/* Connection Lines */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <svg width={svgDimensions.width} height={svgDimensions.height} style={{ overflow: 'visible' }}>
            <line x1={linePositions.leftX}  y1="0"  x2={linePositions.leftX}  y2="20" stroke="#666" strokeWidth="2" />
            <line x1={linePositions.rightX} y1="0"  x2={linePositions.rightX} y2="20" stroke="#666" strokeWidth="2" />
            <line x1={linePositions.leftX}  y1="20" x2={linePositions.rightX} y2="20" stroke="#666" strokeWidth="2" />
            <line x1={linePositions.centerX} y1="20" x2={linePositions.centerX} y2="50" stroke="#666" strokeWidth="2" />
          </svg>
        </div>

        {/* Current Animal */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--multibubble-gap)' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Current Animal: {cowTag}</h4>
          <div style={{ width: 'calc(var(--image-size) * 1.33)', height: 'calc(var(--image-size) * 1.33)' }}>
            <AnimalPhotoViewer
              cowTag={cowTag}
              imageType="body"
              style={{ width: '100%', height: '100%', borderRadius: '5px', border: '3px solid #007bff' }}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Basic Info and EPDs */}
      <div className="bubble-container">
        {/* Basic Info */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Basic Information</h3>
            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <div><strong>DOB:</strong> {cow?.DateOfBirth ? toLocalDisplay(cow.DateOfBirth) : 'N/A'}</div>
              <div><strong>Age:</strong> {toAge(cow?.DateOfBirth) || 'Unknown'}</div>
              <div><strong>Status:</strong> {cow?.Status || 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* EPDs Table */}
        <div style={{ display: 'flex' }}>
          <div style={{ flex: '3' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', gap: '8px' }}>
              <h3 style={{ margin: '0' }}>Expected Progeny Differences (EPDs)</h3>
              <button
                onClick={() => setShowEpdInfoPopup(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#666',
                  padding: '2px', borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#333'}
                onMouseLeave={(e) => e.target.style.color = '#666'}
                title="Learn about EPD calculations"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>info</span>
              </button>
            </div>
            
            {loadingEpds ? (
              <div style={{ textAlign: 'center', padding: '20px', fontStyle: 'italic', color: '#666' }}>
                Loading EPD data...
              </div>
            ) : (
              <ColorTable
                data={prepareEpdData()}
                columns={epdColumns}
                showActionColumn={false}
                alternatingRows={true}
                evenRowColor="#fff"
                oddRowColor="#f0f7e4ff"
                emptyMessage="EPD data will display here when available"
                maxWidth="100%"
              />
            )}
          </div>
        </div>

        {/* EPD Info Popup */}
        <Popup
          isOpen={showEpdInfoPopup}
          onClose={() => setShowEpdInfoPopup(false)}
          title="EPD Calculation Methodology"
          width="750px"
        >
          <div style={{ lineHeight: '1.6', color: '#333' }}>
            <h4 style={{ marginTop: '0', color: '#2c5aa0' }}>How This Database Calculates EPDs</h4>

            <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '5px', borderLeft: '4px solid #2c5aa0', marginBottom: '20px' }}>
              <h5 style={{ color: '#2c5aa0', margin: '0 0 8px 0' }}>Key Points</h5>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                <li>Accuracy values are estimated and not official breed association data.</li>
                <li>Offspring data improves estimated accuracy.</li>
                <li>N/A values indicate the most recent EPD record does not contain data for this field</li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#555', marginBottom: '8px' }}>Data Sources</h3>
              <p style={{ margin: '0 0 10px 0' }}>We display the most recent EPD record, drawing from two tables</p>
              <ul style={{ margin: '0 0 15px 20px', paddingLeft: '0' }}>
                <li><strong>EPD Records:</strong> Stores real EPD records</li>
                <li><strong>Calving Records:</strong> CalfTag linked to breeding records to count actual offspring produced</li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#555', marginBottom: '8px' }}>Accuracy</h3>
              <p style={{ margin: '5px 0 10px 0' }}>
                According to the <a href="https://americanbrahman.org/genetics/performance-data/" target="_blank" rel="noopener noreferrer" style={{ color: '#2c5aa0', textDecoration: 'underline' }}>American Brahman Association</a>, accuracy is ranked as...
              </p>
              <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
                <ul style={{ margin: '0', paddingLeft: '20px' }}>
                  <li><strong>LOW:</strong> 0.0 to 0.50</li>
                  <li><strong>MEDIUM:</strong> 0.50 to 0.75</li>
                  <li><strong>HIGH:</strong> 0.75 and above</li>
                </ul>
              </div>
              <p>Higher accuracy values indicate more reliable EPD predictions</p>
              <p style={{ margin: '20px 0 10px 0' }}>
                If an official EPD record is not provided, we will estimate the accuracy of
                Birth Weight, Weaning Weight, Yearling Weight, Calving Ease Direct, Milk, Marbling, and Carcass Weight.
              </p>
              <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', margin: '10px 0' }}>
                <p style={{ margin: '0 0 10px 0' }}><strong>Base Accuracy (no progeny):</strong></p>
                <ul style={{ margin: '0 0 15px 20px', paddingLeft: '0' }}>
                  <li>1 EPD record: 0.35</li>
                  <li>2 EPD records: 0.55</li>
                  <li>3+ EPD records: 0.70</li>
                </ul>
                <p style={{ margin: '0 0 10px 0' }}><strong>With Progeny Data:</strong></p>
                <div style={{ fontFamily: 'monospace', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '3px', fontSize: '14px' }}>
                  Accuracy = min(0.95, 0.35 + (records × 0.1) + (progeny × 0.05))
                </div>
              </div>
              <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', borderLeft: '4px solid #ffc107' }}>
                <h5 style={{ color: '#856404', margin: '0 0 8px 0' }}>Note</h5>
                <p style={{ margin: '0', fontSize: '14px' }}>
                  As of 9/11/2025, we only use simplified accuracy estimates.
                  The database does not store breed association calculations.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#555', marginBottom: '8px' }}>Range Calculations</h3>
              <p style={{ margin: '0 0 10px 0' }}>Range represents potential EPD change and is calculated as:</p>
              <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', margin: '10px 0' }}>
                <div style={{ fontFamily: 'monospace', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '3px', fontSize: '14px' }}>
                  Range = |EPD Value| × (1 - Accuracy)
                </div>
              </div>
              <p style={{ margin: '10px 0 0 0' }}>
                Higher accuracy animals show smaller ranges, indicating more reliable predictions. A smaller range suggests less potential for EPD changes.
              </p>
            </div>
          </div>
        </Popup>
      </div>

      {/* Section 3: Offspring */}
      <div className="bubble-container">
        <h3 style={{ margin: '0 0 15px 0' }}>Offspring</h3>
        <ColorTable
          data={calvesData}
          columns={calvesColumns}
          showActionColumn={false}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f4f4f4"
          emptyMessage={cowTag ? "No offspring records found" : "Select a cow to view offspring"}
          maxWidth="100%"
        />
      </div>
    </div>
  );
}

export default BreedingFitness;