import React from 'react';


class PopupErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Popup content error:', error, errorInfo);
    
    // Ensure popup cleanup happens even on error
    window.dispatchEvent(new CustomEvent('popupStateChange', { 
      detail: { isOpen: false } 
    }));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center',
          color: '#721c24',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '5px'
        }}>
          <h3>Something went wrong</h3>
          <p>An error occurred while loading this content.</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onClose?.();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
          <details style={{ marginTop: '15px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer' }}>Error Details</summary>
            <pre style={{ 
              fontSize: '12px', 
              backgroundColor: '#f1f1f1', 
              padding: '10px',
              borderRadius: '3px',
              overflow: 'auto',
              marginTop: '10px'
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}


export default PopupErrorBoundary;