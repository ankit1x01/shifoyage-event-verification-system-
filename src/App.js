import React, { useEffect, useMemo, useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, query, where, getDocs, getDoc, doc,
  updateDoc, serverTimestamp, orderBy, limit, startAt, endAt, addDoc
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import QRCode from "qrcode.react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { BrowserMultiFormatReader } from "@zxing/library";

// Firebase configuration
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
const auth = getAuth(app);
const functions = getFunctions(app);

// Google Review URL - Replace with your actual Google review link
const googleReviewUrl = "https://g.page/r/YOUR_PLACE_ID/review";

function useAuth() {
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

// QR Scanner Component using ZXing
function Scanner({ onOpenAttendee }) {
  const [result, setResult] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());

  const startScan = async () => {
    try {
      setIsScanning(true);
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      const selectedDeviceId = videoInputDevices[0]?.deviceId;

      codeReader.current.decodeFromVideoDevice(selectedDeviceId, videoRef.current, (result, err) => {
        if (result) {
          setResult(result.getText());
          setIsScanning(false);
          codeReader.current.reset();
        }
      });
    } catch (err) {
      console.error("Error starting scanner:", err);
      setIsScanning(false);
    }
  };

  const stopScan = () => {
    setIsScanning(false);
    codeReader.current.reset();
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Scan QR Code</h2>

      <div className="mb-4">
        <video ref={videoRef} style={{ width: "100%", maxWidth: "400px" }} />
      </div>

      <div className="flex gap-2 mb-4">
        {!isScanning ? (
          <button onClick={startScan} className="px-4 py-2 bg-green-600 text-white rounded">
            Start Camera
          </button>
        ) : (
          <button onClick={stopScan} className="px-4 py-2 bg-red-600 text-white rounded">
            Stop Camera
          </button>
        )}
      </div>

      <div className="mt-3">
        <input
          className="border p-2 w-full mb-2"
          placeholder="Or paste QR ID manually"
          value={result}
          onChange={e => setResult(e.target.value)}
        />
        <button
          className="w-full px-4 py-2 bg-black text-white rounded"
          onClick={async () => {
            if (!result) return;
            try {
              const q = query(collection(db, "attendees"), where("qrId", "==", result));
              const snap = await getDocs(q);
              if (snap.empty) {
                alert("Attendee not found with QR ID: " + result);
                return;
              }
              const d = snap.docs[0];
              onOpenAttendee({ id: d.id, ...d.data() });
            } catch (error) {
              alert("Error finding attendee: " + error.message);
            }
          }}
        >
          Open Attendee
        </button>
      </div>
    </div>
  );
}

// Attendee Card Component
function AttendeeCard({ attendee, refresh, showCheckbox = false, isSelected = false, onSelect, onQuickCheckIn }) {
  const [saving, setSaving] = useState(false);
  const [reel, setReel] = useState(attendee.reelLink || "");
  const [review, setReview] = useState(attendee.reviewUrl || "");

  const checkIn = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "attendees", attendee.id), {
        checkIn: true,
        checkedInAt: serverTimestamp()
      });
      await refresh();
    } catch (error) {
      alert("Error checking in: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveProofs = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "attendees", attendee.id), {
        reelLink: reel,
        reviewUrl: review
      });
      await refresh();
    } catch (error) {
      alert("Error saving proofs: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const issueCoupon = async () => {
    try {
      const call = httpsCallable(functions, "issue199Coupon");
      const res = await call({ attendeeId: attendee.id });
      alert("Coupon issued: " + (res.data?.couponCode || "(check doc)"));
      await refresh();
    } catch (error) {
      alert("Error issuing coupon: " + error.message);
    }
  };

  return (
    <div className="p-4 border rounded mt-3 bg-white shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {showCheckbox && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              className="w-4 h-4"
              onClick={e => e.stopPropagation()}
            />
          )}
          <h3 className="text-lg font-semibold">{attendee.fullName}</h3>
        </div>
        <div className="text-right">
          <span className={`text-sm px-2 py-1 rounded ${
            attendee.status === 'paid' ? 'bg-green-100 text-green-800' :
            attendee.status === 'internal' ? 'bg-blue-100 text-blue-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {attendee.status}
          </span>
        </div>
      </div>

      <div className="mb-3 text-sm space-y-1">
        <div>Category: <span className="font-medium">{attendee.category}</span></div>
        <div>Check-in: {attendee.checkIn ? "✅ Checked" : "❌ Not checked"}</div>
        <div>QR ID: <span className="font-mono">{attendee.qrId}</span></div>
        {attendee.couponStatus === "issued" && (
          <div className="text-purple-700 font-semibold">
            Coupon: {attendee.couponCode}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {!attendee.checkIn && (
          <div className="flex gap-2">
            <button
              disabled={saving}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              onClick={checkIn}
            >
              {saving ? "Checking in..." : "Mark Check-in"}
            </button>
            {showCheckbox && onQuickCheckIn && (
              <button
                className="px-3 py-2 bg-green-700 text-white rounded hover:bg-green-800 text-sm"
                onClick={onQuickCheckIn}
              >
                Quick ✓
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <a
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-center hover:bg-blue-700"
            href={googleReviewUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Google Review
          </a>
        </div>

        <div className="space-y-2">
          <input
            className="w-full border p-2 rounded"
            placeholder="Reel link (Instagram/YouTube)"
            value={reel}
            onChange={e => setReel(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="Google review URL (optional proof)"
            value={review}
            onChange={e => setReview(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            disabled={saving}
            className="flex-1 px-3 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
            onClick={saveProofs}
          >
            {saving ? "Saving..." : "Save Proofs"}
          </button>
          <button
            disabled={saving || attendee.couponStatus === "issued" || !reel || !review}
            className="flex-1 px-3 py-2 bg-purple-700 text-white rounded hover:bg-purple-800 disabled:opacity-50"
            onClick={issueCoupon}
            title={!reel || !review ? "Reel and review required" : ""}
          >
            {attendee.couponStatus === "issued" ? "Coupon Issued" : "Issue ₹199 Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Attendee Form Component
function AddAttendeeForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    fullName: '',
    status: 'paid',
    category: 'attendee'
  });
  const [saving, setSaving] = useState(false);

  const generateQRId = () => {
    return "QR_" + Math.random().toString(36).slice(2, 10).toUpperCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      alert("Name is required");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "attendees"), {
        fullName: formData.fullName.trim(),
        status: formData.status,
        category: formData.category,
        checkIn: false,
        couponStatus: "none",
        reelLink: "",
        reviewUrl: "",
        qrId: generateQRId(),
        checkedInAt: null,
        createdAt: serverTimestamp()
      });

      alert(`✅ Attendee "${formData.fullName}" added successfully!`);
      onSuccess();
      onClose();
    } catch (error) {
      alert("Error adding attendee: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Add New Attendee</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name *</label>
            <input
              type="text"
              className="w-full border p-2 rounded"
              value={formData.fullName}
              onChange={e => setFormData({...formData, fullName: e.target.value})}
              placeholder="Enter attendee name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full border p-2 rounded"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value})}
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="internal">Internal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              className="w-full border p-2 rounded"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              <option value="attendee">Attendee</option>
              <option value="staff">Staff</option>
              <option value="bhopali_point">Bhopali Point</option>
            </select>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Adding..." : "Add Attendee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Admin Panel Component
function AdminPanel() {
  const [term, setTerm] = useState("");
  const [list, setList] = useState([]);
  const [picked, setPicked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedAttendees, setSelectedAttendees] = useState(new Set());
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("all"); // all, paid, pending, internal
  const [viewMode, setViewMode] = useState("cards"); // cards, table
  const [showAddForm, setShowAddForm] = useState(false);

  const loadAllAttendees = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, "attendees"), orderBy("fullName"));

      if (filter !== "all") {
        q = query(collection(db, "attendees"), where("status", "==", filter), orderBy("fullName"));
      }

      const snap = await getDocs(q);
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setShowAll(true);
    } catch (error) {
      alert("Error loading attendees: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    if (!term) {
      setList([]);
      setShowAll(false);
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "attendees"),
        orderBy("fullName"),
        startAt(term),
        endAt(term + "\uf8ff"),
        limit(20)
      );
      const snap = await getDocs(q);
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setShowAll(false);
    } catch (error) {
      alert("Search error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshPicked = async () => {
    if (!picked) return;
    try {
      const d = await getDoc(doc(db, "attendees", picked.id));
      setPicked({ id: d.id, ...d.data() });
    } catch (error) {
      alert("Error refreshing: " + error.message);
    }
  };

  const quickCheckIn = async (attendee, e) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "attendees", attendee.id), {
        checkIn: true,
        checkedInAt: serverTimestamp()
      });

      // Refresh the list
      if (showAll) {
        await loadAllAttendees();
      } else {
        await search();
      }
    } catch (error) {
      alert("Error checking in: " + error.message);
    }
  };

  const bulkCheckIn = async () => {
    if (selectedAttendees.size === 0) return;

    try {
      const promises = Array.from(selectedAttendees).map(attendeeId =>
        updateDoc(doc(db, "attendees", attendeeId), {
          checkIn: true,
          checkedInAt: serverTimestamp()
        })
      );

      await Promise.all(promises);
      setSelectedAttendees(new Set());

      // Refresh the list
      if (showAll) {
        await loadAllAttendees();
      } else {
        await search();
      }

      alert(`✅ Checked in ${promises.length} attendees`);
    } catch (error) {
      alert("Error with bulk check-in: " + error.message);
    }
  };

  const toggleSelectAttendee = (attendeeId) => {
    const newSelected = new Set(selectedAttendees);
    if (newSelected.has(attendeeId)) {
      newSelected.delete(attendeeId);
    } else {
      newSelected.add(attendeeId);
    }
    setSelectedAttendees(newSelected);
  };

  const selectAll = () => {
    const allIds = new Set(list.map(a => a.id));
    setSelectedAttendees(allIds);
  };

  const clearSelection = () => {
    setSelectedAttendees(new Set());
  };

  const refreshList = async () => {
    if (showAll) {
      await loadAllAttendees();
    } else if (term) {
      await search();
    }
  };

  // Download attendee list with verification links
  const downloadAttendeeLinks = () => {
    if (list.length === 0) {
      alert("No attendees to download. Load attendees first.");
      return;
    }

    // Base URL for verification page - update this to your actual deployment URL
    const baseUrl = window.location.origin + "/attendee-verify.html";
    
    // Create CSV content
    const csvHeaders = "Name,QR ID,Verification Link,Status,Category,Checked In,Coupon Status\n";
    const csvRows = list.map(attendee => {
      const verificationLink = `${baseUrl}?qrId=${attendee.qrId}`;
      return `"${attendee.fullName}","${attendee.qrId}","${verificationLink}","${attendee.status}","${attendee.category}","${attendee.checkIn ? 'Yes' : 'No'}","${attendee.couponStatus || 'none'}"`;
    }).join('\n');
    
    const csvContent = csvHeaders + csvRows;

    // Create downloadable file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `attendee_verification_links_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Generate text list for sharing
  const generateTextList = () => {
    if (list.length === 0) {
      alert("No attendees to generate list. Load attendees first.");
      return;
    }

    const baseUrl = window.location.origin + "/attendee-verify.html";
    
    let textContent = `🎵 SWAR-E-SAFAR Event Pass Links 🎵\n`;
    textContent += `Generated on: ${new Date().toLocaleDateString()}\n`;
    textContent += `Total Attendees: ${list.length}\n\n`;
    
    list.forEach((attendee, index) => {
      const verificationLink = `${baseUrl}?qrId=${attendee.qrId}`;
      textContent += `${index + 1}. ${attendee.fullName}\n`;
      textContent += `   QR ID: ${attendee.qrId}\n`;
      textContent += `   Link: ${verificationLink}\n`;
      textContent += `   Status: ${attendee.status} | ${attendee.checkIn ? 'Checked In' : 'Not Checked In'}\n\n`;
    });

    // Copy to clipboard
    navigator.clipboard.writeText(textContent).then(() => {
      alert("✅ Attendee list copied to clipboard!");
    }).catch(err => {
      // Fallback: show in a textarea for manual copying
      const textarea = document.createElement('textarea');
      textarea.value = textContent;
      textarea.style.width = '100%';
      textarea.style.height = '400px';
      
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000';
      
      const content = document.createElement('div');
      content.style.cssText = 'background:white;padding:20px;border-radius:8px;max-width:90%;max-height:90%;overflow:auto';
      content.innerHTML = '<h3>Copy Attendee List (Ctrl+A, Ctrl+C)</h3>';
      content.appendChild(textarea);
      
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.style.cssText = 'margin-top:10px;padding:8px 16px;background:#000;color:white;border:none;border-radius:4px;cursor:pointer';
      closeBtn.onclick = () => document.body.removeChild(modal);
      content.appendChild(closeBtn);
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      textarea.select();
    });
  };

  // Comprehensive Firebase Query & Download
  const downloadAllFirebaseData = async () => {
    try {
      setLoading(true);
      
      // Query all attendees from Firebase
      const attendeesRef = collection(db, "attendees");
      const allAttendeesQuery = query(attendeesRef, orderBy("fullName"));
      const querySnapshot = await getDocs(allAttendeesQuery);
      
      const allAttendees = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        allAttendees.push({
          id: doc.id,
          ...data,
          // Ensure we have a QR ID
          qrId: data.qrId || doc.id,
          // Format timestamps if they exist
          createdAt: data.createdAt?.toDate?.()?.toLocaleString() || 'N/A',
          updatedAt: data.updatedAt?.toDate?.()?.toLocaleString() || 'N/A',
          checkInTime: data.checkInTime?.toDate?.()?.toLocaleString() || 'N/A'
        });
      });

      if (allAttendees.length === 0) {
        alert("No attendees found in Firebase database.");
        return;
      }

      // Base URL for verification links
      const baseUrl = window.location.origin + "/attendee-verify.html";
      
      // Create comprehensive CSV content
      const csvHeaders = [
        "Name", "QR ID", "Verification Link", "Status", "Category", 
        "Email", "Phone", "Checked In", "Check-in Time", "Coupon Status",
        "Created At", "Updated At", "Firebase Doc ID"
      ].join(",") + "\n";

      const csvRows = allAttendees.map(attendee => {
        const verificationLink = `${baseUrl}?qrId=${attendee.qrId}`;
        return [
          `"${attendee.fullName || 'N/A'}"`,
          `"${attendee.qrId}"`,
          `"${verificationLink}"`,
          `"${attendee.status || 'N/A'}"`,
          `"${attendee.category || 'N/A'}"`,
          `"${attendee.email || 'N/A'}"`,
          `"${attendee.phone || 'N/A'}"`,
          `"${attendee.checkIn ? 'Yes' : 'No'}"`,
          `"${attendee.checkInTime}"`,
          `"${attendee.couponStatus || 'none'}"`,
          `"${attendee.createdAt}"`,
          `"${attendee.updatedAt}"`,
          `"${attendee.id}"`
        ].join(",");
      }).join("\n");

      const csvContent = csvHeaders + csvRows;

      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `firebase_attendees_complete_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Also create a detailed text report
      let textReport = `🎵 SHIFOYAGE EVENT - COMPLETE ATTENDEE DATABASE 🎵\n`;
      textReport += `========================================================\n`;
      textReport += `Generated: ${new Date().toLocaleString()}\n`;
      textReport += `Total Attendees: ${allAttendees.length}\n`;
      textReport += `Database: Firebase Firestore\n`;
      textReport += `========================================================\n\n`;
      
      // Summary statistics
      const stats = {
        total: allAttendees.length,
        checkedIn: allAttendees.filter(a => a.checkIn).length,
        paid: allAttendees.filter(a => a.status === 'paid').length,
        pending: allAttendees.filter(a => a.status === 'pending').length,
        internal: allAttendees.filter(a => a.status === 'internal').length,
        withCoupons: allAttendees.filter(a => a.couponStatus === 'issued').length
      };

      textReport += `📊 STATISTICS:\n`;
      textReport += `• Total Attendees: ${stats.total}\n`;
      textReport += `• Checked In: ${stats.checkedIn} (${((stats.checkedIn/stats.total)*100).toFixed(1)}%)\n`;
      textReport += `• Paid: ${stats.paid}\n`;
      textReport += `• Pending: ${stats.pending}\n`;
      textReport += `• Internal: ${stats.internal}\n`;
      textReport += `• Coupons Issued: ${stats.withCoupons}\n\n`;

      textReport += `🎟️ ATTENDEE LIST WITH VERIFICATION LINKS:\n`;
      textReport += `========================================================\n\n`;
      
      allAttendees.forEach((attendee, index) => {
        const verificationLink = `${baseUrl}?qrId=${attendee.qrId}`;
        textReport += `${index + 1}. ${attendee.fullName}\n`;
        textReport += `   📱 QR ID: ${attendee.qrId}\n`;
        textReport += `   🔗 Link: ${verificationLink}\n`;
        textReport += `   📊 Status: ${attendee.status} | Category: ${attendee.category}\n`;
        textReport += `   ✅ Check-in: ${attendee.checkIn ? 'Yes' : 'No'}${attendee.checkIn ? ` (${attendee.checkInTime})` : ''}\n`;
        textReport += `   🎟️ Coupon: ${attendee.couponStatus || 'none'}\n`;
        if (attendee.email) textReport += `   📧 Email: ${attendee.email}\n`;
        if (attendee.phone) textReport += `   📞 Phone: ${attendee.phone}\n`;
        textReport += `   🆔 Firebase ID: ${attendee.id}\n`;
        textReport += `\n`;
      });

      // Copy comprehensive report to clipboard
      try {
        await navigator.clipboard.writeText(textReport);
        alert(`✅ Complete database downloaded!\n\n📊 CSV File: ${allAttendees.length} attendees with verification links\n📋 Detailed report copied to clipboard\n\nStats: ${stats.checkedIn}/${stats.total} checked in`);
      } catch (err) {
        console.log("Clipboard failed, showing modal");
        // Fallback: show in modal
        showTextModal(textReport, "Complete Attendee Database Report");
        alert(`✅ CSV Downloaded! ${allAttendees.length} attendees with verification links`);
      }

    } catch (error) {
      console.error("Firebase query error:", error);
      alert("❌ Error querying Firebase: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to show text in a modal
  const showTextModal = (text, title) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'width:100%;height:400px;font-family:monospace;font-size:12px;padding:16px;border:1px solid #ccc;border-radius:8px';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px';
    
    const content = document.createElement('div');
    content.style.cssText = 'background:white;padding:24px;border-radius:12px;max-width:90%;max-height:90%;overflow:auto;box-shadow:0 20px 40px rgba(0,0,0,0.3)';
    
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.cssText = 'margin:0 0 16px 0;font-size:18px;font-weight:600';
    
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.style.cssText = 'margin:10px 10px 0 0;padding:8px 16px;background:#4F46E5;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:500';
    copyBtn.onclick = () => {
      textarea.select();
      document.execCommand('copy');
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy to Clipboard', 2000);
    };
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'margin-top:10px;padding:8px 16px;background:#6B7280;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:500';
    closeBtn.onclick = () => document.body.removeChild(modal);
    
    content.appendChild(titleEl);
    content.appendChild(textarea);
    content.appendChild(copyBtn);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
    textarea.select();
  };

  return (
    <div className="p-4">
      <h2 className="font-semibold text-xl mb-4">Admin Panel</h2>

      {/* Controls */}
      <div className="space-y-4 mb-6">
        {/* Search Bar */}
        <div className="flex gap-2">
          <input
            className="border p-2 flex-1 rounded"
            placeholder="Search by name"
            value={term}
            onChange={e => setTerm(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && search()}
          />
          <button
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
            onClick={search}
            disabled={loading}
          >
            {loading ? "..." : "Search"}
          </button>
        </div>

        {/* Load All & Filter Controls */}
        <div className="flex gap-2 items-center flex-wrap">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={loadAllAttendees}
            disabled={loading}
          >
            {loading ? "Loading..." : "Show All Attendees"}
          </button>

          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={() => setShowAddForm(true)}
          >
            + Add Attendee
          </button>

          <select
            className="border p-2 rounded"
            value={filter}
            onChange={e => {
              setFilter(e.target.value);
              if (showAll) loadAllAttendees();
            }}
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="internal">Internal</option>
          </select>

          <button
            className={`px-3 py-2 rounded text-sm ${
              viewMode === 'cards' ? 'bg-gray-800 text-white' : 'border hover:bg-gray-50'
            }`}
            onClick={() => setViewMode('cards')}
          >
            Cards
          </button>
          <button
            className={`px-3 py-2 rounded text-sm ${
              viewMode === 'table' ? 'bg-gray-800 text-white' : 'border hover:bg-gray-50'
            }`}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
        </div>

        {/* Bulk Operations */}
        {list.length > 0 && (
          <div className="flex gap-2 items-center p-3 bg-gray-50 rounded flex-wrap">
            <span className="text-sm text-gray-600">
              {selectedAttendees.size} of {list.length} selected
            </span>
            <button
              className="px-3 py-1 text-sm border rounded hover:bg-white"
              onClick={selectAll}
            >
              Select All
            </button>
            <button
              className="px-3 py-1 text-sm border rounded hover:bg-white"
              onClick={clearSelection}
            >
              Clear
            </button>
            {selectedAttendees.size > 0 && (
              <button
                className="px-4 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                onClick={bulkCheckIn}
              >
                Bulk Check-in ({selectedAttendees.size})
              </button>
            )}
            
            {/* Download Options */}
            <div className="flex gap-2 ml-auto flex-wrap">
              <button
                onClick={downloadAllFirebaseData}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center gap-1 font-medium"
                title="Query Firebase directly and download complete database"
                disabled={loading}
              >
                🔥 {loading ? 'Querying...' : 'Firebase Export'}
              </button>
              <button
                onClick={downloadAttendeeLinks}
                className="px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 flex items-center gap-1"
                title="Download CSV with verification links"
              >
                📊 Download CSV
              </button>
              <button
                onClick={generateTextList}
                className="px-3 py-1 bg-cyan-600 text-white text-sm rounded hover:bg-cyan-700 flex items-center gap-1"
                title="Copy formatted text list to clipboard"
              >
                📋 Copy List
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Attendee List */}
      <div className={viewMode === 'cards' ? 'grid gap-4 md:grid-cols-2' : 'space-y-2'}>
        {list.map(a => (
          viewMode === 'cards' ? (
            <AttendeeCard key={a.id} attendee={a} refresh={refreshList} showCheckbox={true} isSelected={selectedAttendees.has(a.id)} onSelect={() => toggleSelectAttendee(a.id)} onQuickCheckIn={(e) => quickCheckIn(a, e)} />
          ) : (
            <div
              key={a.id}
              className="p-3 border rounded flex items-center gap-4 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedAttendees.has(a.id)}
                onChange={() => toggleSelectAttendee(a.id)}
                className="w-4 h-4"
              />
              <div
                className="flex-1 cursor-pointer"
                onClick={() => setPicked(a)}
              >
                <div className="font-medium">{a.fullName}</div>
                <div className="text-xs text-gray-600">
                  {a.status} • {a.category} • Check-in {a.checkIn ? "✅" : "❌"} • Coupon: {a.couponStatus}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <QRCode value={a.qrId || ""} size={48} />
                {!a.checkIn && (
                  <button
                    className="px-3 py-1 bg-green-700 text-white rounded text-sm hover:bg-green-800"
                    onClick={(e) => quickCheckIn(a, e)}
                  >
                    Check In
                  </button>
                )}
              </div>
            </div>
          )
        ))}
      </div>

      {list.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          {showAll ? "No attendees found with current filter" : "Search for attendees or click 'Show All Attendees'"}
        </div>
      )}

      {picked && (
        <div className="border-t pt-4 mt-6">
          <h3 className="font-medium mb-2">Selected Attendee Details:</h3>
          <AttendeeCard attendee={picked} refresh={refreshPicked} />
        </div>
      )}

      {/* Add Attendee Form Modal */}
      {showAddForm && (
        <AddAttendeeForm
          onClose={() => setShowAddForm(false)}
          onSuccess={refreshList}
        />
      )}
    </div>
  );
}

// Main App Component
function App() {
  const user = useAuth();
  const [view, setView] = useState("scanner");
  const [currentAttendee, setCurrentAttendee] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const signIn = async () => {
    setLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert("Login failed: " + error.message);
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto bg-white min-h-screen">
        <header className="p-4 flex items-center justify-between border-b bg-white sticky top-0 z-10">
          <div className="font-semibold text-lg">Event Check-in + ₹199 Coupon</div>
          <nav className="flex gap-2">
            <button
              className={`px-3 py-1 rounded text-sm ${
                view === 'scanner' ? 'bg-black text-white' : 'border hover:bg-gray-50'
              }`}
              onClick={() => setView("scanner")}
            >
              Scan
            </button>
            <button
              className={`px-3 py-1 rounded text-sm ${
                view === 'admin' ? 'bg-black text-white' : 'border hover:bg-gray-50'
              }`}
              onClick={() => setView("admin")}
            >
              Admin
            </button>
          </nav>
        </header>

        {!user && (
          <div className="p-4 border-b bg-yellow-50">
            <div className="text-sm text-yellow-800 mb-2">Admin Login Required</div>
            <div className="flex gap-2">
              <input
                className="border p-2 rounded flex-1"
                placeholder="Admin email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <input
                className="border p-2 rounded flex-1"
                placeholder="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && signIn()}
              />
              <button
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
                onClick={signIn}
                disabled={loggingIn}
              >
                {loggingIn ? "..." : "Login"}
              </button>
            </div>
          </div>
        )}

        <main className="pb-4">
          {view === "scanner" && (
            <>
              <Scanner onOpenAttendee={setCurrentAttendee} />
              {currentAttendee && (
                <div className="px-4">
                  <AttendeeCard
                    attendee={currentAttendee}
                    refresh={async () => {
                      const d = await getDoc(doc(db, "attendees", currentAttendee.id));
                      setCurrentAttendee({ id: d.id, ...d.data() });
                    }}
                  />
                </div>
              )}
            </>
          )}

          {view === "admin" && user && <AdminPanel />}
          {view === "admin" && !user && (
            <div className="p-4 text-center text-gray-600">
              Please login to access admin panel
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;