import React, { useState, useEffect } from 'react';
import {
    DualListSelector,
    DualListSelectorPane,
    DualListSelectorList,
    DualListSelectorListItem,
    DualListSelectorControlsWrapper,
    DualListSelectorControl,
    DualListSelectorTree,
    EmptyState,
    EmptyStateVariant,
    EmptyStateBody,
    EmptyStateFooter,
    EmptyStateActions,
    Button
} from '@patternfly/react-core';
import {
    AngleDoubleLeftIcon,
    AngleLeftIcon,
    AngleRightIcon,
    AngleDoubleRightIcon,
    SearchIcon
} from '@patternfly/react-icons';
import '@patternfly/react-core/dist/styles/base-no-reset.css';
import AutoCombobox from './autoCombobox';
import PopupNotify from './popupNotify';

// Scoped style fix: base-no-reset.css doesn't include the :where(ul){list-style:none}
// global reset that base.css has, so PF list items show browser-default bullets.
// This targets only PF dual-list elements so nothing else in the app is affected.
const BULLET_FIX = `
  .pf-v6-c-dual-list-selector__list { list-style: none; padding-left: 0; }
`;

// ---------------------------------------------------------------------------
// AnimalDualList — shared inner component for one animal type (cattle / goats)
// ---------------------------------------------------------------------------
function AnimalDualList({
    label,             // "Cattle" or "Goats"
    availableItems,
    setAvailableItems,
    chosenItems,
    setChosenItems,
    leftTitle,
    rightTitle,
    groupByHerd,       // true → tree view grouped by herd (use case 1)
    tagField,          // 'CowTag' or 'GoatTag'
}) {
    const [availableFilter, setAvailableFilter] = useState('');
    const [chosenFilter,    setChosenFilter]    = useState('');

    //  filter 
    const filterItems = (items, filter) => {
        const f = String(filter || '').toLowerCase();
        if (!f) return items;
        return items
            .filter(item => {
                if (item.children) return filterItems(item.children, f).length > 0 || item.text.toLowerCase().includes(f);
                return item.text.toLowerCase().includes(f);
            })
            .map(item => ({ ...item, children: item.children ? filterItems(item.children, f) : undefined }));
    };

    const filteredAvailable = filterItems(availableItems, availableFilter);
    const filteredChosen    = filterItems(chosenItems,    chosenFilter);

    //  autocomplete: derive options from the pane's own items, not allAnimals 
    // FIX: previously used allAnimals (entire fetched list), which:
    //   a) showed animals already moved away (wrong animals)
    //   b) for goats showed cattle tags if allGoats happened to be empty
    // Now we build options from the flattened leaf nodes of each pane directly.
    const flattenToOptions = (items) => {
        let out = [];
        items.forEach(item => {
            if (item.children) out = out.concat(flattenToOptions(item.children));
            else out.push({ name: item.text, value: item.text });
        });
        return out;
    };
    const availableOptions = flattenToOptions(availableItems);
    const chosenOptions    = flattenToOptions(chosenItems);

    //  selection — id-based, not index-based 
    const onOptionSelect = (itemId, isChosen) => {
        const items    = isChosen ? chosenItems    : availableItems;
        const setItems = isChosen ? setChosenItems : setAvailableItems;
        setItems(items.map(item => item.id === itemId ? { ...item, isChecked: !item.isChecked } : item));
    };

    const onTreeOptionCheck = (_e, isChecked, itemData, isChosen) => {
        const items    = isChosen ? chosenItems    : availableItems;
        const setItems = isChosen ? setChosenItems : setAvailableItems;
        const update = (arr, tid, checked) =>
            arr.map(item => {
                if (item.id === tid) return { ...item, isChecked: checked };
                if (item.children) return { ...item, children: update(item.children, tid, checked) };
                return item;
            });
        setItems(update(items, itemData.id, isChecked));
    };

    //  move logic 
    const getSelected = (items) => {
        let out = [];
        items.forEach(item => {
            if (item.children) out = out.concat(getSelected(item.children));
            else if (item.isChecked) out.push({ ...item, isChecked: false });
        });
        return out;
    };

    const removeSelected = (items) =>
        items.map(item => {
            if (item.children) {
                const nc = removeSelected(item.children);
                return nc.length > 0 ? { ...item, children: nc, isChecked: false } : null;
            }
            return item.isChecked ? null : item;
        }).filter(Boolean);

    const flatten = (items) => {
        let out = [];
        items.forEach(item => {
            if (item.children) out = out.concat(flatten(item.children));
            else out.push({ ...item, isChecked: false });
        });
        return out;
    };

    const hasSelected = (items) =>
        items.some(item => item.children ? hasSelected(item.children) : item.isChecked);

    const moveSelected = (fromAvailable) => {
        const src    = fromAvailable ? availableItems    : chosenItems;
        const setSrc = fromAvailable ? setAvailableItems : setChosenItems;
        const dst    = fromAvailable ? chosenItems       : availableItems;
        const setDst = fromAvailable ? setChosenItems    : setAvailableItems;
        const selected = getSelected(src);
        if (!selected.length) return;
        setSrc(removeSelected(src));
        setDst([...dst, ...selected]);
    };

    const moveAll = (fromAvailable) => {
        const src    = fromAvailable ? availableItems    : chosenItems;
        const setSrc = fromAvailable ? setAvailableItems : setChosenItems;
        const dst    = fromAvailable ? chosenItems       : availableItems;
        const setDst = fromAvailable ? setChosenItems    : setAvailableItems;
        setDst([...dst, ...flatten(src)]);
        setSrc([]);
    };

    const buildEmptyState = (isAvail) => (
        <EmptyState titleText="No results found" variant={EmptyStateVariant.sm} headingLevel="h4" icon={SearchIcon}>
            <EmptyStateBody>No results match the filter. Clear and try again.</EmptyStateBody>
            <EmptyStateFooter>
                <EmptyStateActions>
                    <Button variant="link" onClick={() => isAvail ? setAvailableFilter('') : setChosenFilter('')}>
                        Clear filter
                    </Button>
                </EmptyStateActions>
            </EmptyStateFooter>
        </EmptyState>
    );

    return (
        <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#444', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
                {label}
            </h4>
            <DualListSelector
                style={{
                    '--pf-v6-c-dual-list-selector--GridTemplateColumns--pane--MinMax--min': '80px',
                    '--pf-v6-c-dual-list-selector__list-item-row--m-selected--BackgroundColor': '#b1b1b1',
                    '--pf-v6-c-dual-list-selector__list-item-row--m-selected__text--Color': '#000000',
                    '--pf-v6-c-dual-list-selector__list-item-row--hover--BackgroundColor': '#6c748b',
                    '--pf-v6-c-dual-list-selector__tools--MarginBlockEnd': '4px'
                }}
            >
                {/* Available pane */}
                <DualListSelectorPane
                    title={leftTitle && leftTitle}
                    searchInput={
                        <AutoCombobox
                            options={availableOptions}
                            value={availableFilter}
                            onChange={setAvailableFilter}
                            placeholder={`Search ${label.toLowerCase()}...`}
                            allowCustomValue={true}
                        />
                    }
                    status={`${filteredAvailable.length} available`}
                >
                    {availableFilter !== '' && filteredAvailable.length === 0 && buildEmptyState(true)}
                    {groupByHerd ? (
                        <DualListSelectorTree
                            data={filteredAvailable}
                            onOptionCheck={(e, checked, itemData) => onTreeOptionCheck(e, checked, itemData, false)}
                        />
                    ) : (
                        <DualListSelectorList>
                            {filteredAvailable.map(option => (
                                <DualListSelectorListItem
                                    key={option.id}
                                    isSelected={option.isChecked}
                                    id={`avail-${option.id}`}
                                    onOptionSelect={() => onOptionSelect(option.id, false)}
                                >
                                    {option.text}
                                </DualListSelectorListItem>
                            ))}
                        </DualListSelectorList>
                    )}
                </DualListSelectorPane>

                <DualListSelectorControlsWrapper>
                    <DualListSelectorControl isDisabled={!hasSelected(availableItems)} onClick={() => moveSelected(true)}  aria-label="Add selected"    icon={<AngleRightIcon />} />
                    <DualListSelectorControl isDisabled={availableItems.length === 0}  onClick={() => moveAll(true)}       aria-label="Add all"         icon={<AngleDoubleRightIcon />} />
                    <DualListSelectorControl isDisabled={chosenItems.length === 0}     onClick={() => moveAll(false)}      aria-label="Remove all"      icon={<AngleDoubleLeftIcon />} />
                    <DualListSelectorControl isDisabled={!hasSelected(chosenItems)}    onClick={() => moveSelected(false)} aria-label="Remove selected" icon={<AngleLeftIcon />} />
                </DualListSelectorControlsWrapper>

                {/* Chosen pane */}
                <DualListSelectorPane
                    isChosen
                    title={rightTitle && rightTitle}
                    searchInput={
                        <AutoCombobox
                            options={chosenOptions}
                            value={chosenFilter}
                            onChange={setChosenFilter}
                            placeholder={`Search ${label.toLowerCase()}...`}
                            allowCustomValue={true}
                        />
                    }
                    status={`${filteredChosen.length} selected`}
                >
                    {chosenFilter !== '' && filteredChosen.length === 0 && buildEmptyState(false)}
                    <DualListSelectorList>
                        {filteredChosen.map(option => (
                            <DualListSelectorListItem
                                key={option.id}
                                isSelected={option.isChecked}
                                id={`chosen-${option.id}`}
                                onOptionSelect={() => onOptionSelect(option.id, true)}
                            >
                                {option.text}
                            </DualListSelectorListItem>
                        ))}
                    </DualListSelectorList>
                </DualListSelectorPane>
            </DualListSelector>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const toFlatItems = (animals, tagField) =>
    animals.map(a => ({ id: a[tagField], text: a[tagField], isChecked: false, animalData: a }));

const toGroupedItems = (animals, tagField) => {
    const grouped = {};
    animals.forEach(a => {
        const herd = a.HerdName || 'Unassigned';
        if (!grouped[herd]) grouped[herd] = [];
        grouped[herd].push(a);
    });
    return Object.entries(grouped)
        .sort(([a], [b]) => a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b))
        .map(([herdName, herdAnimals]) => ({
            id: `herd-${herdName}`,
            text: `${herdName} (${herdAnimals.length})`,
            isChecked: false,
            defaultExpanded: herdName === 'Unassigned',
            children: herdAnimals.map(a => ({
                id: a[tagField], text: a[tagField], isChecked: false, animalData: a
            }))
        }));
};

// ---------------------------------------------------------------------------
// HerdSplitter
// ---------------------------------------------------------------------------
function HerdSplitter({
    leftHerd       = null,   // source herd; null = all animals (tree view)
    rightHerd      = null,   // pre-selected target herd
    unassignedMode = false,  // true = source is unassigned animals only
    sourceCattle   = null,   // pre-supplied cattle for unassigned mode
    sourceGoats    = null,   // pre-supplied goats  for unassigned mode
    isOpen         = true,
    onClose        = () => {},
    onSave         = () => {},
}) {
    const [existingHerds,  setExistingHerds]  = useState([]);
    const [loading,        setLoading]        = useState(true);

    const [availableCows,  setAvailableCows]  = useState([]);
    const [chosenCows,     setChosenCows]     = useState([]);
    const [availableGoats, setAvailableGoats] = useState([]);
    const [chosenGoats,    setChosenGoats]    = useState([]);

    const [targetHerdName,    setTargetHerdName]    = useState(rightHerd || '');
    const [isCreatingNewHerd, setIsCreatingNewHerd] = useState(false);
    const [newHerdName,       setNewHerdName]       = useState('');

    // Two separate error states for the two different inputs
    const [herdSelectError,   setHerdSelectError]   = useState(false);  // dropdown: no selection
    const [newHerdNameError,  setNewHerdNameError]  = useState(false);  // text input: name taken

    const [notify, setNotify] = useState({ isOpen: false, message: '', title: 'Notice' });
    const showNotify = (message, title = 'Notice') => setNotify({ isOpen: true, message, title });

    // use case: 1 = all→new, 2 = split left herd / unassigned mode
    const useCase = unassignedMode ? 2
        : (!leftHerd && !rightHerd) ? 1
        : (leftHerd && !rightHerd)  ? 2
        : 3;
    const groupByHerd = useCase === 1;

    useEffect(() => { loadInitialData(); }, [leftHerd, rightHerd]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [herdsRes, animalsRes] = await Promise.all([
                fetch('/api/herds',          { credentials: 'include' }),
                fetch('/api/animals/active', { credentials: 'include' })
            ]);
            const herdsData   = await herdsRes.json();
            const animalsData = await animalsRes.json();
            const cows        = animalsData.cows  || [];
            const goats       = animalsData.goats || [];
            const herdNames   = (herdsData.herds  || []).map(h => h.herdName);

            setExistingHerds(herdNames);

            let leftCows, leftGoats, rightCows = [], rightGoats = [];

            if (unassignedMode) {
                leftCows  = sourceCattle || cows .filter(c => !c.HerdName);
                leftGoats = sourceGoats  || goats.filter(g => !g.HerdName);
            } else if (useCase === 1) {
                leftCows  = cows;
                leftGoats = goats;
                setIsCreatingNewHerd(true);
            } else {
                leftCows  = leftHerd ? cows .filter(c => c.HerdName === leftHerd) : cows;
                leftGoats = leftHerd ? goats.filter(g => g.HerdName === leftHerd) : goats;
                if (rightHerd) {
                    rightCows  = cows .filter(c => c.HerdName === rightHerd);
                    rightGoats = goats.filter(g => g.HerdName === rightHerd);
                }
            }

            setAvailableCows (groupByHerd ? toGroupedItems(leftCows,  'CowTag')  : toFlatItems(leftCows,  'CowTag'));
            setAvailableGoats(groupByHerd ? toGroupedItems(leftGoats, 'GoatTag') : toFlatItems(leftGoats, 'GoatTag'));
            setChosenCows    (toFlatItems(rightCows,  'CowTag'));
            setChosenGoats   (toFlatItems(rightGoats, 'GoatTag'));
        } catch (err) {
            console.error('Error loading herd data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Switching herd: just update the label — movements carry over, no reload.
    const handleTargetHerdChange = (value) => {
        if (value === '+ New Herd') {
            setIsCreatingNewHerd(true);
            setTargetHerdName('');
            setNewHerdName('');
            setNewHerdNameError(false);
        } else {
            setIsCreatingNewHerd(false);
            setTargetHerdName(value);
            setHerdSelectError(false);
        }
    };

    const handleNewHerdNameChange = (e) => {
        const val = e.target.value;
        setNewHerdName(val);
        setNewHerdNameError(val !== '' && existingHerds.includes(val));
    };

    const getEffectiveHerdName = () => isCreatingNewHerd ? newHerdName : targetHerdName;

    const handleSave = async () => {
        // Validate: must pick or name a herd
        if (useCase !== 1) {
            const name = getEffectiveHerdName();
            if (!name) {
                setHerdSelectError(true);
                return;
            }
            if (isCreatingNewHerd && existingHerds.includes(name)) {
                setNewHerdNameError(true);
                return;
            }
        } else {
            // useCase 1: validate new herd name
            if (!newHerdName) {
                setHerdSelectError(true);
                return;
            }
            if (existingHerds.includes(newHerdName)) {
                setNewHerdNameError(true);
                return;
            }
        }

        const cowTags  = chosenCows .map(i => i.id);
        const goatTags = chosenGoats.map(i => i.id);

        try {
            if (useCase === 1 || (useCase === 2 && isCreatingNewHerd)) {
                const res = await fetch('/api/herds/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ herdName: getEffectiveHerdName(), cowTags, goatTags })
                });
                if (!res.ok) throw new Error('Failed to create herd');
            } else {
                const requests = [];
                if (cowTags.length > 0) {
                    requests.push(fetch('/api/cows/herd', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ cowTags, herdName: getEffectiveHerdName() })
                    }));
                }
                if (goatTags.length > 0) {
                    requests.push(fetch('/api/goats/herd', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ goatTags, herdName: getEffectiveHerdName() })
                    }));
                }
                const results = await Promise.all(requests);
                if (results.some(r => !r.ok)) throw new Error('Failed to move animals');
            }

            onSave();
            showNotify('Changes saved successfully.', 'Saved');
            setTimeout(() => onClose(), 1200);
        } catch (err) {
            console.error('Save error:', err);
            showNotify(`Failed to save: ${err.message}`, 'Error');
        }
    };

    const pageTitle = unassignedMode   ? 'Assign Unassigned Animals'
        : useCase === 1                 ? 'Create New Herd'
        : useCase === 2                 ? `Split Herd: ${leftHerd}`
        : `Move between ${leftHerd} and ${targetHerdName || rightHerd || 'Target'}`;

    const rightPaneTitle = isCreatingNewHerd ? 'New Herd'
        : targetHerdName ? `Animals in ${targetHerdName}` : 'Target Herd';

    const leftCattleTitle = unassignedMode ? 'Unassigned Animals' : useCase === 1 ? 'All Animals' : `Animals in ${leftHerd}`;

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading herd data...</div>;

    return (
        <>
            {/* Scoped bullet-point fix — only targets PF dual list elements */}
            <style>{BULLET_FIX}</style>

            <div style={{ display: 'flex', flexDirection: 'column', height: '85vh' }}>

                {/* Header */}
                <div style={{ padding: '10px 15px', borderBottom: '1px solid #ddd', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                        <h3 style={{ margin: 0 }}>{pageTitle}</h3>

                        {/* Target herd selector (cases 2, 3, unassigned) */}
                        {(useCase === 2 || useCase === 3 || unassignedMode) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {isCreatingNewHerd ? (
                                        <>
                                            <label>New Herd Name:</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                                <input
                                                    type="text"
                                                    value={newHerdName}
                                                    onChange={handleNewHerdNameChange}
                                                    style={{
                                                        padding: '5px',
                                                        border: newHerdNameError ? '2px solid #dc3545' : '1px solid #ccc',
                                                        borderRadius: '3px',
                                                        outline: 'none'
                                                    }}
                                                    placeholder="Enter herd name"
                                                />
                                                {newHerdNameError && (
                                                    <span style={{ color: '#dc3545', fontSize: '12px' }}>
                                                        A herd with that name already exists!
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => { setIsCreatingNewHerd(false); setNewHerdName(''); setNewHerdNameError(false); }}
                                                style={{ padding: '5px 10px', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer' }}
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <label>Target Herd:</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                                <select
                                                    value={targetHerdName}
                                                    onChange={e => handleTargetHerdChange(e.target.value)}
                                                    style={{
                                                        padding: '5px',
                                                        border: herdSelectError ? '2px solid #dc3545' : '1px solid #ccc',
                                                        borderRadius: '3px',
                                                        outline: 'none'
                                                    }}
                                                >
                                                    <option value="">Select target herd</option>
                                                    {existingHerds.filter(h => h !== leftHerd).map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                    <option value="+ New Herd">+ New Herd</option>
                                                </select>
                                                {herdSelectError && (
                                                    <span style={{ color: '#dc3545', fontSize: '12px' }}>You must select a herd!</span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* New herd name for use case 1 */}
                        {useCase === 1 && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                <input
                                    type="text"
                                    value={newHerdName}
                                    onChange={handleNewHerdNameChange}
                                    style={{
                                        padding: '8px',
                                        border: (herdSelectError && !newHerdName) || newHerdNameError ? '2px solid #dc3545' : '1px solid #ccc',
                                        borderRadius: '3px',
                                        width: '260px',
                                        outline: 'none'
                                    }}
                                    placeholder="New herd name"
                                />
                                {newHerdNameError && (
                                    <span style={{ color: '#dc3545', fontSize: '12px' }}>A herd with that name already exists!</span>
                                )}
                                {herdSelectError && !newHerdName && !newHerdNameError && (
                                    <span style={{ color: '#dc3545', fontSize: '12px' }}>You must enter a herd name!</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Selectors — cattle then goats */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 15px' }}>
                    <AnimalDualList
                        label="Cattle"
                        availableItems={availableCows}
                        setAvailableItems={setAvailableCows}
                        chosenItems={chosenCows}
                        setChosenItems={setChosenCows}
                        leftTitle={leftCattleTitle}
                        rightTitle={`${rightPaneTitle}`}
                        groupByHerd={groupByHerd}
                        tagField="CowTag"
                    />
                    <AnimalDualList
                        label="Goats"
                        availableItems={availableGoats}
                        setAvailableItems={setAvailableGoats}
                        chosenItems={chosenGoats}
                        setChosenItems={setChosenGoats}
                        groupByHerd={groupByHerd}
                        tagField="GoatTag"
                    />
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 15px', borderTop: '1px solid #ddd', backgroundColor: '#f8f9fa',
                    display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0
                }}>
                    <button onClick={onClose}
                        style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave}
                        style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                        Save
                    </button>
                </div>
            </div>

            <PopupNotify
                isOpen={notify.isOpen}
                onClose={() => setNotify({ ...notify, isOpen: false })}
                message={notify.message}
                title={notify.title}
            />
        </>
    );
}

export default HerdSplitter;