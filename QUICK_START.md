# 🚀 Quick Start Commands

## ✅ Rules Updated - Now Run These Commands:

```bash
# 1. Login to Firebase (opens browser)
firebase login

# 2. Set your project
firebase use --add
# Select: swar-e-safar
# Alias: default

# 3. Deploy the test rules
firebase deploy --only "firestore"

# 4. Deploy functions
firebase deploy --only "functions"

# 5. Import your attendees
cd scripts
npm install
node import_attendees.js
```

## 🎯 What Changed:

✅ **Firestore rules updated** to allow any authenticated user (temporary test mode)
✅ **No custom claims needed** for initial testing
✅ **Ready to deploy** once you run the commands above

## 🧪 Test Your App:

1. `npm start` - Start the React app
2. Create a user in Firebase Console → Authentication
3. Login with that user in your app
4. Test QR scanning and attendee management

## 🔒 For Production Later:

Switch back to admin-only rules by copying the original `firestore.rules` content with admin checks.

**Your app is now ready to deploy and test!** 🎉