export default function Calf({cowTag}){
    const [calves, setCalves] = useState([]);
    const [error, setError] = useState(null);

    function formatDate(dateString) {
        const options = { year: "numeric", month: "long", day: "numeric" };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    useEffect(() => {
        if (!cowTag) return; // Don't fetch if no cowTag is provided

        async function fetchCowData() {
            try {
                setError(null);
                const response = await fetch(`/api/cow/${cowTag}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const data = await response.json();
                if (data.calves && data.calves.length > 0) {
                    setCalves(data.calves);
                } else {
                    setCalves([]);
                    alert(`No calves found for Cow ${cowTag}`);
                }
            } catch (error) {
                console.error("Error fetching cow data:", error);
                setError("Error fetching cow data. Please try again.");
            }
        }

        fetchCowData();
    }, [cowTag]); // Runs when cowTag changes
    
    return (
        <div id="calf-data">
            <h3>Current Calves:</h3>
            <div id="calves-table"></div>
        </div>    
    )
}