import "./dashboard.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(null);
  const [token , setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  console.log("entered");
  useEffect(() => {
    // 1. Get URL parameters FIRST (they're the source of truth from HomePage)
    const searchParams = new URLSearchParams(window.location.search);
    const urlEmail = searchParams.get('email');
    const urlToken = searchParams.get('token');

    // 2. Check localStorage (port 3001 specific)
    const storedEmail = localStorage.getItem('user_email');
    const storedToken = localStorage.getItem('google_access_token');

    console.log("URL Email:", urlEmail);
    console.log("URL Token:", urlToken ? "Found" : "Not Found");
    console.log("Stored Email:", storedEmail);
    console.log("Stored Token:", storedToken ? "Found" : "Not Found");

    // 3. Determine credentials (Priority: URL > localStorage)
    const finalEmail = urlEmail || storedEmail;
    const finalToken = urlToken || storedToken;

    if (finalEmail && finalToken) {
      // 4. Save to localStorage (port 3001)
      setEmail(finalEmail);
      setToken(finalToken);
      localStorage.setItem('user_email', finalEmail);
      localStorage.setItem('google_access_token', finalToken);
      sessionStorage.setItem('user_email', finalEmail);
      sessionStorage.setItem('google_access_token', finalToken);

      // 5. DON'T clean URL yet - keep params for navigation
      // Only clean if coming from external link
      if (urlToken) {
        // Coming from HomePage with fresh token - clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      setIsLoading(false);
    } else {
      console.error("❌ Missing credentials. Redirecting to home...");
      window.location.href = "http://localhost:3000"; 
    }
  }, []);
  // useEffect(() => {
  //   // Verify session with backend using cookie
  //   fetch('http://localhost:8000/api/verify-session', {
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
      
  //     // Store access token in localStorage for other API calls
  //     if (data.access_token) {
  //       console.log('token', data.access_token);
  //       localStorage.setItem('google_access_token', data.access_token);
  //     }
  //     localStorage.setItem('user_email', data.email);
      
  //     setIsLoading(false);
  //   })
  //   .catch(error => {
  //     console.error('❌ Auth error:', error);
  //     // Redirect to landing page if not authenticated
  //     window.location.href = "http://localhost:5000";
  //   });
  // }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem',
        color: '#1453c6'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="body">
      <div className="header">
        <p className="subtitle">Hi there! What can I do for you today?</p> 
      </div>
      <div className="grid">
        <div className="bubble primary" onClick={() => navigate(`/profiling/options?email=${email}&token=${token}`)}>
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