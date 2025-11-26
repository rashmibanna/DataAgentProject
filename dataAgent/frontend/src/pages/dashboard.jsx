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
    // --- AUTHENTICATION LOGIC START ---
    
    // 1. Check if data was passed in URL (Redirected from Home Page)
    const queryParams = new URLSearchParams(window.location.search);
    const urlEmail = queryParams.get("email");
    const urlToken = queryParams.get("token");

    // 2. Check LocalStorage (User refreshed the page)
    const storedEmail = localStorage.getItem("user_email");
    const storedToken = localStorage.getItem("google_access_token");

    if (urlEmail && urlEmail !== "undefined") {
      console.log("📥 Receiving Session via URL...");
      
      // Save valid data to storage
      localStorage.setItem("user_email", urlEmail);
      if (urlToken) localStorage.setItem("google_access_token", urlToken);

      // Set State
      setEmail(urlEmail);
      setToken(urlToken);

      // 🧹 Clean the URL (Remove email/token from address bar)
      window.history.replaceState({}, document.title, window.location.pathname);
      
      setIsLoading(false);
    } 
    else if (storedEmail && storedEmail !== "undefined") {
      console.log("♻️ Restoring Session from Storage...");
      setEmail(storedEmail);
      setToken(storedToken);
      setIsLoading(false);
    } 
    else {
      console.warn("⛔ No session found. Redirecting to Landing Page...");
      // Redirect back to App A (Landing Page)
      window.location.href = `${process.env.REACT_APP_BASE_FRONTEND_URL}`;
    }
    // --- AUTHENTICATION LOGIC END ---
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
    window.location.href = `${process.env.REACT_APP_BASE_BACKEND_URL}`;
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
        
        <button 
          onClick={handleLogout}
          style={{
            padding: '8px 20px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 6px rgba(231, 76, 60, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#c0392b';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#e74c3c';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          Logout
        </button>
      </div>
      
      <div className="grid">
        <div className="bubble primary" onClick={() => navigate(`/profiling/options?email=${email}`)}>
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
        
        <div className="bubble primary" onClick={() => navigate(`/mapping/optionsMapping?email=${email}`)}>
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