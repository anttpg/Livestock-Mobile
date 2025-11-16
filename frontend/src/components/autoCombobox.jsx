import React, { useState, useEffect, useRef } from 'react';

function AutoCombobox({
  options = [], // Array of { name: string, value: string } or simple strings
  value = '',
  onChange = () => {},
  placeholder = 'Select or type...',
  disabled = false,
  style = {},
  searchPlaceholder = 'Search options...',
  emptyMessage = 'No matching options found',
  allowCustomValue = false, // If true, allows non-matching values
  required = false // If true, reverts to last valid value when invalid selection
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [inputValue, setInputValue] = useState(value);
  const [lastValidValue, setLastValidValue] = useState(value);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize options to consistent format
  const normalizedOptions = options.map(option => 
    typeof option === 'string' ? { name: option, value: option } : option
  );

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value);
    if (isValidOption(value)) {
      setLastValidValue(value);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isValidOption = (testValue) => {
    return normalizedOptions.some(option => option.value === testValue);
  };

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
    
    if (allowCustomValue) {
      onChange(newValue);
    }
  };

  const handleOptionSelect = (option) => {
    setInputValue(option.value);
    setLastValidValue(option.value);
    setSearchFilter('');
    setIsOpen(false);
    onChange(option.value);
    
    // Return focus to input
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchFilter('');

    // Validation logic
    if (required && !allowCustomValue) {
      // If required and not allowing custom values, revert to last valid value if current is invalid
      if (!isValidOption(inputValue)) {
        setInputValue(lastValidValue);
        onChange(lastValidValue);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      const filtered = getFilteredOptions();
      if (filtered.length === 1) {
        handleOptionSelect(filtered[0]);
      } else if (filtered.length === 0 && !allowCustomValue && required) {
        // No matches and not allowing custom values - revert
        setInputValue(lastValidValue);
        setSearchFilter('');
      }
    }
  };

  return (
    <div style={{ position: 'relative', ...style }} ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? searchFilter : getDisplayValue()}
        onChange={handleInputChange}
        onClick={handleInputClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '4px',
          border: '1px solid #ccc',
          borderRadius: '3px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: disabled ? '#f5f5f5' : 'white',
          ...style
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
}

export default AutoCombobox;