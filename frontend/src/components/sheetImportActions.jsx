// Import actions for each sheet type
import * as XLSX from 'exceljs';

// PregCheck Import Action
export const pregCheckImportAction = async (file) => {
  const workbook = new XLSX.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('No worksheet found in file');
  }

  const records = [];
  const headers = {};
  
  // Read headers from first row
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  // Validate required columns
  const requiredColumns = ['CowTag', 'Result'];
  const headerValues = Object.values(headers);
  
  for (const required of requiredColumns) {
    if (!headerValues.includes(required)) {
      throw new Error(`Missing required column: ${required}`);
    }
  }

  // Process data rows
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        record[header] = cell.value;
      }
    });

    // Skip empty rows
    if (!record.CowTag) continue;

    // Validate and transform data
    if (record.Result && !['Pregnant', 'Open'].includes(record.Result)) {
      throw new Error(`Invalid result "${record.Result}" for cow ${record.CowTag}. Must be "Pregnant" or "Open"`);
    }

    if (record['Fetus Sex'] && !['Heifer', 'Bull', ''].includes(record['Fetus Sex'])) {
      throw new Error(`Invalid fetus sex "${record['Fetus Sex']}" for cow ${record.CowTag}`);
    }

    records.push({
      cowTag: record.CowTag,
      result: record.Result || '',
      sex: record['Fetus Sex'] || '',
      weight: record.Weight ? parseInt(record.Weight) : null,
      notes: record.Notes || ''
    });
  }

  if (records.length === 0) {
    throw new Error('No valid records found in file');
  }

  // Submit to API
  const response = await fetch('/api/pregnancy-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      herdName: 'ALL ACTIVE', // Default herd
      date: new Date().toISOString().split('T')[0],
      records: records.filter(r => r.result) // Only submit records with results
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to import pregnancy check data: ${error.error || 'Unknown error'}`);
  }

  const result = await response.json();
  return `Successfully imported ${result.recordsProcessed} pregnancy check records`;
};

// CalvingTracker Import Action
export const calvingTrackerImportAction = async (file) => {
  const workbook = new XLSX.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('No worksheet found in file');
  }

  const records = [];
  const headers = {};
  
  // Read headers
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  // Process data rows
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        record[header] = cell.value;
      }
    });

    if (!record.CowTag) continue;

    // Handle calving records if calf data is provided
    if (record['Calf Tag'] && record['Birth Date']) {
      // This would require more complex logic to create calving records
      // For now, we'll just log that calving data was found
      console.log(`Calving data found for ${record.CowTag}: ${record['Calf Tag']}`);
    }
  }

  // Note: CalvingTracker is primarily for viewing/tracking, not bulk data entry
  // Most changes would be individual calf additions through the UI
  return `Processed ${records.length} calving records. Note: Calving tracker is primarily for individual record management.`;
};

// Weanlings Import Action  
export const weaningsImportAction = async (file) => {
  const workbook = new XLSX.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('No worksheet found in file');
  }

  const records = [];
  const headers = {};
  
  // Read headers
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  // Process data rows
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        record[header] = cell.value;
      }
    });

    if (!record.CowTag) continue;

    // Check if weaning status was updated
    if (record['Weaning Status'] === 'Weaned' && record['Weaning Date']) {
      records.push({
        cowTag: record.CowTag,
        weaningDate: record['Weaning Date'],
        notes: record.Notes || ''
      });
    }
  }

  if (records.length === 0) {
    return 'No weaning records to import';
  }

  // Submit weaning records
  const response = await fetch('/api/weaning-record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      records: records
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to import weaning data: ${error.error || 'Unknown error'}`);
  }

  const result = await response.json();
  return `Successfully imported ${result.recordsProcessed} weaning records`;
};

// WeighIns Import Action
export const weighInsImportAction = async (file) => {
  const workbook = new XLSX.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('No worksheet found in file');
  }

  const records = [];
  const headers = {};
  
  // Read headers
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  // Process data rows
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        record[header] = cell.value;
      }
    });

    if (!record.CowTag) continue;

    // Check if new weight was provided
    if (record['New Weight'] && parseFloat(record['New Weight']) > 0) {
      records.push({
        cowTag: record.CowTag,
        weight: parseFloat(record['New Weight']),
        notes: record.Notes || ''
      });
    }
  }

  if (records.length === 0) {
    return 'No weight records to import';
  }

  // Submit weight records
  const response = await fetch('/api/batch-weigh-in', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      records: records
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to import weight data: ${error.error || 'Unknown error'}`);
  }

  const result = await response.json();
  return `Successfully imported ${result.recordsProcessed} weight records`;
};

// Map of sheet names to import actions
export const importActions = {
  'PregCheck': pregCheckImportAction,
  'CalvingTracker': calvingTrackerImportAction,
  'Weanlings': weaningsImportAction,
  'WeighIns': weighInsImportAction
};