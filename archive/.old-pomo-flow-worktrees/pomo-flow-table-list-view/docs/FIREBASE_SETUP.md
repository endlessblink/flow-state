# Firebase Setup Guide for Pomo-Flow

## 📋 Overview
This guide will walk you through setting up Firebase for Pomo-Flow's authentication and database features.

---

## Step 1: Create a Firebase Project

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `pomo-flow` (or your preferred name)
4. **Google Analytics**: Optional - you can disable it for now
5. Click **"Create project"** and wait for initialization

---

## Step 2: Register Your Web App

1. In your Firebase project, click the **web icon** (`</>`) to add a web app
2. Enter app nickname: `Pomo-Flow Web`
3. ✅ Check **"Also set up Firebase Hosting"** (optional, but recommended)
4. Click **"Register app"**
5. **Copy the Firebase configuration** - you'll need this in Step 4

The config looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza....",
  authDomain: "pomo-flow-xxxxx.firebaseapp.com",
  projectId: "pomo-flow-xxxxx",
  storageBucket: "pomo-flow-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxx",
  measurementId: "G-XXXXXXXXXX"
};
```

---

## Step 3: Enable Authentication

1. In Firebase Console, go to **Build > Authentication**
2. Click **"Get started"**
3. Enable **Email/Password** authentication:
   - Click on "Email/Password"
   - Toggle **Enable**
   - Click **Save**

4. Enable **Google Sign-In**:
   - Click on "Google"
   - Toggle **Enable**
   - Select a **support email** (your email)
   - Click **Save**

---

## Step 4: Set Up Firestore Database

1. In Firebase Console, go to **Build > Firestore Database**
2. Click **"Create database"**
3. **Security rules**: Choose **"Start in production mode"** (we'll add custom rules later)
4. **Cloud Firestore location**: Choose closest to you (e.g., `us-central1` for North America)
5. Click **"Enable"**

---

## Step 5: Configure Environment Variables

1. Open `.env.local` in your project root
2. Replace the placeholder values with your Firebase config from Step 2:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIza.... # Your actual API key
VITE_FIREBASE_AUTH_DOMAIN=pomo-flow-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pomo-flow-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=pomo-flow-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:xxxxx
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# OpenAI Configuration (will set up later)
VITE_OPENAI_API_KEY=sk-your-api-key-here

# Environment
NODE_ENV=development
```

3. **Save the file**
4. **⚠️ NEVER commit `.env.local` to git** - it's already in `.gitignore`

---

## Step 6: Set Up Firestore Security Rules

We need to secure the database so users can only access their own data.

1. In Firebase Console, go to **Firestore Database > Rules**
2. Replace the default rules with:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check if user owns the document
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // User document - users can only read/write their own user doc
    match /users/{userId} {
      allow read, write: if isOwner(userId);

      // Tasks subcollection - scoped to user
      match /tasks/{taskId} {
        allow read, write: if isOwner(userId);
      }

      // Projects subcollection - scoped to user
      match /projects/{projectId} {
        allow read, write: if isOwner(userId);
      }

      // Settings subcollection - scoped to user
      match /settings/{settingId} {
        allow read, write: if isOwner(userId);
      }
    }
  }
}
```

3. Click **"Publish"**

---

## Step 7: Test Firebase Connection

1. **Restart your dev server** if it's running:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

2. **Check the browser console** - you should see:
   ```
   ✅ Firebase initialized successfully
   ```

3. If you see warnings about missing config, double-check your `.env.local` file

---

## Step 8: (Optional) Set Up Firebase Emulators

For local development without hitting production Firebase:

1. **Install Firebase CLI globally**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project**:
   ```bash
   firebase init
   ```
   - Select: **Firestore**, **Authentication**, **Emulators**
   - Choose your existing project
   - Accept defaults for Firestore rules and indexes
   - For emulators, select: **Authentication Emulator**, **Firestore Emulator**
   - Use default ports (9099 for Auth, 8080 for Firestore)

4. **Update `.env.local`** to use emulators:
   ```env
   VITE_USE_FIREBASE_EMULATORS=true
   ```

5. **Start emulators**:
   ```bash
   firebase emulators:start
   ```

---

## 🎉 Setup Complete!

You're now ready to use Firebase in Pomo-Flow. Next steps:
1. User authentication will be implemented
2. Tasks will sync to Firestore
3. Multi-device sync will work automatically

---

## 📊 Monitoring Free Tier Usage

Firebase has a generous free tier, but it's good to monitor usage:

### Firestore Free Tier Limits:
- **50,000 reads/day**
- **20,000 writes/day**
- **1 GB storage**
- **10 GB/month bandwidth**

### How to Monitor:
1. Go to **Firebase Console > Usage and billing**
2. Check **Firestore** tab for daily usage
3. Set up **billing alerts** (optional)

### Tips to Stay in Free Tier:
- ✅ Use pagination (load 20 tasks at a time, not all at once)
- ✅ Cache data client-side (IndexedDB)
- ✅ Use real-time listeners efficiently (don't listen to entire collection)
- ✅ Implement infinite scroll instead of loading all tasks

---

## 🔐 Security Best Practices

1. **Never expose API keys in public repositories** - they're already in `.env.local` (gitignored)
2. **Use Firestore Security Rules** - already configured in Step 6
3. **Enable App Check** (optional, for production):
   - Protects against abuse
   - Firebase Console > Build > App Check

---

## 🐛 Troubleshooting

### "Firebase configuration incomplete"
- Check that all values in `.env.local` are filled in
- Make sure there are no typos
- Restart dev server after changing `.env.local`

### "Firebase initialization failed"
- Check browser console for detailed error
- Verify Firebase project is created and active
- Check that Firestore is enabled

### "Permission denied" errors
- Verify Firestore Security Rules are published
- Check that user is authenticated
- Verify userId matches in the request

---

## 📚 Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)

---

**Need help?** Check the Firebase Console for detailed logs and errors.
