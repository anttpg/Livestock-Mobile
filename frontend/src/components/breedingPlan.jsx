import React, { useState, useEffect } from 'react';
import Folder from './folder';
import PregCheck from './pregCheck';
import CalvingTracker from './calvingTracker';
import WeanlingTracker from './weanlingTracker';
import BreedingOverview from './breedingOverview';
import BreedingRecords from './BreedingRecords';

const CURRENT_MODE_VALUE = 'current';

function BreedingPlan() {
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [selectedPlan,  setSelectedPlan]  = useState(CURRENT_MODE_VALUE);
    const [loading,       setLoading]       = useState(false);

    const tabs = [
        { id: 'overview',      label: 'Overview'     },
        { id: 'breeding',  label: 'Exposure'         },
        { id: 'pregnancy', label: 'Pregnancy'        },
        { id: 'calving',    label: 'Calving'           },
        { id: 'weaning', label: 'Weaning'        },
    ];

    useEffect(() => {
        fetchBreedingPlans();
    }, []);

    const fetchBreedingPlans = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/breeding-plans', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                const sorted = (data.plans || []).sort((a, b) => b.PlanYear - a.PlanYear);
                setBreedingPlans(sorted);
                // Default stays 'current' — user opts into a specific plan
            } else {
                console.error('Failed to fetch breeding plans');
                setBreedingPlans([]);
            }
        } catch (error) {
            console.error('Error fetching breeding plans:', error);
            setBreedingPlans([]);
        } finally {
            setLoading(false);
        }
    };

    const isCurrentMode  = selectedPlan === CURRENT_MODE_VALUE;
    const numericPlanId  = isCurrentMode ? null : parseInt(selectedPlan, 10);
    const selectedPlanData = breedingPlans.find(p => p.ID === numericPlanId);
    const breedingYear   = selectedPlanData?.PlanYear ?? null;

    const renderTab = (tabConfig) => {
        if (!tabConfig) return null;

        switch (tabConfig.id) {
            case 'overview':
                return (
                    <BreedingOverview planId={numericPlanId} />
                );

            case 'breeding':
                return (
                    <BreedingRecords
                        planId={numericPlanId}
                        isCurrentMode={isCurrentMode}
                    />
                );

            case 'pregnancy':
                return (
                    <PregCheck
                        breedingPlanId={numericPlanId}
                        breedingYear={breedingYear}
                    />
                );

            case 'calving':
                return (
                    <CalvingTracker
                        breedingPlanId={numericPlanId}
                        breedingYear={breedingYear}
                    />
                );

            case 'weaning':
                return (
                    <WeanlingTracker
                        breedingPlanId={numericPlanId}
                        breedingYear={breedingYear}
                    />
                );

            default:
                return null;
        }
    };

    const renderTitle = () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <span>Breeding Plan</span>
            <select
                value={selectedPlan}
                onChange={e => setSelectedPlan(e.target.value)}
                style={{
                    padding: '8px 12px', border: '1px solid #ccc', borderRadius: '5px',
                    fontSize: '16px', minWidth: '200px', backgroundColor: 'white'
                }}
            >
                <option value={CURRENT_MODE_VALUE}>Current Animals</option>
                {breedingPlans.map(plan => (
                    <option key={plan.ID} value={plan.ID}>
                        {plan.PlanYear} — {plan.PlanName}
                    </option>
                ))}
            </select>
            {loading && (
                <span style={{ fontSize: '13px', color: '#888' }}>Loading plans...</span>
            )}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderTitle()}
            <Folder
                tabs={tabs}
                defaultTab="overview"
                renderTab={renderTab}
                selectedTabColor='white'
            />
        </div>
    );
}

export default BreedingPlan;