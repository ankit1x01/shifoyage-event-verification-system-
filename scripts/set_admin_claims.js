// Set admin custom claims for a user
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = {
  // You'll need to download service account key from Firebase Console
  // Go to Project Settings > Service accounts > Generate new private key
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'swar-e-safar'
});

async function setAdminClaim(email) {
  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);

    // Set custom claims
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    console.log(`✅ Admin claims set for ${email}`);
    console.log(`User UID: ${user.uid}`);

    // Verify claims were set
    const userRecord = await admin.auth().getUser(user.uid);
    console.log('Custom claims:', userRecord.customClaims);

  } catch (error) {
    console.error('Error setting admin claims:', error);
  }
}

// Usage: Replace with your admin email
const adminEmail = 'admin@shifoyage.com'; // Change this to your admin email
setAdminClaim(adminEmail);