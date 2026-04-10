import React, { useState } from 'react';
import { StatusBadge } from './animalCombobox';

/**
 * AnimalTableSelector
 *
 * Props:
 *   animals        — Array<{ CowTag, HerdName?, Status? }>
 *   selected       — Set<string>  (controlled)
 *   onChange       — (newSet: Set<string>) => void
 *   maxHeight      — string  default '320px'
 *   label          — string  default 'Select Cows'
 *   extraControls  — ReactNode  rendered to the right of the label (e.g. filter toggles)
 */
function AnimalTableSelector({
    animals      = [],
    selected,
    onChange,
    maxHeight    = '320px',
    label        = 'Select Cows',
    extraControls = null,
}) {
    // Group by herd
    const herdGroups = {};
    for (const a of animals) {
        const herd = a.HerdName || 'No Herd';
        if (!herdGroups[herd]) herdGroups[herd] = [];
        herdGroups[herd].push(a);
    }

    const toggle = (tag) => {
        const next = new Set(selected);
        next.has(tag) ? next.delete(tag) : next.add(tag);
        onChange(next);
    };

    const toggleHerd = (herdName) => {
        const tags      = herdGroups[herdName].map(a => a.CowTag);
        const allChosen = tags.every(t => selected.has(t));
        const next      = new Set(selected);
        allChosen ? tags.forEach(t => next.delete(t)) : tags.forEach(t => next.add(t));
        onChange(next);
    };

    return (
        <div>
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px'
            }}>
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                    {label} &nbsp;({selected.size} selected)
                </span>
                {extraControls}
            </div>

            <div style={{
                border: '1px solid #ddd', borderRadius: '4px',
                maxHeight, overflowY: 'auto', backgroundColor: 'white'
            }}>
                {Object.entries(herdGroups).length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#aaa' }}>
                        No animals found
                    </div>
                ) : Object.entries(herdGroups).map(([herdName, herdAnimals]) => {
                    const allChosen  = herdAnimals.every(a => selected.has(a.CowTag));
                    const someChosen = herdAnimals.some(a => selected.has(a.CowTag));
                    return (
                        <div key={herdName}>
                            <div
                                onClick={() => toggleHerd(herdName)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '5px 10px', backgroundColor: '#f0f4f8',
                                    borderBottom: '1px solid #ddd', cursor: 'pointer',
                                    fontWeight: 'bold', fontSize: '12px', userSelect: 'none'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={allChosen}
                                    ref={el => { if (el) el.indeterminate = someChosen && !allChosen; }}
                                    onChange={() => toggleHerd(herdName)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {herdName}
                                <span style={{ fontWeight: 'normal', color: '#999', marginLeft: '4px' }}>
                                    ({herdAnimals.length})
                                </span>
                            </div>

                            {herdAnimals.map((animal, idx) => (
                                <label key={animal.CowTag} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '4px 10px 4px 24px',
                                    borderBottom: '1px solid #f5f5f5',
                                    cursor: 'pointer', fontSize: '13px',
                                    backgroundColor: idx % 2 === 0 ? 'white' : '#f9fbfd'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selected.has(animal.CowTag)}
                                        onChange={() => toggle(animal.CowTag)}
                                    />
                                    <span style={{ fontWeight: 'bold' }}>{animal.CowTag}</span>
                                    {animal.Status && (
                                        <span style={{ marginLeft: 'auto' }}>
                                            <StatusBadge status={animal.Status} />
                                        </span>
                                    )}
                                </label>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AnimalTableSelector;