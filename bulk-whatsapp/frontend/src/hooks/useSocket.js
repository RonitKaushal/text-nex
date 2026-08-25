import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
const API_BASE_URL = import.meta.env.VITE_SOCKET_URL || 'https://api.textnexus.in'

export const useSocket = ({ token, onConnect, onDisconnect, onError }) => {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef(null)
  const isConnectingRef = useRef(false)
  const localListenersRef = useRef(new Map())

  // Bridge Electron local campaign events into socket-style listeners
  useEffect(() => {
    if (!window.electronAPI?.onCampaignEvent) return undefined

    const unsubscribe = window.electronAPI.onCampaignEvent(({ eventName, data }) => {
      const listeners = localListenersRef.current.get(eventName)
      listeners?.forEach((cb) => {
        try {
          cb(data)
        } catch (e) {
          console.error('Local campaign event handler error:', e)
        }
      })
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const isElectronApp = !!window.electronAPI?.getToken
    if (!token || isElectronApp || isConnectingRef.current) {
      return
    }

    // Clean up existing connection
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }

    console.log('Initializing socket connection with token:', token.substring(0, 10) + '...')
    isConnectingRef.current = true

    // Create socket connection
    const socket = io(API_BASE_URL, {
      query: {
        token: token,
        userId: token // Backend expects userId
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 20000,
      forceNew: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected successfully:', socket.id)
      setIsConnected(true)
      isConnectingRef.current = false
      if (onConnect) onConnect()
    })

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
      isConnectingRef.current = false
      if (onDisconnect) onDisconnect(reason)
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
      isConnectingRef.current = false
      if (onError) onError(error)
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
      isConnectingRef.current = false
      if (onError) onError(error)
    })

    // Handle authentication errors
    socket.on('unauthorized', (error) => {
      console.error('Socket unauthorized:', error)
      setIsConnected(false)
      isConnectingRef.current = false
      if (onError) onError(new Error('Authentication failed: ' + error.message))
    })

    // Cleanup function
    return () => {
      console.log('Cleaning up socket connection')
      isConnectingRef.current = false
      if (socket) {
        socket.disconnect()
        setIsConnected(false)
      }
    }
  }, [token]) // Only depend on token

  const registerLocalListener = useCallback((event, callback) => {
    if (!localListenersRef.current.has(event)) {
      localListenersRef.current.set(event, new Set())
    }
    localListenersRef.current.get(event).add(callback)
  }, [])

  const unregisterLocalListener = useCallback((event, callback) => {
    localListenersRef.current.get(event)?.delete(callback)
  }, [])

  const emit = (event, data) => {
    if (socketRef.current?.connected) {
      console.log('Emitting event:', event, data)
      socketRef.current.emit(event, data)
    } else {
      console.warn('Socket not connected, cannot emit event:', event)
    }
  }

  const on = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback)
    }
    registerLocalListener(event, callback)
  }

  const off = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback)
    }
    unregisterLocalListener(event, callback)
  }

  const hasLocalCampaignBridge = !!window.electronAPI?.onCampaignEvent

  return {
    socket: socketRef.current,
    isConnected: isConnected || hasLocalCampaignBridge,
    emit,
    on,
    off
  }
}
