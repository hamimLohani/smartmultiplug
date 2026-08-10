/**
 * Smart Multi-Plug — Firebase Cloud Functions
 *
 * claimDevice  : Securely pairs a device to a user account.
 * unclaimDevice: Removes a device from a user account.
 *
 * Both are HTTPS Callable Functions — they automatically receive the
 * authenticated user context so we never trust UIDs from the client.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp }      = require('firebase-admin/app');
const { getDatabase }        = require('firebase-admin/database');

initializeApp();

function getNumPlugsFromDeviceId(deviceId) {
  if (deviceId.startsWith('SP2-')) return 2;
  if (deviceId.startsWith('SP3-')) return 3;
  return 4;
}

// ── claimDevice ─────────────────────────────────────────────────────────────
exports.claimDevice = onCall(async (request) => {
  // 1. Must be authenticated
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to pair a device.');
  }

  const uid      = request.auth.uid;
  const deviceId = request.data?.deviceId;

  if (!deviceId || typeof deviceId !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid device ID is required.');
  }

  const db         = getDatabase();
  const deviceRef  = db.ref(`/devices/${deviceId}`);
  const deviceSnap = await deviceRef.once('value');

  // 2. Device must exist in the provisioned devices table
  if (!deviceSnap.exists()) {
    throw new HttpsError('not-found', 'Device not found. Check the code on your device screen.');
  }

  const deviceData = deviceSnap.val();

  // 3. Device must not already be claimed
  if (deviceData.claimed_by && deviceData.claimed_by !== uid) {
    throw new HttpsError('already-exists', 'This device is already paired to another account.');
  }

  // 4. Atomic write: mark device as claimed + create user device record
  const now = Date.now();
  const numPlugs = getNumPlugsFromDeviceId(deviceId);
  const updates = {
    [`/devices/${deviceId}/claimed_by`]: uid,
    [`/devices/${deviceId}/claimed_at`]: now,
    [`/users/${uid}/devices/${deviceId}/name`]: 'Smart Multi-Plug',
    [`/users/${uid}/devices/${deviceId}/paired_at`]: now,
  };

  for (let n = 1; n <= numPlugs; n++) {
    updates[`/users/${uid}/devices/${deviceId}/plugs/${n}/label`] = `Plug ${n}`;
  }

  await db.ref().update(updates);

  return { success: true, deviceId };
});

// ── unclaimDevice ────────────────────────────────────────────────────────────
exports.unclaimDevice = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const uid      = request.auth.uid;
  const deviceId = request.data?.deviceId;

  if (!deviceId) {
    throw new HttpsError('invalid-argument', 'A device ID is required.');
  }

  const db         = getDatabase();
  const deviceRef  = db.ref(`/devices/${deviceId}`);
  const deviceSnap = await deviceRef.once('value');

  if (!deviceSnap.exists()) {
    throw new HttpsError('not-found', 'Device not found.');
  }

  const deviceData = deviceSnap.val();

  // Only the current owner can unclaim
  if (deviceData.claimed_by !== uid) {
    throw new HttpsError('permission-denied', 'You do not own this device.');
  }

  // Atomic write: clear claimed_by + remove user device record
  await db.ref().update({
    [`/devices/${deviceId}/claimed_by`]: null,
    [`/devices/${deviceId}/claimed_at`]: null,
    [`/users/${uid}/devices/${deviceId}`]: null,
  });

  return { success: true };
});
