import React, { useState, useEffect } from 'react';
import '../cow-data.css';

function TagGenerator({ 
  baseTag = '', 
  onTagSelected, 
  onClose,
  allowReusable = false,
  allowCustom = false
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [enableReusable, setEnableReusable] = useState(allowReusable);
  const [showReusablePopup, setShowReusablePopup] = useState(false);

  useEffect(() => {
    if (baseTag || baseTag === '') {
      generateSuggestions();
    }
  }, [baseTag, enableReusable]);

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tag-suggestions/${encodeURIComponent(baseTag || 'default')}?reusable=${enableReusable}`, 
        {
          credentials: 'include'
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } else {
        const error = await response.json();
        if (error.message && error.message.includes('reusable tags feature requires database changes')) {
          setShowReusablePopup(true);
          setEnableReusable(false);
        }
        console.error('Failed to generate tag suggestions');
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error generating tag suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (tag) => {
    if (onTagSelected) {
      onTagSelected(tag);
    }
  };

  const handleCustomTagSubmit = () => {
    if (customTag.trim() && onTagSelected) {
      onTagSelected(customTag.trim());
    }
  };

  const handleReusableToggle = () => {
    if (!enableReusable) {
      setShowReusablePopup(true);
    } else {
      setEnableReusable(false);
    }
  };

  const confirmReusable = () => {
    setEnableReusable(true);
    setShowReusablePopup(false);
    generateSuggestions();
  };

  return (
    <div style={{ padding: '20px', background: 'white' }}>
      <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>
        Tag Generator
      </h3>

      {/* Base Tag Info */}
      {baseTag && (
        <div style={{
          backgroundColor: '#e3f2fd',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <strong>Base Tag:</strong> {baseTag}
        </div>
      )}

      {/* Reusable Option */}
      <div style={{
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '5px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={enableReusable}
            onChange={handleReusableToggle}
            style={{ transform: 'scale(1.2)' }}
          />
          <label style={{ fontWeight: 'bold', color: '#856404' }}>
            Enable reusability of inactive tags
          </label>
        </div>
        <div style={{ fontSize: '12px', color: '#856404' }}>
          Allow using tags from dead/sold animals (requires database changes)
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#666'
        }}>
          Generating suggestions...
        </div>
      )}

      {/* Suggestions */}
      {!loading && suggestions.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '15px', color: '#333' }}>
            Suggested Tags:
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '10px'
          }}>
            {suggestions.map((tag, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(tag)}
                className="button"
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Suggestions */}
      {!loading && suggestions.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#666',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          No suggestions available for the given base tag.
        </div>
      )}


      {/* Custom Tag Input */}
      {allowCustom && (
        <div style={{
          padding: '15px',
          marginBottom: '20px'
        }}>
          <h4 style={{ marginBottom: '10px', color: '#333' }}>
            Or enter custom tag:
          </h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Enter custom tag"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                fontSize: '16px'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCustomTagSubmit();
                }
              }}
            />
            <button
              onClick={handleCustomTagSubmit}
              disabled={!customTag.trim()}
              className="button"
              style={{
                padding: '8px 16px',
                backgroundColor: customTag.trim() ? '#007bff' : '#6c757d',
                color: 'white',
                opacity: customTag.trim() ? 1 : 0.6,
                cursor: customTag.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              Use This Tag
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={onClose}
          className="button"
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white'
          }}
        >
          Cancel
        </button>
        
        <button
          onClick={() => generateSuggestions()}
          className="button"
          style={{
            padding: '10px 20px',
            backgroundColor: '#17a2b8',
            color: 'white'
          }}
        >
          Refresh Suggestions
        </button>
      </div>

      {/* Tag Generation Rules */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '5px',
        fontSize: '12px',
        color: '#666'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Tag Generation Rules:</div>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Letter suggestions: Append 'a', 'b', 'c', etc. to base tag</li>
          <li>Parent-based: Use parent tag as base for offspring suggestions</li>
          <li>Numeric suggestions: Find nearest unused numbers (range 0-1000)</li>
          <li>Suggestions prioritize uniqueness and avoid existing active tags</li>
        </ul>
      </div>

      {/* Reusable Feature Popup */}
      {showReusablePopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#dc3545', marginBottom: '20px' }}>
              Feature Not Available
            </h3>
            <p style={{ marginBottom: '20px', lineHeight: '1.5' }}>
              The reusable tags feature requires changes to the database before it can be completed. 
              This feature would allow reusing tags from inactive animals (dead/sold/etc.).
            </p>
            <p style={{ marginBottom: '30px', fontSize: '14px', color: '#666' }}>
              For now, inactive animal tags are excluded from suggestions.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowReusablePopup(false)}
                className="button"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmReusable}
                className="button"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ffc107',
                  color: 'black'
                }}
              >
                Enable Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TagGenerator;