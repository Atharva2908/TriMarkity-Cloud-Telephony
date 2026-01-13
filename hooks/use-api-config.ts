"use client"

export const useApiConfig = () => {
  // ✅ FIXED: Proper environment detection
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
    (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? "http://localhost:8000" 
      : "https://trimarkity-cloud-telephony.onrender.com"
    )
  
  const wsUrl = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')
  
  return { 
    apiUrl, 
    wsUrl 
  }
}
