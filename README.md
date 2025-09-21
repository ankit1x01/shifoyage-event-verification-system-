# Shifoyage Event QR Check-in System

A React + Firebase app for event QR code check-ins with coupon system.

## Features

- **QR Scanner**: Scan attendee QR codes to check them in
- **Admin Panel**: Search attendees, quick check-in, view QR codes
- **Coupon System**: Issue ₹199 coupons after reel + review verification
- **Real-time Updates**: Firebase Firestore for live data sync

## Quick Setup

### 1. Firebase Setup
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase project (choose existing project: swar-e-safar)
firebase init
```

### 2. Import Attendees
```bash
cd scripts
npm install
npm run import
```

### 3. Deploy Cloud Function
```bash
cd functions
npm install
firebase deploy --only functions
```

### 4. Set Admin Claims
In Firebase Console > Authentication:
- Create admin user with email/password
- Add custom claim: `{ "admin": true }`

### 5. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 6. Run Development Server
```bash
npm start
```

## Google Review Setup

Update the `googleReviewUrl` in `src/App.js`:
```javascript
const googleReviewUrl = "https://g.page/r/YOUR_PLACE_ID/review";
```

## Usage Flow

1. **Staff scans QR** → Opens attendee page → Mark check-in
2. **Attendee posts reel** → Paste Instagram/YouTube link
3. **Admin verifies** → Issue ₹199 coupon (requires both reel + review)
4. **Quick admin search** → Type name → One-click check-in

## File Structure

```
src/App.js          # Main React app with QR scanner + admin
scripts/            # CSV import utilities
functions/          # Cloud Functions (coupon issuing)
firestore.rules     # Database security rules
public/Attendees_Seed.csv  # Attendee data for import
```

## Build & Deploy

```bash
npm run build
firebase deploy --only hosting
```

The app will be available at: https://swar-e-safar.web.app