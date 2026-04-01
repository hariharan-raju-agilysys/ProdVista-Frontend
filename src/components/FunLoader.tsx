import { useState, useEffect } from 'react'

// Fun loading messages with emojis that rotate
const loadingStates = [
  { emoji: '🚀', text: 'Launching into orbit...' },
  { emoji: '⚡', text: 'Charging up the flux capacitor...' },
  { emoji: '🧠', text: 'Teaching AI new tricks...' },
  { emoji: '🎯', text: 'Locking onto target...' },
  { emoji: '🔮', text: 'Consulting the crystal ball...' },
  { emoji: '🎪', text: 'Setting up the big show...' },
  { emoji: '🌊', text: 'Riding the data wave...' },
  { emoji: '🎨', text: 'Painting your dashboard...' },
  { emoji: '🏗️', text: 'Building something awesome...' },
  { emoji: '🎵', text: 'Composing your symphony of data...' },
  { emoji: '🧪', text: 'Mixing the perfect formula...' },
  { emoji: '🌟', text: 'Sprinkling some stardust...' },
  { emoji: '🍳', text: 'Cooking up fresh results...' },
  { emoji: '🏎️', text: 'Shifting into high gear...' },
  { emoji: '🎮', text: 'Loading next level...' },
]

// Contextual messages for different operations
const contextMessages: Record<string, { emoji: string; text: string }[]> = {
  dashboard: [
    { emoji: '📊', text: 'Arranging your widgets...' },
    { emoji: '📈', text: 'Crunching the latest numbers...' },
    { emoji: '🎯', text: 'Aligning your KPIs...' },
  ],
  ai: [
    { emoji: '🤖', text: 'Waking up the AI brain...' },
    { emoji: '💭', text: 'AI is thinking real hard...' },
    { emoji: '🧠', text: 'Neural networks activating...' },
  ],
  data: [
    { emoji: '📦', text: 'Unpacking your data...' },
    { emoji: '🗄️', text: 'Searching the archives...' },
    { emoji: '🔍', text: 'Finding the needle in the haystack...' },
  ],
  auth: [
    { emoji: '🔐', text: 'Verifying your VIP pass...' },
    { emoji: '🛡️', text: 'Checking your credentials...' },
    { emoji: '🎫', text: 'Validating your ticket...' },
  ],
}

interface FunLoaderProps {
  /** Optional context for themed messages */
  context?: 'dashboard' | 'ai' | 'data' | 'auth'
  /** Custom loading message override */
  message?: string
  /** Show as full-page overlay */
  fullPage?: boolean
  /** Show as inline small loader */
  inline?: boolean
  /** Custom class */
  className?: string
}

export default function FunLoader({ context, message, fullPage, inline, className }: FunLoaderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  const messages = context ? [...(contextMessages[context] || []), ...loadingStates] : loadingStates

  useEffect(() => {
    // Start with random index
    setCurrentIndex(Math.floor(Math.random() * messages.length))
    
    const interval = setInterval(() => {
      setIsVisible(false)
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % messages.length)
        setIsVisible(true)
      }, 200)
    }, 2500)

    return () => clearInterval(interval)
  }, [messages.length])

  const current = messages[currentIndex]

  if (inline) {
    return (
      <span className={`inline-flex items-center gap-2 ${className || ''}`}>
        <span className="text-lg animate-bounce">{current.emoji}</span>
        <span className="text-sm text-gray-500">{message || current.text}</span>
      </span>
    )
  }

  if (fullPage) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${className || ''}`}>
        <div className="text-center">
          <div className={`text-6xl mb-4 transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
            {current.emoji}
          </div>
          <div className={`transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
            <p className="text-lg font-medium text-gray-700">{message || current.text}</p>
          </div>
          <div className="flex justify-center gap-1.5 mt-6">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-blue-400"
                style={{ animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Default: centered card
  return (
    <div className={`flex flex-col items-center justify-center py-16 ${className || ''}`}>
      <div className={`text-5xl mb-3 transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
        {current.emoji}
      </div>
      <div className={`transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
        <p className="text-sm font-medium text-gray-600">{message || current.text}</p>
      </div>
      <div className="flex justify-center gap-1 mt-4">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-blue-400"
            style={{ animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}

/** Mini emoji loader for buttons/inline */
export function MiniLoader({ emoji = '⚡' }: { emoji?: string }) {
  return <span className="inline-block animate-bounce text-base">{emoji}</span>
}
