import React, { useState, useRef, useEffect } from 'react';
import Popup from './popup'; // Assuming Popup component is in the same directory
import { toLocalDisplayLong } from '../utils/dateUtils';

function Table({ 
  data = [], 
  columns = [], 
  title = "",
  emptyMessage = "No data found",
  onRowClick = null, // Function to call when row is clicked
  onActionClick = null, // Function to call when action button is clicked
  actionButtonText = "VIEW",
  actionButtonColor = "#28a745",
  showActionColumn = true,
  className = "",
  style = {},
  alternatingRows = true, // Enable/disable alternating row colors
  evenRowColor = "#fff", // Color for even rows (0, 2, 4, etc.)
  oddRowColor = "#f9f9f9", // Color for odd rows (1, 3, 5, etc.)
  hoverColor = "#f0f0f0" // Color when hovering over rows
}) {
  const [scrollDirection, setScrollDirection] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const tableRef = useRef(null);

  const formatValue = (value, type = 'text') => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (type) {
      case 'date':
        return toLocalDisplayLong(value) || 'N/A';
      case 'number':
        return value.toString();
      case 'text':
      default:
        return value.toString();
    }
  };

  // Determine which data to show
  const displayData = data;

  // Function to get row background color
  const getRowBackgroundColor = (rowIndex) => {
    if (hoveredRow === rowIndex && hoverColor) {
      return hoverColor;
    }
    if (!alternatingRows) {
      return evenRowColor; // Use even row color as default when alternating is disabled
    }
    return rowIndex % 2 === 0 ? evenRowColor : oddRowColor;
  };

  // Handle scroll direction locking for mobile
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
    ...style
  };

  const headerStyle = {
    border: borderStyle,
    padding: '8px',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
    color: '#333'
  };

  const cellStyle = {
    border: '1px solid #eee',
  };

  const PopupTable = () => (
    <div style={{ overflowX: 'auto', maxHeight: '70vh'}}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th 
                key={index}
                style={{ 
                  ...headerStyle,
                  width: column.width || 'auto',
                  textAlign: column.align || 'left'
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
                    padding: column.type === 'select' ? '0' : '8px',
                    width: column.width || 'auto',
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
                  {column.customRender ?
                    column.customRender(row[column.key], row, rowIndex) :
                    formatValue(row[column.key], column.type)
                  }
                </td>
              ))}
              {showActionColumn && (
                <td style={{ 
                  ...cellStyle,
                  width: '80px',
                  textAlign: 'center'
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
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // If no data, return empty message
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
                  width: column.width || 'auto',
                  textAlign: column.align || 'left'
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
                    padding: column.type === 'select' ? '0' : '8px', 
                    width: column.width || 'auto',
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
                  {column.customRender ?
                    column.customRender(row[column.key], row, rowIndex) :
                    formatValue(row[column.key], column.type)
                  }
                </td>
              ))}
              {showActionColumn && (
                <td style={{
                  ...cellStyle,
                  width: '80px',
                  textAlign: 'center'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionClick && onActionClick(row, rowIndex);
                    }}
                    style={{
                      padding: '5px 15px',
                      backgroundColor: typeof actionButtonColor === 'function'
                        ? actionButtonColor(row, rowIndex)
                        : actionButtonColor,
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      const currentBg = typeof actionButtonColor === 'function'
                        ? actionButtonColor(row, rowIndex)
                        : actionButtonColor;
                      if (currentBg === '#3bb558') {
                        e.target.style.backgroundColor = '#28a745';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const originalBg = typeof actionButtonColor === 'function'
                        ? actionButtonColor(row, rowIndex)
                        : actionButtonColor;
                      e.target.style.backgroundColor = originalBg;
                    }}
                  >
                    {typeof actionButtonText === 'function'
                      ? actionButtonText(row, rowIndex)
                      : actionButtonText}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default Table;