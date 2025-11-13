import React, { useState, useRef, useEffect } from 'react';
import Popup from './popup';

function ColorTable({ 
  data = [], 
  columns = [], 
  title = "",
  emptyMessage = "No data found",
  maxRows = null,
  onRowClick = null,
  onActionClick = null,
  actionButtonText = "VIEW",
  actionButtonColor = "#28a745",
  showActionColumn = true,
  className = "",
  style = {},
  alternatingRows = true,
  evenRowColor = "#fff",
  oddRowColor = "#f9f9f9", 
  hoverColor = "#f0f0f0",
  // New color features
  fullColorColumns = false,
  columnColors = {}, // For body cells
  headerColors = {}, // For header cells
  maxWidth = null,
  // Smart conditional coloring
  conditionalColors = {}, // { columnKey: { condition: (row) => boolean, trueColor: '#color', falseColor: '#color', trueTextColor: '#color', falseTextColor: '#color' } }
  rowConditionalColors = {}, // { condition: (row) => boolean, trueColor: '#color', falseColor: '#color' }
  // NEW: Date format control
  ShortenDate = false // If true, uses MM/DD/YYYY format instead of long format
}) {
  
  const [showPopup, setShowPopup] = useState(false);
  const [scrollDirection, setScrollDirection] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const tableRef = useRef(null);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    if (ShortenDate) {
      // Use MM/DD/YYYY format
      const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
      return new Date(dateString).toLocaleDateString('en-US', options);
    } else {
      // Use long format (existing behavior)
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    }
  };

  const formatValue = (value, type = 'text') => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (type) {
      case 'date':
        return formatDate(value);
      case 'number':
        return value.toString();
      case 'text':
      default:
        return value.toString();
    }
  };

  const shouldLimitRows = maxRows && data.length > maxRows;
  const displayData = shouldLimitRows ? data.slice(0, maxRows) : data;
  const hasMoreRows = shouldLimitRows;

  const getRowBackgroundColor = (rowIndex) => {
    if (hoveredRow === rowIndex && hoverColor && !fullColorColumns) {
      return hoverColor;
    }
    if (!alternatingRows) {
      return evenRowColor;
    }
    return rowIndex % 2 === 0 ? evenRowColor : oddRowColor;
  };

  // Smart function to get cell styling based on conditions
  const getCellStyling = (row, column, rowIndex) => {
    let backgroundColor = getRowBackgroundColor(rowIndex);
    let textColor = 'inherit';

    // Apply full column coloring first
    if (fullColorColumns && columnColors[column.key]) {
      backgroundColor = columnColors[column.key];
    }

    // Apply row conditional coloring
    for (const [conditionKey, config] of Object.entries(rowConditionalColors)) {
      if (config.condition(row)) {
        backgroundColor = config.trueColor || backgroundColor;
        textColor = config.trueTextColor || textColor;
      } else if (config.falseColor) {
        backgroundColor = config.falseColor;
        textColor = config.falseTextColor || textColor;
      }
    }

    // Apply column conditional coloring (takes precedence)
    const conditionalConfig = conditionalColors[column.key];
    if (conditionalConfig && conditionalConfig.condition) {
      if (conditionalConfig.condition(row)) {
        backgroundColor = conditionalConfig.trueColor || backgroundColor;
        textColor = conditionalConfig.trueTextColor || textColor;
      } else {
        backgroundColor = conditionalConfig.falseColor || backgroundColor;
        textColor = conditionalConfig.falseTextColor || textColor;
      }
    }

    return { backgroundColor, textColor };
  };

  const handleScroll = (e, direction) => {
    if (!scrollDirection) {
      setScrollDirection(direction);
      setTimeout(() => setScrollDirection(null), 150);
    } else if (scrollDirection !== direction) {
      e.preventDefault();
    }
  };

  const borderStyle = '1px solid #ddd';

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    margin: '0',
    tableLayout: 'fixed',
    ...(maxWidth && { maxWidth }),
    ...style
  };

  const headerStyle = {
    border: borderStyle,
    padding: '8px',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
    color: '#333',
    whiteSpace: 'nowrap'
  };

  const cellStyle = {
    border: '1px solid #eee',
    padding: '0px',
    verticalAlign: 'top',
    position: 'relative'
  };

  // Enhanced custom render that handles automatic coloring
  const renderCellContent = (column, row, rowIndex) => {
    const styling = getCellStyling(row, column, rowIndex);
    const value = row[column.key];

    // If column has custom render, use it but wrap it in the base div if it doesn't provide one
    if (column.customRender) {
      const customContent = column.customRender(value, row, rowIndex, styling);
      
      // If custom render returns a div, use it as-is; otherwise wrap it
      if (React.isValidElement(customContent) && customContent.type === 'div') {
        return customContent;
      } else {
        return (
          <div style={{
            backgroundColor: styling.backgroundColor,
            color: styling.textColor,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            minHeight: '30px',
            padding: '8px',
            boxSizing: 'border-box',
            whiteSpace: column.noWrap ? 'nowrap' : 'normal'
          }}>
            {customContent}
          </div>
        );
      }
    }

    // Default colored cell wrapper
    return (
      <div style={{
        backgroundColor: styling.backgroundColor,
        color: styling.textColor,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        minHeight: '30px',
        padding: '8px',
        boxSizing: 'border-box',
        whiteSpace: column.noWrap ? 'nowrap' : 'normal'
      }}>
        {formatValue(value, column.type)}
      </div>
    );
  };

  const PopupTable = () => (
    <div style={{ overflowX: 'auto', maxHeight: '70vh'}}>
      <table style={{...tableStyle, maxWidth: 'none'}}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th 
                key={index}
                style={{ 
                  ...headerStyle,
                  width: column.width || (column.autoWidth ? 'auto' : undefined),
                  minWidth: column.minWidth || undefined,
                  maxWidth: column.maxWidth || undefined,
                  textAlign: column.align || 'left',
                  backgroundColor: fullColorColumns 
                    ? (headerColors[column.key] || columnColors[column.key] || '#f8f9fa')
                    : (headerColors[column.key] || '#f8f9fa')
                }}
              >
                {column.header}
              </th>
            ))}
            {showActionColumn && (
              <th style={{ 
                ...headerStyle,
                width: '120px',
                textAlign: 'center'
              }}>
                Action
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={rowIndex}
              style={{ 
                cursor: onRowClick ? 'pointer' : 'default',
                backgroundColor: getRowBackgroundColor(rowIndex),
                transition: 'background-color 0.2s ease'
              }}
              onClick={() => onRowClick && onRowClick(row, rowIndex)}
              onMouseEnter={() => setHoveredRow(rowIndex)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {columns.map((column, colIndex) => (
                <td 
                  key={colIndex}
                  style={{ 
                    ...cellStyle,
                    width: column.width || (column.autoWidth ? 'auto' : undefined),
                    minWidth: column.minWidth || undefined,
                    maxWidth: column.maxWidth || undefined,
                    textAlign: column.align || 'left',
                    cursor: column.clickable ? 'pointer' : 'default',
                    color: column.clickable ? '#007bff' : 'inherit',
                    textDecoration: column.clickable ? 'underline' : 'none'
                  }}
                  onClick={(e) => {
                    if (column.onClick) {
                      e.stopPropagation();
                      column.onClick(row, column.key);
                    }
                  }}
                >
                  {renderCellContent(column, row, rowIndex)}
                </td>
              ))}
              {showActionColumn && (
                <td style={{ 
                  ...cellStyle,
                  width: '100px',
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    width: '100%',
                    height: '100%',
                    minHeight: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    backgroundColor: getRowBackgroundColor(rowIndex)
                  }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onActionClick && onActionClick(row, rowIndex);
                      }}
                      style={{ 
                        padding: '5px 15px',
                        backgroundColor: actionButtonColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      {actionButtonText}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        fontStyle: 'italic',
        color: '#666',
        border: '2px dashed #ccc',
        borderRadius: '5px'
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <table 
        ref={tableRef}
        style={tableStyle}
        className={className}
        onWheel={(e) => handleScroll(e, 'vertical')}
        onTouchStart={() => setScrollDirection(null)}
      >
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th 
                key={index}
                style={{ 
                  ...headerStyle,
                  width: column.width || (column.autoWidth ? 'auto' : undefined),
                  minWidth: column.minWidth || undefined,
                  maxWidth: column.maxWidth || undefined,
                  textAlign: column.align || 'left',
                  backgroundColor: fullColorColumns 
                    ? (headerColors[column.key] || columnColors[column.key] || '#f8f9fa')
                    : (headerColors[column.key] || '#f8f9fa')
                }}
              >
                {column.header}
              </th>
            ))}
            {showActionColumn && (
              <th style={{ 
                ...headerStyle,
                width: '80px',
                textAlign: 'center'
              }}>
                Action
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, rowIndex) => (
            <tr 
              key={rowIndex}
              style={{ 
                cursor: onRowClick ? 'pointer' : 'default',
                backgroundColor: getRowBackgroundColor(rowIndex),
                transition: 'background-color 0.2s ease'
              }}
              onClick={() => onRowClick && onRowClick(row, rowIndex)}
              onMouseEnter={() => setHoveredRow(rowIndex)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {columns.map((column, colIndex) => (
                <td 
                  key={colIndex}
                  style={{ 
                    ...cellStyle,
                    width: column.width || (column.autoWidth ? 'auto' : undefined),
                    minWidth: column.minWidth || undefined,
                    maxWidth: column.maxWidth || undefined,
                    textAlign: column.align || 'left',
                    cursor: column.clickable ? 'pointer' : 'default',
                    color: column.clickable ? '#007bff' : 'inherit',
                    textDecoration: column.clickable ? 'underline' : 'none'
                  }}
                  onClick={(e) => {
                    if (column.onClick) {
                      e.stopPropagation();
                      column.onClick(row, column.key);
                    }
                  }}
                >
                  {renderCellContent(column, row, rowIndex)}
                </td>
              ))}
              {showActionColumn && (
                <td style={{ 
                  ...cellStyle,
                  width: '120px',
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0px',
                    backgroundColor: getRowBackgroundColor(rowIndex)
                  }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onActionClick && onActionClick(row, rowIndex);
                      }}
                      style={{ 
                        padding: '5px 15px',
                        backgroundColor: actionButtonColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      {actionButtonText}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      {hasMoreRows && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '15px',
          borderTop: '1px solid #eee',
          marginTop: '10px'
        }}>
          <button
            onClick={() => setShowPopup(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            View all records ({data.length} total)
          </button>
        </div>
      )}

      <Popup
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
        title={`All ${title || 'Records'} (${data.length} total)`}
        width="90vw"
        maxHeight="90vh"
      >
        <PopupTable />
      </Popup>
    </>
  );
}

export default ColorTable;