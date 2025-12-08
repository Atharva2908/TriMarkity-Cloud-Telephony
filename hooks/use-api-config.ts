"use client"

export const useApiConfig = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://trimarkity-cloud-telephony.onrender.com"
  const wsUrl = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')
  
  return { apiUrl, wsUrl }
}
