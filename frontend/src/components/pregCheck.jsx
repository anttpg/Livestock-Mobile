import React, { useState } from 'react';
import Form from './forms';
import '../cow-data.css';

function PregCheck({ breedingPlanId, breedingYear }) {
    const headerContent = (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                Showing only cows with breeding records for {breedingYear || 'current year'}
            </div>
        </div>
    );

    return (
        <Form
            title="Pregnancy Check"
            headerContent={headerContent}
            sheetName="PregCheck"
            showImportButton={true}
            editLive={true}
            selectableRows={false} 
            //editLive={false}
            //selectableRows={true}
            breedingPlanId={breedingPlanId}
            breedingYear={breedingYear}
        />
    );
}

export default PregCheck;