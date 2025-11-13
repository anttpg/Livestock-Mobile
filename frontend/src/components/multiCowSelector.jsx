import React, { useState, useEffect } from 'react';
import { TreeView } from '@patternfly/react-core';

// Option 1: Custom Implementation
function MultiCowSelectorCustom({ 
  cowList = [], 
  selected = () => {}, 
  unselected = () => {},
  displayParams = { showDOB: false }, // For now just toggle for DOB
  displayByHerd = false,
  onClose = null // For cancel functionality
}) {
  const [selectedCows, setSelectedCows] = useState(new Set());
  const [expandedHerds, setExpandedHerds] = useState(new Set());
  const [showDOB, setShowDOB] = useState(displayParams.showDOB || false);

  // Group cows by herd if displayByHerd is enabled
  const groupedData = displayByHerd ? groupCowsByHerd(cowList) : { 'All Cows': cowList };

  function groupCowsByHerd(cows) {
    const grouped = {};
    
    cows.forEach(cow => {
      const herdName = cow.CurrentHerd || 'Unassigned';
      if (!grouped[herdName]) {
        grouped[herdName] = [];
      }
      grouped[herdName].push(cow);
    });

    // Sort herds alphabetically, with Unassigned last
    const sortedHerds = {};
    Object.keys(grouped)
      .sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return a.localeCompare(b);
      })
      .forEach(herdName => {
        sortedHerds[herdName] = grouped[herdName];
      });

    return sortedHerds;
  }

  const toggleCowSelection = (cowTag) => {
    const newSelected = new Set(selectedCows);
    if (newSelected.has(cowTag)) {
      newSelected.delete(cowTag);
    } else {
      newSelected.add(cowTag);
    }
    setSelectedCows(newSelected);
  };

  const toggleHerdSelection = (herdName) => {
    const herdCows = groupedData[herdName] || [];
    const herdTags = herdCows.map(cow => cow.CowTag);
    
    // Check if all cows in herd are selected
    const allSelected = herdTags.every(tag => selectedCows.has(tag));
    
    const newSelected = new Set(selectedCows);
    if (allSelected) {
      // Deselect all
      herdTags.forEach(tag => newSelected.delete(tag));
    } else {
      // Select all
      herdTags.forEach(tag => newSelected.add(tag));
    }
    setSelectedCows(newSelected);
  };

  const toggleHerdExpansion = (herdName) => {
    const newExpanded = new Set(expandedHerds);
    if (newExpanded.has(herdName)) {
      newExpanded.delete(herdName);
    } else {
      newExpanded.add(herdName);
    }
    setExpandedHerds(newExpanded);
  };

  const handleSubmit = () => {
    const selectedCowObjects = cowList.filter(cow => selectedCows.has(cow.CowTag));
    const unselectedCowObjects = cowList.filter(cow => !selectedCows.has(cow.CowTag));
    
    selected(selectedCowObjects);
    unselected(unselectedCowObjects);
  };

  const handleCancel = () => {
    setSelectedCows(new Set());
    if (onClose) onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Initialize expanded herds (Unassigned expanded by default)
  useEffect(() => {
    if (displayByHerd) {
      setExpandedHerds(new Set(['Unassigned']));
    }
  }, [displayByHerd]);

  return (
    <div style={{ 
      height: '500px', 
      display: 'flex', 
      flexDirection: 'column',
      border: '1px solid #ccc',
      borderRadius: '5px'
    }}>
      {/* Header with DOB toggle */}
      <div style={{ 
        padding: '10px 15px', 
        borderBottom: '1px solid #ddd',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0 }}>Select Animals</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input 
            type="checkbox" 
            checked={showDOB}
            onChange={(e) => setShowDOB(e.target.checked)}
          />
          Show DOB
        </label>
      </div>

      {/* Scrollable list */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: '10px' 
      }}>
        {Object.entries(groupedData).map(([herdName, herdCows]) => (
          <div key={herdName}>
            {/* Herd header (only show if displayByHerd) */}
            {displayByHerd && (
              <div
                onClick={() => toggleHerdExpansion(herdName)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  margin: '5px 0',
                  backgroundColor: '#e3f2fd',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                <input 
                  type="checkbox"
                  checked={herdCows.every(cow => selectedCows.has(cow.CowTag))}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleHerdSelection(herdName);
                  }}
                  style={{ marginRight: '10px' }}
                />
                <span style={{ marginRight: '10px' }}>
                  {expandedHerds.has(herdName) ? '▼' : '▶'}
                </span>
                Herd: {herdName} ({herdCows.length})
              </div>
            )}

            {/* Cow list (show if not grouped by herd, or if herd is expanded) */}
            {(!displayByHerd || expandedHerds.has(herdName)) && 
              herdCows.map((cow) => (
                <div
                  key={cow.CowTag}
                  onClick={() => toggleCowSelection(cow.CowTag)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 10px',
                    margin: '2px 0',
                    marginLeft: displayByHerd ? '30px' : '0px', // Indent if under herd
                    backgroundColor: selectedCows.has(cow.CowTag) ? '#fff3cd' : '#f9f9f9',
                    border: selectedCows.has(cow.CowTag) ? '2px solid #ffc107' : '1px solid #ddd',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input 
                    type="checkbox"
                    checked={selectedCows.has(cow.CowTag)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleCowSelection(cow.CowTag);
                    }}
                    style={{ marginRight: '10px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 'bold' }}>{cow.CowTag}</span>
                    {showDOB && cow.DateOfBirth && (
                      <span style={{ marginLeft: '15px', color: '#666' }}>
                        DOB: {formatDate(cow.DateOfBirth)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ 
        padding: '15px', 
        borderTop: '1px solid #ddd',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={handleCancel}
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
          onClick={handleSubmit}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Select ({selectedCows.size})
        </button>
      </div>
    </div>
  );
}

// Option 2: PatternFly TreeView Implementation
function MultiCowSelectorPatternFly({ 
  cowList = [], 
  selected = () => {}, 
  unselected = () => {},
  displayParams = { showDOB: false },
  displayByHerd = false,
  onClose = null
}) {
  const [checkedItems, setCheckedItems] = useState([]);
  const [showDOB, setShowDOB] = useState(displayParams.showDOB || false);

  // Convert cow data to PatternFly TreeView format
  const convertToTreeViewData = () => {
    if (!displayByHerd) {
      // Simple flat list
      return cowList.map(cow => ({
        name: showDOB && cow.DateOfBirth ? 
          `${cow.CowTag} - DOB: ${formatDate(cow.DateOfBirth)}` : 
          cow.CowTag,
        id: cow.CowTag,
        checkProps: { checked: false, 'aria-label': `Select ${cow.CowTag}` },
        cowData: cow
      }));
    } else {
      // Grouped by herd
      const grouped = {};
      cowList.forEach(cow => {
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
          name: `Herd: ${herdName}`,
          id: `herd-${herdName}`,
          checkProps: { checked: false, 'aria-label': `Select all in ${herdName}` },
          defaultExpanded: herdName === 'Unassigned',
          children: herdCows.map(cow => ({
            name: showDOB && cow.DateOfBirth ? 
              `${cow.CowTag} - DOB: ${formatDate(cow.DateOfBirth)}` : 
              cow.CowTag,
            id: cow.CowTag,
            checkProps: { checked: false, 'aria-label': `Select ${cow.CowTag}` },
            cowData: cow
          }))
        }));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const onCheck = (event, treeViewItem) => {
    const checked = event.target.checked;
    
    // Handle selection logic similar to PatternFly example
    const treeViewData = convertToTreeViewData();
    const checkedItemTree = treeViewData
      .map(opt => Object.assign({}, opt))
      .filter(item => filterItems(item, treeViewItem));
    const flatCheckedItems = flattenTree(checkedItemTree);

    setCheckedItems(prevCheckedItems =>
      checked
        ? prevCheckedItems.concat(flatCheckedItems.filter(item => !checkedItems.some(i => i.id === item.id)))
        : prevCheckedItems.filter(item => !flatCheckedItems.some(i => i.id === item.id))
    );
  };

  // Helper functions for PatternFly tree logic
  const isChecked = (dataItem) => checkedItems.some(item => item.id === dataItem.id);
  const areAllDescendantsChecked = (dataItem) =>
    dataItem.children ? dataItem.children.every(child => areAllDescendantsChecked(child)) : isChecked(dataItem);
  const areSomeDescendantsChecked = (dataItem) =>
    dataItem.children ? dataItem.children.some(child => areSomeDescendantsChecked(child)) : isChecked(dataItem);

  const flattenTree = (tree) => {
    let result = [];
    tree.forEach(item => {
      result.push(item);
      if (item.children) {
        result = result.concat(flattenTree(item.children));
      }
    });
    return result;
  };

  const mapTree = (item) => {
    const hasCheck = areAllDescendantsChecked(item);
    if (item.checkProps) {
      item.checkProps.checked = false;

      if (hasCheck) {
        item.checkProps.checked = true;
      } else {
        const hasPartialCheck = areSomeDescendantsChecked(item);
        if (hasPartialCheck) {
          item.checkProps.checked = null;
        }
      }

      if (item.children) {
        return {
          ...item,
          children: item.children.map(child => mapTree(child))
        };
      }
    }
    return item;
  };

  const filterItems = (item, checkedItem) => {
    if (item.id === checkedItem.id) {
      return true;
    }

    if (item.children) {
      return (
        (item.children = item.children
          .map(opt => Object.assign({}, opt))
          .filter(child => filterItems(child, checkedItem))).length > 0
      );
    }
  };

  const handleSubmit = () => {
    // Get actual cow objects for selected items
    const selectedCowTags = checkedItems
      .filter(item => !item.id.startsWith('herd-')) // Exclude herd nodes
      .map(item => item.id);
    
    const selectedCowObjects = cowList.filter(cow => selectedCowTags.includes(cow.CowTag));
    const unselectedCowObjects = cowList.filter(cow => !selectedCowTags.includes(cow.CowTag));
    
    selected(selectedCowObjects);
    unselected(unselectedCowObjects);
  };

  const handleCancel = () => {
    setCheckedItems([]);
    if (onClose) onClose();
  };

  const treeData = convertToTreeViewData();
  const mapped = treeData.map(item => mapTree(item));

  return (
    <div style={{ 
      height: '500px', 
      display: 'flex', 
      flexDirection: 'column',
      border: '1px solid #ccc',
      borderRadius: '5px'
    }}>
      {/* Header with DOB toggle */}
      <div style={{ 
        padding: '10px 15px', 
        borderBottom: '1px solid #ddd',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0 }}>Select Animals</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input 
            type="checkbox" 
            checked={showDOB}
            onChange={(e) => setShowDOB(e.target.checked)}
          />
          Show DOB
        </label>
      </div>

      {/* PatternFly TreeView */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
        <TreeView
          hasAnimations
          aria-label="Cow Selection Tree"
          data={mapped}
          onCheck={onCheck}
          hasCheckboxes
          hasSelectableNodes
        />
      </div>

      {/* Action buttons */}
      <div style={{ 
        padding: '15px', 
        borderTop: '1px solid #ddd',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={handleCancel}
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
          onClick={handleSubmit}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Select ({checkedItems.filter(item => !item.id.startsWith('herd-')).length})
        </button>
      </div>
    </div>
  );
}

// Main component that exports both options
function MultiCowSelector(props) {
  // Toggle between implementations - set to false for PatternFly TreeView
  const useCustomImplementation = true;
  
  if (useCustomImplementation) {
    return <MultiCowSelectorCustom {...props} />;
  } else {
    return <MultiCowSelectorPatternFly {...props} />;
  }
}

export default MultiCowSelector;