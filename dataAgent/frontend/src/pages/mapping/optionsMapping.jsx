import React, { useState , useCallback , useEffect} from 'react';
import { useLocation , useNavigate } from "react-router-dom";



const MappingOptions = () => {
  const location = useLocation();
  const navigate = useNavigate();
   const [email, setEmail] = useState(null);
    const [token, setToken] = useState(null);
   const [isLoading, setIsLoading] = useState(true);
  const [activeOption, setActiveOption] = useState('drive'); 
  // FIX 1: Correctly destructure useState for loading
  const [loading,setLoading] = useState(false);
  console.log(email);

  useEffect(() => {
      // Verify session with backend using cookie
      fetch(`${process.env.REACT_APP_BACKEND_URL}/api/verify-session`, {
        credentials: 'include'  // CRITICAL: Sends cookies
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('Not authenticated');
        }
        return res.json();
      })
      .then(data => {
        console.log('✅ Authenticated:', data.email);
        setEmail(data.email);
        setToken(data.access_token);
        
        // Store access token and email in localStorage for convenience
        if (data.access_token) {
          localStorage.setItem('google_access_token', data.access_token);
        }
        localStorage.setItem('user_email', data.email);
        
        setIsLoading(false);
      })
      .catch(error => {
        console.error('❌ Auth error:', error);
        // Redirect to landing page if not authenticated
        window.location.href = "http://localhost:3000";
      });
    }, []);

  const showDrive = useCallback(() => {
    setActiveOption('drive'); 
    navigate(`/DriveSelection?email=${email}`); 
}, [email, navigate]);
  
  const showLocal = () => {
    setActiveOption('local');
    navigate(`/FileSelection?email=${email}`); // Pass email for persistence
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f3f6fb 0%, #e8edf7 100%)',
      color: '#1a2b50',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      height: '100vh',
      overflow: 'hidden',
      padding: '20px',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      margin: 0,
      boxSizing: 'border-box',
      position: 'relative'
    }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      
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
 
      {/* Main Container */}
      <div style={{
        width: '100%',
        maxWidth: '700px'
      }}>
        <div style={{
          background: '#fff',
          padding: '30px',
          borderRadius: '20px',
          boxShadow: '0 15px 40px rgba(20, 83, 198, 0.12)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #1453c6, #2a6ce8, #4d8eff)'
          }} />

          <div style={{ marginBottom: '25px' }}>
            <p style={{
              color: '#5a6c8d',
              fontSize: '1.5rem',
              margin: 0,
              fontWeight: '500'
            }}>Select the file on which you want me to work on!</p>
          </div>

          {/* Option Cards */}
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '25px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <div 
              onClick={showDrive}
              style={{
                background: activeOption === 'drive' ? 'linear-gradient(135deg, #f0f5ff, #e6eeff)' : '#f8faff',
                borderRadius: '14px',
                padding: '20px',
                width: '200px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: activeOption === 'drive' ? '2px solid #2a6ce8' : '2px solid transparent',
                textAlign: 'center'
              }}
            >
              <div style={{
                width: '50px',
                height: '50px',
                background: 'linear-gradient(135deg, #eaf0ff, #d5e1ff)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: '#1453c6'
              }}>
                <i className="fab fa-google-drive" style={{ fontSize: '22px' }}></i>
              </div>
              <div style={{
                fontSize: '1.05rem',
                fontWeight: '600',
                marginBottom: '6px',
                color: '#1a2b50'
              }}>Google Drive</div>
              <div style={{
                color: '#5a6c8d',
                fontSize: '0.8rem',
                lineHeight: '1.4'
              }}>Access from Drive</div>
            </div>

            <div 
              onClick={showLocal}
              style={{
                background: activeOption === 'local' ? 'linear-gradient(135deg, #f0f5ff, #e6eeff)' : '#f8faff',
                borderRadius: '14px',
                padding: '20px',
                width: '200px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: activeOption === 'local' ? '2px solid #2a6ce8' : '2px solid transparent',
                textAlign: 'center'
              }}
            >
              <div style={{
                width: '50px',
                height: '50px',
                background: 'linear-gradient(135deg, #eaf0ff, #d5e1ff)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: '#1453c6'
              }}>
                <i className="fas fa-upload" style={{ fontSize: '22px' }}></i>
              </div>
              <div style={{
                fontSize: '1.05rem',
                fontWeight: '600',
                marginBottom: '6px',
                color: '#1a2b50'
              }}>Local Upload</div>
              <div style={{
                color: '#5a6c8d',
                fontSize: '0.8rem',
                lineHeight: '1.4'
              }}>Upload from computer</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Loader */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(255, 255, 255, 0.95)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div style={{
            border: '4px solid #e6eeff',
            borderTop: '4px solid #1a73e8',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            marginBottom: '15px'
          }} />
          <div style={{
            fontSize: '1.5rem',
            color: '#1a2b50',
            fontWeight: '600'
          }}>Loading...</div>
          <style>{`
            @keyframes spin {
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default MappingOptions;