# Quick Firebase Setup (Web Console Method)

The CLI project creation failed due to permissions. Let's use the Firebase Console instead (5 minutes):

## Step 1: Create Firebase Project (2 minutes)

1. **Go to**: https://console.firebase.google.com/
2. Click **"Add project"** or **"Create a project"**
3. **Project name**: `Pomo-Flow`
4. **Google Analytics**: Toggle OFF (not needed for now)
5. Click **"Create project"**
6. Wait for project creation (~30 seconds)
7. Click **"Continue"**

---

## Step 2: Register Web App (1 minute)

1. In your Firebase project, click the **web icon** (`</>`) under "Get started by adding Firebase to your app"
2. **App nickname**: `Pomo-Flow Web`
3. ❌ **Don't** check "Also set up Firebase Hosting" (we'll do this later)
4. Click **"Register app"**
5. **COPY THE CONFIG** - you'll see something like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "pomo-flow-xxxxx.firebaseapp.com",
  projectId: "pomo-flow-xxxxx",
  storageBucket: "pomo-flow-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxx",
  measurementId: "G-XXXXXXXXXX"
};
```

6. **Copy this entire config** - we'll use it next
7. Click **"Continue to console"**

---

## Step 3: Paste Config Here

Once you have the config, paste it in this chat and say:

> "Here's my Firebase config: [paste the config object]"

I'll automatically:
- ✅ Extract the values
- ✅ Update `.env.local`
- ✅ Initialize Firebase in the project
- ✅ Enable Firestore
- ✅ Enable Authentication
- ✅ Deploy rules and indexes

---

## That's It!

After you paste the config, I'll handle everything else automatically. The whole process takes ~5 minutes total.

**Ready?** Go to https://console.firebase.google.com/ and follow steps 1-2, then paste the config here!
