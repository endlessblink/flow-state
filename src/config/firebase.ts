import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth, connectAuthEmulator } from 'firebase/auth'
import {
  getFirestore,
  type Firestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence
} from 'firebase/firestore'

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Validate Firebase configuration
const validateConfig = () => {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig])

  if (missingKeys.length > 0) {
    console.warn(
      '⚠️ Firebase configuration incomplete. Missing keys:',
      missingKeys.join(', '),
      '\nPlease update .env.local with your Firebase credentials.'
    )
    return false
  }

  // Check for placeholder values
  if (firebaseConfig.apiKey === 'your-api-key-here') {
    console.warn(
      '⚠️ Firebase configuration contains placeholder values.',
      '\nPlease update .env.local with your actual Firebase credentials.'
    )
    return false
  }

  return true
}

// Development environment detection
const isDevelopment = import.meta.env.DEV
const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

// Connection status monitoring
let connectionRetryCount = 0
const MAX_RETRY_COUNT = 3
const RETRY_DELAY = 2000 // 2 seconds

// Connection retry logic
const retryConnection = async (operation: () => Promise<any>, operationName: string): Promise<any> => {
  for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt++) {
    try {
      const result = await operation()
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`)
      }
      return result
    } catch (error: any) {
      console.warn(`⚠️ ${operationName} failed on attempt ${attempt}/${MAX_RETRY_COUNT}:`, error.message)

      if (attempt === MAX_RETRY_COUNT) {
        console.error(`❌ ${operationName} failed after ${MAX_RETRY_COUNT} attempts`)
        throw error
      }

      // Wait before retrying with exponential backoff
      const delay = RETRY_DELAY * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Connection status monitoring
const monitorConnection = () => {
  if (!db) return

  // Monitor online/offline status
  const handleOnline = () => {
    console.log('🌐 Connection restored - Firebase operations should resume')
    connectionRetryCount = 0
  }

  const handleOffline = () => {
    console.warn('📵 Connection lost - Firebase will work in offline mode')
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Log initial connection status
  if (!navigator.onLine) {
    console.warn('📵 Starting in offline mode - Firebase will work offline')
  }
}

// Initialize Firebase only if config is valid
let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let initializationPromise: Promise<void> | null = null

const isConfigValid = validateConfig()

// Async initialization function
const initializeFirebase = async () => {
  if (!isConfigValid) {
    console.log('ℹ️ Firebase not initialized - configuration incomplete')
    return
  }

  try {
    // Log environment info
    if (isDevelopment) {
      console.log('🔧 Initializing Firebase in DEVELOPMENT mode')
      console.log(`🌐 Current origin: ${typeof window !== 'undefined' ? window.location.origin : 'unknown'}`)
    }

    // Initialize Firebase with error handling
    app = await retryConnection(
      () => Promise.resolve(initializeApp(firebaseConfig)),
      'Firebase App Initialization'
    )

    // Initialize Auth with error handling
    auth = await retryConnection(
      () => Promise.resolve(getAuth(app)),
      'Firebase Auth Initialization'
    )

    // Initialize Firestore with error handling
    db = await retryConnection(
      () => Promise.resolve(getFirestore(app)),
      'Firestore Initialization'
    )

    // Enable offline persistence for Firestore with better error handling
    if (db) {
      try {
        await enableMultiTabIndexedDbPersistence(db)
        console.log('✅ Firestore multi-tab persistence enabled')
      } catch (err: any) {
        if (err.code === 'failed-precondition') {
          console.warn('⚠️ Firestore persistence: Multiple tabs open, using single-tab mode')
          try {
            await enableIndexedDbPersistence(db)
            console.log('✅ Firestore single-tab persistence enabled')
          } catch (singleTabErr: any) {
            console.warn('⚠️ Firestore persistence not available:', singleTabErr.message)
          }
        } else if (err.code === 'unimplemented') {
          console.warn('⚠️ Firestore persistence not supported in this browser')
        } else {
          console.warn('⚠️ Firestore persistence error:', err.message)
        }
      }
    }

    // Connect to emulators in development (if available)
    if (isDevelopment && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
      if (auth) {
        connectAuthEmulator(auth, 'http://localhost:9099')
        console.log('🔧 Connected to Firebase Auth Emulator')
      }
      if (db) {
        connectFirestoreEmulator(db, 'localhost', 8080)
        console.log('🔧 Connected to Firestore Emulator')
      }
    }

    // Set up connection monitoring
    monitorConnection()

    console.log('✅ Firebase initialized successfully')
    console.log(`🔧 Development mode: ${isDevelopment}`)
    console.log(`🌐 Localhost: ${isLocalhost}`)
  } catch (error: any) {
    console.error('❌ Firebase initialization failed:', error)
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    })

    // Try to provide helpful error messages
    if (error.message?.includes('CORS') || error.message?.includes('cross-origin')) {
      console.error('🚨 CORS Error detected! Make sure localhost:5546 is added to authorized domains in Firebase Console')
    }
  }
}

// Start initialization
initializationPromise = initializeFirebase()

// Export instances
export { app, auth, db, initializationPromise }

// Export a helper to check if Firebase is ready
export const isFirebaseReady = () => {
  return !!(app && auth && db)
}

// Export a helper to wait for Firebase initialization
export const waitForFirebase = async (timeout = 10000): Promise<boolean> => {
  if (!initializationPromise) return false

  try {
    await Promise.race([
      initializationPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firebase initialization timeout')), timeout)
      )
    ])
    return isFirebaseReady()
  } catch (error) {
    console.warn('Firebase initialization failed or timed out:', error)
    return false
  }
}

// Export environment info
export const getFirebaseEnvironment = () => ({
  isDevelopment,
  isLocalhost,
  isConfigValid,
  currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'unknown'
})

// Export config for debugging
export { firebaseConfig }
