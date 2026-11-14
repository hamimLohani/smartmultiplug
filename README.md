# Smart Multi-Plug — Web Dashboard

[![Smart Multi-Plug Demo](https://img.youtube.com/vi/S4y2Y5nRX88/maxresdefault.jpg)](https://youtu.be/S4y2Y5nRX88?si=wG9PPGMmeDoYeQaE)

A production-grade web application for controlling a WiFi-enabled smart power strip (ESP8266-based). Built with **React + Vite**, **Firebase Auth + Realtime Database**, and **MQTT over WebSockets**[...]

---

## Features

- 🔐 **Email/password + Google sign-in** via Firebase Auth
- 🔌 **Real-time plug control** — MQTT-driven with optimistic UI and automatic revert if device doesn't respond
- 🔄 **Multi-Device Support** — Seamlessly register, nick-name, and toggle control between multiple smart multi-plugs using a glassmorphic header dropdown
- 👥 **Family Sharing & Approvals** — Invite family members to control your plugs. Guest requests are held in a pending queue until the owner approves them
- 📶 **Live online/offline status** — Real-time indicators with unified paired/unpaired states across Dashboard, Timers, and Settings
- ⏱ **Advanced Timers** — Delay countdowns (device-clock based) and scheduled on/off times (WiFi clock based)
- 📝 **Tap-to-rename** outlets and strips — Saved to Firebase Realtime Database and synced across all family members in real-time
- 📱 **Mobile-first dark UI** — Glassmorphism, micro-animations, premium feel

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

### 4. Deploy Database Rules & Hosting

```bash
# Deploy RTDB Security Rules
firebase deploy --only database

# Build and deploy hosting
npm run build
firebase deploy --only hosting
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
3. Enable **Realtime Database** (start in locked mode, then deploy local `database.rules.json` using the Firebase CLI)
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

All topics are scoped to the device owner's UID and the device ID:

```
users/{ownerUid}/devices/{deviceId}/plug/{1-4}/set          ← publish (website → device)
users/{ownerUid}/devices/{deviceId}/plug/{1-4}/state        ← subscribe, retained (device → website)
users/{ownerUid}/devices/{deviceId}/plug/{1-4}/schedule     ← publish, retained (JSON array)
users/{ownerUid}/devices/{deviceId}/plug/{1-4}/timer/set    ← publish (start/cancel delay timer)
users/{ownerUid}/devices/{deviceId}/plug/{1-4}/timer/state  ← subscribe, retained (countdown state)
users/{ownerUid}/devices/{deviceId}/status                  ← subscribe, retained LWT (online/offline)
```

Guests and shared members dynamically resolve the `ownerUid` of the active device from the database to ensure all controls publish to the single source of truth namespace the physical plug is listening to.

---

## Family Sharing Architecture & Security

### 1. Pairing Approvals

If a device is already claimed by an owner:
- A guest user entering the same Device ID submits a pairing request to `devices/${deviceId}/pairing_requests/${guestUid}` containing their name and Gmail.
- The guest's pairing screen enters a real-time listening state showing **Awaiting Owner Approval**.
- The owner sees the pending request in their **Settings** page and can **Accept** or **Reject** it.

### 2. Owner Revocation

The owner can view all active shared guest Gmail addresses in the **Shared Members** card under settings. 
- Revoking a guest removes their UID from the device's shared members index and deletes the device reference node from the guest's personal path (`users/${guestUid}/devices/${deviceId}`).
- Upgraded Firebase RTDB Security Rules authorize the owner (`claimed_by === auth.uid`) to write and clean up nodes inside the guests' personal path.

---

## Security Notes

### MQTT Credentials (known tradeoff)

Currently the app uses static MQTT credentials stored in environment variables (`VITE_MQTT_USERNAME` / `VITE_MQTT_PASSWORD`). Because Vite bundles these into the client-side JavaScript, they are exposed to the browser.

**Acceptable for MVP** because:
- Credentials are scoped to a single read/write user (not broker admin)
- Topic ACLs on the broker limit access to `users/{uid}/*` patterns

**Production hardening** (recommended before public launch):
- Issue short-lived MQTT credentials from a Cloud Function on login, using HiveMQ's REST API or a custom JWT auth plugin
- Implement topic-level ACLs on the broker so each user can only pub/sub their own `users/{uid}/*` topics

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
│   └── DeviceContext.jsx # Multi-device loader + owner configuration synchronization
│
├── hooks/
│   └── useMqtt.js        # useMqttSubscribe / useMqttPublish hooks
│
├── pages/
│   ├── Login.jsx         # Sign in (email + Google + password reset)
│   ├── SignUp.jsx        # Register
│   ├── PairDevice.jsx    # SP-xxxxxxxx claim flow & owner-approval gate
│   ├── Dashboard.jsx     # 4-plug control panel with device switcher
│   ├── Timers.jsx        # Delay + Schedule timer panel
│   └── Settings.jsx      # Rename, unpair, guest approvals, and revocation lists
│
├── components/
│   ├── PlugCard.jsx           # Individual plug toggle + inline rename
│   ├── OnlineIndicator.jsx    # Online/offline badge (unpaired support)
│   ├── TabBar.jsx             # Bottom navigation bar
│   ├── ActiveTimersList.jsx   # Running timers list with countdown
│   ├── SkeletonLoader.jsx     # Loading skeleton for dashboard
│   └── ProtectedRoute.jsx     # Auth + device-paired route guard
│
├── styles/
│   └── index.css         # Full design system (dark mode, tokens, animations)
│
functions/
├── index.js              # Cloud Functions: claimDevice, unclaimDevice
└── package.json
```

---

## Future Additions (Out of Scope)

- Push notifications when a timer fires
- Energy monitoring / usage history
- Payment / subscription billing
- OTA firmware update portal
