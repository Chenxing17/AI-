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
  LogOut, CheckCircle, Menu, X, AlertTriangle, Calendar as CalendarIcon, Users, MapPin, Clock
} from 'lucide-react';

// --- Firebase 配置優化 ---
const getFirebaseConfig = () => {
  try {
    const envConfig = import.meta.env?.VITE_FIREBASE_CONFIG;
    if (envConfig) return JSON.parse(envConfig);

    const globalConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
    if (globalConfig) return JSON.parse(globalConfig);
  } catch (e) {
    console.error("Config Parse Error", e);
  }
  
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

  // 強制載入 Tailwind CSS 引擎 (解決外觀跑掉的問題)
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
  }, []);

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
        setError(`身份驗證失敗: ${err.message}`);
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
        setError("連線逾時：無法從資料庫讀取資料。請檢查 Firebase 安全規則。");
      }
    }, 15000);

    const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
    const unsubscribeRooms = onSnapshot(roomsRef, (snapshot) => {
      const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomList);
      setLoading(false);
      clearTimeout(timeout);
    }, (err) => {
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
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Home className="text-blue-600 animate-pulse" size={32} />
          </div>
        </div>
        <h1 className="text-3xl font-black text-slate-800 mb-2">智宿雲</h1>
        <p className="text-slate-400 font-medium">正在啟動您的雲端住宿體驗...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-100 p-6 rounded-3xl text-red-600 mb-8 shadow-inner">
          <AlertTriangle size={64} />
        </div>
        <h1 className="text-3xl font-black text-slate-800 mb-4">系統異常</h1>
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-red-50 max-w-md w-full text-left">
          <p className="text-red-500 font-mono text-sm break-all mb-6 leading-relaxed">{error}</p>
          <div className="text-slate-500 text-sm space-y-3 bg-slate-50 p-4 rounded-2xl">
            <p className="font-bold text-slate-700">解決步驟：</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>確保已開啟 Firebase 匿名登入</li>
              <li>確保 Firestore Rules 設為公開</li>
              <li>檢查 Vercel 環境變數配置</li>
            </ul>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="mt-10 bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold transition-all">重新整理</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
            <div className="bg-blue-600 p-2 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <Home size={24} />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-800">智宿雲</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => setView('search')} className={`font-semibold transition-colors ${view === 'search' ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>搜尋房型</button>
            <button onClick={() => setView('my-bookings')} className={`font-semibold transition-colors ${view === 'my-bookings' ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>我的訂單</button>
            {isAdmin ? (
              <button onClick={() => setView('admin-dashboard')} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl hover:bg-slate-800 font-bold shadow-xl transition-all">管理中心</button>
            ) : (
              <button onClick={() => setView('admin-login')} className="text-slate-300 hover:text-slate-600 font-medium transition-colors">管理登入</button>
            )}
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600 bg-slate-50 rounded-xl">
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t p-6 flex flex-col gap-5 animate-in slide-in-from-top duration-300">
            <button onClick={() => { setView('search'); setIsMenuOpen(false); }} className="text-lg font-bold text-slate-700">搜尋房型</button>
            <button onClick={() => { setView('my-bookings'); setIsMenuOpen(false); }} className="text-lg font-bold text-slate-700">我的訂單</button>
            <div className="h-px bg-slate-100 my-2"></div>
            {isAdmin ? (
              <button onClick={() => { setView('admin-dashboard'); setIsMenuOpen(false); }} className="text-blue-600 font-black text-left">管理後台中心</button>
            ) : (
              <button onClick={() => { setView('admin-login'); setIsMenuOpen(false); }} className="text-left text-slate-400 font-medium">管理者登入</button>
            )}
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        {view === 'home' && <HomeView onStart={() => setView('search')} />}
        {view === 'search' && <SearchView rooms={rooms} bookings={bookings} userId={user?.uid} />}
        {view === 'my-bookings' && <MyBookingsView bookings={bookings} userId={user?.uid} />}
        {view === 'admin-login' && <AdminLogin onLogin={handleAdminLogin} />}
        {view === 'admin-dashboard' && <AdminDashboard rooms={rooms} bookings={bookings} onLogout={handleAdminLogout} />}
      </main>

      <footer className="mt-20 py-12 bg-white border-t border-slate-100 text-center">
        <div className="flex justify-center gap-2 mb-4">
          <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-white"><Home size={16}/></div>
          <span className="font-black text-slate-800 uppercase tracking-widest">Cloud Homestay</span>
        </div>
        <p className="text-slate-400 text-sm">&copy; 2024 智宿雲系統開發團隊. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

// --- 子組件 ---

function HomeView({ onStart }) {
  return (
    <div className="flex flex-col items-center py-12">
      <div className="w-full max-w-5xl h-[30rem] md:h-[35rem] bg-slate-200 rounded-[3rem] mb-16 overflow-hidden relative shadow-2xl group">
        <img src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&q=80&w=1200" alt="Homestay" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent flex flex-col items-center justify-end p-12 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter">智宿雲，<br/>懂您的專屬假期。</h1>
          <p className="text-slate-200 text-lg md:text-xl font-medium max-w-xl mb-10 opacity-90">結合雲端科技與人性化設計，為您媒合全台最頂尖的民宿空間。</p>
          <button onClick={onStart} className="bg-white text-slate-900 px-12 py-5 rounded-[2rem] font-black text-xl shadow-2xl hover:bg-blue-600 hover:text-white transition-all">立即探索房源</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl w-full">
        <div className="text-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-6"><Search size={32}/></div>
          <h3 className="text-xl font-black mb-2">精準媒合</h3>
          <p className="text-slate-400 text-sm">即時過濾已訂房源，確保您看到的每一間房都能立即預訂。</p>
        </div>
        <div className="text-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-6"><Settings size={32}/></div>
          <h3 className="text-xl font-black mb-2">智慧管理</h3>
          <p className="text-slate-400 text-sm">系統化處理訂單與房態，讓民宿經營變得前所未有的輕鬆。</p>
        </div>
        <div className="text-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-6"><CheckCircle size={32}/></div>
          <h3 className="text-xl font-black mb-2">安全保障</h3>
          <p className="text-slate-400 text-sm">透過 Firebase 加密技術保護您的個人資訊與訂單隱私。</p>
        </div>
      </div>
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
    if (!guestName || !guestPhone) return alert("請填寫完整資訊");
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
    } catch (err) { alert("申請失敗"); }
  };

  return (
    <div>
      <h2 className="text-3xl font-black mb-8 tracking-tight">搜尋房源</h2>
      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 mb-12 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">入住日期</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full py-4 px-4 bg-slate-50 border-none rounded-2xl font-bold" />
        </div>
        <div>
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">退房日期</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="w-full py-4 px-4 bg-slate-50 border-none rounded-2xl font-bold" />
        </div>
        <div>
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">旅伴人數</label>
          <select value={guests} onChange={e => setGuests(Number(e.target.value))} className="w-full py-4 px-4 bg-slate-50 border-none rounded-2xl font-bold">
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} 位旅客</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <div className="w-full bg-blue-600 text-white font-black p-4 rounded-2xl text-center shadow-lg"><Search size={20} className="inline mr-2" /> 即時搜尋</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {filteredRooms.map(room => (
          <div key={room.id} className="bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all border border-slate-100 overflow-hidden group">
            <div className="h-64 relative overflow-hidden">
              <img src={room.imageUrl || "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={room.name} />
              <div className="absolute top-4 right-4 bg-white/90 px-4 py-2 rounded-2xl text-xs font-black">最多 {room.capacity} 人</div>
            </div>
            <div className="p-8">
              <h3 className="text-2xl font-black mb-3">{room.name}</h3>
              <p className="text-slate-400 text-sm mb-8 line-clamp-2 h-10">{room.description || "體驗智宿雲帶給您的極致舒適體驗。"}</p>
              <div className="flex items-center justify-between border-t pt-6">
                <span className="text-2xl font-black text-blue-600">${room.price}<span className="text-xs text-slate-400 font-normal"> /晚</span></span>
                <button onClick={() => setBookingRoom(room)} disabled={!startDate || !endDate} className={`px-8 py-3 rounded-2xl font-black shadow-lg ${(!startDate || !endDate) ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>立即預訂</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {bookingRoom && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between mb-8">
              <h3 className="text-2xl font-black">預訂資訊確認</h3>
              <button onClick={() => setBookingRoom(null)}><X/></button>
            </div>
            <div className="space-y-4 mb-8">
              <div className="flex justify-between border-b pb-2 text-sm"><span>房型名稱</span><span className="font-bold">{bookingRoom.name}</span></div>
              <div className="flex justify-between border-b pb-2 text-sm"><span>日期範圍</span><span className="font-bold">{startDate} → {endDate}</span></div>
              <div className="flex justify-between items-end pt-4"><span className="text-slate-400 font-bold">預估金額</span><span className="text-4xl font-black text-red-500">${calculateTotal(startDate, endDate, bookingRoom)}</span></div>
              <input placeholder="住客姓名" className="w-full border-none rounded-2xl p-4 bg-slate-100 font-bold mt-6" value={guestName} onChange={e => setGuestName(e.target.value)} />
              <input placeholder="聯絡電話" className="w-full border-none rounded-2xl p-4 bg-slate-100 font-bold" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
            </div>
            <button onClick={handleBooking} className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-xl shadow-xl hover:bg-blue-700 transition-all">送出預訂申請</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MyBookingsView({ bookings, userId }) {
  const myBookings = bookings.filter(b => b.userId === userId || b.userId === 'anonymous').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-black mb-10 tracking-tight">我的預訂紀錄</h2>
      <div className="space-y-6">
        {myBookings.map(b => (
          <div key={b.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1 w-full">
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-2xl font-black">{b.roomName}</h3>
                <span className={`text-[10px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest ${b.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : b.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{b.status === 'pending' ? '審核中' : b.status === 'confirmed' ? '預訂成功' : '已取消'}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                <div>日期：{b.startDate}</div>
                <div>至：{b.endDate}</div>
                <div>人數：{b.guests}</div>
                <div className="font-black text-blue-600">總計：${b.totalAmount}</div>
              </div>
            </div>
          </div>
        ))}
        {myBookings.length === 0 && <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed text-slate-300 font-bold uppercase">尚無預訂資料</div>}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [pwd, setPwd] = useState('');
  return (
    <div className="flex items-center justify-center py-20 animate-in zoom-in duration-500">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center border border-slate-50">
        <div className="bg-blue-600 w-20 h-20 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-blue-200">
          <Settings size={40} />
        </div>
        <h2 className="text-3xl font-black mb-10">管理者驗證</h2>
        <input type="password" placeholder="密碼" className="w-full border-none rounded-2xl p-5 bg-slate-100 font-bold text-center text-xl mb-6" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin(pwd)} />
        <button onClick={() => onLogin(pwd)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-xl">進入管理後台</button>
      </div>
    </div>
  );
}

function AdminDashboard({ rooms, bookings, onLogout }) {
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
    <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
      <div className="bg-slate-900 text-white p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <h2 className="text-2xl font-black tracking-tight uppercase tracking-widest">Management Console</h2>
        <div className="flex gap-3">
          <button onClick={() => setTab('calendar')} className={`px-6 py-3 rounded-2xl font-black transition-all ${tab === 'calendar' ? 'bg-blue-600' : 'bg-slate-800'}`}>房態</button>
          <button onClick={() => setTab('rooms')} className={`px-6 py-3 rounded-2xl font-black transition-all ${tab === 'rooms' ? 'bg-blue-600' : 'bg-slate-800'}`}>房源</button>
          <button onClick={() => setTab('orders')} className={`px-6 py-3 rounded-2xl font-black transition-all ${tab === 'orders' ? 'bg-blue-600' : 'bg-slate-800'}`}>審核</button>
          <button onClick={onLogout} className="p-3 text-slate-500 hover:text-white transition-colors"><LogOut size={24} /></button>
        </div>
      </div>

      <div className="p-8 md:p-10">
        {tab === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {rooms.map(room => (
              <div key={room.id} className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                <div className="flex justify-between items-center mb-6 font-black">
                  <h3>{room.name}</h3>
                  <div className={`w-3 h-3 rounded-full ${room.status === 'available' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                </div>
                <select value={room.status} onChange={async (e) => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: e.target.value })} className="w-full border-none bg-white rounded-xl px-4 py-3 text-sm font-bold shadow-sm">
                  <option value="available">營運中</option>
                  <option value="cleaning">清潔中</option>
                  <option value="maintenance">維修中</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {tab === 'rooms' && (
          <div>
            <button onClick={() => setEditingRoom({ name: '', price: 2000, holidayPrice: 2500, capacity: 2, description: '', imageUrl: '' })} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black mb-8">新增房源</button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rooms.map(room => (
                <div key={room.id} className="bg-white border p-6 rounded-3xl flex justify-between items-center">
                  <span className="font-bold">{room.name}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingRoom(room)} className="p-3 bg-slate-100 rounded-xl"><Settings size={18} /></button>
                    <button onClick={async () => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id))} className="p-3 bg-red-50 text-red-500 rounded-xl"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-4">
            {bookings.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(b => (
              <div key={b.id} className="bg-slate-50 border p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="w-full">
                  <div className="font-black text-lg">{b.guestName} <span className="text-sm font-normal text-slate-400">({b.roomName})</span></div>
                  <div className="text-sm text-slate-500">{b.startDate} → {b.endDate} | ${b.totalAmount}</div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  {b.status === 'pending' && <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">核准</button>}
                  {b.status !== 'cancelled' && <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="flex-1 border border-red-100 text-red-400 px-6 py-2 rounded-xl font-bold">取消</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingRoom && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-xl p-10 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black mb-8">房型維護</h3>
            <div className="space-y-4">
              <input value={editingRoom.name} onChange={e => setEditingRoom({...editingRoom, name: e.target.value})} className="w-full border-none rounded-2xl p-4 bg-slate-100 font-bold" placeholder="房型名稱" />
              <div className="flex gap-4">
                <input type="number" value={editingRoom.price} onChange={e => setEditingRoom({...editingRoom, price: Number(e.target.value)})} className="flex-1 border-none rounded-2xl p-4 bg-slate-100 font-bold" placeholder="平日價" />
                <input type="number" value={editingRoom.holidayPrice} onChange={e => setEditingRoom({...editingRoom, holidayPrice: Number(e.target.value)})} className="flex-1 border-none rounded-2xl p-4 bg-slate-100 font-bold" placeholder="假日價" />
              </div>
              <input value={editingRoom.imageUrl} onChange={e => setEditingRoom({...editingRoom, imageUrl: e.target.value})} className="w-full border-none rounded-2xl p-4 bg-slate-100 font-bold" placeholder="照片 URL" />
              <textarea value={editingRoom.description} onChange={e => setEditingRoom({...editingRoom, description: e.target.value})} className="w-full border-none rounded-2xl p-4 bg-slate-100 font-bold h-24" placeholder="介紹文案..." />
            </div>
            <div className="mt-8 flex gap-4">
              <button onClick={() => setEditingRoom(null)} className="flex-1 py-4 border-2 rounded-2xl font-bold">取消</button>
              <button onClick={() => saveRoom(editingRoom)} className="flex-1 py-4 bg-blue-600 text-white rounded-[2rem] font-bold shadow-xl shadow-blue-200">儲存變更</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 修正動畫樣式
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .animate-spin-slow { animation: spin-slow 8s linear infinite; }
  `;
  document.head.appendChild(style);
}
