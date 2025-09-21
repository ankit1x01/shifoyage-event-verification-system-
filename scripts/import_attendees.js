import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyABY76GZlMiQOGuaBOJlo-pyLP9uPy-Hnk",
  authDomain: "swar-e-safar.firebaseapp.com",
  projectId: "swar-e-safar",
  storageBucket: "swar-e-safar.firebasestorage.app",
  messagingSenderId: "857144891571",
  appId: "1:857144891571:web:6fc8922a8a43fdf7a1b8c6",
  measurementId: "G-ZQ5L1E8M10"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Read and parse CSV
const csvContent = fs.readFileSync("../public/Attendees_Seed.csv", "utf8");
const rows = csvContent.trim().split("\n");
const [header, ...data] = rows;
const cols = header.split(",");

function generateQRId() {
  return "QR_" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function importAttendees() {
  console.log("Starting import...");

  for (const line of data) {
    if (!line.trim()) continue; // Skip empty lines

    const values = line.split(",");
    const obj = Object.fromEntries(cols.map((c, i) => [c, values[i] || ""]));

    // Generate QR ID if not provided
    obj.qrId = obj.qrId || generateQRId();

    try {
      await addDoc(collection(db, "attendees"), {
        fullName: obj.fullName,
        status: obj.status || "pending",
        category: obj.category || "attendee",
        checkIn: (obj.checkIn === "True" || obj.checkIn === "true"),
        couponStatus: obj.couponStatus || "none",
        reelLink: obj.reelLink || "",
        reviewUrl: obj.reviewUrl || "",
        qrId: obj.qrId,
        checkedInAt: null
      });
      console.log("Imported:", obj.fullName, "- QR:", obj.qrId);
    } catch (error) {
      console.error("Error importing", obj.fullName, ":", error);
    }
  }

  console.log("Import completed!");
}

importAttendees().catch(console.error);