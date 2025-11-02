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

// Initialize Firebase only if config is valid
let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

const isConfigValid = validateConfig()

if (isConfigValid) {
  try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig)

    // Initialize Auth
    auth = getAuth(app)

    // Initialize Firestore
    db = getFirestore(app)

    // Enable offline persistence for Firestore
    // Try multi-tab first (works across tabs), fallback to single-tab
    if (db) {
      enableMultiTabIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled in one tab at a time
          console.warn('⚠️ Firestore persistence: Multiple tabs open, using single-tab mode')
          enableIndexedDbPersistence(db!)
        } else if (err.code === 'unimplemented') {
          // The current browser doesn't support persistence
          console.warn('⚠️ Firestore persistence not supported in this browser')
        }
      })
    }

    // Connect to emulators in development (if available)
    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
      if (auth) {
        connectAuthEmulator(auth, 'http://localhost:9099')
        console.log('🔧 Connected to Firebase Auth Emulator')
      }
      if (db) {
        connectFirestoreEmulator(db, 'localhost', 8080)
        console.log('🔧 Connected to Firestore Emulator')
      }
    }

    console.log('✅ Firebase initialized successfully')
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error)
  }
} else {
  console.log('ℹ️ Firebase not initialized - configuration incomplete')
}

// Export instances
export { app, auth, db }

// Export a helper to check if Firebase is ready
export const isFirebaseReady = () => {
  return !!(app && auth && db)
}

// Export config for debugging
export { firebaseConfig }
