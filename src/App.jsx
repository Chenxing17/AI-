import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, 
  addDoc, updateDoc, deleteDoc, onSnapshot
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Home, Settings, Search, Plus, Trash2, 
  LogOut, CheckCircle, Menu, X
} from 'lucide-react';

// --- Firebase 配置 (相容 Vercel 環境與 Canvas 環境) ---
const getFirebaseConfig = () => {
  try {
    // 1. 優先嘗試讀取 Vite 環境變數 (Vercel 部署建議設定)
    if (import.meta.env?.VITE_FIREBASE_CONFIG) {
      return JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
    }
    // 2. 嘗試讀取系統全局變數
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.error("Firebase Config Parse Error", e);
  }
  
  // 3. 預設備用配置
  return {
    apiKey: "AIzaSyA3oh6tq2TttSHaPy1_HgjaFSv5kMRl_rc",
    authDomain: "ai-0416.firebaseapp.com",
    projectId: "ai-0416",
    storageBucket: "ai-0416.firebasestorage.app",
    messagingSenderId: "224222328655",
    appId: "1:224222328655:web:077968d5a54dc00f4cb73a",
    measurementId: "G-L1MKZ8LFN6"
  };
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'homestay-booking-sys';

// --- 輔助函式 ---
const isWeekend = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDay();
  return day === 5 || day === 6; // 週五、週六算假日
};

const calculateTotal = (startDate, endDate, room) => {
  if (!startDate || !endDate || !room) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  let total = 0;
  let current = new Date(start);

  while (current < end) {
    const dateStr = current.toISOString().split('T')[0];
    total += isWeekend(dateStr) ? (room.holidayPrice || room.price * 1.2) : room.price;
    current.setDate(current.getDate() + 1);
  }
  return total;
};

// --- 主要組件 ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); 
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [adminSettings, setAdminSettings] = useState({ password: '1234' });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');

  // 初始化 Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Firebase Auth Error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currUser) => {
      if (currUser) {
        setUser(currUser);
      }
    });
    return () => unsubscribe();
  }, []);

  // 監聽資料
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
    const unsubscribeRooms = onSnapshot(roomsRef, (snapshot) => {
      const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomList);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Fetch Rooms Error:", error);
      setLoading(false);
    });

    const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubscribeBookings = onSnapshot(bookingsRef, (snapshot) => {
      const bookingList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(bookingList);
    });

    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setAdminSettings(docSnap.data());
      } else {
        setDoc(settingsRef, { password: '1234' });
      }
    });

    return () => {
      unsubscribeRooms();
      unsubscribeBookings();
      unsubscribeSettings();
    };
  }, [user]);

  const handleAdminLogin = (pwd) => {
    if (pwd === adminSettings.password) {
      setIsAdmin(true);
      localStorage.setItem('isAdmin', 'true');
      setView('admin-dashboard');
    } else {
      alert("密碼錯誤！");
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('isAdmin');
    setView('home');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h1 className="text-xl font-bold text-gray-700">系統載入中...</h1>
        {!user && <p className="text-sm text-gray-400 mt-2">正在建立安全連線...</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <Home size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-800">智宿雲</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => setView('search')} className="text-gray-600 hover:text-blue-600 font-medium transition">搜尋房型</button>
            <button onClick={() => setView('my-bookings')} className="text-gray-600 hover:text-blue-600 font-medium transition">我的訂單</button>
            {isAdmin ? (
              <button onClick={() => setView('admin-dashboard')} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-md transition">管理後台</button>
            ) : (
              <button onClick={() => setView('admin-login')} className="text-gray-400 hover:text-gray-600 transition">管理者登入</button>
            )}
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-600">
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t p-4 flex flex-col gap-4 animate-in slide-in-from-top duration-200">
            <button onClick={() => { setView('search'); setIsMenuOpen(false); }} className="text-left font-medium">搜尋房型</button>
            <button onClick={() => { setView('my-bookings'); setIsMenuOpen(false); }} className="text-left font-medium">我的訂單</button>
            {isAdmin ? (
              <button onClick={() => { setView('admin-dashboard'); setIsMenuOpen(false); }} className="text-blue-600 font-bold text-left">管理後台</button>
            ) : (
              <button onClick={() => { setView('admin-login'); setIsMenuOpen(false); }} className="text-left text-gray-500">管理者登入</button>
            )}
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'home' && <HomeView onStart={() => setView('search')} />}
        {view === 'search' && <SearchView rooms={rooms} bookings={bookings} userId={user?.uid} />}
        {view === 'my-bookings' && <MyBookingsView bookings={bookings} rooms={rooms} userId={user?.uid} />}
        {view === 'admin-login' && <AdminLogin onLogin={handleAdminLogin} />}
        {view === 'admin-dashboard' && <AdminDashboard rooms={rooms} bookings={bookings} settings={adminSettings} onLogout={handleAdminLogout} />}
      </main>

      <footer className="mt-12 py-8 bg-gray-100 border-t text-center text-gray-500 text-sm">
        &copy; 2024 智宿雲系統. All Rights Reserved.
      </footer>
    </div>
  );
}

function HomeView({ onStart }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-full max-w-4xl h-64 md:h-96 bg-gray-200 rounded-3xl mb-12 overflow-hidden relative shadow-2xl">
        <img 
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1200" 
          alt="Homestay" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center p-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg">智宿雲：智能住宿新體驗</h1>
        </div>
      </div>
      <h2 className="text-2xl md:text-4xl font-extrabold mb-6 text-gray-800">歡迎來到智宿雲</h2>
      <p className="text-gray-600 text-lg max-w-2xl mb-10 leading-relaxed">
        我們致力於結合智能技術與溫馨服務，為每一位旅客提供最流暢的預訂體驗與最高品質的住宿空間。
      </p>
      <button 
        onClick={onStart}
        className="bg-blue-600 text-white text-lg px-10 py-4 rounded-full font-bold shadow-xl hover:bg-blue-700 transform hover:scale-105 transition-all"
      >
        開始規劃您的旅程
      </button>
    </div>
  );
}

function SearchView({ rooms, bookings, userId }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [guests, setGuests] = useState(1);
  const [bookingRoom, setBookingRoom] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const filteredRooms = useMemo(() => {
    if (!startDate || !endDate) return rooms.filter(r => r.status === 'available');
    
    return rooms.filter(room => {
      if (room.status !== 'available') return false;
      if (room.capacity < guests) return false;
      const hasConflict = bookings.some(b => {
        if (b.roomId !== room.id || b.status === 'cancelled') return false;
        const bStart = new Date(b.startDate);
        const bEnd = new Date(b.endDate);
        const qStart = new Date(startDate);
        const qEnd = new Date(endDate);
        return qStart < bEnd && qEnd > bStart;
      });
      return !hasConflict;
    });
  }, [rooms, bookings, startDate, endDate, guests]);

  const handleBooking = async () => {
    if (!guestName || !guestPhone) return alert("請填寫聯絡資訊");
    const total = calculateTotal(startDate, endDate, bookingRoom);
    try {
      const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
      await addDoc(bookingsRef, {
        roomId: bookingRoom.id,
        roomName: bookingRoom.name,
        userId: userId || 'anonymous',
        guestName,
        guestPhone,
        startDate,
        endDate,
        guests,
        totalAmount: total,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      alert("訂房申請已送出！請於『我的訂單』中查看審核進度。");
      setBookingRoom(null);
    } catch (err) {
      alert("預訂失敗，請檢查網路連線後再試。");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">搜尋可用房型</h2>
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 mb-10 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-500 mb-1">入住日期</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white transition" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-500 mb-1">退房日期</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || new Date().toISOString().split('T')[0]} className="w-full border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white transition" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-500 mb-1">入住人數</label>
          <select value={guests} onChange={e => setGuests(Number(e.target.value))} className="w-full border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white transition">
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} 位</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <div className="w-full bg-blue-50 text-blue-600 font-bold p-3 rounded-xl text-center flex items-center justify-center gap-2">
            <Search size={18} /> 即時媒合房源
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {filteredRooms.map(room => (
          <div key={room.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div className="h-56 bg-gray-200 relative overflow-hidden">
              <img src={room.imageUrl || "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=600"} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={room.name} />
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                最多 {room.capacity} 人
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2 text-gray-800">{room.name}</h3>
              <p className="text-gray-500 text-sm mb-6 line-clamp-2 h-10">{room.description}</p>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-black text-blue-600">${room.price}</span>
                  <span className="text-xs text-gray-400"> / 晚</span>
                </div>
                <button 
                  onClick={() => setBookingRoom(room)}
                  disabled={!startDate || !endDate}
                  className={`px-6 py-2.5 rounded-xl font-bold shadow-sm transition-all ${(!startDate || !endDate) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-95'}`}
                >
                  {(!startDate || !endDate) ? '請選日期' : '立即預訂'}
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredRooms.length === 0 && (
          <div className="col-span-full py-24 text-center text-gray-400">
            <Search size={64} className="mx-auto mb-4 opacity-10" />
            <p className="text-lg">很抱歉，智宿雲目前在該時段已無可用房型。</p>
            <p className="text-sm">建議更換日期或人數再試一次。</p>
          </div>
        )}
      </div>

      {bookingRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-gray-800">確認訂單資訊</h3>
              <button onClick={() => setBookingRoom(null)} className="p-2 hover:bg-gray-100 rounded-full transition"><X /></button>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-gray-500">智宿雲房型</span>
                <span className="font-bold text-gray-800">{bookingRoom.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-gray-500">入住時間</span>
                <span className="font-bold text-gray-800">{startDate} ~ {endDate}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-4">
                <span className="text-gray-500 text-lg">預估總金額</span>
                <span className="text-2xl font-black text-red-500">${calculateTotal(startDate, endDate, bookingRoom)}</span>
              </div>
              <div className="space-y-4 pt-4">
                <div className="relative">
                  <label className="text-xs font-bold text-gray-400 absolute -top-2 left-3 bg-white px-1">住客真實姓名</label>
                  <input placeholder="請輸入姓名" className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition" value={guestName} onChange={e => setGuestName(e.target.value)} />
                </div>
                <div className="relative">
                  <label className="text-xs font-bold text-gray-400 absolute -top-2 left-3 bg-white px-1">聯絡電話</label>
                  <input placeholder="請輸入電話" className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
                </div>
              </div>
              <button onClick={handleBooking} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-lg mt-6 shadow-xl hover:bg-blue-700 active:scale-95 transition-all">送出預訂申請</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyBookingsView({ bookings, rooms, userId }) {
  const myBookings = bookings.filter(b => b.userId === userId || b.userId === 'anonymous').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleCancel = async (bookingId, startDate) => {
    const today = new Date();
    const start = new Date(startDate);
    const diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 3) return alert("入住前 3 天內不允許取消訂房。");
    if (window.confirm("確定要取消這筆智宿雲預訂嗎？")) {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bookingId), { status: 'cancelled' });
        alert("已成功取消預訂。");
      } catch (err) { alert("操作失敗。"); }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-gray-800">個人預訂中心</h2>
      <div className="space-y-4">
        {myBookings.map(b => (
          <div key={b.id} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center hover:shadow-md transition">
            <div className="flex-1 w-full">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xl font-bold text-gray-800">{b.roomName}</h3>
                <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                  b.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                  b.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {b.status === 'pending' ? '審核中' : b.status === 'confirmed' ? '預訂成功' : '已取消'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-500">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-300">日期區間</label>
                  <span className="text-gray-700 font-medium">{b.startDate} ~ {b.endDate}</span>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-300">入住人數</label>
                  <span className="text-gray-700 font-medium">{b.guests} 位</span>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-300">實付金額</label>
                  <span className="text-blue-600 font-black">${b.totalAmount}</span>
                </div>
              </div>
            </div>
            {b.status !== 'cancelled' && (
              <button onClick={() => handleCancel(b.id, b.startDate)} className="w-full md:w-auto px-6 py-2 border-2 border-red-50 text-red-400 rounded-xl hover:bg-red-50 hover:text-red-500 font-bold transition">取消訂房</button>
            )}
          </div>
        ))}
        {myBookings.length === 0 && <div className="py-24 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">目前尚無預訂紀錄，智宿雲正期待您的光臨。</div>}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [pwd, setPwd] = useState('');
  return (
    <div className="flex items-center justify-center py-20">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 w-full max-w-md">
        <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg">
          <Settings size={32} />
        </div>
        <h2 className="text-2xl font-extrabold mb-2 text-center text-gray-800">智宿雲管理系統</h2>
        <p className="text-center text-gray-400 text-sm mb-8">請輸入管理授權碼以繼續</p>
        <input type="password" placeholder="管理密碼" className="w-full border-2 border-gray-50 rounded-2xl p-4 mb-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin(pwd)} />
        <button onClick={() => onLogin(pwd)} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold hover:bg-gray-800 active:scale-95 shadow-lg transition-all">登入管理中心</button>
        <p className="mt-6 text-center text-xs text-gray-400">系統預設密碼為 1234</p>
      </div>
    </div>
  );
}

function AdminDashboard({ rooms, bookings, settings, onLogout }) {
  const [tab, setTab] = useState('calendar');
  const [editingRoom, setEditingRoom] = useState(null);

  const saveRoom = async (roomData) => {
    try {
      if (roomData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomData.id), roomData);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'), { ...roomData, status: 'available' });
      }
      setEditingRoom(null);
    } catch (err) { alert("資料儲存失敗"); }
  };

  const deleteRoom = async (id) => {
    if (window.confirm("刪除此房型將影響現有訂單連結，確定執行？")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', id));
    }
  };

  const updateBookingStatus = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id), { status });
  };

  const changePassword = async (newPwd) => {
    if (newPwd.length < 4) return alert("密碼長度需至少 4 碼");
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin'), { password: newPwd });
    alert("智宿雲管理密碼已更新。");
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-50 overflow-hidden">
      <div className="bg-gray-900 text-white p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black">智宿雲管理控制台</h2>
          <p className="text-gray-400 text-sm mt-1">智慧化管理您的房源與訂單</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTab('calendar')} className={`px-5 py-2.5 rounded-xl font-bold transition ${tab === 'calendar' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>房態看板</button>
          <button onClick={() => setTab('rooms')} className={`px-5 py-2.5 rounded-xl font-bold transition ${tab === 'rooms' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>房型管理</button>
          <button onClick={() => setTab('orders')} className={`px-5 py-2.5 rounded-xl font-bold transition ${tab === 'orders' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>訂單審核</button>
          <button onClick={() => setTab('settings')} className={`px-4 py-2.5 rounded-xl transition ${tab === 'settings' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}><Settings size={20} /></button>
          <button onClick={onLogout} className="p-2.5 text-gray-500 hover:text-white transition"><LogOut size={22} /></button>
        </div>
      </div>

      <div className="p-8">
        {tab === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map(room => {
              const activeBookings = bookings.filter(b => b.roomId === room.id && b.status !== 'cancelled');
              return (
                <div key={room.id} className="border border-gray-100 rounded-3xl p-6 bg-gray-50/50">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-extrabold text-lg text-gray-800">{room.name}</h3>
                    <select value={room.status} onChange={async (e) => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: e.target.value })} className="text-xs border-0 bg-white rounded-lg px-2 py-1 shadow-sm font-bold">
                      <option value="available">營運中</option>
                      <option value="cleaning">清潔中</option>
                      <option value="maintenance">維修中</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-black">近期行程</div>
                    {activeBookings.slice(0, 3).map(b => (
                      <div key={b.id} className="bg-white p-3 rounded-xl border border-gray-50 shadow-sm text-xs flex justify-between items-center">
                        <span className="font-medium">{b.startDate.slice(5)} - {b.endDate.slice(5)}</span>
                        <span className="text-gray-400 font-bold">{b.guestName}</span>
                      </div>
                    ))}
                    {activeBookings.length === 0 && <p className="text-xs text-gray-300 italic py-2">目前尚無預訂紀錄</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'rooms' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl text-gray-800">房型資產管理</h3>
              <button onClick={() => setEditingRoom({ name: '', price: 2000, holidayPrice: 2500, capacity: 2, description: '', imageUrl: '' })} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-500/20"><Plus size={20} /> 新增房源</button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-50">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr className="text-gray-400 text-[11px] uppercase tracking-widest font-black">
                    <th className="p-5">房型名稱</th>
                    <th className="p-5">人數上限</th>
                    <th className="p-5">平假日房價</th>
                    <th className="p-5">即時狀態</th>
                    <th className="p-5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rooms.map(room => (
                    <tr key={room.id} className="hover:bg-blue-50/30 transition">
                      <td className="p-5 font-bold text-gray-800">{room.name}</td>
                      <td className="p-5 text-gray-600">{room.capacity} 人</td>
                      <td className="p-5 font-mono text-gray-600">${room.price} / ${room.holidayPrice}</td>
                      <td className="p-5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${room.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {room.status === 'available' ? 'AVAILABLE' : 'BLOCKED'}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingRoom(room)} className="p-2 hover:bg-white rounded-lg text-blue-500 shadow-sm border border-transparent hover:border-blue-100"><Settings size={18} /></button>
                          <button onClick={() => deleteRoom(room.id)} className="p-2 hover:bg-white rounded-lg text-red-400 shadow-sm border border-transparent hover:border-red-100"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-6">
            <h3 className="font-bold text-xl text-gray-800">全站預訂審核</h3>
            <div className="grid gap-4">
              {bookings.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(b => (
                <div key={b.id} className="bg-white border border-gray-100 rounded-3xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-blue-200 transition">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-black text-gray-800">{b.guestName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${b.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>{b.status.toUpperCase()}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      房型：<span className="text-gray-800 font-medium">{b.roomName}</span> | 日期：{b.startDate} ~ {b.endDate} | 金額：<span className="text-blue-600 font-bold">${b.totalAmount}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    {b.status === 'pending' && <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="flex-1 md:flex-none bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-green-700 flex items-center justify-center gap-2"><CheckCircle size={16}/> 通過審核</button>}
                    {b.status !== 'cancelled' && <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="flex-1 md:flex-none border border-red-100 text-red-400 px-5 py-2 rounded-xl text-sm font-bold hover:bg-red-50">拒絕/取消</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="max-w-md mx-auto py-12">
            <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 shadow-sm">
              <h3 className="font-black text-xl mb-2 text-gray-800">系統安全性</h3>
              <p className="text-gray-400 text-sm mb-8">定期更改密碼以保護智宿雲的資料安全</p>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 px-2">智宿雲管理新密碼</label>
                  <div className="flex gap-3">
                    <input id="new-pwd" type="password" placeholder="請輸入新密碼" className="flex-1 border-gray-200 rounded-2xl p-4 bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition shadow-inner" />
                    <button onClick={() => changePassword(document.getElementById('new-pwd').value)} className="bg-gray-900 text-white px-8 rounded-2xl font-black shadow-lg hover:bg-black transition-all">更新</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {editingRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black mb-8 text-gray-800">{editingRoom.id ? '編輯房源資訊' : '新增智宿雲房源'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <input value={editingRoom.name} onChange={e => setEditingRoom({...editingRoom, name: e.target.value})} className="w-full border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition" placeholder="房型名稱" />
              </div>
              <input type="number" value={editingRoom.price} onChange={e => setEditingRoom({...editingRoom, price: Number(e.target.value)})} className="w-full border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white transition" placeholder="平日價格" />
              <input type="number" value={editingRoom.holidayPrice} onChange={e => setEditingRoom({...editingRoom, holidayPrice: Number(e.target.value)})} className="w-full border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white transition" placeholder="假日價格" />
              <input type="number" value={editingRoom.capacity} onChange={e => setEditingRoom({...editingRoom, capacity: Number(e.target.value)})} className="w-full border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white transition" placeholder="容納人數" />
              <input value={editingRoom.imageUrl} onChange={e => setEditingRoom({...editingRoom, imageUrl: e.target.value})} className="w-full border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white transition" placeholder="照片 URL" />
              <textarea value={editingRoom.description} onChange={e => setEditingRoom({...editingRoom, description: e.target.value})} className="w-full border-gray-100 rounded-2xl p-4 bg-gray-50 h-32 md:col-span-2 focus:bg-white transition" placeholder="內容介紹..." />
            </div>
            <div className="mt-10 flex gap-4">
              <button onClick={() => setEditingRoom(null)} className="flex-1 py-4 border-2 border-gray-50 rounded-2xl font-bold text-gray-400 hover:bg-gray-50 transition">取消</button>
              <button onClick={() => saveRoom(editingRoom)} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all">確認儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
