import React, { useState, useEffect } from 'react';
import ColorTable from './colorTable';
import PhotoViewer from './photoViewer';
import Popup from './popup';


function BreedingFitness({ 
  cowTag, 
  cowData, 
  currentUser, 
  loading = false, 
  hideSearchBar = false, 
  onDataUpdate,
  onNavigate
}) {
  const [epdData, setEpdData] = useState(null);
  const [loadingEpds, setLoadingEpds] = useState(false);
  const [showEpdInfoPopup, setShowEpdInfoPopup] = useState(false);
  const [svgDimensions, setSvgDimensions] = useState({ width: 400, height: 60 });
  const [linePositions, setLinePositions] = useState({
    leftX: 75,
    rightX: 325,
    centerX: 200
  });

  // Calculate responsive SVG dimensions and positions
  useEffect(() => {
    const calculateSvgLayout = () => {
      // Get CSS custom property values
      const rootStyles = getComputedStyle(document.documentElement);
      const treeGap = parseInt(rootStyles.getPropertyValue('--tree-gap').trim());
      const imageSize = parseInt(rootStyles.getPropertyValue('--image-size').trim()) || 150; // fallback to 150 if not defined
      
      // Calculate positions
      const leftImageCenter = imageSize / 2;
      const rightImageCenter = imageSize + treeGap + (imageSize / 2);
      const centerPoint = imageSize + (treeGap / 2);
      const totalWidth = (2 * imageSize) + treeGap;
      
      setSvgDimensions({
        width: totalWidth,
        height: 60
      });
      
      setLinePositions({
        leftX: leftImageCenter,
        rightX: rightImageCenter,
        centerX: centerPoint
      });
    };

    // Calculate on mount
    calculateSvgLayout();

    // Recalculate on window resize
    const handleResize = () => {
      calculateSvgLayout();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch EPD data when cowTag changes
  useEffect(() => {
    if (cowTag) {
      fetchEpdData();
    }
  }, [cowTag]);

  const fetchEpdData = async () => {
    if (!cowTag) return;
    
    setLoadingEpds(true);
    try {
      const response = await fetch(`/api/cow/${cowTag}/epds`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setEpdData(data);
      } else {
        console.error('Failed to fetch EPD data');
        setEpdData(null);
      }
    } catch (error) {
      console.error('Error fetching EPD data:', error);
      setEpdData(null);
    } finally {
      setLoadingEpds(false);
    }
  };

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'Unknown';
    const birthDate = new Date(dateOfBirth);
    const now = new Date();
    const ageInMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                       (now.getMonth() - birthDate.getMonth());
    
    if (ageInMonths < 12) {
      return `${ageInMonths} months`;
    } else {
      const years = Math.floor(ageInMonths / 12);
      const months = ageInMonths % 12;
      return months > 0 ? `${years}y ${months}m` : `${years} years`;
    }
  };

  // Handle navigation to different animals
  const handleAnimalNavigation = (targetCowTag) => {
    if (!targetCowTag) return;
    
    // Use onNavigate function passed from parent
    if (onNavigate) {
      onNavigate(targetCowTag);
    } else {
      console.warn('onNavigate not provided to BreedingFitness component');
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${year}`;
  };


  // parse accuracy/range data
  const parseDelimitedData = (dataString) => {
      if (!dataString) return {};
      const result = {};
      dataString.split('|').forEach(pair => {
          const [key, value] = pair.split(':');
          if (key && value) {
              result[key] = value === 'N/A' ? null : parseFloat(value);
          }
      });
      return result;
  };


  // Prepare EPD data for table - always show table with N/A values if no data
  const prepareEpdData = () => {
    // If we have EPD data, use the most recent record
    const epd = epdData?.epds?.[0] || {};
    
    // Parse the JSON accuracy and range data
    const accuracy = epd.Accuracy ? parseDelimitedData(epd.Accuracy) : {};
    const range = epd.Range ? parseDelimitedData(epd.Range) : {};

    // Map trait names to their accuracy/range keys
    const traitKeyMap = {
      'Calving Ease Direct': 'CalvingEaseDirect',
      'Birth Weight': 'BirthWeight', 
      'Weaning Weight': 'WeaningWeight',
      'Yearling Weight': 'YearlingWeight',
      'Milk': 'Milk',
      'Carcass Weight': 'CarcassWeight',
      'Marbling': 'Marbling'
    };

    // Helper function to get accuracy/range values
    const getAccuracy = (traitName) => {
      const key = traitKeyMap[traitName];
      return key && accuracy[key] !== null ? accuracy[key] : 'N/A';
    };

    const getRange = (traitName) => {
      const key = traitKeyMap[traitName];
      return key && range[key] !== null ? `±${range[key]}` : 'N/A';
    };
    
    // Always return the full EPD table structure, with N/A for missing values
    return [
      { 
        trait: 'Calving Ease Direct', 
        value: epd.CalvingEaseDirect || 'N/A',
        accuracy: getAccuracy('Calving Ease Direct'),
        range: getRange('Calving Ease Direct')
      },
      { 
        trait: 'Birth Weight', 
        value: epd.BirthWeight || 'N/A',
        accuracy: getAccuracy('Birth Weight'),
        range: getRange('Birth Weight')
      },
      { 
        trait: 'Weaning Weight', 
        value: epd.WeaningWeight || 'N/A',
        accuracy: getAccuracy('Weaning Weight'),
        range: getRange('Weaning Weight')
      },
      { 
        trait: 'Yearling Weight', 
        value: epd.YearlingWeight || 'N/A',
        accuracy: getAccuracy('Yearling Weight'),
        range: getRange('Yearling Weight')
      },
      { 
        trait: 'Dry Matter Intake', 
        value: epd.DryMatterIntake || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Scrotal Circumference', 
        value: epd.ScrotalCircumference || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Sustained Cow Fertility', 
        value: epd.SustainedCowFertility || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Milk', 
        value: epd.Milk || 'N/A',
        accuracy: getAccuracy('Milk'),
        range: getRange('Milk')
      },
      { 
        trait: 'Milk & Growth', 
        value: epd['Milk&Growth'] || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Calving Ease Maternal', 
        value: epd.CalvingEaseMaternal || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Mature Weight', 
        value: epd.MatureWeight || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Udder Suspension', 
        value: epd.UdderSuspension || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Teat Size', 
        value: epd.TeatSize || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Carcass Weight', 
        value: epd.CarcassWeight || 'N/A',
        accuracy: getAccuracy('Carcass Weight'),
        range: getRange('Carcass Weight')
      },
      { 
        trait: 'Fat', 
        value: epd.Fat || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Ribeye Area', 
        value: epd.RibeyeArea || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Marbling', 
        value: epd.Marbling || 'N/A',
        accuracy: getAccuracy('Marbling'),
        range: getRange('Marbling')
      },
      { 
        trait: 'Beef Merit Index', 
        value: epd.BeefMeritIndex || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Brahman Influence Index', 
        value: epd.BrahmanInfluenceIndex || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      },
      { 
        trait: 'Certified Hereford Beef', 
        value: epd.CertifiedHerefordBeef || 'N/A',
        accuracy: 'N/A', // Not calculated for this trait
        range: 'N/A'
      }
    ];
  };

  // EPD table columns - now with accuracy and range
  const epdColumns = [
    {
      key: 'trait',
      header: 'Trait',
      width: '50%'
    },
    {
      key: 'value',
      header: 'Value',
      width: '15%',
      align: 'center'
    },
    {
      key: 'accuracy',
      header: window.innerWidth < 550 ? 'Acc.' : 'Accuracy',
      width: '15%',
      align: 'center'
    },
    {
      key: 'range',
      header: 'Range',
      width: '20%',
      align: 'center'
    }
  ];

  const calvesColumns = [
    {
      key: 'CalfTag',
      header: 'Tag',
      width: '15%',
      customRender: (value, row) => (
        <button
          onClick={() => handleAnimalNavigation(value)}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0',
            margin: '0'
          }}
        >
          {value}
        </button>
      )
    },
    {
      key: 'DOB',
      header: 'DOB',
      width: '12%',
      customRender: (value) => formatDate(value)
    },
    {
      key: 'Sex',
      header: 'Sex',
      width: '8%',
      customRender: (value) => value === 'Male' ? 'M' : value === 'Female' ? 'F' : value
    },
    {
      key: 'SireTag',
      header: 'Sire',
      width: '15%',
      customRender: (value, row) => (
        value ? (
          <button
            onClick={() => handleAnimalNavigation(value)}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0',
              margin: '0'
            }}
          >
            {value}
          </button>
        ) : 'N/A'
      )
    },
    {
      key: 'Genotype',
      header: 'Type',
      width: '18%'
    },
    {
      key: 'Birthweight',
      header: 'BW',
      width: '10%'
    },
    {
      key: 'WeaningWeight',
      header: 'WW',
      width: '10%'
    },
    {
      key: 'IsAI',
      header: 'AI?',
      width: '12%',
      customRender: (value) => value ? 'Yes' : 'No'
    }
  ];

  const cow = cowData?.cowData?.[0];
  const calvesData = cowData?.calves || [];

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading breeding fitness data...
      </div>
    );
  }

  return (
    <div className="multibubble-page">
      {/* Section 1: Family Tree Photos */}
      <div className="bubble-container">
        <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>Family Tree</h3>
        
        {/* Parents Row */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'flex-end',
          gap: 'var(--tree-gap)',
          marginBottom: '30px'
        }}>
          {/* Dam */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => handleAnimalNavigation(cow?.Dam)}
              disabled={!cow?.Dam}
              style={{
                background: 'none',
                border: 'none',
                color: cow?.Dam ? '#007bff' : '#666',
                textDecoration: cow?.Dam ? 'underline' : 'none',
                cursor: cow?.Dam ? 'pointer' : 'default',
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '10px'
              }}
            >
              Dam: {cow?.Dam || 'Unknown'}
            </button>
            <div style={{ 
              width: 'var(--image-size)', 
              height: 'var(--image-size)' 
            }}>
              <PhotoViewer
                cowTag={cow?.Dam}
                imageType="body"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '5px',
                  border: cow?.Dam ? 'none' : '2px dashed #ccc'
                }}
              />
            </div>
          </div>

          {/* Sire */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => handleAnimalNavigation(cow?.Sire)}
              disabled={!cow?.Sire}
              style={{
                background: 'none',
                border: 'none',
                color: cow?.Sire ? '#007bff' : '#666',
                textDecoration: cow?.Sire ? 'underline' : 'none',
                cursor: cow?.Sire ? 'pointer' : 'default',
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '10px'
              }}
            >
              Sire: {cow?.Sire || 'Unknown'}
            </button>
            <div style={{ 
              width: 'var(--image-size)', 
              height: 'var(--image-size)' 
            }}>
              <PhotoViewer
                cowTag={cow?.Sire}
                imageType="body"
                alternateDefaultPhoto={!cow?.Sire}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '5px',
                  border: cow?.Sire ? 'none' : '2px dashed #ccc'
                }}
              />
            </div>
          </div>
        </div>

        {/* Connection Lines */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <svg 
            width={svgDimensions.width} 
            height={svgDimensions.height} 
            style={{ overflow: 'visible' }}
          >
            {/* Vertical lines up from parents */}
            <line 
              x1={linePositions.leftX} 
              y1="0" 
              x2={linePositions.leftX} 
              y2="20" 
              stroke="#666" 
              strokeWidth="2" 
            />
            <line 
              x1={linePositions.rightX} 
              y1="0" 
              x2={linePositions.rightX} 
              y2="20" 
              stroke="#666" 
              strokeWidth="2" 
            />
            {/* Horizontal line connecting parents */}
            <line 
              x1={linePositions.leftX} 
              y1="20" 
              x2={linePositions.rightX} 
              y2="20" 
              stroke="#666" 
              strokeWidth="2" 
            />
            {/* Vertical line down to offspring */}
            <line 
              x1={linePositions.centerX} 
              y1="20" 
              x2={linePositions.centerX} 
              y2="50" 
              stroke="#666" 
              strokeWidth="2" 
            />
          </svg>
        </div>

        {/* Current Animal */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--multibubble-gap)'}}>
          <h4 style={{ margin: '0 0 10px 0' }}>Current Animal: {cowTag}</h4>
          <div style={{ 
            width: 'calc(var(--image-size) * 1.33)', 
            height: 'calc(var(--image-size) * 1.33)' 
          }}>
            <PhotoViewer
              cowTag={cowTag}
              imageType="body"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '5px',
                border: '3px solid #007bff'
              }}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Basic Info and EPDs */}
      <div className="bubble-container">

        {/* Basic Info */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Basic Information</h3>
            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <div><strong>DOB:</strong> {cow?.DateOfBirth ? new Date(cow.DateOfBirth).toLocaleDateString() : 'N/A'}</div>
              <div><strong>Age:</strong> {calculateAge(cow?.DateOfBirth)}</div>
              <div><strong>Status:</strong> {cow?.Status || 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* EPDs Table */}
        <div style={{ display: 'flex' }}>
          <div style={{ flex: '3' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '15px',
              gap: '8px'
            }}>
              <h3 style={{ margin: '0' }}>Expected Progeny Differences (EPDs)</h3>
              <button
                onClick={() => setShowEpdInfoPopup(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '2px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#333'}
                onMouseLeave={(e) => e.target.style.color = '#666'}
                title="Learn about EPD calculations"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  info
                </span>
              </button>
            </div>
            
            {loadingEpds ? (
              <div style={{ textAlign: 'center', padding: '20px', fontStyle: 'italic', color: '#666' }}>
                Loading EPD data...
              </div>
            ) : (
              <ColorTable
                data={prepareEpdData()}
                columns={epdColumns}
                showActionColumn={false}
                alternatingRows={true}
                evenRowColor="#fff"
                oddRowColor="#f0f7e4ff"
                emptyMessage="EPD data will display here when available"
                maxWidth="100%"
              />
            )}
          </div>
        </div>

        {/* EPD Info Popup */}
        <Popup
          isOpen={showEpdInfoPopup}
          onClose={() => setShowEpdInfoPopup(false)}
          title="EPD Calculation Methodology"
          width="750px"
        >
          <div style={{ lineHeight: '1.6', color: '#333' }}>
            <h4 style={{ marginTop: '0', color: '#2c5aa0' }}>How This Database Calculates EPDs</h4>

            <div style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '15px', 
              borderRadius: '5px',
              borderLeft: '4px solid #2c5aa0',
              marginBottom: '20px'
            }}>
              <h5 style={{ color: '#2c5aa0', margin: '0 0 8px 0' }}>Key Points</h5>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                <li>Accuracy values are estimated and not official breed association data.</li>
                <li>Offspring data improves estimated accuracy.</li>
                <li>N/A values indicate the most recent EPD record does not contain data for this field</li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#555', marginBottom: '8px' }}>Data Sources</h3>
              <p style={{ margin: '0 0 10px 0' }}>
                We display the most recent EPD record, drawing from two tables 
              </p>
              <ul style={{ margin: '0 0 15px 20px', paddingLeft: '0' }}>
                <li><strong>EPD Records:</strong> Stores real EPD records</li>
                <li><strong>Calving Records:</strong> CalfTag linked to breeding records to count actual offspring produced</li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#555', marginBottom: '8px' }}>Accuracy</h3>
              <p style={{ margin: '5px 0 10px 0' }}>
                According to the <a 
                  href="https://americanbrahman.org/genetics/performance-data/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#2c5aa0', textDecoration: 'underline' }}
                >
                  American Brahman Association
                </a>, accuracy is ranked as...
              </p>
              
              <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
                <ul style={{ margin: '0', paddingLeft: '20px' }}>
                  <li><strong>LOW:</strong> 0.0 to 0.50</li>
                  <li><strong>MEDIUM:</strong> 0.50 to 0.75</li>
                  <li><strong>HIGH:</strong> 0.75 and above</li>
                </ul>
              </div>
              <p>Higher accuracy values indicate more reliable EPD predictions</p>

              <p style={{ margin: '20px 0 10px 0' }}>
                If an offical EPD record is not provided, we will estimate the accuracy of 
                Birth Weight, Weaning Weight, Yearling Weight, Calving Ease Direct, Milk, Marbling, and Carcass Weight.
              </p>
              
              <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', margin: '10px 0' }}>
                <p style={{ margin: '0 0 10px 0' }}><strong>Base Accuracy (no progeny):</strong></p>
                <ul style={{ margin: '0 0 15px 20px', paddingLeft: '0' }}>
                  <li>1 EPD record: 0.35</li>
                  <li>2 EPD records: 0.55</li>
                  <li>3+ EPD records: 0.70</li>
                </ul>
                
                <p style={{ margin: '0 0 10px 0' }}><strong>With Progeny Data:</strong></p>
                <div style={{ 
                  fontFamily: 'monospace', 
                  backgroundColor: '#f8f9fa', 
                  padding: '10px', 
                  borderRadius: '3px',
                  fontSize: '14px'
                }}>
                  Accuracy = min(0.95, 0.35 + (records × 0.1) + (progeny × 0.05))
                </div>
              </div>

              <div style={{ 
                backgroundColor: '#fff3cd', 
                padding: '10px', 
                borderRadius: '5px',
                borderLeft: '4px solid #ffc107'
              }}>
                <h5 style={{ color: '#856404', margin: '0 0 8px 0' }}>Note</h5>
                <p style={{ margin: '0', fontSize: '14px' }}>
                  As of 9/11/2025, we only use simplified accuracy estimates. 
                  The database does not store breed association calculations.
                </p>
              </div>
            </div>


            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#555', marginBottom: '8px' }}>Range Calculations</h3>
              <p style={{ margin: '0 0 10px 0' }}>
                Range represents potential EPD change and is calculated as:
              </p>
              <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', margin: '10px 0' }}>
                <div style={{ 
                  fontFamily: 'monospace', 
                  backgroundColor: '#f8f9fa', 
                  padding: '10px', 
                  borderRadius: '3px',
                  fontSize: '14px'
                }}>
                  Range = |EPD Value| × (1 - Accuracy)
                </div>
              </div>
              <p style={{ margin: '10px 0 0 0' }}>
                Higher accuracy animals show smaller ranges, indicating more reliable predictions. A smaller range suggests less potential for EPD changes.
              </p>
            </div>
          </div>
        </Popup>

      </div>

      {/* Section 3: Enhanced Calves Table */}
      <div className="bubble-container">
        <h3 style={{ margin: '0 0 15px 0' }}>Offspring</h3>
        <ColorTable
          data={calvesData}
          columns={calvesColumns}
          showActionColumn={false}
          alternatingRows={true}
          evenRowColor="#fff"
          oddRowColor="#f4f4f4"
          emptyMessage={cowTag ? "No offspring records found" : "Select a cow to view offspring"}
          maxWidth="100%"
        />
      </div>
    </div>
  );
}

export default BreedingFitness;