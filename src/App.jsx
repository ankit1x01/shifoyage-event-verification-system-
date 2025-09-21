import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode.react";

// Printable coupon (A5-ish) — only visible during print
const CouponTicket = React.forwardRef(({ attendee, eventName = "Event Coupon", orgName = "Your Brand" }, ref) => {
  if (!attendee) return null;

  const code = attendee.couponCode || "";
  const name = attendee.fullName || "";
  const amount = "₹199";

  return (
    <div id="print-area" ref={ref}>
      {/* Print-only stylesheet — hides everything except #print-area */}
      <style>{`
        @media screen { #print-area { display: none; } }

        @media print {
          @page { size: A5; margin: 10mm; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: fixed; inset: 0; padding: 0; }

          .coupon {
            width: 148mm;   /* A5 width */
            min-height: 90mm;
            margin: 0 auto;
            border: 2px dashed #999;
            border-radius: 12px;
            padding: 14mm 12mm;
            display: grid;
            grid-template-columns: 1fr auto;
            grid-template-rows: auto auto 1fr auto;
            row-gap: 8mm;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
          }
          .brand { grid-column: 1 / -1; display:flex; align-items:center; gap:10px; }
          .logo {
            width: 28px; height: 28px; border-radius: 999px; border:1px solid #000; 
            display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;
          }
          .brand h1 { margin:0; font-size:18px; letter-spacing: .3px; }
          .amount {
            font-size: 40px; font-weight: 800; line-height: 1; 
          }
          .meta { text-align: right; font-size: 11px; color: #333; }
          .code {
            grid-column: 1 / -1;
            font-size: 22px; font-weight: 700; letter-spacing: 2px;
            padding: 6px 10px; border: 1px solid #000; display:inline-block; width: max-content;
          }
          .row { display:flex; align-items:center; justify-content:space-between; gap:12mm; }
          .name { font-size: 16px; font-weight: 600; }
          .qr { border:1px solid #000; padding:6px; border-radius:8px; }
          .terms {
            grid-column: 1 / -1; margin:0; padding-left: 14px; font-size: 11px; line-height: 1.35;
          }
          .cutline {
            grid-column: 1 / -1; text-align:center; letter-spacing: 4px; color:#aaa; font-size:12px;
          }
        }
      `}</style>

      <div className="coupon">
        <div className="brand">
          {/* Replace "BR" with your initials/logo letters, or drop in an <img> */}
          <div className="logo">BR</div>
          <h1>{orgName} — {eventName}</h1>
        </div>

        <div className="amount">{amount}</div>
        <div className="meta">
          <div>Status: {attendee.couponStatus === "issued" ? "Issued" : "Pending"}</div>
          <div>Attendee ID: {attendee.id?.slice(0, 8)}</div>
        </div>

        <div className="code">CODE: {code}</div>

        <div className="row">
          <div className="name">Issued to: {name}</div>
          <div className="qr">
            <QRCode value={code || attendee.qrId || attendee.id} size={96} includeMargin />
          </div>
        </div>

        <ul className="terms">
          <li>Valid for a single redemption of ₹199. Not exchangeable for cash.</li>
          <li>Issued only after reel + Google review verification.</li>
          <li>Coupon is unique and non-transferable. Keep this page as proof.</li>
          <li>Organizer reserves the right to validate identity & revoke misuse.</li>
        </ul>

        <div className="cutline">··········································</div>
      </div>
    </div>
  );
});

// AttendeeCard component with print functionality
const AttendeeCard = ({ attendee, onUpdate }) => {
  // Print functionality refs and state
  const printRef = useRef(null);
  const [showPrint, setShowPrint] = useState(false);
  const [saving, setSaving] = useState(false);

  const printCoupon = () => {
    if (attendee.couponStatus !== "issued" || !attendee.couponCode) {
      alert("Please issue the ₹199 coupon first.");
      return;
    }
    setShowPrint(true);
    // Give React a tick to mount the print area, then trigger print
    setTimeout(() => {
      window.print();
    }, 150);

    const done = () => {
      setShowPrint(false);
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
  };

  const issueCoupon = async () => {
    setSaving(true);
    // Your existing logic for issuing coupon would go here
    // Example implementation:
    try {
      const updatedAttendee = {
        ...attendee,
        couponStatus: "issued",
        couponCode: `COUP${Date.now().toString().slice(-6)}`
      };
      onUpdate?.(updatedAttendee);
    } catch (error) {
      console.error("Error issuing coupon:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border">
      <h3 className="text-lg font-semibold mb-4">{attendee.fullName}</h3>
      
      <div className="space-y-2 mb-4">
        <p><span className="font-medium">Email:</span> {attendee.email}</p>
        <p><span className="font-medium">Phone:</span> {attendee.phone}</p>
        <p><span className="font-medium">ID:</span> {attendee.id?.slice(0, 8)}</p>
        <p><span className="font-medium">Coupon Status:</span> 
          <span className={`ml-2 px-2 py-1 rounded text-sm ${
            attendee.couponStatus === "issued" 
              ? "bg-green-100 text-green-800" 
              : "bg-yellow-100 text-yellow-800"
          }`}>
            {attendee.couponStatus || "pending"}
          </span>
        </p>
        {attendee.couponCode && (
          <p><span className="font-medium">Coupon Code:</span> {attendee.couponCode}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          disabled={saving || attendee.couponStatus === "issued"}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          onClick={issueCoupon}
        >
          {saving ? "Issuing..." : "Issue ₹199 Coupon"}
        </button>
        
        <button
          disabled={saving || attendee.couponStatus !== "issued"}
          className="px-3 py-2 bg-indigo-700 text-white rounded hover:bg-indigo-800 disabled:bg-gray-400"
          onClick={printCoupon}
        >
          Print Coupon
        </button>
      </div>

      {/* Mount the printable component when showPrint is true */}
      {showPrint && (
        <CouponTicket 
          ref={printRef} 
          attendee={attendee} 
          eventName="₹199 Reward" 
          orgName="Your Brand" 
        />
      )}
    </div>
  );
};

// Main App component
const App = () => {
  const [attendees, setAttendees] = useState([
    // Sample data - replace with your actual data source
    {
      id: "12345678",
      fullName: "John Doe",
      email: "john@example.com",
      phone: "+91 9876543210",
      couponStatus: "pending",
      qrId: "QR12345678"
    }
  ]);

  const updateAttendee = (updatedAttendee) => {
    setAttendees(prev => 
      prev.map(attendee => 
        attendee.id === updatedAttendee.id ? updatedAttendee : attendee
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-center mb-8">Event QR System</h1>
      
      <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {attendees.map(attendee => (
          <AttendeeCard 
            key={attendee.id} 
            attendee={attendee} 
            onUpdate={updateAttendee}
          />
        ))}
      </div>
    </div>
  );
};

export default App;