import React, { useState, useEffect, useRef } from 'react';
import { useLocation , useNavigate } from "react-router-dom";

// Note: GoogleDrivePicker import is removed as we are using local file selection

const FileSelection = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [sourceFile, setSourceFile] = useState(null);
    const [targetFile, setTargetFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [cardVisible, setCardVisible] = useState(false);

    const [email , setEmail] = useState(null);
    const [token, setToken] = useState(null);

    // Refs for the hidden file inputs
    const sourceInputRef = useRef(null);
    const targetInputRef = useRef(null);

    
    const showLoader = (msg = "Loading...") => setLoading(msg);
    const hideLoader = () => setLoading(false);
    
    // useEffect(() => {
    //     // Verify session with backend using cookie
    //     fetch(`${process.env.REACT_APP_BASE_BACKEND_URL}/api/verify-session`, {
    //       credentials: 'include'  // CRITICAL: Sends cookies
    //     })
    //     .then(res => {
    //       if (!res.ok) {
    //         throw new Error('Not authenticated');
    //       }
    //       return res.json();
    //     })
    //     .then(data => {
    //       console.log('✅ Authenticated:', data.email);
    //       setEmail(data.email);
    //       setToken(data.access_token);
          
    //       // Store access token and email in localStorage for convenience
    //       if (data.access_token) {
    //         localStorage.setItem('google_access_token', data.access_token);
    //       }
    //       localStorage.setItem('user_email', data.email);
          
    //       setIsLoading(false);
    //     })
    //     .catch(error => {
    //       console.error('❌ Auth error:', error);
    //       // Redirect to landing page if not authenticated
    //       window.location.href = `${process.env.REACT_APP_FRONTEND_URL}`;
    //     });
    //   }, []);
 
    useEffect(() => {
        // 1. Get params from URL (Passed from MappingOptions)
        const queryParams = new URLSearchParams(window.location.search);
        const urlEmail = queryParams.get("email");
        const urlToken = queryParams.get("token");

        // 2. Get params from LocalStorage (Refresh / Back Button)
        const storedEmail = localStorage.getItem("user_email");
        const storedToken = localStorage.getItem("google_access_token");

        if (urlEmail && urlEmail !== "undefined") {
            console.log("📥 Receiving Session in File Selection...");
            
            // Save valid data to storage
            localStorage.setItem("user_email", urlEmail);
            if (urlToken) localStorage.setItem("google_access_token", urlToken);

            // Update State
            setEmail(urlEmail);
            setToken(urlToken);

            // 🧹 Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } 
        else if (storedEmail && storedEmail !== "undefined") {
            console.log("♻️ Restoring Session from Storage...");
            setEmail(storedEmail);
            setToken(storedToken);
        } 
        else {
            console.warn("⛔ No session found. Redirecting...");
            // Optional: Redirect to landing page
            // window.location.href = process.env.REACT_APP_BASE_FRONTEND_URL || '/';
        }
        
        setTimeout(() => setCardVisible(true), 100);
    }, []);

    useEffect(() => {
        setTimeout(() => setCardVisible(true), 100);
    }, []);
    
    // --- NEW: Handlers to trigger hidden file inputs ---
    const handleSourceSelectClick = () => {
        // Triggers the hidden file input element
        sourceInputRef.current.click();
    };

    const handleTargetSelectClick = () => {
        // Triggers the hidden file input element
        targetInputRef.current.click();
    };

    // --- NEW: Handlers for when a file is actually selected ---
    const handleSourceFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSourceFile(file);
        }
    };

    const handleTargetFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setTargetFile(file);
        }
    };
    // --------------------------------------------------------
    
    const handleContinue = async () => {
        if (!sourceFile || !targetFile || !email) {
        alert("Please select both files and ensure your email is present.");
        return;
    }
    if (!email) {
            alert("Session expired. Please refresh the page.");
            return;
        }
    const accessToken = token || localStorage.getItem('google_access_token');
    if (!accessToken) {
        alert("❌ No authentication token found. Please login again.");
        // Redirect to login page
        window.location.href = `${process.env.REACT_APP_FRONTEND_URL || '/'}`;
        return;
    }
     
    console.log('✅ All validation passed. Email:', email);
    console.log('✅ Token exists:', accessToken ? 'Yes' : 'No');
    showLoader("Uploading files...");
    
    try {
        // 1. Upload Source File
        const sourceUpload = await uploadFile(sourceFile);
        showLoader("Source file uploaded. Uploading Target file...");
        
        // 2. Upload Target File
        const targetUpload = await uploadFile(targetFile);
        showLoader("Starting Smart Mapping (May take 30-60 seconds)...");

        // 3. Run Mapping on the backend
        // 3. Run Mapping on the backend
const mappingResult = await startMapping(
    sourceUpload.local_path.replace(/\\/g, '/'),  // Normalize path
    targetUpload.local_path.replace(/\\/g, '/'),  // Normalize path
    email
);

        // 4. Success: Navigate and pass the mapping result
        hideLoader();
        alert(`Mapping successful! Result saved to Drive. URL: ${mappingResult.file_url}`);
        
        navigate('/finallink', {
            state: { 
                sourceFile: sourceUpload.name, // Pass names or paths as strings
                targetFile: targetUpload.name, 
                mapping: mappingResult.mapping,
                fileUrl: mappingResult.file_url,
                // Add any other details you need on the next page
                email: email,
                token: accessToken
            }
        });
        
    } catch (error) {
        console.error("Mapping Process Error:", error);
        hideLoader();
        alert(`Process Failed: ${error.message}. Check the console for details.`);
        if (error.message.includes('authentication') || 
            error.message.includes('login') || 
            error.message.includes('credentials')) {
            alert(`${error.message}\n\nRedirecting to login page...`);
            setTimeout(() => {
                window.location.href = `${process.env.REACT_APP_FRONTEND_URL || '/'}`;
            }, 2000);
        } else {
            alert(`❌ Process Failed: ${error.message}\n\nCheck the console for details.`);
        }
    }
    };

    const handleLogout = async () => {
    // 1. Clear Local Storage (Crucial)
    localStorage.removeItem("user_email");
    localStorage.removeItem("google_access_token");
    
    // 3. Redirect to Landing Page
    window.location.href = `${process.env.REACT_APP_BASE_FRONTEND_URL}?action=logout`;
  };


    const isReadyToContinue = sourceFile !== null && targetFile !== null;

    // Add this inside the FileSelection component, before handleContinue

const BACKEND_URL = `${process.env.REACT_APP_BASE_BACKEND_URL}/api/mapping`;

// Helper to upload a single file
const uploadFile = async (file) => {
    const userEmail = email; // Use the email derived from the URL
    const accessToken = token || localStorage.getItem('google_access_token');
    if (!accessToken) {
        throw new Error('❌ No authentication token found. Please login again.');
    }
    const formData = new FormData();
    formData.append('email', userEmail);
    formData.append('file', file);
    
    // Calls the /api/upload_local route
    const response = await fetch(`${process.env.REACT_APP_BASE_BACKEND_URL}/api/upload_local`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`  // ✅ CRITICAL: Send token here
        },
        body: formData,
    });
    
    if (!response.ok) {
        let errorData = await response.text();
        try { errorData = JSON.parse(errorData); } catch {}
        throw new Error(`Upload failed for ${file.name}: ${errorData.detail || errorData.error || response.statusText}`);
    }
    // Returns { name, local_path, preview }
    return response.json(); 
};

// Helper to call the smart mapping endpoint
const startMapping = async (hostFilePath, targetFilePath, userEmail) => {
    const accessToken = token || localStorage.getItem('google_access_token');
    
    if (!accessToken) {
        throw new Error('❌ No authentication token found. Please login again.');
    }
    
    console.log('🔑 Starting mapping with token for:', userEmail);
    const formData = new FormData();
    formData.append('email', userEmail);
    // Use the 'local_path' result from the uploads as the file ID surrogate
    formData.append('host_file_id' , hostFilePath);
    formData.append('target_file_id' , targetFilePath);
    formData.append('host_system', 'Host System');
    formData.append('target_system', 'Target System');

    // Calls the /api/smart_mapping_with_files route
    const response = await fetch(`${BACKEND_URL}/smart_mapping_with_files`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`  // ✅ CRITICAL: Send token here
        },
        body: formData,
    });

    if (!response.ok) {
        let errorData = await response.text();
        try { errorData = JSON.parse(errorData); } catch {}
        throw new Error(`Mapping execution failed: ${errorData.detail || errorData.error || response.statusText}`);
    }

    return response.json(); // Returns the mapping result (mapping, file_url, preview, etc.)
};

// ...

    // The Google Picker related function is removed/skipped as it's no longer needed for local files.
    
    return (
        <>
            <link
                rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
            />

            {/* FIXED TOP-RIGHT LOGOUT BUTTON (Kept for completeness) */}
            <div
                style={{
                    position: "fixed",
                    top: "50px",
                    right: "50px",
                    display: "flex",
                    gap: "12px",
                    zIndex: 9999,
                }}
            >
                <button
                    onClick={{handleLogout}}
                    style={{
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "10px",
                        padding: "10px 20px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.95rem",
                        transition: "all 0.3s",
                        boxShadow: "0 4px 12px rgba(220, 53, 69, 0.2)",
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = "#bb2d3b";
                        e.target.style.transform = "translateY(-2px)";
                        e.target.style.boxShadow = "0 6px 16px rgba(220, 53, 69, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = "#dc3545";
                        e.target.style.transform = "translateY(0)";
                        e.target.style.boxShadow = "0 4px 12px rgba(220, 53, 69, 0.2)";
                    }}
                >
                    <i className="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>

            {/* Full Screen Container */}
            <div
                style={{
                    background: "linear-gradient(135deg, #f3f6fb 0%, #e8edf7 100%)",
                    color: "#1a2b50",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    padding: "10px",
                    overflow: "hidden",
                    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
                }}
            >
                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>

                {/* Main Card */}
                <div
                    style={{
                        background: "#fff",
                        padding: "35px 28px",
                        borderRadius: "20px",
                        boxShadow: "0 10px 30px rgba(20, 83, 198, 0.12)",
                        textAlign: "center",
                        width: "100%",
                        maxWidth: "480px",
                        position: "relative",
                        overflow: "hidden",
                        opacity: cardVisible ? 1 : 0,
                        transform: cardVisible ? "translateY(0)" : "translateY(20px)",
                        transition: "opacity 0.5s ease, transform 0.5s ease",
                    }}
                >
                    {/* Top Accent */}
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "4px",
                            background: "linear-gradient(90deg, #1453c6, #2a6ce8, #4d8eff)",
                        }}
                    />

                    {/* File Icon */}
                    <div
                        style={{
                            width: "80px",
                            height: "80px",
                            background: "linear-gradient(135deg, #eaf0ff 0%, #d5e1ff 100%)",
                            borderRadius: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 20px",
                            fontSize: "32px",
                            color: "#1453c6",
                            boxShadow: "0 10px 20px rgba(20, 83, 198, 0.15)",
                            animation: "pulse 2s infinite",
                        }}
                    >
                        <i className="fas fa-upload"></i> {/* Changed icon to upload */}
                    </div>

                    {/* Title */}
                    <p
                        style={{
                            color: "#5a6c8d",
                            fontSize: "1.25rem",
                            marginBottom: "22px",
                        }}
                    >
                        Select Source and Target Files
                    </p>

                    {/* SOURCE FILE SELECTION */}
                    <div
                        style={{
                            background: "#f8faff",
                            borderRadius: "14px",
                            padding: "16px",
                            marginBottom: "16px",
                            border: "1px solid #e6eeff",
                        }}
                    >
                        <span
                            style={{
                                display: "block",
                                fontSize: "0.85rem",
                                color: "#5a6c8d",
                                marginBottom: "10px",
                            }}
                        >
                            Source File (From Local Drive)
                        </span>

                        {/* Hidden Input for Source File */}
                        <input
                            type="file"
                            ref={sourceInputRef}
                            onChange={handleSourceFileChange}
                            style={{ display: 'none' }}
                            // Allow common data formats
                            accept=".json,.csv,.xml,.xlsx,.txt" 
                        />

                        <button
                            onClick={handleSourceSelectClick}
                            style={{
                                background: "linear-gradient(135deg, #1453c6, #2a6ce8)",
                                color: "white",
                                border: "none",
                                borderRadius: "10px",
                                padding: "10px 20px",
                                fontWeight: "600",
                                cursor: "pointer",
                                fontSize: "0.95rem",
                                transition: "all 0.3s",
                                boxShadow: "0 4px 12px rgba(20, 83, 198, 0.2)",
                                width: "100%",
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = "translateY(-2px)";
                                e.target.style.boxShadow = "0 6px 16px rgba(20, 83, 198, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = "translateY(0)";
                                e.target.style.boxShadow = "0 4px 12px rgba(20, 83, 198, 0.2)";
                            }}
                        >
                            <i className="fas fa-file-upload"></i> {sourceFile ? 'Change Source File' : 'Select Source File'}
                        </button>

                        {sourceFile && (
                            <div
                                style={{
                                    marginTop: "12px",
                                    fontWeight: "700",
                                    color: "#1453c6",
                                    fontSize: "0.95rem",
                                    wordBreak: "break-word",
                                }}
                            >
                                <i className="fas fa-check-circle" style={{ color: "#2ecc71", marginRight: "6px" }}></i>
                                {sourceFile.name}
                            </div>
                        )}
                    </div>

                    {/* TARGET FILE SELECTION */}
                    <div
                        style={{
                            background: "#f8faff",
                            borderRadius: "14px",
                            padding: "16px",
                            marginBottom: "20px",
                            border: "1px solid #e6eeff",
                        }}
                    >
                        <span
                            style={{
                                display: "block",
                                fontSize: "0.85rem",
                                color: "#5a6c8d",
                                marginBottom: "10px",
                            }}
                        >
                            Target File (From Local Drive)
                        </span>

                        {/* Hidden Input for Target File */}
                        <input
                            type="file"
                            ref={targetInputRef}
                            onChange={handleTargetFileChange}
                            style={{ display: 'none' }}
                            // Allow common data formats
                            accept=".json,.csv,.xml,.xlsx,.txt"
                        />

                        <button
                            onClick={handleTargetSelectClick}
                            style={{
                                background: "linear-gradient(135deg, #1453c6, #2a6ce8)",
                                color: "white",
                                border: "none",
                                borderRadius: "10px",
                                padding: "10px 20px",
                                fontWeight: "600",
                                cursor: "pointer",
                                fontSize: "0.95rem",
                                transition: "all 0.3s",
                                boxShadow: "0 4px 12px rgba(230, 126, 34, 0.2)",
                                width: "100%",
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = "translateY(-2px)";
                                e.target.style.boxShadow = "0 6px 16px rgba(230, 126, 34, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = "translateY(0)";
                                e.target.style.boxShadow = "0 4px 12px rgba(230, 126, 34, 0.2)";
                            }}
                        >
                            <i className="fas fa-file-upload"></i> {targetFile ? 'Change Target File' : 'Select Target File'}
                        </button>

                        {targetFile && (
                            <div
                                style={{
                                    marginTop: "12px",
                                    fontWeight: "700",
                                    color: "#1453c6",
                                    fontSize: "0.95rem",
                                    wordBreak: "break-word",
                                }}
                            >
                                <i className="fas fa-check-circle" style={{ color: "#2ecc71", marginRight: "6px" }}></i>
                                {targetFile.name}
                            </div>
                        )}
                    </div>

                    {/* CONFIRM BUTTON */}
                    <button
                        onClick={handleContinue}
                        disabled={!isReadyToContinue || loading}
                        style={{
                            background: !isReadyToContinue || loading
                                ? "#ccc"
                                : "linear-gradient(135deg, #27ae60, #2ecc71)",
                            color: "#fff",
                            padding: "14px 26px",
                            border: "none",
                            borderRadius: "12px",
                            fontSize: "1rem",
                            fontWeight: "600",
                            cursor: !isReadyToContinue || loading ? "not-allowed" : "pointer",
                            transition: "all 0.3s ease",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "10px",
                            width: "100%",
                        }}
                    >
                        {loading ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> Processing...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-check-circle"></i>
                                Confirm & Continue
                            </>
                        )}
                    </button>

                    {/* Loader */}
                    {loading && (
                        <div
                            style={{
                                marginTop: "20px",
                                color: "#5a6c8d",
                                fontSize: "0.95rem",
                                padding: "14px",
                                background: "#f8faff",
                                borderRadius: "12px",
                                border: "1px solid #e6eeff",
                                display: "flex",
                                gap: "10px",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <div
                                style={{
                                    border: "3px solid rgba(20, 83, 198, 0.2)",
                                    borderTop: "3px solid #1453c6",
                                    borderRadius: "50%",
                                    width: "22px",
                                    height: "22px",
                                    animation: "spin 1s linear infinite",
                                }}
                            />
                            <span>Processing your selection... Please wait</span>
                        </div>
                    )}

                    <div
                        style={{
                            marginTop: "15px",
                            fontSize: "0.8rem",
                            color: "#8a9bb8",
                        }}
                    >
                        Your data will be uploaded and processed securely.
                    </div>
                </div>

                {/* Back link */}
                <div
                    style={{
                        marginTop: "10px",
                        color: "#5a6c8d",
                        fontSize: "0.9rem",
                    }}
                >
                    <a
                        href={`/mapping/optionsMapping?email=${email}`}
                        style={{
                            color: "#1453c6",
                            textDecoration: "none",
                            display: "inline-flex",
                            gap: "5px",
                            alignItems: "center",

                        }}
                    >
                        <i className="fas fa-arrow-left"></i> Back to Options
                    </a>
                </div>
                {/* Removed GoogleDrivePicker component */}
            </div>
        </>
    );
};

export default FileSelection;