const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.issue199Coupon = functions.https.onCall(async (data, context) => {
  if (!context.auth?.token?.admin) {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }
  const { attendeeId } = data;
  const ref = db.collection("attendees").doc(attendeeId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Attendee not found");
    const a = snap.data();

    if (!a.reelLink || !a.reviewUrl) {
      throw new functions.https.HttpsError("failed-precondition", "Reel and review are required before issuing coupon.");
    }
    if (a.couponStatus === "issued") {
      // idempotent
      return;
    }

    const code = "EVNT199-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    tx.update(ref, { couponStatus: "issued", couponCode: code });

    tx.set(db.collection("coupons").doc(code), {
      code,
      amount: 199,
      issuedTo: ref.id,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  const updated = await ref.get();
  return { couponCode: updated.data().couponCode };
});