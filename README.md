# Smart Multi-Plug — Web Dashboard

A production-grade web application for controlling a WiFi-enabled 4-outlet smart power strip (ESP8266-based). Built with **React + Vite**, **Firebase Auth + Realtime Database**, and **MQTT over WebSockets**.

---

## Features

- 🔐 **Email/password + Google sign-in** via Firebase Auth
- 🔌 **Real-time plug control** — MQTT-driven with optimistic UI and automatic revert if device doesn't respond
- 📶 **Live online/offline status** via MQTT retained LWT topic  
- ⏱ **Advanced Timers** — delay countdowns (device-clock based) and scheduled on/off times (WiFi clock based)
- 📝 **Tap-to-rename** outlets — saved to Firebase Realtime Database
- 🔗 **Secure device pairing** via Firebase Cloud Functions
- 📱 **Mobile-first dark UI** — glassmorphism, micro-animations, premium feel

---

## Quick Start

### 1. Clone & install

```bash
git clone <your-repo>
cd smart-multiplug
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in all values (see §Environment Variables below).

### 3. Run locally

```bash
npm run dev
```

### 4. Deploy to Firebase Hosting

```bash
npm run build
firebase deploy
```

---

## Environment Variables

All secrets are loaded from `.env` — **never committed to the repo**.

| Variable | Where to find it |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same |
| `VITE_FIREBASE_DATABASE_URL` | Firebase Console → Realtime Database → Data tab (URL at top) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Console → Project Settings |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Console → Project Settings |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console → Project Settings |
| `VITE_FIREBASE_APP_ID` | Firebase Console → Project Settings |
| `VITE_MQTT_BROKER_URL` | Your HiveMQ Cloud cluster URL: `wss://xxxx.hivemq.cloud:8884/mqtt` |
| `VITE_MQTT_USERNAME` | HiveMQ Cloud → Access Management → Credentials |
| `VITE_MQTT_PASSWORD` | Same |

---

## Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Sign-in methods → Email/Password + Google
3. Enable **Realtime Database** (start in locked mode, then deploy `database.rules.json`)
4. Register a **Web App** and copy the config into `.env`
5. Deploy Cloud Functions:
   ```bash
   cd functions && npm install
   cd .. && firebase deploy --only functions
   ```

### Device Provisioning (pre-seeding `/devices`)

Before a device can be paired, it must exist in the `/devices` table. Write once at factory time:

```json
{
  "devices": {
    "SP-AABBCCDD": {
      "claimed_by": null,
      "provisioned_at": 1700000000000
    }
  }
}
```

This is intentionally out of scope for this codebase (done by your provisioning script).

---

## MQTT Topic Structure

All topics are scoped to the authenticated user and device:

```
users/{uid}/devices/{deviceId}/plug/{1-4}/set          ← publish (website → device)
users/{uid}/devices/{deviceId}/plug/{1-4}/state        ← subscribe, retained (device → website)
users/{uid}/devices/{deviceId}/plug/{1-4}/schedule     ← publish, retained (JSON array)
users/{uid}/devices/{deviceId}/plug/{1-4}/timer/set    ← publish (start/cancel delay timer)
users/{uid}/devices/{deviceId}/plug/{1-4}/timer/state  ← subscribe, retained (countdown state)
users/{uid}/devices/{deviceId}/status                  ← subscribe, retained LWT (online/offline)
```

---

## Security Notes

### MQTT Credentials (known tradeoff)

Currently the app uses static MQTT credentials stored in environment variables (`VITE_MQTT_USERNAME` / `VITE_MQTT_PASSWORD`). Because Vite bundles these into the client-side JavaScript, they are visible to anyone who inspects the page source.

**Acceptable for MVP** because:
- Credentials are scoped to a single read/write user (not broker admin)
- Topic ACLs on the broker limit access to `users/{uid}/*` patterns

**Production hardening** (recommended before public launch):
- Issue short-lived MQTT credentials from a Cloud Function on login, using HiveMQ's REST API or a custom JWT auth plugin
- Implement topic-level ACLs on the broker so each user can only pub/sub their own `users/{uid}/*` topics

### Device Claim Security

The device pairing flow runs entirely in a Firebase Cloud Function (`claimDevice`). The client never writes directly to `/devices` — only the function does, after validating:
1. The device exists in the pre-provisioned `/devices` table
2. The device is not already claimed by another UID
3. The requesting user is authenticated (Firebase verifies the ID token automatically)

---

## Project Structure

```
src/
├── main.jsx              # React entry point
├── App.jsx               # Routes + providers + tab bar logic
├── firebase.js           # Firebase SDK init
├── mqtt.js               # MQTT singleton (connect, subscribe, publish)
│
├── contexts/
│   ├── AuthContext.jsx   # Firebase auth state + MQTT lifecycle
│   └── DeviceContext.jsx # Paired device + plug labels from RTDB
│
├── hooks/
│   └── useMqtt.js        # useMqttSubscribe / useMqttPublish hooks
│
├── pages/
│   ├── Login.jsx         # Sign in (email + Google + password reset)
│   ├── SignUp.jsx        # Register
│   ├── PairDevice.jsx    # SP-xxxxxxxx claim flow
│   ├── Dashboard.jsx     # 4-plug control panel
│   ├── Timers.jsx        # Delay + Schedule timer panel
│   └── Settings.jsx      # Rename, unpair, account actions
│
├── components/
│   ├── PlugCard.jsx           # Individual plug toggle + inline rename
│   ├── OnlineIndicator.jsx    # Online/offline badge
│   ├── TabBar.jsx             # Bottom navigation bar
│   ├── ActiveTimersList.jsx   # Running timers list with countdown
│   ├── SkeletonLoader.jsx     # Loading skeleton for dashboard
│   └── ProtectedRoute.jsx     # Auth + device-paired route guard
│
└── styles/
    └── index.css         # Full design system (dark mode, tokens, animations)

functions/
├── index.js              # Cloud Functions: claimDevice, unclaimDevice
└── package.json
```

---

## Future Additions (Out of Scope)

- Push notifications when a timer fires
- Multi-device support per user
- Energy monitoring / usage history
- Payment / subscription billing
- OTA firmware update portal
