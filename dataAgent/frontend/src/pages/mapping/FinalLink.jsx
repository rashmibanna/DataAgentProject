import React from "react";
import { useLocation } from "react-router-dom";

const FinalLink = () => {
  // 1. Retrieve the location object from React Router
    const location = useLocation();
    
    // 2. Safely extract the fileUrl from the navigation state
    //    We assume the fileUrl is passed under the key 'fileUrl'
    const fileUrl = location.state?.fileUrl || '#'; 
    
    // Determine if we have a valid link to display
    const isLinkValid = fileUrl !== '#';
  return(
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #f3f6fb 0%, #e8edf7 100%)',
      overflow: 'hidden'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #e9f8f2, #d1f2e6)',
        color: '#155724',
        borderRadius: '12px',
        padding: '30px',
        textAlign: 'left',
        lineHeight: '1.6',
        fontSize: '1rem',
        borderLeft: '4px solid #198754',
        boxShadow: '0 4px 12px rgba(25, 135, 84, 0.15)',
        maxWidth: '650px',
        width: '100%'
      }}>
        <h3 style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '15px',
          margin: '0 0 15px 0'
        }}>
          <i className="fas fa-check-circle"></i> Mapping Complete!
        </h3>
        <div className="stats" style={{ 
          marginTop: '15px', 
          display: 'flex', 
          gap: '20px', 
          justifyContent: 'center' 
        }}>
          
        </div>
        <p style={{ 
          marginTop: '15px', 
          fontSize: '1rem', 
          color: '#2c3e50', 
          textAlign: 'center',
          margin: '15px 0 0 0'
        }}>
          The Mapping results have been saved to your Google Drive.{' '}
          <span style={{ fontSize: "15px" }}>
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#0b58ca', 
                fontWeight: '600', 
                textDecoration: 'none',
                transition: 'color 0.3s',
                wordBreak: 'break-all'
              }}
              onMouseOver={(e) => {
                                    if (isLinkValid) {
                                        e.target.style.color = '#2a6ce8';
                                        e.target.style.textDecoration = 'underline';
                                    }
                                }}
                                onMouseOut={(e) => {
                                    if (isLinkValid) {
                                        e.target.style.color = '#0b58ca';
                                        e.target.style.textDecoration = 'none';
                                    }
                                }}
            >
              Click here
            </a>
            &nbsp;to view the result file
          </span>
        </p>
      </div>
    </div>
  )
};

export default FinalLink;