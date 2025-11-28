import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [showLogout, setShowLogout] = useState(false);
  const [email, setEmail] = useState(null);

  // Get email from URL (for OAuth callback)
  // const urlEmail = new URLSearchParams(location.search).get("email");

  // // --- Authentication Management useEffect ---
  // useEffect(() => {
  //   // Handle OAuth callback - email in URL means just logged in
  //   if (urlEmail) {
  //     setEmail(urlEmail);
  //     setIsSignedIn(true);
  //     // Store email for convenience (not for auth)
  //     localStorage.setItem("user_email", urlEmail);
  //     // Clean up URL
  //     window.history.replaceState({}, '', '/');
  //   } else {
  //     // Check if user has existing session by verifying with backend
  //     fetch(`${process.env.REACT_APP_BASE_BACKEND_URL}/api/verify-session`, {
  //       credentials: 'include'
  //     })
  //     .then(res => {
  //       if (res.ok) {
  //         return res.json();
  //       }
  //       throw new Error('Not authenticated');
  //     })
  //     .then(data => {
  //       setEmail(data.email);
  //       setIsSignedIn(true);
  //       localStorage.setItem("user_email", data.email);
  //     })
  //     .catch(() => {
  //       // Not signed in
  //       setIsSignedIn(false);
  //       setEmail(null);
  //       localStorage.removeItem("user_email");
  //     });
  //   }
  // }, [urlEmail]);

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
      setIsSignedIn(true);

      // Clean the URL (Remove token/email so it looks clean)
      window.history.replaceState({}, document.title, window.location.pathname);
    } 
    
    // SCENARIO B: User Refreshed or came back from Dashboard (Data is in Storage)
    else if (storedEmail) { // (We trust the email if it exists in storage)
      console.log("♻️ Session restored from LocalStorage");
      setEmail(storedEmail);
      setIsSignedIn(true);
    }
    
    // SCENARIO C: No data found
    else {
      console.log("❌ No session found. User is Guest.");
      setIsSignedIn(false);
      setEmail(null);
    }
  }, []);

  const dashboardUrl = `${process.env.REACT_APP_FRONTEND2_URL}/dashboard`;
  const PMUrl = `${process.env.REACT_APP_PM_URL}`;

  const handleSignIn = () => {
     console.log(`${process.env.REACT_APP_BASE_BACKEND_URL}/login`)
    window.location.href = `${process.env.REACT_APP_BASE_BACKEND_URL}/login`;
  };

  const handleLogout = async () => {
    // try {
    //   // Call backend logout to clear session cookie
    //   await fetch(`${process.env.REACT_APP_BASE_BACKEND_URL}/api/logout`, {
    //     method: 'POST',
    //     credentials: 'include'
    //   });
    //   console.log('✅ Logged out from backend');
    // } catch (error) {
    //   console.error('Logout error:', error);
    // }
    
    // Clear frontend storage
    localStorage.removeItem("user_email");
    localStorage.removeItem("google_access_token");
    setIsSignedIn(false);
    setEmail(null);
    setShowLogout(false);
    navigate('/');
    console.log('✅ Logged out successfully');
  };

  const handleCardClick = (cardIndex) => {
    if (isSignedIn) {
      // 🚨 CRITICAL FIX: Read directly from storage to ensure we never pass "undefined"
      const currentEmail = localStorage.getItem("user_email"); 
      const currentToken = localStorage.getItem("google_access_token");
      switch(cardIndex) {
        case 0: // Data Agent
          if (currentEmail) {
            window.location.href = `${dashboardUrl}?email=${encodeURIComponent(currentEmail)}&token=${encodeURIComponent(currentToken || '')}`;
          } else {
             alert("Session error. Please login again.");
             handleLogout();
          }
          break;
        case 1: // QA Agent
          console.log('QA Agent - Coming soon');
          break;
        case 2: // Coding Agent
          console.log('Coding Agent - Coming soon');
          break;
        case 3: // PM Agent
          if (currentEmail) {
            window.location.href = `${PMUrl}?email=${encodeURIComponent(currentEmail)}&token=${encodeURIComponent(currentToken || '')}`;
          } else {
             alert("Session error. Please login again.");
             handleLogout();
          }
          break;
        default:
          break;
      }
    }
  };

  const getFirstName = (email) => {
    if (!email) return "User";
    const localPart = email.split('@')[0];
    const parts = localPart.split(/[._-]/);
    let firstName = parts[0];
    if (firstName) {
      return firstName.charAt(0).toUpperCase() + firstName.slice(1);
    }
    return "User";
  };

  const cards = [
    { 
      icon: '🤖', 
      title: 'Data Agent', 
      desc: 'Intelligent data profiling, validation, and quality analysis',
      hoverDesc: 'Automate data profiling with AI-powered validation rules. Detect anomalies, ensure integrity, and generate comprehensive quality reports instantly.'
    },
    { 
      icon: '🧪', 
      title: 'QA Agent', 
      desc: 'Automated testing and quality assurance workflows',
      hoverDesc: 'Generate test cases automatically, identify bugs intelligently, and execute comprehensive testing workflows with minimal manual intervention.'
    },
    { 
      icon: '💻', 
      title: 'Coding Agent', 
      desc: 'AI-powered code generation and optimization',
      hoverDesc: 'Generate production-ready code, optimize performance, refactor legacy systems, and receive intelligent code reviews with best practice recommendations.'
    },
    { 
      icon: '📋', 
      title: 'PM Agent', 
      desc: 'Project management and workflow automation',
      hoverDesc: 'Automate sprint planning, track deliverables intelligently, generate status reports, and optimize resource allocation with AI-driven insights.'
    }
  ];

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #f3f6fb 0%, #e8edf7 100%)',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Navbar */}
      <nav style={{
        height: '85px',
        background: 'white',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 50px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img 
            src="https://www.forsysinc.com/assets/img/logo.png" 
            alt="Forsys Logo" 
            style={{
              width: '70px', 
              height: '70px', 
              objectFit: 'contain', 
            }} 
          />
          
          <div style={{ 
            fontSize: '28px', 
            fontWeight: '700',
            letterSpacing: '-0.5px',
            display: 'flex',
            gap: '2px'
          }}>
            <span style={{ color: '#1761c2ff' }}>For</span>
            <span style={{ color: '#c3c614ff' }}>sys</span>
            <span style={{ color: '#0d77e2ff', marginLeft: '8px' }}>Agents</span>
          </div>
        </div>

        {!isSignedIn ? (
          <button
            onClick={handleSignIn}
            style={{
              padding: '12px 28px',
              background: '#1453c6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(20, 83, 198, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#0d3d9a';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#1453c6';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            Sign In with Google
          </button>
        ) : (
          <div 
            style={{ position: 'relative' }}
            onMouseEnter={() => setShowLogout(true)}
            onMouseLeave={() => setShowLogout(false)}
          >
            <div style={{
              padding: '10px 20px',
              background: '#eaf0ff',
              borderRadius: '8px',
              color: '#1453c6',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '18px' }}>👤</span>
              <span>Hi, {getFirstName(email)}</span>
            </div>
            
            {showLogout && (
              <div 
                onClick={handleLogout}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  // marginTop: '5px',
                  padding: '10px 20px',
                  background: 'white',
                  // border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#e74c3c',
                  cursor: 'pointer',
                  width: 'max-content',
                  zIndex: 10
                }}
              >
                Logout
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Cards Section */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '30px 50px',
        overflow: 'hidden'
      }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: '2rem',
          color: '#0941b9ff',
          marginBottom: '40px',
          fontWeight: '700',
          letterSpacing: '-0.5px'
        }}>
          Forsys Agentic Workforce
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '24px',
          width: '100%',
          maxWidth: '1300px'
        }}>
          {cards.map((card, idx) => {
            const isHovered = hoveredCard === idx;
            const isDisabledComingSoon = idx === 1 || idx === 2;   // QA & Coding
            const isClickable = isSignedIn && !isDisabledComingSoon;
            
            return (
              <div
                key={idx}
                onClick={() => handleCardClick(idx)}
                onMouseEnter={() => setHoveredCard(idx)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '28px 20px',
                  boxShadow: isHovered && isClickable 
                    ? '0 8px 24px rgba(20, 83, 198, 0.25)' 
                    : '0 4px 12px rgba(0,0,0,0.08)',
                  cursor: isClickable ? 'pointer' : 'not-allowed',
                  opacity: isClickable ? 1 : 0.5,
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  border: isHovered && isClickable ? '2px solid #1453c6' : '2px solid transparent',
                  transform: isHovered && isClickable ? 'translateY(-8px)' : 'translateY(0)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '260px'
                }}
              >
                {isDisabledComingSoon ? (
  <div style={{
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(255, 193, 7, 0.2)',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#b8860b',
    border: '1px solid rgba(255, 193, 7, 0.4)'
  }}>
    ⏳ Coming Soon
  </div>
) : !isSignedIn ? (
  <div style={{
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(255,255,255,0.95)',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#5a6c8d',
    border: '1px solid #e0e0e0'
  }}>
    🔒 Sign in required
  </div>
) : (
  <div style={{
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(76, 175, 80, 0.1)',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#2e7d32',
    border: '1px solid rgba(76, 175, 80, 0.3)'
  }}>
    ✓ Available
  </div>
)}


                <div style={{
                  width: '65px',
                  height: '65px',
                  background: isClickable && isHovered ? '#1453c6' : '#eaf0ff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '34px',
                  marginBottom: '18px',
                  transition: 'all 0.3s ease'
                }}>
                  {card.icon}
                </div>

                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  color: isClickable && isHovered ? '#1453c6' : '#1a2b50',
                  marginBottom: '10px',
                  transition: 'color 0.3s ease'
                }}>
                  {card.title}
                </h3>

                <p style={{
                  fontSize: '0.9rem',
                  color: '#5a6c8d',
                  lineHeight: '1.5',
                  flex: 1,
                  transition: 'all 0.3s ease'
                }}>
                  {isHovered && isClickable ? card.hoverDesc : card.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HomePage;