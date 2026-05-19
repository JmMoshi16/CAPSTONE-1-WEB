# Flutter Integration — QR Scan History

## Overview
When a customer scans a QR code in the Flutter app, the app must write a document to the `qr_scan_history` Firestore collection. This is what populates the **Scan History** tab in the admin dashboard.

---

## Firestore Collection: `qr_scan_history`

### Document Structure

```dart
{
  "token": "uuid-string-of-the-scanned-qr",         // String — the QR token value
  "wasteType": "Recyclable",                          // String — "Biodegradable" | "Recyclable" | "Residual"
  "scannedAt": "2024-05-01T13:45:00.000Z",           // String — ISO 8601 timestamp of when user scanned
  "scannedByUid": "firebase-auth-uid",               // String — the customer's Firebase Auth UID
  "scannedByName": "Juan Dela Cruz",                 // String — customer's username from users collection
  "scannedByEmail": "juan@example.com",              // String — customer's email
  "pointsAwarded": 10,                               // Number — points given for this scan
  "tokenCreatedAt": "2024-05-01T13:30:00.000Z",      // String — ISO 8601 timestamp of when admin generated the QR
  "expiresAt": "2024-05-01T13:50:00.000Z",           // String — ISO 8601 expiry timestamp of the QR token
  "secondsAfterCreation": 900                        // Number — how many seconds after tokenCreatedAt the user scanned
}
```

---

## How to Calculate `secondsAfterCreation`

```dart
final tokenCreatedAt = DateTime.parse(qrToken.createdAt);
final scannedAt = DateTime.now();
final secondsAfterCreation = scannedAt.difference(tokenCreatedAt).inSeconds;
```

---

## Flutter Code — Write to `qr_scan_history`

Call this function after a successful QR scan and points have been awarded:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

Future<void> recordQRScan({
  required String token,
  required String wasteType,
  required int pointsAwarded,
  required String tokenCreatedAt,
  required String expiresAt,
}) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return;

  // Get user's display name from Firestore
  final userDoc = await FirebaseFirestore.instance
      .collection('users')
      .doc(user.uid)
      .get();

  final username = userDoc.data()?['username'] ?? 'Unknown';
  final email = user.email ?? '';

  final scannedAt = DateTime.now();
  final createdAt = DateTime.parse(tokenCreatedAt);
  final secondsAfterCreation = scannedAt.difference(createdAt).inSeconds;

  await FirebaseFirestore.instance.collection('qr_scan_history').add({
    'token': token,
    'wasteType': wasteType,
    'scannedAt': scannedAt.toIso8601String(),
    'scannedByUid': user.uid,
    'scannedByName': username,
    'scannedByEmail': email,
    'pointsAwarded': pointsAwarded,
    'tokenCreatedAt': tokenCreatedAt,
    'expiresAt': expiresAt,
    'secondsAfterCreation': secondsAfterCreation,
  });
}
```

---

## When to Call It

Call `recordQRScan()` inside your QR scan handler, **after**:
1. The QR token is validated (not expired, not already used)
2. Points have been added to the user's account
3. The `waste_logs` document has been written

```dart
// Example flow in your QR scan screen
Future<void> handleQRScan(String qrValue) async {
  // qrValue format: "ECOBIN:Recyclable:uuid-token"
  final parts = qrValue.split(':');
  if (parts.length < 3 || parts[0] != 'ECOBIN') return;

  final wasteType = parts[1];
  final token = parts[2];

  // 1. Fetch token doc from qr_tokens
  final tokenQuery = await FirebaseFirestore.instance
      .collection('qr_tokens')
      .where('token', isEqualTo: token)
      .limit(1)
      .get();

  if (tokenQuery.docs.isEmpty) return; // invalid token

  final tokenData = tokenQuery.docs.first.data();
  final expiresAt = DateTime.parse(tokenData['expiresAt']);

  if (DateTime.now().isAfter(expiresAt)) return; // expired

  // 2. Award points + write waste_log (your existing logic here)
  // ...

  // 3. Record scan history
  await recordQRScan(
    token: token,
    wasteType: wasteType,
    pointsAwarded: pointsAwarded,
    tokenCreatedAt: tokenData['createdAt'],
    expiresAt: tokenData['expiresAt'],
  );
}
```

---

## Firestore Security Rules

Add this rule to allow customers to write to `qr_scan_history`:

```
match /qr_scan_history/{docId} {
  allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  allow create: if request.auth != null;
}
```

---

## Admin Dashboard — What It Shows

Once documents exist in `qr_scan_history`, the admin dashboard QR page will show:

| Field | Displayed As |
|---|---|
| `scannedByName` + `scannedByEmail` | User info on each row |
| `scannedAt` | "X minutes ago" timestamp |
| `secondsAfterCreation` | "Xm Xs after generation" + progress bar |
| `pointsAwarded` | Green points badge |
| `wasteType` | Colored type badge |
| Full receipt | Slide-in drawer with timing analysis |

---

*Generated for ECOReward Bin — Capstone Project*
