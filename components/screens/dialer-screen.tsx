"use client"

import { useState, useEffect, useRef, KeyboardEvent } from "react"
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Loader2,
  AlertCircle,
  Circle,
  RotateCcw,
  FileText,
  Download,
  Hash,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCallApi } from "@/hooks/use-call-api"
import { useWebhookCalls } from "@/hooks/use-webhook-calls"
import { useApiConfig } from "@/hooks/use-api-config"
import type { CallState, CallStatus } from "@/hooks/use-call-api"
import { TelnyxRTC } from '@telnyx/webrtc'

// Telnyx WebRTC client singleton
let telnyxClient: any = null
let currentWebRTCCall: any = null

type Contact = {
  id?: string | number
  name: string
  phone: string
}

type DialerScreenProps = {
  contacts: Contact[]
  demoMode?: boolean
  onCallStateChange?: (state: CallState | null) => void
}

// Subset: fill this list with all countries from your data
// Subset: fill this list with all countries from your data
const countryCodes = [
  { country: "Afghanistan", code: "+93" },
  { country: "Albania", code: "+355" },
  { country: "Algeria", code: "+213" },
  { country: "Andorra", code: "+376" },
  { country: "Angola", code: "+244" },
  { country: "Antarctica Territories", code: "+672" },
  { country: "Argentina", code: "+54" },
  { country: "Armenia", code: "+374" },
  { country: "Aruba", code: "+297" },
  { country: "Ascension Island", code: "+247" },
  { country: "Australia", code: "+61" },
  { country: "Austria", code: "+43" },
  { country: "Azerbaijan", code: "+994" },
  { country: "Bahrain", code: "+973" },
  { country: "Bangladesh", code: "+880" },
  { country: "Belarus", code: "+375" },
  { country: "Belgium", code: "+32" },
  { country: "Belize", code: "+501" },
  { country: "Benin", code: "+229" },
  { country: "Bhutan", code: "+975" },
  { country: "Bolivia", code: "+591" },
  { country: "Bosnia & Herzegovina", code: "+387" },
  { country: "Botswana", code: "+267" },
  { country: "Brazil", code: "+55" },
  { country: "Brunei", code: "+673" },
  { country: "Bulgaria", code: "+359" },
  { country: "Burkina Faso", code: "+226" },
  { country: "Burundi", code: "+257" },
  { country: "Cameroon", code: "+237" },
  { country: "Cape Verde", code: "+238" },
  { country: "Central African Republic", code: "+236" },
  { country: "Chad", code: "+235" },
  { country: "Chile", code: "+56" },
  { country: "China", code: "+86" },
  { country: "Canada", code: "+1" },
  { country: "Colombia", code: "+57" },
  { country: "Comoros", code: "+269" },
  { country: "Cook Islands", code: "+682" },
  { country: "Costa Rica", code: "+506" },
  { country: "Côte d’Ivoire", code: "+225" },
  { country: "Croatia", code: "+385" },
  { country: "Cuba", code: "+53" },
  { country: "Cyprus", code: "+357" },
  { country: "Czech Republic", code: "+420" },
  { country: "Denmark", code: "+45" },
  { country: "Diego Garcia", code: "+246" },
  { country: "Djibouti", code: "+253" },
  { country: "DR Congo", code: "+243" },
  { country: "Ecuador", code: "+593" },
  { country: "Egypt", code: "+20" },
  { country: "El Salvador", code: "+503" },
  { country: "Equatorial Guinea", code: "+240" },
  { country: "Eritrea", code: "+291" },
  { country: "Estonia", code: "+372" },
  { country: "Eswatini", code: "+268" },
  { country: "Ethiopia", code: "+251" },
  { country: "Falkland Islands", code: "+500" },
  { country: "Faroe Islands", code: "+298" },
  { country: "Fiji", code: "+679" },
  { country: "Finland", code: "+358" },
  { country: "France", code: "+33" },
  { country: "French Polynesia", code: "+689" },
  { country: "Gabon", code: "+241" },
  { country: "Gambia", code: "+220" },
  { country: "Georgia", code: "+995" },
  { country: "Germany", code: "+49" },
  { country: "Ghana", code: "+233" },
  { country: "Gibraltar", code: "+350" },
  { country: "Greece", code: "+30" },
  { country: "Greenland", code: "+299" },
  { country: "Guatemala", code: "+502" },
  { country: "Guinea", code: "+224" },
  { country: "Guinea-Bissau", code: "+245" },
  { country: "Haiti", code: "+509" },
  { country: "Honduras", code: "+504" },
  { country: "Hungary", code: "+36" },
  { country: "Iceland", code: "+354" },
  { country: "India", code: "+91" },
  { country: "Indonesia", code: "+62" },
  { country: "Iran", code: "+98" },
  { country: "Iraq", code: "+964" },
  { country: "Ireland", code: "+353" },
  { country: "Israel", code: "+972" },
  { country: "Italy/Vatican", code: "+39" },
  { country: "Japan", code: "+81" },
  { country: "Kazakhstan", code: "+7" },
  { country: "Kenya", code: "+254" },
  { country: "Kiribati", code: "+686" },
  { country: "Kosovo", code: "+383" },
  { country: "Kyrgyzstan", code: "+996" },
  { country: "Latvia", code: "+371" },
  { country: "Lebanon", code: "+961" },
  { country: "Lesotho", code: "+266" },
  { country: "Liberia", code: "+231" },
  { country: "Libya", code: "+218" },
  { country: "Liechtenstein", code: "+423" },
  { country: "Lithuania", code: "+370" },
  { country: "Luxembourg", code: "+352" },
  { country: "Madagascar", code: "+261" },
  { country: "Malawi", code: "+265" },
  { country: "Malaysia", code: "+60" },
  { country: "Maldives", code: "+960" },
  { country: "Mali", code: "+223" },
  { country: "Malta", code: "+356" },
  { country: "Marshall Islands", code: "+692" },
  { country: "Mauritania", code: "+222" },
  { country: "Mauritius", code: "+230" },
  { country: "Mexico", code: "+52" },
  { country: "Micronesia", code: "+691" },
  { country: "Moldova", code: "+373" },
  { country: "Monaco", code: "+377" },
  { country: "Mongolia", code: "+976" },
  { country: "Montenegro", code: "+382" },
  { country: "Morocco", code: "+212" },
  { country: "Mozambique", code: "+258" },
  { country: "Myanmar", code: "+95" },
  { country: "Namibia", code: "+264" },
  { country: "Nauru", code: "+674" },
  { country: "Nepal", code: "+977" },
  { country: "Netherlands", code: "+31" },
  { country: "New Caledonia", code: "+687" },
  { country: "New Zealand", code: "+64" },
  { country: "Nicaragua", code: "+505" },
  { country: "Niger", code: "+227" },
  { country: "Nigeria", code: "+234" },
  { country: "Niue", code: "+683" },
  { country: "North Macedonia", code: "+389" },
  { country: "Norway", code: "+47" },
  { country: "Pakistan", code: "+92" },
  { country: "Palau", code: "+680" },
  { country: "Palestine", code: "+970" },
  { country: "Panama", code: "+507" },
  { country: "Papua New Guinea", code: "+675" },
  { country: "Peru", code: "+51" },
  { country: "Philippines", code: "+63" },
  { country: "Poland", code: "+48" },
  { country: "Portugal", code: "+351" },
  { country: "Qatar", code: "+974" },
  { country: "Republic of the Congo", code: "+242" },
  { country: "Romania", code: "+40" },
  { country: "Russia", code: "+7" },
  { country: "Rwanda", code: "+250" },
  { country: "Saint Pierre & Miquelon", code: "+508" },
  { country: "Samoa", code: "+685" },
  { country: "San Marino", code: "+378" },
  { country: "São Tomé & Príncipe", code: "+239" },
  { country: "Saudi Arabia", code: "+966" },
  { country: "Senegal", code: "+221" },
  { country: "Serbia", code: "+381" },
  { country: "Seychelles", code: "+248" },
  { country: "Sierra Leone", code: "+232" },
  { country: "Singapore", code: "+65" },
  { country: "Slovakia", code: "+421" },
  { country: "Slovenia", code: "+386" },
  { country: "Solomon Islands", code: "+677" },
  { country: "Somalia", code: "+252" },
  { country: "South Africa", code: "+27" },
  { country: "South Korea", code: "+82" },
  { country: "Spain", code: "+34" },
  { country: "Sri Lanka", code: "+94" },
  { country: "Sudan", code: "+249" },
  { country: "Suriname", code: "+597" },
  { country: "Sweden", code: "+46" },
  { country: "Switzerland", code: "+41" },
  { country: "Syria", code: "+963" },
  { country: "Taiwan", code: "+886" },
  { country: "Tajikistan", code: "+992" },
  { country: "Tanzania", code: "+255" },
  { country: "Thailand", code: "+66" },
  { country: "Timor-Leste", code: "+670" },
  { country: "Togo", code: "+228" },
  { country: "Tokelau", code: "+690" },
  { country: "Tonga", code: "+676" },
  { country: "Tunisia", code: "+216" },
  { country: "Turkey", code: "+90" },
  { country: "Turkmenistan", code: "+993" },
  { country: "Tuvalu", code: "+688" },
  { country: "UAE", code: "+971" },
  { country: "Uganda", code: "+256" },
  { country: "Ukraine", code: "+380" },
  { country: "United Kingdom", code: "+44" },
  { country: "United States", code: "+1" },
  { country: "Uruguay", code: "+598" },
  { country: "Uzbekistan", code: "+998" },
  { country: "Vanuatu", code: "+678" },
  { country: "Venezuela", code: "+58" },
  { country: "Vietnam", code: "+84" },
  { country: "Wallis & Futuna", code: "+681" },
  { country: "Zambia", code: "+260" },
  { country: "Zimbabwe", code: "+263" }
];



function isE164(number: string) {
  return /^\+\d{10,15}$/.test(number)
}

export function DialerScreen({
  contacts,
  demoMode = false,
  onCallStateChange,
}: DialerScreenProps) {
  const [selectedCountryCode, setSelectedCountryCode] = useState(countryCodes[0].code)
  const [localNumber, setLocalNumber] = useState("")
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const [lastDialedNumber, setLastDialedNumber] = useState<string | null>(null)
  const [lastDialedContact, setLastDialedContact] = useState<Contact | null>(null)

  const [callNotes, setCallNotes] = useState("")
  const [savedNotes, setSavedNotes] = useState<
    { callId: string; to: string; notes: string; timestamp: string; recordingUrl?: string }[]
  >([])

  // WebRTC specific states
  const [webrtcReady, setWebrtcReady] = useState(false)
  const [webrtcError, setWebrtcError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Recording URL state
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)

  // Keypad toggle state
  const [showKeypad, setShowKeypad] = useState(false)

  // Use API config hook
  const { apiUrl } = useApiConfig()

  const { subscribe, isConnected } = useWebhookCalls(apiUrl)
  const {
    callState,
    setCallState,
    isConnecting,
    initiateCall,
    hangupCall,
    toggleMute,
    toggleSpeaker,
    toggleRecording,
    clearCall,
  } = useCallApi({ apiUrl })

  const fullDialedNumber = selectedCountryCode + localNumber.replace(/^0+/, "")

  // Initialize Telnyx WebRTC client
  useEffect(() => {
    if (!telnyxClient) {
      console.log('🔌 Initializing Telnyx WebRTC client...')
      
      telnyxClient = new TelnyxRTC({
        login: 'TriMarkity',
        password: 'Harshall@1002',
      })

      telnyxClient.on('telnyx.ready', () => {
        console.log('✅ Telnyx WebRTC client registered and ready')
        setWebrtcReady(true)
        setWebrtcError(null)
      })

      telnyxClient.on('telnyx.error', (error: any) => {
        const errorMsg = error?.message || JSON.stringify(error)
        if (errorMsg.includes('bye') || errorMsg.includes('failed!') || errorMsg === '{}') {
          console.log('ℹ️ Normal call disconnect (bye)')
          return
        }
        
        console.error('❌ Telnyx WebRTC error:', error)
        setWebrtcError('WebRTC connection failed')
        setWebrtcReady(false)
      })

      telnyxClient.on('telnyx.notification', (notification: any) => {
        console.log('📞 WebRTC Notification:', notification)
      
        if (notification.type === 'callUpdate') {
          const call = notification.call
          currentWebRTCCall = call

          if (call.remoteStream && audioRef.current) {
            if (audioRef.current.srcObject !== call.remoteStream) {
              audioRef.current.srcObject = call.remoteStream
              
              audioRef.current.play().catch((err) => {
                console.error('❌ Audio play error:', err)
                const playAudio = () => {
                  audioRef.current?.play()
                  document.removeEventListener('click', playAudio)
                }
                document.addEventListener('click', playAudio, { once: true })
              })
              
              console.log('🔊 Remote audio stream attached')
            }
          }

          if (call.state === 'new') {
            console.log('📱 WebRTC Call: new (incoming to browser)')
          } else if (call.state === 'trying') {
            console.log('📱 WebRTC Call: trying')
          } else if (call.state === 'ringing') {
            console.log('📱 WebRTC Call: ringing')
            setCallState(prev => prev ? { ...prev, status: 'ringing' } : prev)
          } else if (call.state === 'active') {
            console.log('📱 WebRTC Call: active (audio flowing)')
            setCallState(prev => prev ? { ...prev, status: 'active' } : prev)
          } else if (call.state === 'done') {
            console.log('📱 WebRTC Call: done')
            setCallState(prev => prev ? { ...prev, status: 'ended' } : prev)
            currentWebRTCCall = null
            
            if (audioRef.current && audioRef.current.srcObject) {
              audioRef.current.srcObject = null
            }
          }
        }
      })

      telnyxClient.connect()
    }

    return () => {
      if (telnyxClient) {
        telnyxClient.disconnect()
        telnyxClient = null
      }
    }
  }, [setCallState])

  // Poll for recording status after call becomes active
  useEffect(() => {
    if (!callState || callState.status !== 'active') return
    
    let pollCount = 0
    const maxPolls = 5
    
    const pollRecordingStatus = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/webrtc/status/${callState.call_id}`)
        if (response.ok) {
          const data = await response.json()
          
          if (data.is_recording) {
            console.log('🔴 Recording confirmed via polling')
            setCallState(prev => prev ? { ...prev, isRecording: true } : prev)
            return true
          }
        }
      } catch (e) {
        console.error('Recording status poll error:', e)
      }
      return false
    }
    
    // Start polling 2 seconds after call becomes active
    const pollInterval = setInterval(async () => {
      pollCount++
      const recordingActive = await pollRecordingStatus()
      
      if (recordingActive || pollCount >= maxPolls) {
        clearInterval(pollInterval)
      }
    }, 2000)
    
    return () => clearInterval(pollInterval)
  }, [callState?.status, callState?.call_id, apiUrl, setCallState])

  // Fetch recording URL after call ends
  useEffect(() => {
    if (!callState || callState.status !== 'ended' || !callState.call_id) return
    
    const fetchRecordingUrl = async () => {
      try {
        // Wait a few seconds for recording to be saved
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        const response = await fetch(`${apiUrl}/api/webrtc/status/${callState.call_id}`)
        if (response.ok) {
          const data = await response.json()
          
          if (data.recording_url) {
            console.log('💾 Recording URL retrieved:', data.recording_url)
            setRecordingUrl(data.recording_url)
          }
        }
      } catch (e) {
        console.error('Failed to fetch recording URL:', e)
      }
    }
    
    fetchRecordingUrl()
  }, [callState?.status, callState?.call_id, apiUrl])

  // WebSocket subscription with recording sync
  useEffect(() => {
    let isMounted = true

    const unsubscribe = subscribe({
      onCallUpdate: (data: any) => {
        if (!isMounted) return
        if (!callState || data.call_id !== callState.call_id) return

        const rawStatus: string = data.status ?? data.call_state ?? callState.status

        const nextStatus: CallStatus =
          rawStatus === "completed" || rawStatus === "hangup"
            ? "ended"
            : ((rawStatus as CallStatus) || callState.status)

        setCallState((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            status: nextStatus,
            duration: data.duration ?? prev.duration ?? 0,
            isRecording: data.is_recording ?? prev.isRecording ?? false,
          }
        })

        // Update recording URL if available
        if (data.recording_url) {
          setRecordingUrl(data.recording_url)
        }

        if (
          rawStatus === "ended" ||
          rawStatus === "failed" ||
          rawStatus === "completed" ||
          rawStatus === "hangup"
        ) {
          clearCall()
        }
      },
      onError: () => {
        console.log("WebSocket unavailable, using polling")
      },
    })

    return () => {
      isMounted = false
      if (typeof unsubscribe === "function") {
        unsubscribe()
      }
    }
  }, [subscribe, callState?.call_id, setCallState, clearCall, callState])

  // Bubble call state up
  useEffect(() => {
    onCallStateChange?.(callState ?? null)
  }, [callState, onCallStateChange])

  const dialPad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

  const isCallActive =
    !!callState &&
    (callState.status === "dialing" ||
      callState.status === "ringing" ||
      callState.status === "active")

  const statusLabel = (() => {
    if (!callState) {
      if (isConnecting) return "Dialing"
      if (!webrtcReady) return "Initializing WebRTC..."
      return demoMode ? "Demo Mode" : "Ready to dial"
    }
    switch (callState.status) {
      case "dialing":
        return "Dialing"
      case "ringing":
        return "Ringing"
      case "active":
        return "On Call"
      case "ended":
        return "Call Ended"
      case "failed":
        return "Call Failed"
      default:
        return callState.status
    }
  })()

  const formattedDuration = (() => {
    const d = callState?.duration ?? 0
    const minutes = String(Math.floor(d / 60)).padStart(2, "0")
    const seconds = String(d % 60).padStart(2, "0")
    return `${minutes}:${seconds}`
  })()

  const handleDial = (digit: string) => {
    if (localNumber.length < 15) {
      setLocalNumber((prev) => prev + digit)
    }
    if (isCallActive && currentWebRTCCall) {
      currentWebRTCCall.dtmf(digit)
    }
  }

  // Send DTMF tones during active call
  const sendDTMF = async (digit: string) => {
    if (!callState || callState.status !== 'active') {
      console.warn('⚠️ Cannot send DTMF - call not active')
      return
    }

    try {
      // Send via WebRTC (instant)
      if (currentWebRTCCall && typeof currentWebRTCCall.dtmf === 'function') {
        currentWebRTCCall.dtmf(digit)
        console.log(`🔊 Sent DTMF: ${digit}`)
      }
      
      // Also send via API (backup)
      await fetch(`${apiUrl}/api/outbound/send-dtmf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_control_id: callState.call_id,
          digits: digit
        })
      })
    } catch (error) {
      console.error('❌ DTMF send error:', error)
    }
  }

  const handleBackspace = () => {
    setLocalNumber((prev) => prev.slice(0, -1))
  }

  const handleCall = async () => {
    if (!localNumber || isConnecting || !webrtcReady) {
      if (!webrtcReady) {
        setWebrtcError('WebRTC not ready yet')
      }
      return
    }

    if (!isE164(fullDialedNumber)) {
      alert("Please enter a valid phone number (country code + number), e.g. +12345678901")
      return
    }

    try {
      const response = await fetch(`${apiUrl}/api/webrtc/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_number: fullDialedNumber,
          from_number: selectedCountryCode,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log('✅ PSTN call initiated:', data)

      setCallState({
        call_id: data.call_id,
        from_number: data.from,
        to_number: data.to,
        status: "dialing",
        duration: 0,
        isMuted: false,
        isOnHold: false,
        speakerOn: true,
        isRecording: false,
      })

      if (telnyxClient && currentWebRTCCall === null) {
        console.log('📞 Making WebRTC call from browser to:', fullDialedNumber)
        
        currentWebRTCCall = telnyxClient.newCall({
          destinationNumber: fullDialedNumber,
          callerNumber: data.from,
        })

        console.log('✅ WebRTC call created, waiting for ringing...')
      }

      setLastDialedNumber(fullDialedNumber)
      setLastDialedContact(selectedContact ?? null)
      setCallNotes("")
      setRecordingUrl(null)
    } catch (error) {
      console.error("[DialerScreen] Call initiation error:", error)
      setCallState({
        call_id: `error-${Date.now()}`,
        from_number: selectedCountryCode,
        to_number: fullDialedNumber,
        status: "failed",
        duration: 0,
        isMuted: false,
        isOnHold: false,
        speakerOn: true,
        isRecording: false,
        error: error instanceof Error ? error.message : "Failed to initiate call",
      })
    }
  }

  const handleEndCall = async () => {
    try {
      if (currentWebRTCCall) {
        try {
          currentWebRTCCall.hangup()
          console.log('✅ WebRTC call hung up')
        } catch (e) {
          console.error('WebRTC hangup error:', e)
        }
        currentWebRTCCall = null
      }
      
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.srcObject = null
      }
      
      await hangupCall()
      
    } catch (e) {
      console.error("Failed to hang up:", e)
    } finally {
      if (callState && (callNotes.trim() || recordingUrl)) {
        setSavedNotes((prev) => [
          {
            callId: callState.call_id,
            to: fullDialedNumber,
            notes: callNotes.trim(),
            timestamp: new Date().toISOString(),
            recordingUrl: recordingUrl || undefined,
          },
          ...prev,
        ])
      }

      clearCall()
      setLocalNumber("")
      setSelectedContact(null)
      setCallNotes("")
      setRecordingUrl(null)
      setShowKeypad(false)
    }
  }

  const handleContactClick = (contact: Contact, autoDial?: boolean) => {
    setSelectedContact(contact)

    if (contact.phone && contact.phone.startsWith("+")) {
      const code = countryCodes.find((c) => contact.phone.startsWith(c.code))?.code
      if (code) {
        setSelectedCountryCode(code)
        setLocalNumber(contact.phone.slice(code.length))
      } else {
        setLocalNumber(contact.phone.replace(/\D/g, ""))
      }
    } else {
      setLocalNumber(contact.phone.replace(/\D/g, ""))
    }

    if (autoDial) {
      setTimeout(() => {
        handleCall()
      }, 0)
    }
  }

  const handleToggleMute = async () => {
    try {
      await toggleMute()
      
      if (currentWebRTCCall) {
        if (callState?.isMuted) {
          if (typeof currentWebRTCCall.unmuteAudio === 'function') {
            currentWebRTCCall.unmuteAudio()
            console.log('🎤 Audio unmuted')
          }
        } else {
          if (typeof currentWebRTCCall.muteAudio === 'function') {
            currentWebRTCCall.muteAudio()
            console.log('🔇 Audio muted')
          }
        }
      }
    } catch (e) {
      console.error("Failed to toggle mute:", e)
    }
  }

  const handleToggleRecording = async () => {
    if (callState?.status !== "active") {
      console.warn("⚠️ Recording only available when call is active")
      return
    }
    
    try {
      await toggleRecording()
    } catch (e) {
      console.error("Failed to toggle recording:", e)
    }
  }

  const handleToggleSpeaker = async () => {
    try {
      await toggleSpeaker()
    } catch (e) {
      console.error("Failed to toggle speaker:", e)
    }
  }

  const handleRedial = () => {
    if (!lastDialedNumber || isConnecting || isCallActive) return
    const matchingCode =
      countryCodes.find((c) => lastDialedNumber.startsWith(c.code))?.code ?? selectedCountryCode
    const local = lastDialedNumber.replace(matchingCode, "")
    setSelectedCountryCode(matchingCode)
    setLocalNumber(local)
    setSelectedContact(lastDialedContact)
    setTimeout(() => handleCall(), 0)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).tagName === "TEXTAREA") return

    if (!isCallActive) {
      if (event.key === "Enter") {
        event.preventDefault()
        handleCall()
      }
      if (event.key === "Backspace" && !localNumber) {
        event.preventDefault()
      }
    } else {
      if (event.key === "Escape") {
        event.preventDefault()
        handleEndCall()
      }
    }
  }

  const glassCard =
    "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/5 dark:from-white/10 dark:via-white/0 dark:to-white/5 shadow-[0_18px_40px_rgba(15,23,42,0.45)] backdrop-blur-xl"

  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] max-w-5xl mx-auto px-2 py-4 sm:px-4 lg:py-8"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Left: Dialer */}
      <div
        className={`${glassCard} p-5 sm:p-6 lg:p-8 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80`}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400/80">
              Dialer
            </div>
            <div className="mt-1 text-lg sm:text-xl font-semibold text-slate-50">
              {statusLabel}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            {/* WebRTC Status Indicator */}
            <div className="flex items-center gap-1.5">
              <Circle
                className={`h-2 w-2 ${
                  webrtcReady
                    ? "fill-green-500 text-green-500"
                    : "fill-yellow-500 text-yellow-500 animate-pulse"
                }`}
              />
              <span className="text-[10px] text-slate-400">
                {webrtcReady ? "WebRTC Ready" : "Connecting..."}
              </span>
            </div>
            
            {/* WebSocket Status Indicator */}
            <div className="flex items-center gap-1.5">
              <Circle
                className={`h-2 w-2 ${
                  isConnected
                    ? "fill-blue-500 text-blue-500"
                    : "fill-gray-500 text-gray-500"
                }`}
              />
              <span className="text-[10px] text-slate-400">
                {isConnected ? "Live Updates" : "Offline"}
              </span>
            </div>
            
            {demoMode && (
              <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-200">
                Demo Mode
              </span>
            )}
            {callState?.status && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  isCallActive
                    ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40"
                    : callState.status === "failed"
                    ? "bg-rose-500/15 text-rose-200 border border-rose-400/40"
                    : "bg-slate-700/60 text-slate-200 border border-slate-500/50"
                }`}
              >
                <span
                  className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                    isCallActive
                      ? "bg-emerald-400 animate-pulse"
                      : callState.status === "failed"
                      ? "bg-rose-400"
                      : "bg-slate-300"
                  }`}
                />
                {statusLabel}
              </span>
            )}
          </div>
        </div>

        {/* WebRTC Error Display */}
        {webrtcError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            <AlertCircle className="h-4 w-4" />
            <span>{webrtcError}</span>
          </div>
        )}

        {/* Number and timer */}
        <div
          className={`mb-6 rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 transition-all ${
            isCallActive
              ? "border-emerald-400/70 bg-gradient-to-r from-emerald-500/10 via-slate-900/60 to-sky-500/10 shadow-[0_0_0_1px_rgba(34,197,94,0.3),0_18px_40px_rgba(15,23,42,0.9)]"
              : "border-white/10 bg-slate-900/50"
          }`}
        >
          {selectedContact && (
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Contact
                </div>
                <div className="text-sm font-medium text-slate-50">
                  {selectedContact.name}
                </div>
              </div>
              {callState?.status === "active" && (
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Duration
                  </div>
                  <div className="font-mono text-lg font-semibold text-emerald-300">
                    {formattedDuration}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Number
            </div>
            <div className="font-mono text-4xl sm:text-5xl font-bold text-slate-50 break-words text-center">
              {!isCallActive ? `${selectedCountryCode}${localNumber || "0"}` : fullDialedNumber}
            </div>
            {callState?.status === "active" && (
              <div className="mt-2 flex items-center gap-2 text-xs font-medium text-emerald-200">
                <div className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live call connected
              </div>
            )}
          </div>

          {callState?.error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              <AlertCircle className="h-4 w-4" />
              <span>{callState.error}</span>
            </div>
          )}
        </div>

        {/* Recording Available Banner */}
        {callState?.status === 'ended' && recordingUrl && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Circle className="h-3 w-3 fill-emerald-500 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-100">
                Recording Available
              </span>
            </div>
            <a
              href={recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-sky-300 hover:text-sky-200 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </div>
        )}

        {/* Input row (only idle) */}
        {!isCallActive && (
          <div className="mb-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-[46%]">
              <select
                aria-label="Country code"
                value={selectedCountryCode}
                onChange={(e) => setSelectedCountryCode(e.target.value)}
                disabled={isConnecting}
                className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 shadow-inner focus:border-sky-400/70 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                {countryCodes.map((c) => (
                  <option key={c.code + c.country} value={c.code}>
                    {c.country} {c.code}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                ▼
              </span>
            </div>
            <input
              className="flex-1 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 shadow-inner outline-none ring-offset-slate-950 placeholder:text-slate-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/40"
              type="tel"
              inputMode="numeric"
              value={localNumber}
              onChange={(e) => setLocalNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter number"
              maxLength={15}
              disabled={isConnecting}
            />
          </div>
        )}

        {/* Dialpad / Controls */}
        {!isCallActive ? (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
              {dialPad.map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleDial(digit)}
                  disabled={isConnecting}
                  className="group h-12 sm:h-14 rounded-2xl border border-white/5 bg-slate-900/70 text-lg sm:text-2xl font-semibold text-slate-100 shadow hover:border-sky-400/60 hover:bg-sky-500/10 hover:shadow-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block translate-y-px transition-transform group-active:translate-y-0.5">
                    {digit}
                  </span>
                </button>
              ))}
            </div>

            <div className="mb-3 flex gap-2">
              <Button
                onClick={handleBackspace}
                disabled={isConnecting || !localNumber}
                variant="outline"
                className="flex-1 rounded-xl border-white/10 bg-slate-900/60 text-xs sm:text-sm text-slate-100 hover:border-sky-400/60 hover:bg-sky-500/10"
              >
                ← Backspace
              </Button>
              <Button
                onClick={() => setLocalNumber("")}
                disabled={isConnecting || !localNumber}
                variant="outline"
                className="flex-1 rounded-xl border-white/10 bg-slate-900/60 text-xs sm:text-sm text-slate-100 hover:border-slate-400/60 hover:bg-slate-800/80"
              >
                Clear
              </Button>
            </div>

            <div className="mb-6 flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleCall}
                disabled={!localNumber || isConnecting || !webrtcReady}
                size="lg"
                className="flex-1 h-12 sm:h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 text-sm sm:text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Call
                    <span className="hidden text-xs font-normal text-emerald-950/80 sm:inline">
                      (Enter)
                    </span>
                  </span>
                )}
              </Button>
              <Button
                onClick={handleRedial}
                disabled={!lastDialedNumber || isConnecting || isCallActive}
                size="lg"
                variant="outline"
                className="h-12 sm:h-14 w-full sm:w-40 rounded-xl border-white/10 bg-slate-900/70 text-xs sm:text-sm text-slate-100 hover:border-emerald-400/60 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {lastDialedContact?.name ? `Redial ${lastDialedContact.name}` : "Redial"}
              </Button>
            </div>

            {/* Quick Access */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <FileText className="h-3.5 w-3.5" />
                  Quick Access
                </div>
                <span className="text-[10px] text-slate-500">
                  Click to auto-dial
                </span>
              </div>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {contacts.map((contact) => (
                  <button
                    key={contact.id ?? contact.phone ?? contact.name}
                    onClick={() => handleContactClick(contact, true)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2 text-left text-xs hover:border-sky-400/60 hover:bg-sky-500/5"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-slate-100">
                        {contact.name}
                      </div>
                      <div className="text-[11px] text-slate-400">{contact.phone}</div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-medium text-sky-300">
                      <Phone className="h-3.5 w-3.5" />
                      Dial
                    </div>
                  </button>
                ))}
                {contacts.length === 0 && (
                  <div className="py-3 text-center text-xs text-slate-500">
                    No quick contacts configured
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Active Call Controls */}
            <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Call Controls
              </div>
              <div className="grid grid-cols-4 gap-2">
                {/* Mute Button */}
                <Button
                  onClick={handleToggleMute}
                  variant={callState?.isMuted ? "default" : "outline"}
                  className={`h-14 rounded-xl text-xs flex flex-col items-center justify-center gap-1 ${
                    callState?.isMuted
                      ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-50"
                      : "border-white/10 bg-slate-900/60 text-slate-100 hover:border-emerald-400/60 hover:bg-emerald-500/10"
                  }`}
                >
                  {callState?.isMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                  <span className="text-[10px]">
                    {callState?.isMuted ? "Unmute" : "Mute"}
                  </span>
                </Button>

                {/* Speaker Button */}
                <Button
                  onClick={handleToggleSpeaker}
                  variant={callState?.speakerOn ? "default" : "outline"}
                  className={`h-14 rounded-xl text-xs flex flex-col items-center justify-center gap-1 ${
                    callState?.speakerOn
                      ? "border-sky-400/60 bg-sky-500/20 text-sky-50"
                      : "border-white/10 bg-slate-900/60 text-slate-100 hover:border-sky-400/60 hover:bg-sky-500/10"
                  }`}
                >
                  <Volume2 className="h-5 w-5" />
                  <span className="text-[10px]">Speaker</span>
                </Button>

                {/* Record Indicator */}
                <div
                  className={`h-14 rounded-xl text-xs flex flex-col items-center justify-center gap-1 ${
                    callState?.isRecording
                      ? "border border-rose-400/70 bg-rose-500/20 text-rose-50"
                      : "border border-white/10 bg-slate-900/60 text-slate-400 opacity-60"
                  }`}
                >
                  <Circle
                    className={`h-4 w-4 ${
                      callState?.isRecording ? "fill-rose-500 animate-pulse" : ""
                    }`}
                  />
                  <span className="text-[10px]">
                    {callState?.isRecording ? "Rec" : "No Rec"}
                  </span>
                </div>

                {/* Keypad Button */}
                <Button
                  onClick={() => setShowKeypad(!showKeypad)}
                  variant={showKeypad ? "default" : "outline"}
                  className={`h-14 rounded-xl text-xs flex flex-col items-center justify-center gap-1 ${
                    showKeypad
                      ? "border-purple-400/60 bg-purple-500/20 text-purple-50"
                      : "border-white/10 bg-slate-900/60 text-slate-100 hover:border-purple-400/60 hover:bg-purple-500/10"
                  }`}
                >
                  <Hash className="h-5 w-5" />
                  <span className="text-[10px]">Keypad</span>
                </Button>
              </div>
            </div>

            {/* DTMF Keypad Overlay */}
            {showKeypad && (
              <div className="mt-4 rounded-2xl border border-purple-400/40 bg-gradient-to-br from-purple-500/10 to-slate-950/90 p-4 shadow-lg shadow-purple-500/20">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
                    Send Tones (DTMF)
                  </div>
                  <button
                    onClick={() => setShowKeypad(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs"
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {dialPad.map((digit) => (
                    <button
                      key={digit}
                      onClick={() => sendDTMF(digit)}
                      className="group h-14 rounded-xl border border-white/10 bg-slate-900/70 text-2xl font-semibold text-slate-100 shadow hover:border-purple-400/60 hover:bg-purple-500/20 hover:shadow-purple-500/30 active:scale-95 transition-all"
                    >
                      <span className="block transition-transform group-active:translate-y-0.5">
                        {digit}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-center text-slate-400">
                  Press digits to navigate phone menus (IVR systems)
                </p>
              </div>
            )}

            {/* Hang Up Button */}
            <div className="mt-4">
              <Button
                onClick={handleEndCall}
                size="lg"
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 text-base font-semibold text-white shadow-lg shadow-rose-500/40 hover:opacity-95"
              >
                <PhoneOff className="mr-2 h-5 w-5" />
                End Call
                <span className="ml-2 hidden text-xs font-normal text-rose-100/80 sm:inline">
                  (Esc)
                </span>
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Right: Notes / Context */}
      <div
        className={`${glassCard} p-5 sm:p-6 bg-gradient-to-b from-slate-900/70 via-slate-900/40 to-slate-950/80`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-sky-500/15 p-1.5 text-sky-300">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Call Notes
              </div>
              <div className="text-sm font-semibold text-slate-100">
                Conversation context
              </div>
            </div>
          </div>
          {isCallActive && (
            <span className="rounded-full bg-slate-800/80 px-3 py-1 text-[11px] text-slate-300">
              Auto-saved on end
            </span>
          )}
        </div>

        <textarea
          className="mb-3 h-32 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 shadow-inner outline-none placeholder:text-slate-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/40"
          placeholder={
            isCallActive
              ? "Type notes while you talk…"
              : "Capture outcomes, objections, and next steps…"
          }
          value={callNotes}
          onChange={(e) => setCallNotes(e.target.value)}
        />

        {savedNotes.length > 0 && (
          <div className="mt-1 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recent notes
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {savedNotes.map((entry) => (
                <div
                  key={entry.callId + entry.timestamp}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-100">{entry.to}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-300">{entry.notes}</p>
                  
                  {/* Recording download link in saved notes */}
                  {entry.recordingUrl && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <a
                        href={entry.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-sky-300 hover:text-sky-200 transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Download Recording
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {savedNotes.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-700/70 bg-slate-950/40 px-3 py-4 text-center text-xs text-slate-500">
            Notes you save after calls will appear here for quick reference.
          </div>
        )}
      </div>

      {/* Hidden audio element for remote WebRTC stream */}
      <audio ref={audioRef} autoPlay playsInline muted={false} />
    </div>
  )
}
