import React, { useState, useEffect } from 'react';
import Folder from './folder';
import PregCheck from './pregCheck';
import CalvingTracker from './calvingTracker';
import WeanlingTracker from './weanlingTracker';
import BreedingOverview from './breedingOverview';

function BreedingPlan() {
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState('');
    const [planOverview, setPlanOverview] = useState(null);
    const [loading, setLoading] = useState(false);

    // Define tabs configuration for breeding plan
    const tabs = [
        { id: 'plan', label: 'Plan' },
        { id: 'pregnancy', label: 'Pregnancy' },
        { id: 'calves', label: 'Calves' },
        { id: 'weanlings', label: 'Weanlings' }
    ];

    // Fetch breeding plans on component mount
    useEffect(() => {
        fetchBreedingPlans();
    }, []);

    // Fetch plan overview when plan is selected
    useEffect(() => {
        if (selectedPlan) {
            fetchPlanOverview();
        }
    }, [selectedPlan]);

    const fetchBreedingPlans = async () => {
        try {
            const response = await fetch('/api/breeding-plans', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const plans = data.plans || [];

                // Sort by year (descending)
                const sortedPlans = plans.sort((a, b) => b.PlanYear - a.PlanYear);
                setBreedingPlans(sortedPlans);

                // Select most recent plan by default
                if (sortedPlans.length > 0) {
                    setSelectedPlan(sortedPlans[0].ID);
                }
            } else {
                console.error('Failed to fetch breeding plans');
                setBreedingPlans([]);
            }
        } catch (error) {
            console.error('Error fetching breeding plans:', error);
            setBreedingPlans([]);
        }
    };

    const fetchPlanOverview = async () => {
        if (!selectedPlan) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/breeding-plans/${selectedPlan}/overview`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setPlanOverview(data);
            } else {
                console.error('Failed to fetch plan overview');
                setPlanOverview(null);
            }
        } catch (error) {
            console.error('Error fetching plan overview:', error);
            setPlanOverview(null);
        } finally {
            setLoading(false);
        }
    };

    // Function to render tab content
    const renderTab = (tabConfig, data, searchTerm, helpers) => {
        if (!tabConfig) return null;

        // Get the selected plan data for year context
        const selectedPlanData = breedingPlans.find(p => p.ID === parseInt(selectedPlan));
        const breedingYear = selectedPlanData?.PlanYear;

        switch (tabConfig.id) {
            case 'plan':
                return <BreedingOverview planId={selectedPlan} />;
            case 'pregnancy':
                return <PregCheck breedingPlanId={selectedPlan} breedingYear={breedingYear} />;
            case 'calves':
                return <CalvingTracker breedingPlanId={selectedPlan} breedingYear={breedingYear} />;
            case 'weanlings':
                return <WeanlingTracker breedingPlanId={selectedPlan} breedingYear={breedingYear} />;
            default:
                return null;
        }
    };

    function BullAssignmentComponent({ selectedPlan, unassignedAnimals, onAssignmentComplete }) {
        const [breedingAnimalStatus, setBreedingAnimalStatus] = useState(null);
        const [selectedBull, setSelectedBull] = useState('');
        const [selectedCows, setSelectedCows] = useState(new Set());
        const [exposureStartDate, setExposureStartDate] = useState('');
        const [exposureEndDate, setExposureEndDate] = useState('');
        const [assigning, setAssigning] = useState(false);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            fetchBreedingAnimalStatus();
            // Set default dates (current date to 45 days later)
            const today = new Date();
            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() + 45);

            setExposureStartDate(today.toISOString().split('T')[0]);
            setExposureEndDate(endDate.toISOString().split('T')[0]);
        }, []);

        const fetchBreedingAnimalStatus = async () => {
            try {
                const response = await fetch('/api/breeding-animal-status', {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    setBreedingAnimalStatus(data);
                } else {
                    console.error('Failed to fetch breeding animal status');
                }
            } catch (error) {
                console.error('Error fetching breeding animal status:', error);
            } finally {
                setLoading(false);
            }
        };

        const handleCowSelection = (cowTag, selected) => {
            const newSelected = new Set(selectedCows);
            if (selected) {
                newSelected.add(cowTag);
            } else {
                newSelected.delete(cowTag);
            }
            setSelectedCows(newSelected);
        };

        const handleSelectAll = (selected) => {
            if (selected && breedingAnimalStatus) {
                setSelectedCows(new Set(breedingAnimalStatus['unassigned-cows'].map(animal => animal.CowTag)));
            } else {
                setSelectedCows(new Set());
            }
        };

        const handleAssignment = async () => {
            if (!selectedBull || selectedCows.size === 0 || !exposureStartDate || !exposureEndDate) {
                alert('Please select a bull, cows, and exposure dates');
                return;
            }

            setAssigning(true);
            try {
                const response = await fetch('/api/assign-breeding-records', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        planId: selectedPlan,
                        primaryBull: selectedBull,
                        cowTags: Array.from(selectedCows),
                        exposureStartDate,
                        exposureEndDate
                    })
                });

                if (response.ok) {
                    alert(`Successfully assigned ${selectedCows.size} cows to ${selectedBull}`);
                    setSelectedCows(new Set());
                    setSelectedBull('');
                    onAssignmentComplete(); // Refresh the overview
                    fetchBreedingAnimalStatus(); // Refresh the animal status
                } else {
                    const error = await response.text();
                    alert(`Failed to assign breeding records: ${error}`);
                }
            } catch (error) {
                console.error('Error assigning breeding records:', error);
                alert('Error assigning breeding records');
            } finally {
                setAssigning(false);
            }
        };

        if (loading) {
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    Loading breeding animal status...
                </div>
            );
        }

        if (!breedingAnimalStatus) {
            return (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    Failed to load breeding animal status
                </div>
            );
        }

        const unassignedCows = unassignedAnimals || [];
        const bulls = breedingAnimalStatus.bulls || [];

        return (
            <div>
                {/* Bull Selection */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Select Bull:
                    </label>
                    <select
                        value={selectedBull}
                        onChange={(e) => setSelectedBull(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }}
                    >
                        <option value="">Choose a bull...</option>
                        {bulls.map((bull) => {
                            const ageYears = Math.floor(bull.AgeInMonths / 12);
                            const ageMonths = bull.AgeInMonths % 12;
                            const ageDisplay = ageYears > 0
                                ? `${ageYears}y ${ageMonths}m`
                                : `${ageMonths}m`;

                            return (
                                <option key={bull.CowTag} value={bull.CowTag}>
                                    {bull.CowTag} - {bull.Description || 'No description'} ({ageDisplay})
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* Exposure Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Exposure Start:
                        </label>
                        <input
                            type="date"
                            value={exposureStartDate}
                            onChange={(e) => setExposureStartDate(e.target.value)}
                            style={{
                                width: '95%',
                                padding: '8px',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Exposure End:
                        </label>
                        <input
                            type="date"
                            value={exposureEndDate}
                            onChange={(e) => setExposureEndDate(e.target.value)}
                            style={{
                                width: '95%',
                                padding: '8px',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                </div>

                {/* Animal Status Summary */}
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>Current Animal Status:</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px', fontSize: '12px' }}>
                        <div>Bulls: {bulls.length}</div>
                        <div>Calfs: {breedingAnimalStatus.calfs?.length || 0}</div>
                        <div>Yearlings: {breedingAnimalStatus.yearlings?.length || 0}</div>
                        <div>Assigned: {breedingAnimalStatus['assigned-cow']?.length || 0}</div>
                        <div>Unassigned: {unassignedCows.length}</div>
                    </div>
                </div>


                {/* Assignment Button */}
                <button
                    onClick={handleAssignment}
                    disabled={assigning || !selectedBull || selectedCows.size === 0 || unassignedCows.length === 0}
                    style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: assigning || unassignedCows.length === 0 ? '#ccc' : '#7b1fa2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        marginBottom: '12px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: assigning || unassignedCows.length === 0 ? 'not-allowed' : 'pointer'
                    }}
                >
                    {assigning ? 'Assigning...' : 
                     unassignedCows.length === 0 ? 'No Unassigned Cows Available' :
                     `Assign ${selectedCows.size} Cows to Bull`}
                </button>


                {/* Cow Selection */}
                <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <label style={{ fontWeight: 'bold' }}>Select Unassigned Cows:</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="checkbox"
                                checked={selectedCows.size === unassignedCows.length && unassignedCows.length > 0}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                            Select All
                        </label>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                            ({selectedCows.size} selected)
                        </span>
                    </div>

                    <div style={{
                        // maxHeight: '200px',
                        // overflowY: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '10px',
                        backgroundColor: 'white'
                    }}>
                        {unassignedCows.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                                No unassigned cows available for breeding assignment
                            </div>
                        ) : (
                            unassignedCows.map((animal) => {
                                const ageYears = Math.floor(animal.AgeInMonths / 12);
                                const ageMonths = animal.AgeInMonths % 12;

                                return (
                                    <label
                                        key={animal.CowTag}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '5px 0',
                                            borderBottom: '1px solid #f0f0f0'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedCows.has(animal.CowTag)}
                                            onChange={(e) => handleCowSelection(animal.CowTag, e.target.checked)}
                                        />
                                        <span style={{ fontWeight: 'bold' }}>{animal.CowTag}</span>
                                        {animal.CurrentHerd && (
                                            <span style={{ color: '#666', fontSize: '14px' }}>
                                                ({animal.CurrentHerd})
                                            </span>
                                        )}
                                        <span style={{ color: '#888', fontSize: '12px', marginLeft: 'auto' }}>
                                            {ageYears > 0 ? `${ageYears}y ${ageMonths}m` : `${ageMonths}m`}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>
        );
    }

    const renderTitle = () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <span>Breeding Plan</span>
            <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                style={{
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                    minWidth: '200px',
                    backgroundColor: 'white'
                }}
            >
                <option value="">Select a plan...</option>
                {breedingPlans.map((plan) => (
                    <option key={plan.ID} value={plan.ID}>
                        {plan.PlanYear} - {plan.PlanName}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderTitle()}
            <Folder
                tabs={tabs}
                defaultTab="plan"
                renderTab={renderTab}
                selectedTabColor='#f8f9fa'
            />
        </div>
    );
}

export default BreedingPlan;