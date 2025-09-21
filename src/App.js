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
          <div className="flex gap-2 items-center p-3 bg-gray-50 rounded">
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
          </div>
        )}
      </div>

      {/* Attendee List */}
      <div className={viewMode === 'cards' ? 'grid gap-4 md:grid-cols-2' : 'space-y-2'}>
        {list.map(a => (
          viewMode === 'cards' ? (
            <AttendeeCard key={a.id} attendee={a} showCheckbox={true} isSelected={selectedAttendees.has(a.id)} onSelect={() => toggleSelectAttendee(a.id)} onQuickCheckIn={(e) => quickCheckIn(a, e)} />
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