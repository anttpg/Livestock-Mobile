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
import { usePatternFlyStyles } from '../styles/usePatternFlyStyles';
import styles from '../styles/patternfly.module.css';
import AutoCombobox from './autoCombobox';

function HerdSplitter({
    leftHerd = null,
    rightHerd = null,
    isOpen = true,
    onClose = () => { },
    onSave = () => { }
}) {
    usePatternFlyStyles();

    const [availableItems, setAvailableItems] = useState([]);
    const [chosenItems, setChosenItems] = useState([]);
    const [availableFilter, setAvailableFilter] = useState('');
    const [chosenFilter, setChosenFilter] = useState('');
    const [newHerdName, setNewHerdName] = useState('');
    const [targetHerdName, setTargetHerdName] = useState(rightHerd || '');
    const [existingHerds, setExistingHerds] = useState([]);
    const [isCreatingNewHerd, setIsCreatingNewHerd] = useState(false);
    const [saveButtonText, setSaveButtonText] = useState('Save');
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const [pendingHerdChange, setPendingHerdChange] = useState(null);
    const [loading, setLoading] = useState(true);
    const [allCows, setAllCows] = useState([]);

    // Determine use case based on props
    const useCase = !leftHerd && !rightHerd ? 1 :
        leftHerd && !rightHerd ? 2 : 3;

    useEffect(() => {
        loadInitialData();
    }, [leftHerd, rightHerd]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // Fetch all herds
            const herdsResponse = await fetch('/api/herds/list', { credentials: 'include' });
            const herdsData = await herdsResponse.json();
            setExistingHerds(Array.isArray(herdsData) ? herdsData : []);

            // Fetch all cows for autocomplete
            const allCowsResponse = await fetch('/api/cows/by-herd', { credentials: 'include' });
            const allCowsData = await allCowsResponse.json();
            setAllCows(allCowsData.cows || []);

            // Fetch cows based on use case
            let leftCows = [];
            let rightCows = [];

            if (useCase === 1) {
                // Case 1: All cows available, empty chosen
                leftCows = allCowsData.cows || [];
                setIsCreatingNewHerd(true);
            } else if (useCase === 2) {
                // Case 2: Specific herd cows available
                const herdCowsResponse = await fetch(`/api/herd/${encodeURIComponent(leftHerd)}/animals`, { credentials: 'include' });
                const herdCowsData = await herdCowsResponse.json();
                leftCows = herdCowsData.animals || [];
            } else {
                // Case 3: Left herd available, right herd chosen  
                const leftHerdResponse = await fetch(`/api/herd/${encodeURIComponent(leftHerd)}/animals`, { credentials: 'include' });
                const leftHerdData = await leftHerdResponse.json();
                leftCows = leftHerdData.animals || [];

                // FIXED: Load right herd cattle when it exists
                if (rightHerd) {
                    const rightHerdResponse = await fetch(`/api/herd/${encodeURIComponent(rightHerd)}/animals`, { credentials: 'include' });
                    const rightHerdData = await rightHerdResponse.json();
                    rightCows = rightHerdData.animals || [];
                }
            }

            setAvailableItems(convertCowsToTreeData(leftCows));
            setChosenItems(convertCowsToTreeData(rightCows));
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const convertCowsToTreeData = (cows) => {
        if (useCase === 1) {
            // Group by herd for case 1
            const grouped = {};
            cows.forEach(cow => {
                const herdName = cow.CurrentHerd || 'Unassigned';
                if (!grouped[herdName]) {
                    grouped[herdName] = [];
                }
                grouped[herdName].push(cow);
            });

            return Object.entries(grouped)
                .sort(([a], [b]) => {
                    if (a === 'Unassigned') return 1;
                    if (b === 'Unassigned') return -1;
                    return a.localeCompare(b);
                })
                .map(([herdName, herdCows]) => ({
                    id: `herd-${herdName}`,
                    text: `${herdName} (${herdCows.length})`,
                    isChecked: false,
                    defaultExpanded: herdName === 'Unassigned',
                    children: herdCows.map(cow => ({
                        id: cow.CowTag,
                        text: cow.CowTag,
                        isChecked: false,
                        cowData: cow
                    }))
                }));
        } else {
            // Flat list for cases 2 and 3
            return cows.map(cow => ({
                id: cow.CowTag || cow.GoatTag,
                text: cow.CowTag || cow.GoatTag,
                isChecked: false,
                cowData: cow
            }));
        }
    };

    // FIXED: Ensure filter is treated as string
    const filterItems = (items, filter) => {
        const filterStr = String(filter || '').toLowerCase();
        if (!filterStr) return items;

        return items.filter(item => {
            if (item.children) {
                const filteredChildren = filterItems(item.children, filterStr);
                return filteredChildren.length > 0 || item.text.toLowerCase().includes(filterStr);
            }
            return item.text.toLowerCase().includes(filterStr);
        }).map(item => ({
            ...item,
            children: item.children ? filterItems(item.children, filterStr) : undefined
        }));
    };

    const moveSelected = (fromAvailable) => {
        const sourceItems = fromAvailable ? availableItems : chosenItems;
        const setSourceItems = fromAvailable ? setAvailableItems : setChosenItems;
        const destItems = fromAvailable ? chosenItems : availableItems;
        const setDestItems = fromAvailable ? setChosenItems : setAvailableItems;

        // Get selected items (handle tree structure)
        const getSelectedItems = (items) => {
            let selected = [];
            items.forEach(item => {
                if (item.children) {
                    selected = selected.concat(getSelectedItems(item.children));
                } else if (item.isChecked) {
                    selected.push({ ...item, isChecked: false });
                }
            });
            return selected;
        };

        // Remove selected items from source (handle tree structure)
        const removeSelectedItems = (items) => {
            return items.map(item => {
                if (item.children) {
                    const newChildren = removeSelectedItems(item.children);
                    if (newChildren.length > 0) {
                        return { ...item, children: newChildren, isChecked: false };
                    }
                    return null; // Remove empty parent
                }
                return item.isChecked ? null : item;
            }).filter(Boolean);
        };

        const selectedItems = getSelectedItems(sourceItems);
        if (selectedItems.length === 0) return;

        const newSourceItems = removeSelectedItems(sourceItems);
        const newDestItems = [...destItems, ...selectedItems];

        setSourceItems(newSourceItems);
        setDestItems(newDestItems);
    };

    const moveAll = (fromAvailable) => {
        const sourceItems = fromAvailable ? availableItems : chosenItems;
        const setSourceItems = fromAvailable ? setAvailableItems : setChosenItems;
        const destItems = fromAvailable ? chosenItems : availableItems;
        const setDestItems = fromAvailable ? setChosenItems : setAvailableItems;

        // Flatten all items from tree structure
        const flattenItems = (items) => {
            let result = [];
            items.forEach(item => {
                if (item.children) {
                    result = result.concat(flattenItems(item.children));
                } else {
                    result.push({ ...item, isChecked: false });
                }
            });
            return result;
        };

        const flattened = flattenItems(sourceItems);
        setDestItems([...destItems, ...flattened]);
        setSourceItems([]);
    };

    const onOptionSelect = (event, index, isChosen) => {
        const items = isChosen ? chosenItems : availableItems;
        const setItems = isChosen ? setChosenItems : setAvailableItems;

        const newItems = [...items];
        if (newItems[index]) {
            newItems[index] = { ...newItems[index], isChecked: !newItems[index].isChecked };
            setItems(newItems);
        }
    };

    const onTreeOptionCheck = (event, isChecked, itemData, isChosen) => {
        const items = isChosen ? chosenItems : availableItems;
        const setItems = isChosen ? setChosenItems : setAvailableItems;

        // Update the item in the tree structure
        const updateItemInTree = (items, targetId, newChecked) => {
            return items.map(item => {
                if (item.id === targetId) {
                    return { ...item, isChecked: newChecked };
                }
                if (item.children) {
                    return { ...item, children: updateItemInTree(item.children, targetId, newChecked) };
                }
                return item;
            });
        };

        setItems(updateItemInTree(items, itemData.id, isChecked));
    };

    const handleTargetHerdChange = (newHerdValue) => {
        if (chosenItems.length > 0 && targetHerdName !== newHerdValue) {
            setPendingHerdChange(newHerdValue);
            setShowUnsavedWarning(true);
        } else {
            setTargetHerdName(newHerdValue);
            if (newHerdValue === '+ New Herd') {
                setIsCreatingNewHerd(true);
                setTargetHerdName('');
                setChosenItems([]); // Clear chosen items when creating new herd
            } else {
                setIsCreatingNewHerd(false);
                // FIXED: Load cattle from selected herd
                if (newHerdValue && useCase === 3) {
                    loadRightHerdCattle(newHerdValue);
                }
            }
        }
    };

    const loadRightHerdCattle = async (herdName) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/herd/${encodeURIComponent(herdName)}/animals`, { credentials: 'include' });
            const data = await response.json();
            setChosenItems(convertCowsToTreeData(data.animals || []));
        } catch (error) {
            console.error('Error loading right herd cattle:', error);
            setChosenItems([]);
        } finally {
            setLoading(false);
        }
    };

    const confirmHerdChange = async () => {
        await handleSave();
        setTargetHerdName(pendingHerdChange);
        if (pendingHerdChange === '+ New Herd') {
            setIsCreatingNewHerd(true);
            setTargetHerdName('');
            setChosenItems([]);
        } else {
            setIsCreatingNewHerd(false);
            if (pendingHerdChange && useCase === 3) {
                loadRightHerdCattle(pendingHerdChange);
            }
        }
        setShowUnsavedWarning(false);
        setPendingHerdChange(null);
    };

    const discardAndSwitch = () => {
        setTargetHerdName(pendingHerdChange);
        if (pendingHerdChange === '+ New Herd') {
            setIsCreatingNewHerd(true);
            setTargetHerdName('');
            setChosenItems([]);
        } else {
            setIsCreatingNewHerd(false);
            if (pendingHerdChange && useCase === 3) {
                loadRightHerdCattle(pendingHerdChange);
            }
        }
        setShowUnsavedWarning(false);
        setPendingHerdChange(null);
    };

    const handleSave = async () => {
        try {
            if (useCase === 1 || (useCase === 2 && isCreatingNewHerd)) {
                const createResponse = await fetch('/api/herds/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        herdName: newHerdName || targetHerdName,
                        cows: chosenItems.map(item => item.id)
                    })
                });

                if (!createResponse.ok) {
                    throw new Error('Failed to create herd');
                }
            } else {
                const moveResponse = await fetch('/api/herds/batch-move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        cowTags: chosenItems.map(item => item.id),
                        targetHerd: targetHerdName,
                        sourceHerd: leftHerd
                    })
                });

                if (!moveResponse.ok) {
                    throw new Error('Failed to move cows');
                }
            }

            if (useCase === 1) {
                onSave();
                onClose();
            } else {
                setSaveButtonText('Exit');
                alert('Successfully saved changes!');
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('Error saving changes');
        }
    };

    const handleExit = () => {
        onClose();
    };

    // Get cows for autocomplete - filter by left herd if applicable
    const getAvailableCowsForSearch = (isAvailable = true) => {
        if (isAvailable) {
            if (leftHerd) {
                return allCows.filter(cow => cow.CurrentHerd === leftHerd);
            }
            return allCows;
        } else {
            // For chosen side, return cows from the target herd if it exists
            if (targetHerdName && !isCreatingNewHerd) {
                return allCows.filter(cow => cow.CurrentHerd === targetHerdName);
            }
            return chosenItems.map(item => ({ CowTag: item.id, CurrentHerd: targetHerdName }));
        }
    };

    // Convert cows to AutoCombobox options format
    const getCowOptions = (isAvailable = true) => {
        const cows = getAvailableCowsForSearch(isAvailable);
        return cows.map(cow => ({
            name: cow.CowTag || cow.GoatTag,
            value: cow.CowTag || cow.GoatTag
        }));
    };

    const buildEmptyState = (isAvailable) => (
        <EmptyState titleText="No results found" variant={EmptyStateVariant.sm} headingLevel="h4" icon={SearchIcon}>
            <EmptyStateBody>No results match the filter criteria. Clear all filters and try again.</EmptyStateBody>
            <EmptyStateFooter>
                <EmptyStateActions>
                    <Button
                        variant="link"
                        onClick={() => isAvailable ? setAvailableFilter('') : setChosenFilter('')}
                    >
                        Clear all filters
                    </Button>
                </EmptyStateActions>
            </EmptyStateFooter>
        </EmptyState>
    );

    const hasSelectedItems = (items) => {
        return items.some(item => {
            if (item.children) {
                return hasSelectedItems(item.children);
            }
            return item.isChecked;
        });
    };

    if (loading) {
        return <div>Loading herd data...</div>;
    }

    const filteredAvailable = filterItems(availableItems, availableFilter);
    const filteredChosen = filterItems(chosenItems, chosenFilter);

    return (
        <>
            <div style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
                {/* Title and herd selection */}
                <div style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>
                            {useCase === 1 ? 'Create New Herd' :
                                useCase === 2 ? `Split Herd: ${leftHerd}` :
                                    `Move between ${leftHerd} and ${targetHerdName || rightHerd || 'Target'}`}
                        </h3>

                        {/* Target herd selection aligned to right */}
                        {(useCase === 2 || useCase === 3) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {isCreatingNewHerd ? (
                                    <>
                                        <label>New Herd Name:</label>
                                        <input
                                            type="text"
                                            value={newHerdName}
                                            onChange={(e) => setNewHerdName(e.target.value)}
                                            style={{ padding: '5px', border: '1px solid #ccc', borderRadius: '3px' }}
                                            placeholder="Enter new herd name"
                                        />
                                        <button
                                            onClick={() => {
                                                setIsCreatingNewHerd(false);
                                                setNewHerdName('');
                                            }}
                                            style={{ padding: '5px 10px', border: '1px solid #ccc', borderRadius: '3px' }}
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <label>Target Herd:</label>
                                        <select
                                            value={targetHerdName}
                                            onChange={(e) => handleTargetHerdChange(e.target.value)}
                                            style={{ padding: '5px', border: '1px solid #ccc', borderRadius: '3px' }}
                                        >
                                            <option value="">Select target herd</option>
                                            {existingHerds
                                                .filter(herd => herd !== leftHerd)
                                                .map(herd => (
                                                    <option key={herd} value={herd}>{herd}</option>
                                                ))
                                            }
                                            <option value="+ New Herd">+ New Herd</option>
                                        </select>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* New herd name input for case 1 */}
                    {useCase === 1 && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>New Herd Name:</label>
                            <input
                                type="text"
                                value={newHerdName}
                                onChange={(e) => setNewHerdName(e.target.value)}
                                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '3px', width: '300px' }}
                                placeholder="Enter new herd name"
                            />
                            {existingHerds.includes(newHerdName) && (
                                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                                    Herd name already exists
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* DualListSelector */}
                <div style={{ flex: 1, padding: '15px' }}>
                    <DualListSelector>
                        {/* Available Pane */}
                        <DualListSelectorPane
                            title={useCase === 1 ? "All Available Cows" : `Cows in ${leftHerd}`}
                            searchInput={
                                <AutoCombobox
                                    options={getCowOptions(true)}
                                    value={availableFilter}
                                    onChange={setAvailableFilter}
                                    placeholder="Search available cows..."
                                    allowCustomValue={true}
                                />
                            }
                            status={`${filteredAvailable.length} options available`}
                            listMinHeight="200px"
                            style={{
                                flex: 1,
                                minWidth: '150px',
                                overflow: 'hidden'
                            }}
                        >
                            {availableFilter !== '' && filteredAvailable.length === 0 && buildEmptyState(true)}

                            {useCase === 1 ? (
                                <DualListSelectorTree
                                    data={filteredAvailable}
                                    onOptionCheck={(event, isChecked, itemData) =>
                                        onTreeOptionCheck(event, isChecked, itemData, false)
                                    }
                                />
                            ) : (
                                <DualListSelectorList>
                                    {filteredAvailable.map((option, index) => (
                                        <DualListSelectorListItem
                                            key={option.id}
                                            isSelected={option.isChecked}
                                            id={`available-option-${index}`}
                                            onOptionSelect={(e) => onOptionSelect(e, index, false)}
                                        >
                                            {option.text}
                                        </DualListSelectorListItem>
                                    ))}
                                </DualListSelectorList>
                            )}
                        </DualListSelectorPane>

                        {/* Controls */}
                        <DualListSelectorControlsWrapper>
                            <DualListSelectorControl
                                isDisabled={!hasSelectedItems(availableItems)}
                                onClick={() => moveSelected(true)}
                                aria-label="Add selected"
                                icon={<AngleRightIcon />}
                            />
                            <DualListSelectorControl
                                isDisabled={availableItems.length === 0}
                                onClick={() => moveAll(true)}
                                aria-label="Add all"
                                icon={<AngleDoubleRightIcon />}
                            />
                            <DualListSelectorControl
                                isDisabled={chosenItems.length === 0}
                                onClick={() => moveAll(false)}
                                aria-label="Remove all"
                                icon={<AngleDoubleLeftIcon />}
                            />
                            <DualListSelectorControl
                                isDisabled={!hasSelectedItems(chosenItems)}
                                onClick={() => moveSelected(false)}
                                aria-label="Remove selected"
                                icon={<AngleLeftIcon />}
                            />
                        </DualListSelectorControlsWrapper>

                        {/* Chosen Pane */}
                        <DualListSelectorPane
                            isChosen
                            title={useCase === 1 || isCreatingNewHerd ?
                                "New Herd" :
                                `Cows in ${targetHerdName || rightHerd || 'Target Herd'}`}
                            searchInput={
                                <AutoCombobox
                                    options={getCowOptions(false)}
                                    value={chosenFilter}
                                    onChange={setChosenFilter}
                                    placeholder="Search chosen cows..."
                                    allowCustomValue={true}
                                />
                            }
                            status={`${filteredChosen.length} options available`}
                            listMinHeight="200px"
                            style={{ 
                                flex: 1, 
                                minWidth: '150px',
                                overflow: 'hidden'
                            }}
                        >
                            {chosenFilter !== '' && filteredChosen.length === 0 && buildEmptyState(false)}

                            <DualListSelectorList>
                                {filteredChosen.map((option, index) => (
                                    <DualListSelectorListItem
                                        key={option.id}
                                        isSelected={option.isChecked}
                                        id={`chosen-option-${index}`}
                                        onOptionSelect={(e) => onOptionSelect(e, index, true)}
                                    >
                                        {option.text}
                                    </DualListSelectorListItem>
                                ))}
                            </DualListSelectorList>
                        </DualListSelectorPane>
                    </DualListSelector>
                </div>

                {/* Action buttons */}
                <div style={{
                height: '10vh', // 10% of viewport height
                padding: '15px',
                borderTop: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                alignItems: 'center', // Center buttons vertically
                flexShrink: 0 // Prevent shrinking
            }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={saveButtonText === 'Exit' ? handleExit : handleSave}
                        disabled={
                            (useCase === 1 && (!newHerdName || existingHerds.includes(newHerdName) || chosenItems.length === 0)) ||
                            ((useCase === 2 || useCase === 3) && chosenItems.length === 0 && saveButtonText !== 'Exit')
                        }
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            opacity:
                                (useCase === 1 && (!newHerdName || existingHerds.includes(newHerdName) || chosenItems.length === 0)) ||
                                    ((useCase === 2 || useCase === 3) && chosenItems.length === 0 && saveButtonText !== 'Exit')
                                    ? 0.6 : 1
                        }}
                    >
                        {saveButtonText}
                    </button>
                </div>
            </div>

            {/* Unsaved Changes Warning Popup */}
            {showUnsavedWarning && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '5px',
                        maxWidth: '400px'
                    }}>
                        <h4>You have unsaved movements</h4>
                        <p>Switching herds will discard your current selections. Save and switch?</p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowUnsavedWarning(false)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={discardAndSwitch}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer'
                                }}
                            >
                                Discard and Switch
                            </button>
                            <button
                                onClick={confirmHerdChange}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: '1px solid #28a745',
                                    borderRadius: '3px',
                                    cursor: 'pointer'
                                }}
                            >
                                Save and Switch
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default HerdSplitter;