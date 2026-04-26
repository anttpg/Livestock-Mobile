import React, { useState, useEffect, useCallback } from 'react';
import Timeline from './timeline';
import Table from './table';
import Popup from './popup';
import { useNavigate } from 'react-router-dom';
import CalvingAlertsBubble from './calvingAlert';
import { toLocalDisplayLong, ageInMonths } from '../utils/dateUtils';

function Overview() {
  const [calvingData, setCalvingData] = useState({
    calvingAlerts: [],
    expectedBirths: [],
    pregChecks: [],
    calvingRecords: [],
  });

  const [animalData, setAnimalData] = useState({ bulls: [], cows: [], calves: [] });
  const [openAnimalPopup, setOpenAnimalPopup] = useState(null);

  const navigate = useNavigate();

  const fetchCalvingData = useCallback(async () => {
    try {
      const plansRes = await fetch('/api/breeding-plans', { credentials: 'include' });
      if (!plansRes.ok) return;
      const { plans = [] } = await plansRes.json();
      const activePlans = plans.filter(p => p.IsActive);
      if (activePlans.length === 0) return;

      const overviews = await Promise.all(
        activePlans.map(p =>
          fetch(`/api/breeding-plans/${p.ID}/overview`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );

      const seenAlerts = new Set();
      const seenBirths = new Set();
      const merged = { calvingAlerts: [], expectedBirths: [], pregChecks: [], calvingRecords: [] };

      for (const data of overviews) {
        if (!data) continue;
        for (const a of (data.calvingAlerts || [])) {
          if (!seenAlerts.has(a.cowTag)) { seenAlerts.add(a.cowTag); merged.calvingAlerts.push(a); }
        }
        for (const b of (data.expectedBirths || [])) {
          const k = b.cowTag + (b.breedingRecordId || '');
          if (!seenBirths.has(k)) { seenBirths.add(k); merged.expectedBirths.push(b); }
        }
        merged.pregChecks.push(...(data.pregChecks || []));
        merged.calvingRecords.push(...(data.calvingRecords || []));
      }

      setCalvingData(merged);
    } catch (e) {
      console.error('Overview: failed to fetch calving data', e);
    }
  }, []);

  const fetchAnimalData = useCallback(async () => {
    try {
      const res = await fetch('/api/animals/active', { credentials: 'include' });
      if (!res.ok) return;
      const { cows: animals = [] } = await res.json();

      const bulls  = animals.filter(a => a.Sex === 'Male'   && ageInMonths(a.DateOfBirth) >= 12);
      const cows   = animals.filter(a => a.Sex === 'Female' && ageInMonths(a.DateOfBirth) >= 12);
      const calves = animals.filter(a => ageInMonths(a.DateOfBirth) < 12);

      setAnimalData({ bulls, cows, calves });
    } catch (e) {
      console.error('Overview: failed to fetch animal data', e);
    }
  }, []);

  useEffect(() => {
    fetchCalvingData();
    fetchAnimalData();
  }, [fetchCalvingData, fetchAnimalData]);

  const animalTableColumns = [
    {
      key: 'CowTag',
      header: 'Tag',
      type: 'text',
      align: 'left',
      customRender: (value, row) => (
        <span
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/animal?search=${row.CowTag}&tab=general`);
          }}
          style={{ color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'DateOfBirth',
      header: 'Date of Birth',
      type: 'date',
      align: 'left',
    },
    {
      key: 'HerdName',
      header: 'Herd',
      type: 'text',
      align: 'left',
    },
  ];

  const navButtons = [
    { label: 'Herds',          icon: 'footprint',      path: '/herds'       },
    { label: 'Animal Records', icon: 'folder_open',    path: '/animal'      },
    { label: 'Breeding Plan',  icon: 'calendar_month', path: '/breeding'    },
    { label: 'Equipment',      icon: 'forklift',       path: '/equipment'   },
    { label: 'Pastures',       icon: 'grass',          path: '/pastures'    },
    { label: 'Fieldsheets',    icon: 'assignment',     path: '/fieldsheets' },
  ];

  const animalGroups = [
    { key: 'bulls',  label: 'Bulls',  icon: 'male'   },
    { key: 'cows',   label: 'Cows',   icon: 'female' },
    { key: 'calves', label: 'Calves', icon: null     },
  ];

  const baseButtonStyle = {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '6px', padding: '16px 8px',
    border: '1px solid #e8e8e8', borderRadius: '8px',
    backgroundColor: '#f2f2f2',
    cursor: 'pointer',
    fontSize: '12px', fontWeight: '600', color: '#444',
    transition: 'background-color 0.15s, border-color 0.15s',
  };

  return (
    <div className="multibubble-column">
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 20px 0' }}>
        Overview
      </h1>

      {/* Nav buttons */}
      <div className="bubble-container" style={{ marginBottom: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {navButtons.map(({ label, icon, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={baseButtonStyle}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e8e8e8'; e.currentTarget.style.borderColor = '#ccc'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f2f2f2'; e.currentTarget.style.borderColor = '#e8e8e8'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#555' }}>
                {icon}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Animal count cards */}
      <div className="bubble-container" style={{ marginBottom: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {animalGroups.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setOpenAnimalPopup(key)}
              style={baseButtonStyle}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e8e8e8'; e.currentTarget.style.borderColor = '#ccc'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f2f2f2'; e.currentTarget.style.borderColor = '#e8e8e8'; }}
            >
              <span style={{ fontSize: '22px', fontWeight: '700', color: '#222', lineHeight: 1 }}>
                {animalData[key].length}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {icon && (
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#555' }}>
                    {icon}
                  </span>
                )}
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Animal popups */}
      {animalGroups.map(({ key, label }) => (
        <Popup
          key={key}
          isOpen={openAnimalPopup === key}
          onClose={() => setOpenAnimalPopup(null)}
          title={label}
          fullscreen
        >
          <Table
            columns={animalTableColumns}
            data={animalData[key]}
            showActionColumn={false}
            actionButtonText="VIEW"
            actionButtonColor="#3bb558"
            onActionClick={(row) => navigate(`/animal?search=${row.CowTag}&tab=general`)}
          />
        </Popup>
      ))}

      <div className="bubble-container">
        <CalvingAlertsBubble
          calvingAlerts={calvingData.calvingAlerts}
          expectedBirths={calvingData.expectedBirths}
          pregChecks={calvingData.pregChecks}
          calvingRecords={calvingData.calvingRecords}
          planId={null}
          onRefresh={fetchCalvingData}
          showExpectedBirths={false}
        />
      </div>
    </div>
  );
}

export default Overview;