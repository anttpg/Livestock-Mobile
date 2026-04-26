import React from 'react';
import { UnlinkedRecordsBubble } from './recordLinker';
import { toLocalDisplay } from '../utils/dateUtils';

// ---------------------------------------------------------------------------
// Fetch / save / render — pregnancy-check-specific implementations
// ---------------------------------------------------------------------------

const fetchUnlinkedPregChecks = () =>
    fetch('/api/pregnancy-checks/unlinked', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });

const fetchPregCheckCandidates = (rec) =>
    fetch(`/api/breeding-records?cowTag=${encodeURIComponent(rec.CowTag)}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { records: [] });

const savePregCheckLink = (rec, candidate) =>
    fetch(`/api/pregnancy-checks/${rec.ID}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ BreedingRecordID: candidate.ID }),
    });

const renderPregCheckRecord = (rec) => ({
    primary:   rec.CowTag,
    secondary: [
        toLocalDisplay(rec.PregCheckDate),
        rec.MonthsPregnant != null ? `${rec.MonthsPregnant}mo` : null,
        rec.TestType || null,
    ].filter(Boolean).join('  ·  '),
    badge: rec.TestResults ? {
        label:  rec.TestResults,
        bg:     rec.TestResults === 'Pregnant' ? '#e8f5e9' : '#f5f5f5',
        color:  rec.TestResults === 'Pregnant' ? '#2e7d32' : '#666',
        border: rec.TestResults === 'Pregnant' ? '#a5d6a7' : '#ddd',
    } : null,
    note: rec.Notes || null,
});

const pregCheckCandidateLabel = (rec) =>
    `Breeding records for ${rec.CowTag}`;

// ---------------------------------------------------------------------------
// PregnancyLinkerBubble — drop-in banner + popup for unlinked pregnancy checks.
//
// Props:
//   onRefresh  () => void  called when the popup closes so the parent
//                          can re-fetch any data it displays
// ---------------------------------------------------------------------------

export function PregnancyLinkerBubble({ onRefresh }) {
    return (
        <UnlinkedRecordsBubble
            fetchUnlinked={fetchUnlinkedPregChecks}
            fetchCandidates={fetchPregCheckCandidates}
            saveLink={savePregCheckLink}
            renderRecord={renderPregCheckRecord}
            candidateLabel={pregCheckCandidateLabel}
            noun="pregnancy check"
            nounPlural="pregnancy checks"
            popupTitle="Link Pregnancy Checks to Breeding Records"
            onRefresh={onRefresh}
        />
    );
}
