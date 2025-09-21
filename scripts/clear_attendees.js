import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

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

async function clearAllAttendees() {
  console.log("Getting all attendees...");

  const querySnapshot = await getDocs(collection(db, "attendees"));
  console.log(`Found ${querySnapshot.size} documents to delete`);

  let deleteCount = 0;
  for (const docSnapshot of querySnapshot.docs) {
    try {
      await deleteDoc(doc(db, "attendees", docSnapshot.id));
      deleteCount++;
      console.log(`Deleted: ${docSnapshot.data().fullName} (${deleteCount}/${querySnapshot.size})`);
    } catch (error) {
      console.error(`Error deleting ${docSnapshot.data().fullName}:`, error);
    }
  }

  console.log(`Cleared ${deleteCount} attendees from Firebase`);
}

clearAllAttendees().catch(console.error);