import "./dashboard.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // useEffect(() => {
  //   // Verify session with backend using cookie
  //   fetch(`${process.env.REACT_APP_BASE_BACKEND_URL}/api/verify-session`, {
  //     credentials: 'include'  // CRITICAL: Sends cookies
  //   })
  //   .then(res => {
  //     if (!res.ok) {
  //       throw new Error('Not authenticated');
  //     }
  //     return res.json();
  //   })
  //   .then(data => {
  //     console.log('✅ Authenticated:', data.email);
  //     setEmail(data.email);
  //     setToken(data.access_token);
      
  //     // Store access token and email in localStorage for convenience
  //     if (data.access_token) {
  //       localStorage.setItem('google_access_token', data.access_token);
  //     }
  //     localStorage.setItem('user_email', data.email);
      
  //     setIsLoading(false);
  //   })
  //   .catch(error => {
  //     console.error('❌ Auth error:', error);
  //     // Redirect to landing page if not authenticated
  //     window.location.href = `${process.env.REACT_APP_BASE_FRONTEND_URL}`;
  //   });
  // }, []);

  useEffect(() => {
      // 1. Get params from URL (New Login)
      const queryParams = new URLSearchParams(window.location.search);
      const urlToken = queryParams.get("token");
      const urlEmail = queryParams.get("email");
  
      // 2. Get params from Storage (Returning User / Refresh)
      const storedToken = localStorage.getItem("google_access_token");
      const storedEmail = localStorage.getItem("user_email");
  
      // SCENARIO A: User just arrived from Login (Data is in URL)
      if (urlToken && urlEmail) {
        console.log("📥 New login detected from URL. Saving session...");
        
        // Save to Local Storage (Persistence)
        localStorage.setItem("google_access_token", urlToken);
        localStorage.setItem("user_email", urlEmail);
        
        // Update UI
        setEmail(urlEmail);
        setToken(urlToken);
        // Clean the URL (Remove token/email so it looks clean)
        window.history.replaceState({}, document.title, window.location.pathname);
      } 
      
      // SCENARIO B: User Refreshed or came back from Dashboard (Data is in Storage)
      else if (storedEmail) { // (We trust the email if it exists in storage)
        console.log("♻️ Session restored from LocalStorage");
        setEmail(storedEmail);
        setToken(storedToken);
      }
      
      // SCENARIO C: No data found
      else {
        console.log("❌ No session found. User is Guest.");
        setEmail(null);
      }
    }, []);

  const handleLogout = async () => {
    // 1. Clear Local Storage (Crucial)
    localStorage.removeItem("user_email");
    localStorage.removeItem("google_access_token");

    // 2. Optional: Notify Backend (Fire and forget)
    try {
      if (token) {
        await fetch(`${process.env.REACT_APP_BASE_BACKEND_URL}/api/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
      }
    } catch (error) {
      console.error('Backend logout failed, but frontend session cleared.');
    }
    
    // 3. Redirect to Landing Page
    window.location.href = `${process.env.REACT_APP_BASE_FRONTEND_URL}?action=logout`;
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem',
        color: '#1453c6',
        fontFamily: "'Inter', system-ui, sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⏳</div>
          <div>Loading Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="body">
      <div className="header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '20px 40px'
      }}>
        <p className="subtitle">Hi there! What can I do for you today?</p>
        
        {/* Top Right Buttons */}
      <div style={{ 
        position: 'fixed',
        top: '50px',
        right: '50px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        zIndex: 10
      }}>
        <button
          onClick={() => window.location.href = `/dashboard?email=${email}`}
          style={{
            background: 'linear-gradient(135deg, #1453c6, #2a6ce8)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 20px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.95rem',
            transition: 'all 0.3s',
            boxShadow: '0 4px 12px rgba(20, 83, 198, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 16px rgba(20, 83, 198, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(20, 83, 198, 0.2)';
          }}
        >
          <i className="fas fa-arrow-left"></i> Back
        </button>

        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to logout?')) {
              window.location.href = '/';
            }
          }}
          style={{ 
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 20px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.95rem',
            transition: 'all 0.3s',
            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#bb2d3b';
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 16px rgba(220, 53, 69, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#dc3545';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.2)';
          }}
        >
          <i className="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
      </div>
      
      <div className="grid">
        <div className="bubble primary" onClick={() => navigate(`/profiling/options?email=${encodeURIComponent(email)}`)}>
          <div className="bubble-icon">📊</div>
          <div className="bubble-title">Data Profiling</div>
          <div className="bubble-desc">Analyze and understand your data structure</div>
        </div>
        
        <div className="bubble disabled">
          <div className="coming-soon">Coming Soon</div>
          <div className="bubble-icon">🧹</div>
          <div className="bubble-title">Data Cleaning</div>
          <div className="bubble-desc">Remove inconsistencies and errors</div>
        </div>
        
        <div className="bubble primary" onClick={() => navigate(`/mapping/optionsMapping?email=${encodeURIComponent(email)}`)}>
          <div className="bubble-icon">🗺️</div>
          <div className="bubble-title">Data Mapping</div>
          <div className="bubble-desc">Transform data between formats</div>
        </div>
        
        <div className="bubble disabled">
          <div className="coming-soon">Coming Soon</div>
          <div className="bubble-icon">✅</div>
          <div className="bubble-title">Data Validation</div>
          <div className="bubble-desc">Verify data quality and integrity</div>
        </div>
        
        <div className="bubble disabled">
          <div className="coming-soon">Coming Soon</div>
          <div className="bubble-icon">⚖️</div>
          <div className="bubble-title">Reconciliation</div>
          <div className="bubble-desc">Match and compare data sets</div>
        </div>
      </div>
      
      <div className="footer">
        <p>AI Agent Dashboard</p>
      </div>
    </div>
  );
};

export default Dashboard;