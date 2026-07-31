# Coding Prompt: Smart Multi-Plug Website / Dashboard

Copy everything below into your AI coding assistant (Claude Code, Cursor, etc.) or use it as a spec for manual development.

---

## Project Context

Build a production-grade web application for the **Smart Multi-Plug** — a WiFi-controlled 4-outlet power strip (ESP8266-based). The website lets users create an account, pair their physical device, and control 4 plugs remotely. The device communicates over MQTT with retained messages; the website must reflect true device state in near real-time, not guess or assume commands succeeded.

Design for non-technical end users: the UI must be extremely simple — no jargon, no clutter, large clear controls.

## Tech Stack

- **Frontend:** React (or Next.js if SSR/routing benefits are wanted — your call, but state the choice and why).
- **Auth:** Firebase Authentication (email/password + Google sign-in).
- **Database:** Firebase Realtime Database (or Firestore — pick one and justify briefly; Realtime Database pairs naturally with the always-on MQTT-style data flow described below).
- **Device messaging:** MQTT over WebSockets, connecting directly from the browser to the same MQTT broker (e.g., HiveMQ Cloud) the ESP8266 uses, using the `mqtt.js` library.
- **Hosting:** Static hosting (Vercel/Firebase Hosting) is acceptable since there's no custom backend server required beyond Firebase + MQTT broker — call this out explicitly, or propose a minimal Node/Express backend only if genuinely needed (e.g., for the device-claim security check described below).

## Core User Flows

### 1. Sign Up / Log In
- Email/password and Google sign-in via Firebase Auth.
- Standard password reset flow (Firebase handles this natively).
- After login, redirect to the dashboard. If the user has no paired device yet, show a "Pair your device" screen instead of an empty dashboard.

### 2. Device Pairing (Claim Flow)
- User enters the pairing code shown on their device's OLED screen (format: `SP-xxxxxxxx`) into a single input field.
- **Security requirement:** pairing must not be a simple "does this code exist" check. The backend (Firebase Cloud Function, or minimal Node endpoint) must verify:
  - The `device_id` exists in a pre-registered `devices` table (written during factory provisioning — assume this table already exists and is seeded).
  - The device is not already claimed by another user (`claimed_by` field is empty/null).
  - On success, set `claimed_by = uid` and create a `users/{uid}/devices/{deviceId}` record with default plug names ("Plug 1"–"Plug 4").
- Show a clear success state, then route to the dashboard.
- Handle and clearly display errors: invalid code, already-claimed device, network failure.

### 3. Dashboard (Main Screen)
- 4 large toggle switches, one per plug, each labeled with a user-editable name (tap-to-rename, saved to the database).
- A device online/offline indicator (small dot or badge + label) so users understand immediately why controls might not be responding.
- Toggling a switch must:
  1. Optimistically update the UI immediately (feels instant).
  2. Publish an MQTT command to `users/{uid}/devices/{deviceId}/plug/{n}/set`.
  3. Subscribe to `users/{uid}/devices/{deviceId}/plug/{n}/state` and reconcile the UI to the device's *actual* reported state — if the device doesn't confirm within a few seconds, revert the optimistic UI state and show a small "didn't respond" indication rather than leaving the UI in a false state.
- Subscribe to `users/{uid}/devices/{deviceId}/status` (retained topic) on dashboard load so the correct last-known online/offline state appears immediately, without waiting for a fresh publish.

### 4. Settings (Minimal, Secondary Screen)
- Rename plugs.
- Unpair/remove device (clears `claimed_by` server-side, not just locally).
- Account settings (change password, log out).

### 5. Advanced Timers (Unified Panel)

Present Schedule and Timer as **one panel with a mode toggle**, not two separate screens — this is simpler for users than maintaining a mental model of "two different features." Layout (matches agreed design):

```
┌─ Advanced Timers ──────────────────────────────┐
│ DEVICE:  [ Plug 1 ] [ Plug 2 ] [ Plug 3 ] [Plug 4]│
│ ACTION:  [ ON ]  [ OFF ]                          │
│                                                    │
│ TIMER MODE:  [ Delay ]  [ Schedule Time ]         │
│                                                    │
│  — if Delay selected —                            │
│  SELECT DELAY:                                     │
│  [1 Min] [5 Min] [15 Min]                          │
│  [30 Min] [1 Hour] [Custom __ min]                 │
│                                                    │
│  — if Schedule Time selected —                     │
│  SET TIME: [ HH:MM picker ]                        │
│  REPEAT:   [ Once ] [ Every day ] [ Custom days ]  │
│                                                    │
│           [   Add Timer   ]                        │
│                                                    │
│ ACTIVE TIMERS                                       │
│  (list of running/scheduled timers, or              │
│   "No active timers" empty state)                  │
└────────────────────────────────────────────────┘
```

**5a. Delay mode (one-off countdown)**
- User picks Device (which plug), Action (turn it ON or OFF when the timer fires), and a duration via quick-pick chips (1/5/15/30 min, 1 hour) or a custom minute value.
- This is duration-based and runs on the device's `millis()` clock — it does **not** require WiFi/NTP time sync to work correctly, unlike Schedule Time mode below. This makes it the reliable option for users whose device isn't consistently online.
- Tapping "Add Timer" publishes a start command to `.../plug/{n}/timer/set` with the duration + action, and adds an entry to the Active Timers list showing a live countdown (sourced from the device's reported remaining time over MQTT, not simulated client-side, so it never drifts from the device's actual state).
- Only one active Delay timer per plug — starting a new one on a plug that already has one running should prompt to replace it, not silently overwrite.

**5b. Schedule Time mode (recurring or one-off at a specific time)**
- User picks Device, Action, a specific clock time, and a repeat setting: Once / Every day / Custom days.
- Multiple Schedule Time entries per plug are allowed (unlike the device's own on-screen menu, which is limited to one daily ON + one daily OFF time per port — see the firmware prompt, Section 7a; this website panel is the full-featured editor).
- **Important limitation to surface here, not hide:** Schedule Time mode requires the device to know the correct clock time, which it only gets by syncing over WiFi (there's no battery-backed clock chip in this hardware). If the device has never connected to WiFi, or has lost its time sync, Schedule Time entries won't fire correctly until it reconnects. Show a small inline note when Schedule Time mode is selected (e.g., "Requires your plug to be connected to WiFi to keep accurate time.") — Delay mode shows no such warning, since it doesn't need it.
- On save, publish the entry to a retained MQTT topic (`.../plug/{n}/schedule`) and also persist it in the database so it reloads correctly next time the dashboard opens, independent of the device's own retained MQTT state.

**5c. Active Timers list**
- Shows all currently running Delay countdowns and upcoming/recurring Schedule Time entries for the selected device, in plain language (e.g., "Light — ON in 4:32" for a Delay timer, "Fan — OFF every day at 11:00 PM" for a Schedule Time entry).
- Each entry has a way to cancel/delete it.
- Empty state: "No active timers" (as in the agreed mockup) rather than a blank area.

## MQTT Integration Details

- Use `mqtt.js` over WebSockets (`wss://`) to connect from the browser directly to the broker.
- Authenticate the MQTT connection using a **scoped, short-lived credential** — do not expose a broker admin credential in frontend code. If the broker supports JWT-based auth or per-user credentials issued by a Cloud Function, use that; otherwise, document the limitation clearly as a known tradeoff to revisit.
- Topic structure (must match the ESP8266 firmware exactly):
  ```
  users/{uid}/devices/{deviceId}/plug/{1-4}/set      (publish, from website)
  users/{uid}/devices/{deviceId}/plug/{1-4}/state    (subscribe, retained)
  users/{uid}/devices/{deviceId}/plug/{1-4}/schedule (publish, retained — JSON array of schedule entries)
  users/{uid}/devices/{deviceId}/plug/{1-4}/timer/set    (publish — start/cancel a countdown timer)
  users/{uid}/devices/{deviceId}/plug/{1-4}/timer/state  (subscribe, retained — remaining time / active state)
  users/{uid}/devices/{deviceId}/status              (subscribe, retained, LWT)
  ```
- Clean up MQTT subscriptions on component unmount / logout to avoid leaked connections.

## Database Schema (Firebase Realtime Database example)

```
/devices/{deviceId}
    claimed_by: uid | null
    provisioned_at: timestamp

/users/{uid}/devices/{deviceId}
    name: string
    plugs/{1-4}/label: string
    plugs/{1-4}/schedule: [
        { enabled: bool, onTime: "HH:MM" | null, offTime: "HH:MM" | null, days: ["mon","tue",...] | "all" }
    ]
    paired_at: timestamp
```

Adjust field names as needed, but keep a clear separation between the provisioning-owned `/devices` table (source of truth for "does this device exist / is it claimed") and the user-owned `/users/{uid}/devices` table (source of truth for display names and preferences).

## UI/UX Requirements

- Design for a general, non-technical audience: minimal text, large touch targets, no technical jargon ("MQTT," "broker," "topic" should never appear in user-facing copy).
- Mobile-first responsive layout — most users will access this from a phone.
- Loading and error states for every network-dependent action (pairing, toggling, login) — never leave the user looking at a screen that appears frozen with no feedback.
- Empty state for a fresh account ("You haven't paired a device yet" with a clear call-to-action button).

## Non-Functional Requirements

- Handle Firebase Auth session persistence correctly (user stays logged in across page reloads).
- Guard all dashboard/settings routes behind an authenticated + device-paired check; redirect appropriately if either condition fails.
- Reasonable error boundaries so one failed component doesn't crash the whole dashboard.
- Basic loading skeletons rather than blank white screens during initial data fetch.

## Deliverables

1. Project structure (folders/files) with a brief explanation of each.
2. Firebase Auth integration (sign-up, login, logout, password reset).
3. Pairing/claim flow (frontend + the Cloud Function or minimal backend endpoint it calls).
4. Dashboard component with live MQTT-driven toggles and online/offline status.
5. Settings screen (rename plugs, unpair, account actions).
6. Per-plug scheduling UI (list, add, edit, delete schedule entries) with the WiFi/time-sync limitation clearly surfaced to the user.
7. A short README section explaining required environment variables (Firebase config, MQTT broker URL, any Cloud Function endpoints) without hardcoding secrets into the repo.

## Explicitly Out of Scope for This Prompt

- The ESP8266 firmware itself (already specified separately).
- The factory device-provisioning script that seeds the `/devices` table.
- Payment/billing, multi-device-per-user UI polish beyond basic support, and push notifications — note these as possible future additions but do not build them now.
