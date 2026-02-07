import React, { useState, useEffect, useCallback } from 'react';
import AutoCombobox from './autoCombobox';

// Custom AutoCombobox component with proper search behavior
const SearchAutoCombobox = ({
  options = [],
  value = '',
  onChange = () => {},
  onSelect = () => {},
  onKeyDown = () => {},
  placeholder = 'Select or type...',
  disabled = false,
  style = {},
  searchPlaceholder = 'Search options...',
  emptyMessage = 'No matching options found',
  allowCustomValue = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [inputValue, setInputValue] = useState(value);

  // Normalize options to consistent format
  const normalizedOptions = options.map(option => 
    typeof option === 'string' ? { name: option, value: option } : option
  );

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdown = event.target.closest('.search-combobox');
      if (!dropdown) {
        setIsOpen(false);
        setSearchFilter('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getFilteredOptions = () => {
    if (!searchFilter) return normalizedOptions;
    return normalizedOptions.filter(option =>
      option.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      option.value.toLowerCase().includes(searchFilter.toLowerCase())
    );
  };

  const getDisplayValue = () => {
    const option = normalizedOptions.find(opt => opt.value === inputValue);
    return option ? option.name : inputValue;
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
      setSearchFilter('');
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSearchFilter(newValue);
    onChange(newValue);
  };

  const handleOptionSelect = (option) => {
    setInputValue(option.value);
    setSearchFilter('');
    setIsOpen(false);
    onChange(option.value);
    onSelect(option.value);
  };

  const handleInputKeyDown = (e) => {
    onKeyDown(e);
    
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchFilter('');
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true);
      setSearchFilter('');
    }
  };

  return (
    <div className="search-combobox" style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={isOpen ? searchFilter : getDisplayValue()}
        onChange={handleInputChange}
        onClick={handleInputClick}
        onKeyDown={handleInputKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          width: '100%',
          cursor: disabled ? 'not-allowed' : 'text',
          backgroundColor: disabled ? '#f5f5f5' : 'white',
          fontSize: '20px',
          padding: '8px 12px',
          border: '1px solid #ccc',
          borderRadius: '4px 0 0 4px',
          outline: 'none'
        }}
      />
      
      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {/* Search indicator when filtering */}
          {searchFilter && (
            <div style={{ 
              padding: '8px', 
              borderBottom: '1px solid #eee',
              fontSize: '11px',
              color: '#666',
              fontStyle: 'italic'
            }}>
              {getFilteredOptions().length} matches for "{searchFilter}"
            </div>
          )}
          
          {/* Options */}
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {getFilteredOptions().length > 0 ? (
              getFilteredOptions().map((option, idx) => (
                <div
                  key={idx}
                  onClick={() => handleOptionSelect(option)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: idx < getFilteredOptions().length - 1 ? '1px solid #f5f5f5' : 'none',
                    fontSize: '12px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'white';
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{option.name}</div>
                  {option.value !== option.name && (
                    <div style={{ color: '#666', fontSize: '11px' }}>{option.value}</div>
                  )}
                </div>
              ))
            ) : (
              <div style={{
                padding: '12px',
                textAlign: 'center',
                color: '#666',
                fontSize: '12px'
              }}>
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function SearchBar({ 
  onSearch, 
  placeholder = "Search by tag", 
  buttonImage = "/images/search-icon.png",
  value = "", // Controlled value prop
  cowOptions = [], // Array of cow options for autocomplete
  herdFilter = null // Optional herd to filter cows by
}) {
  const [searchValue, setSearchValue] = useState(value);
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // GLOBAL HISTORY, load from sessionStorage on mount
  useEffect(() => {
    try {
      const savedHistory = sessionStorage.getItem('cowSearchHistory');
      const savedIndex = sessionStorage.getItem('cowSearchCurrentIndex');
      
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory);
        
        if (savedIndex !== null) {
          setCurrentIndex(parseInt(savedIndex, 10));
        }
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  }, []);

  // Update searchValue when value prop changes
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  // Add current cow to history when value prop changes (from URL navigation)
  useEffect(() => {
    if (value && value.trim() !== '' && value !== history[currentIndex]) {
      const newHistory = [...history];
      
      if (currentIndex < history.length - 1) {
        newHistory.splice(currentIndex + 1);
      }
      
      newHistory.push(value);
      const newIndex = newHistory.length - 1;
      
      try {
        sessionStorage.setItem('cowSearchHistory', JSON.stringify(newHistory));
        sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
      } catch (error) {
        console.error('Error saving search history:', error);
      }
      
      setHistory(newHistory);
      setCurrentIndex(newIndex);
    }
  }, [value, history, currentIndex]);

  const handleNavigation = useCallback((newCow) => {
    if (!newCow || newCow.trim() === '') {
      return;
    }
    
    const newHistory = [...history];
    
    if (currentIndex < history.length - 1) {
      newHistory.splice(currentIndex + 1);
    }
    
    if (newCow !== history[currentIndex]) {
      newHistory.push(newCow);
      const newIndex = newHistory.length - 1;
      
      try {
        sessionStorage.setItem('cowSearchHistory', JSON.stringify(newHistory));
        sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
      } catch (error) {
        console.error('Error saving search history:', error);
      }
      
      setHistory(newHistory);
      setCurrentIndex(newIndex);
    }
    
    setSearchValue(newCow);
    onSearch(newCow);
  }, [history, currentIndex, onSearch]);

  // Expose handleNavigation to parent components
  useEffect(() => {
    const searchBarElement = document.getElementById('search-bar-container');
    if (searchBarElement) {
      searchBarElement.navigate = handleNavigation;
    }
  }, [handleNavigation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      handleNavigation(searchValue.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleOptionSelect = (selectedValue) => {
    setSearchValue(selectedValue);
    // Auto-submit when an option is selected from dropdown
    handleNavigation(selectedValue);
  };

  const handleComboboxChange = (newValue) => {
    setSearchValue(newValue);
    // Don't auto-submit on change, only update the input value
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const previousCow = history[newIndex];
      
      try {
        sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
      } catch (error) {
        console.error('Error saving search index:', error);
      }
      
      setCurrentIndex(newIndex);
      setSearchValue(previousCow);
      onSearch(previousCow);
    }
  };

  const handleForward = () => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      const nextCow = history[newIndex];
      
      try {
        sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
      } catch (error) {
        console.error('Error saving search index:', error);
      }
      
      setCurrentIndex(newIndex);
      setSearchValue(nextCow);
      onSearch(nextCow);
    }
  };

  // Prepare options for AutoCombobox
  const getFilteredOptions = () => {
    let filteredCows = cowOptions;
    
    // Filter by herd if specified
    if (herdFilter) {
      filteredCows = cowOptions.filter(cow => 
        cow.CurrentHerd === herdFilter || 
        (cow.herd && cow.herd === herdFilter) ||
        (!cow.CurrentHerd && !cow.herd && herdFilter === 'Unassigned')
      );
    }
    
    // Convert to AutoCombobox format
    return filteredCows.map(cow => ({
      name: cow.CowTag || cow.tag || cow.name || cow,
      value: cow.CowTag || cow.tag || cow.name || cow
    }));
  };

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;
  const showNavigation = history.length > 1;

  const imageStyle = {
    position: 'absolute',
    top: '0%',
    left: '0%',
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  };

  const buttonStyle = {
    padding: '5px 10px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    minWidth: '80px'
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  };

  // If no cowOptions provided, fall back to original input behavior
  const useAutoComplete = cowOptions.length > 0;

  return (
    <div id="search-bar-container">
      {/* Search form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
        {useAutoComplete ? (
          <AutoCombobox
            options={getFilteredOptions()}
            value={searchValue}
            onChange={handleComboboxChange}
            placeholder={placeholder}
            allowCustomValue={true}
            style={{
              fontSize: '20px', // Prevent iOS zoom
              padding: '8px 7px',
              outline: 'none',
            }}
            searchPlaceholder={`Search ${herdFilter ? `in ${herdFilter}` : 'all cows'}...`}
            emptyMessage={`No animals found${herdFilter ? ` in ${herdFilter}` : ''}`}
            onKeyDown={handleKeyDown}
            onSelect={handleOptionSelect}
          />
        ) : (
          <input 
            id="search-bar"
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={placeholder}
            style={{
              fontSize: '20px', // Prevent iOS zoom
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px 0 0 4px',
              outline: 'none'
            }}
            required
          />
        )}
        <button
          id="search-button"
          type="submit"
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderLeft: 'none',
            borderRadius: '0 4px 4px 0',
            backgroundColor: '#7dbdce', // Restored original blue color
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img src={buttonImage} alt="Search" style={imageStyle} />
        </button>
      </form>
      
      {/* Navigation buttons underneath */}
      {showNavigation && (
        <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={handleBack}
            disabled={!canGoBack}
            style={canGoBack ? buttonStyle : disabledButtonStyle}
          >
            ← {canGoBack ? history[currentIndex - 1] : 'Back'}
          </button>
          <button
            type="button"
            onClick={handleForward}
            disabled={!canGoForward}
            style={canGoForward ? buttonStyle : disabledButtonStyle}
          >
            {canGoForward ? history[currentIndex + 1] : 'Fwd'} →
          </button>
        </div>
      )}
    </div>
  );
}

export default SearchBar;