import React from 'react';
import { UnlinkedRecordsBubble } from './recordLinker';
import { toLocalDisplay } from '../utils/dateUtils';

// ---------------------------------------------------------------------------
// Fetch / save / render — calving-record-specific implementations
// ---------------------------------------------------------------------------

const fetchUnlinkedCalvingRecords = () =>
    fetch('/api/calving-records/unlinked', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });

const fetchCalvingCandidates = (rec) => {
    if (!rec.DamTag) return Promise.resolve({ records: [] });
    return fetch(`/api/breeding-records?cowTag=${encodeURIComponent(rec.DamTag)}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });
};

const saveCalvingLink = (rec, candidate) =>
    fetch(`/api/calving-records/${rec.ID}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ BreedingRecordID: candidate.ID }),
    });

const renderCalvingRecord = (rec) => ({
    primary:   rec.DamTag || 'No dam tag',
    secondary: [
        rec.CalfTag ? `Calf: ${rec.CalfTag}` : null,
        toLocalDisplay(rec.BirthDate),
        rec.CalfSex || null,
        rec.CalfDiedAtBirth ? 'Died at birth' : null,
    ].filter(Boolean).join('  ·  '),
    badge: null,
    note:  rec.CalvingNotes || null,
});

const calvingCandidateLabel = (rec) =>
    rec.DamTag
        ? `Breeding records for dam ${rec.DamTag}`
        : 'No dam tag — cannot look up breeding records';

// ---------------------------------------------------------------------------
// CalvingLinkerBubble — drop-in banner + popup for unlinked calving records.
//
// Props:
//   onRefresh  () => void  called when the popup closes so the parent
//                          can re-fetch any data it displays
// ---------------------------------------------------------------------------

export function CalvingLinkerBubble({ onRefresh }) {
    return (
        <UnlinkedRecordsBubble
            fetchUnlinked={fetchUnlinkedCalvingRecords}
            fetchCandidates={fetchCalvingCandidates}
            saveLink={saveCalvingLink}
            renderRecord={renderCalvingRecord}
            candidateLabel={calvingCandidateLabel}
            noun="calving record"
            nounPlural="calving records"
            popupTitle="Link Calving Records to Breeding Records"
            onRefresh={onRefresh}
        />
    );
}
