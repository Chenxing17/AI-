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
  LogOut, CheckCircle, Menu, X, AlertTriangle
} from 'lucide-react';

// --- Firebase 配置優化 ---
const getFirebaseConfig = () => {
  try {
    // 優先讀取環境變數
    const envConfig = import.meta.env?.VITE_FIREBASE_CONFIG;
    if (envConfig) return JSON.parse(envConfig);

    const globalConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
    if (globalConfig) return JSON.parse(globalConfig);
  } catch (e) {
    console.error("Config Parse Error", e);
  }
  
  // 備用預設值 (請確保您的 Firebase 專案已啟用 Anonymous Auth)
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
  return day === 5 || day === 6;
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
  const [error, setError] = useState(null); 
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
        console.error("Auth Error:", err);
        setError(`身份驗證失敗: ${err.message} (請檢查 Firebase Console 是否啟用了匿名登入)`);
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currUser) => {
      setUser(currUser);
    });
    return () => unsubscribe();
  }, []);

  // 監聽資料
  useEffect(() => {
    if (!user) return;

    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError("連線逾時：無法從資料庫讀取資料。請檢查 Firebase 安全規則或網路連線。");
      }
    }, 10000);

    const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
    const unsubscribeRooms = onSnapshot(roomsRef, (snapshot) => {
      const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomList);
      setLoading(false);
      clearTimeout(timeout);
    }, (err) => {
      console.error("Rooms Fetch Error:", err);
      setError(`資料讀取失敗: ${err.message}`);
      setLoading(false);
      clearTimeout(timeout);
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
      clearTimeout(timeout);
    };
  }, [user, loading]);

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
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h1 className="text-2xl font-black text-gray-800 mb-2">智宿雲載入中...</h1>
        <p className="text-gray-400 animate-pulse">正在嘗試連接至雲端伺服器</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-100 p-4 rounded-full text-red-600 mb-6">
          <AlertTriangle size={48} />
        </div>
        <h1 className="text-2xl font-black text-gray-800 mb-4">系統連線異常</h1>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-left">
          <p className="text-red-500 font-mono text-sm break-all mb-4">{error}</p>
          <div className="text-gray-500 text-xs space-y-2">
            <p><strong>常見解決方案：</strong></p>
            <ul className="list-disc ml-4 space-y-1">
              <li>前往 Firebase Console → Authentication → Sign-in method，啟用<strong>匿名登入</strong>。</li>
              <li>前往 Firestore → Rules，確保已設為<strong>公開測試模式</strong>。</li>
              <li>檢查 Vercel Environment Variables 是否已正確設定 <code>VITE_FIREBASE_CONFIG</code>。</li>
            </ul>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="mt-8 bg-gray-900 text-white px-8 py-3 rounded-xl font-bold">重新嘗試連線</button>
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
          <div className="md:hidden bg-white border-t p-4 flex flex-col gap-4">
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
        <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1200" alt="Homestay" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center p-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg">智宿雲：智能住宿新體驗</h1>
        </div>
      </div>
      <h2 className="text-2xl md:text-4xl font-extrabold mb-6 text-gray-800">歡迎來到智宿雲</h2>
      <p className="text-gray-600 text-lg max-w-2xl mb-10 leading-relaxed">提供最流暢的預訂體驗與最高品質的住宿空間。</p>
      <button onClick={onStart} className="bg-blue-600 text-white text-lg px-10 py-4 rounded-full font-bold shadow-xl hover:bg-blue-700 transition-all">開始規劃您的旅程</button>
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
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
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
      alert("訂房申請已送出！");
      setBookingRoom(null);
    } catch (err) { alert("預訂失敗"); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">搜尋可用房型</h2>
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 mb-10 grid grid-cols-1 md:grid-cols-4 gap-4">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="border rounded-xl p-3 bg-gray-50" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="border rounded-xl p-3 bg-gray-50" />
        <select value={guests} onChange={e => setGuests(Number(e.target.value))} className="border rounded-xl p-3 bg-gray-50">
          {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} 位</option>)}
        </select>
        <div className="bg-blue-50 text-blue-600 font-bold p-3 rounded-xl text-center flex items-center justify-center gap-2"><Search size={18} /> 即時媒合</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {filteredRooms.map(room => (
          <div key={room.id} className="bg-white rounded-3xl shadow-sm border overflow-hidden hover:shadow-xl transition-all group">
            <div className="h-56 bg-gray-200 relative overflow-hidden">
              <img src={room.imageUrl || "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=600"} className="w-full h-full object-cover group-hover:scale-110 transition-duration-500" alt={room.name} />
              <div className="absolute top-3 right-3 bg-white/90 px-3 py-1 rounded-full text-xs font-bold">最多 {room.capacity} 人</div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2 text-gray-800">{room.name}</h3>
              <p className="text-gray-500 text-sm mb-6 line-clamp-2 h-10">{room.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-blue-600">${room.price}<span className="text-xs text-gray-400 font-normal"> /晚</span></span>
                <button onClick={() => setBookingRoom(room)} disabled={!startDate || !endDate} className={`px-6 py-2.5 rounded-xl font-bold ${(!startDate || !endDate) ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white'}`}>立即預訂</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {bookingRoom && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-bold mb-6">確認訂單：{bookingRoom.name}</h3>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between border-b pb-2"><span>日期</span><span className="font-bold">{startDate} ~ {endDate}</span></div>
              <div className="flex justify-between border-b pb-2"><span>金額</span><span className="text-xl font-black text-red-500">${calculateTotal(startDate, endDate, bookingRoom)}</span></div>
              <input placeholder="住客姓名" className="w-full border rounded-xl p-4 bg-gray-50" value={guestName} onChange={e => setGuestName(e.target.value)} />
              <input placeholder="聯絡電話" className="w-full border rounded-xl p-4 bg-gray-50" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setBookingRoom(null)} className="flex-1 py-4 border rounded-2xl font-bold">取消</button>
              <button onClick={handleBooking} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg">送出預訂</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyBookingsView({ bookings, rooms, userId }) {
  const myBookings = bookings.filter(b => b.userId === userId || b.userId === 'anonymous').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-gray-800">個人預訂中心</h2>
      <div className="space-y-4">
        {myBookings.map(b => (
          <div key={b.id} className="bg-white border rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 w-full">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xl font-bold text-gray-800">{b.roomName}</h3>
                <span className={`text-xs px-3 py-1 rounded-full font-bold ${b.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>{b.status === 'pending' ? '審核中' : '預訂成功'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                <div>日期：{b.startDate} ~ {b.endDate}</div>
                <div>金額：<span className="text-blue-600 font-bold">${b.totalAmount}</span></div>
              </div>
            </div>
          </div>
        ))}
        {myBookings.length === 0 && <div className="py-24 text-center text-gray-400 bg-white rounded-3xl border border-dashed">目前尚無預訂紀錄。</div>}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [pwd, setPwd] = useState('');
  return (
    <div className="flex items-center justify-center py-20">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md text-center">
        <Settings size={48} className="mx-auto text-blue-600 mb-6" />
        <h2 className="text-2xl font-extrabold mb-8">管理登入</h2>
        <input type="password" placeholder="管理密碼" className="w-full border-2 border-gray-50 rounded-2xl p-4 mb-4 bg-gray-50 focus:bg-white outline-none" value={pwd} onChange={e => setPwd(e.target.value)} />
        <button onClick={() => onLogin(pwd)} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold">登入</button>
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
    } catch (err) { alert("儲存失敗"); }
  };

  const updateBookingStatus = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id), { status });
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl border overflow-hidden">
      <div className="bg-gray-900 text-white p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <h2 className="text-2xl font-black">智宿雲管理控制台</h2>
        <div className="flex gap-2">
          <button onClick={() => setTab('calendar')} className={`px-5 py-2.5 rounded-xl ${tab === 'calendar' ? 'bg-blue-600' : 'bg-gray-800'}`}>房態</button>
          <button onClick={() => setTab('rooms')} className={`px-5 py-2.5 rounded-xl ${tab === 'rooms' ? 'bg-blue-600' : 'bg-gray-800'}`}>房型</button>
          <button onClick={() => setTab('orders')} className={`px-5 py-2.5 rounded-xl ${tab === 'orders' ? 'bg-blue-600' : 'bg-gray-800'}`}>審核</button>
          <button onClick={onLogout} className="p-2.5 text-gray-500"><LogOut size={22} /></button>
        </div>
      </div>
      <div className="p-8">
        {tab === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rooms.map(room => (
              <div key={room.id} className="border rounded-3xl p-6 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold">{room.name}</h3>
                  <select value={room.status} onChange={async (e) => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: e.target.value })} className="text-xs border-0 bg-white rounded px-2 py-1">
                    <option value="available">營運中</option>
                    <option value="cleaning">清潔中</option>
                    <option value="maintenance">維修中</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'rooms' && (
          <div>
            <button onClick={() => setEditingRoom({ name: '', price: 2000, holidayPrice: 2500, capacity: 2, description: '', imageUrl: '' })} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold mb-6">新增房型</button>
            {rooms.map(room => (
              <div key={room.id} className="flex justify-between items-center border-b py-4">
                <span>{room.name} (${room.price})</span>
                <div className="flex gap-2">
                  <button onClick={() => setEditingRoom(room)} className="p-2 text-blue-500"><Settings size={18} /></button>
                  <button onClick={async () => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id))} className="p-2 text-red-400"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'orders' && (
          <div className="space-y-4">
            {bookings.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(b => (
              <div key={b.id} className="border rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold">{b.guestName} - {b.roomName}</div>
                  <div className="text-sm text-gray-500">{b.startDate} ~ {b.endDate} | ${b.totalAmount}</div>
                </div>
                {b.status === 'pending' && <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold">核准</button>}
              </div>
            ))}
          </div>
        )}
      </div>
      {editingRoom && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-bold mb-6">房型編輯</h3>
            <div className="space-y-4">
              <input value={editingRoom.name} onChange={e => setEditingRoom({...editingRoom, name: e.target.value})} className="w-full border rounded-xl p-3 bg-gray-50" placeholder="房型名稱" />
              <div className="flex gap-4">
                <input type="number" value={editingRoom.price} onChange={e => setEditingRoom({...editingRoom, price: Number(e.target.value)})} className="flex-1 border rounded-xl p-3 bg-gray-50" placeholder="平日價" />
                <input type="number" value={editingRoom.holidayPrice} onChange={e => setEditingRoom({...editingRoom, holidayPrice: Number(e.target.value)})} className="flex-1 border rounded-xl p-3 bg-gray-50" placeholder="假日價" />
              </div>
              <input value={editingRoom.imageUrl} onChange={e => setEditingRoom({...editingRoom, imageUrl: e.target.value})} className="w-full border rounded-xl p-3 bg-gray-50" placeholder="照片 URL" />
            </div>
            <div className="mt-8 flex gap-4">
              <button onClick={() => setEditingRoom(null)} className="flex-1 py-4 border rounded-2xl">取消</button>
              <button onClick={() => saveRoom(editingRoom)} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
