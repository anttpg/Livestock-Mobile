import React from 'react';
import { UnlinkedRecordsBubble } from './recordLinker';
import { toLocalDisplay } from '../utils/dateUtils';

// ---------------------------------------------------------------------------
// CalvingRecordCandidate — right-panel card for a single calving record
// Passed to RecordLinker via the CandidateComponent prop.
// ---------------------------------------------------------------------------

export function CalvingRecordCandidate({ record, isSelected, onClick }) {
    return (
        <div
            onClick={onClick}
            style={{
                padding: 'var(--table-padding) var(--table-padding)', marginBottom: '6px', borderRadius: '5px', cursor: 'pointer',
                border: `2px solid ${isSelected ? '#1976d2' : '#e0e0e0'}`,
                backgroundColor: isSelected ? '#e3f2fd' : '#fafafa',
                transition: 'border-color 0.12s',
            }}
        >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px' }}>
                    {record.CalfTag || '—'}
                </span>
                {record.CalfSex && (
                    <span style={{
                        fontSize: '11px', padding: '1px 7px', borderRadius: '8px',
                        backgroundColor: '#f0f0f0', color: '#555', border: '1px solid #ddd',
                    }}>
                        {record.CalfSex}
                    </span>
                )}
                {record.PlanID && (
                    <span style={{ fontSize: '12px', color: '#aaa' }}>Plan {record.PlanID}</span>
                )}
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                {[
                    record.BirthDate ? `Born ${toLocalDisplay(record.BirthDate)}` : null,
                    record.DamTag    ? `Dam: ${record.DamTag}`                    : null,
                ].filter(Boolean).join('  ·  ')}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Fetch / save / render — weaning-specific implementations
// ---------------------------------------------------------------------------

const fetchUnlinkedWeaningRecords = () =>
    fetch('/api/weaning-records/unlinked', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });

const fetchWeaningCandidates = (rec) => {
    if (!rec.CowTag) return Promise.resolve({ records: [] });
    return fetch(`/api/calving-records?calfTag=${encodeURIComponent(rec.CowTag)}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });
};

// The server should derive and set PlanID from the linked CalvingRecord.
const saveWeaningLink = (rec, candidate) =>
    fetch(`/api/weaning-records/${rec.ID}`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ calvingRecordId: candidate.ID }),
    });

const renderWeaningRecord = (rec) => ({
    primary:   rec.CowTag || 'No tag',
    secondary: [
        rec.WeaningDate   ? toLocalDisplay(rec.WeaningDate)        : null,
        rec.WeaningWeight != null ? `${rec.WeaningWeight} lbs`     : null,
    ].filter(Boolean).join('  ·  '),
    badge: null,
    note:  rec.Notes || null,
});

const weaningCandidateLabel = (rec) =>
    rec.CowTag
        ? `Calving records for calf ${rec.CowTag}`
        : 'No tag — cannot look up calving records';


export function WeaningLinkerBubble({ onRefresh }) {
    return (
        <UnlinkedRecordsBubble
            fetchUnlinked={fetchUnlinkedWeaningRecords}
            fetchCandidates={fetchWeaningCandidates}
            saveLink={saveWeaningLink}
            renderRecord={renderWeaningRecord}
            candidateLabel={weaningCandidateLabel}
            CandidateComponent={CalvingRecordCandidate}
            noun="weaning record"
            nounPlural="weaning records"
            popupTitle="Link Weaning Records to Calving Records"
            onRefresh={onRefresh}
        />
    );
}