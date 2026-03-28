import React, { useState, useEffect } from 'react';
import Table from './table';

function SheetTemplate({ sheetId }) {
    const [columns, setColumns] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);

    useEffect(() => {
        if (sheetId) loadPreview();
    }, [sheetId]);

    const loadPreview = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/sheets/structure/${sheetId}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to load template');

            const data = await response.json();
            const columnConfig = JSON.parse(data.columns);

            setColumns(columnConfig.columns.flatMap(col => {
                if (col.storage === 'record') {
                    return col.fields.map(field => ({
                        key:    `${col.recordSlot}.${field.key}`,
                        header: `${col.name} - ${field.name}`
                    }));
                }
                return [{ key: col.key, header: col.name }];
            }));

        } catch (err) {
            console.error('Error loading preview:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', fontSize: '18px', color: '#666' }}>
            Loading...
        </div>
    );

    if (error) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', fontSize: '18px', color: '#dc3545' }}>
            {error}
        </div>
    );

    if (!columns) return null;

    const emptyRow = Object.fromEntries(columns.map(c => [c.key, '']));

    return (
        <div style={{ overflowX: 'auto', padding: '15px' }}>
            <Table
                data={[emptyRow]}
                columns={columns}
                rawMode={true}
                evenRowColor="#f0f8ff"
                oddRowColor="#fff"
                showActionColumn={false}
            />
        </div>
    );
}

export default SheetTemplate;