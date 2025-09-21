# Firebase Setup Steps

## 1. Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `swar-e-safar`
3. Navigate to **Firestore Database**
4. Click **Create database**
5. Choose **Start in test mode** (we'll add security rules later)
6. Select a location close to your users (e.g., `asia-south1`)

## 2. Enable Authentication

1. In Firebase Console → **Authentication**
2. Click **Get started**
3. Go to **Sign-in method** tab
4. Enable **Email/Password** provider
5. Create your admin user:
   - Go to **Users** tab
   - Click **Add user**
   - Email: `admin@shifoyage.com` (or your preferred email)
   - Password: Choose a secure password

## 3. Set Admin Custom Claims

### Option A: Using Firebase Console (if available)
In Firebase Console → **Authentication** → **Users**:
1. Click on your admin user
2. Look for **Custom claims** section
3. Add: `{"admin": true}`

### Option B: Using Script (if console option not available)
1. Go to Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key" and download the JSON file
3. Place the JSON file in the `scripts/` folder as `service-account.json`
4. Update `scripts/set_admin_claims.js` with your admin email
5. Run: `node scripts/set_admin_claims.js`

### Option C: Simple Alternative (Recommended)
**Temporarily use test mode rules** - we'll update the security rules to allow any authenticated user to write (for initial testing):

In `firestore.rules`, temporarily change:
```javascript
allow write: if request.auth.token.admin == true;
```
to:
```javascript
allow write: if request.auth != null;
```

Then switch back to admin-only after testing.

## 4. Firebase CLI Setup & Deploy

Run these commands in your project directory:

```bash
# Login to Firebase (opens browser)
firebase login

# Add your project
firebase use --add
# Select: swar-e-safar
# Alias: default

# Deploy rules and functions (PowerShell syntax)
firebase deploy --only "functions,firestore"
```

## 5. Import Attendees

```bash
cd scripts
npm install
node import_attendees.js
```

## 6. Deploy Cloud Function

```bash
cd functions
npm install
firebase deploy --only functions
```

## Troubleshooting

**If you get "NOT_FOUND" errors:**
- Make sure Firestore database is created (step 1)
- Verify project ID matches in firebase config
- Check that security rules are deployed

**If import script fails:**
- Ensure you're logged into Firebase CLI
- Verify the CSV file path is correct
- Check network connectivity

## Test Your Setup

1. Start the app: `npm start`
2. Login with your admin credentials
3. Try scanning a QR code or searching for an attendee
4. Test the coupon issuance flow

The app should now work without the NOT_FOUND errors!