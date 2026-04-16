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
  LogOut, CheckCircle, Menu, X, AlertTriangle, Calendar as CalendarIcon, Users, MapPin, Clock, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react';

// --- Firebase 配置 ---
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

// 關鍵：固定路徑，防止資料因為版本更新而消失
const appId = 'homestay-smart-cloud-v1';

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

  // 強制載入 Tailwind CSS 引擎
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
  }, []);

  // 1. 初始化身份驗證
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
      if (currUser) setUser(currUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. 即時監聽 Firestore 資料
  useEffect(() => {
    if (!user) return;

    // 取得房間清單
    const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
    const unsubscribeRooms = onSnapshot(roomsRef, (snapshot) => {
      const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomList);
      setLoading(false); // 房間載入後關閉全螢幕遮罩
    }, (err) => {
      setError(`房源讀取失敗: ${err.message}`);
      setLoading(false);
    });

    // 取得訂單清單 (不分權限抓取全部，過濾在前端做)
    const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubscribeBookings = onSnapshot(bookingsRef, (snapshot) => {
      const bookingList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(bookingList);
    });

    // 取得管理設定
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
  }, [user]); // 移除 loading 依賴，避免重複訂閱

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

  // 全螢幕載入畫面
  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col items-center justify-center p-6 text-center text-slate-800">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Home className="text-blue-600 animate-pulse" size={32} />
          </div>
        </div>
        <h1 className="text-3xl font-black mb-2">智宿雲</h1>
        <p className="text-slate-400 font-medium tracking-widest uppercase text-xs animate-pulse">正在開啟您的智慧假期...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-blue-100">
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
            <div className="bg-blue-600 p-2 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform shadow-blue-200">
              <Home size={24} />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-800">智宿雲</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-slate-600">
            <button onClick={() => setView('search')} className={`font-semibold transition-colors ${view === 'search' ? 'text-blue-600' : 'hover:text-blue-600'}`}>搜尋房型</button>
            <button onClick={() => setView('my-bookings')} className={`font-semibold transition-colors ${view === 'my-bookings' ? 'text-blue-600' : 'hover:text-blue-600'}`}>我的訂單</button>
            {isAdmin ? (
              <button onClick={() => setView('admin-dashboard')} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl hover:bg-slate-800 font-bold shadow-xl transition-all shadow-slate-200">管理中心</button>
            ) : (
              <button onClick={() => setView('admin-login')} className="text-slate-300 hover:text-slate-600 font-medium transition-colors">管理登入</button>
            )}
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600 bg-slate-50 rounded-xl transition-colors">
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t p-6 flex flex-col gap-5 animate-in slide-in-from-top duration-300">
            <button onClick={() => { setView('search'); setIsMenuOpen(false); }} className="text-lg font-bold text-slate-700">搜尋房型</button>
            <button onClick={() => { setView('my-bookings'); setIsMenuOpen(false); }} className="text-lg font-bold text-slate-700">我的訂單</button>
            <div className="h-px bg-slate-100"></div>
            {isAdmin ? (
              <button onClick={() => { setView('admin-dashboard'); setIsMenuOpen(false); }} className="text-blue-600 font-black text-left text-lg">管理控制台</button>
            ) : (
              <button onClick={() => { setView('admin-login'); setIsMenuOpen(false); }} className="text-left text-slate-400 font-medium">管理者驗證登入</button>
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

      <footer className="mt-20 py-12 bg-white border-t border-slate-100 text-center text-slate-400 text-sm">
        <div className="mb-4 flex justify-center gap-2 items-center opacity-40">
          <div className="w-5 h-5 bg-slate-400 rounded-lg flex items-center justify-center text-white"><Home size={12}/></div>
          <span className="font-bold tracking-widest uppercase text-[10px]">Cloud Homestay System</span>
        </div>
        &copy; 2024 智宿雲系統開發團隊. All Rights Reserved.
      </footer>
    </div>
  );
}

// --- 子組件 ---

function HomeView({ onStart }) {
  return (
    <div className="flex flex-col items-center py-12 animate-in fade-in duration-700">
      <div className="w-full max-w-5xl h-[30rem] md:h-[35rem] bg-slate-200 rounded-[3rem] mb-16 overflow-hidden relative shadow-2xl group border border-slate-100">
        <img src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&q=80&w=1200" alt="Homestay" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s]" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent flex flex-col items-center justify-end p-12 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter drop-shadow-xl">智宿雲，<br/>懂您的專屬假期。</h1>
          <p className="text-slate-200 text-lg md:text-xl font-medium max-w-xl mb-10 opacity-90 drop-shadow-md">結合雲端大數據與人性化預訂介面，為您精準媒合每一刻溫馨時光。</p>
          <button onClick={onStart} className="bg-white text-slate-900 px-12 py-5 rounded-[2rem] font-black text-xl shadow-2xl hover:bg-blue-600 hover:text-white transform hover:scale-105 active:scale-95 transition-all duration-300">立即搜尋可用房源</button>
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
    if (!guestName || !guestPhone) return alert("請填寫住客姓名與聯絡電話");
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
      alert("預訂申請已送出！請至「我的訂單」查看審核狀態。");
      setBookingRoom(null);
    } catch (err) { alert("系統連線不穩定，請稍後再試。"); }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-3xl font-black mb-8 tracking-tight text-slate-800">探索智宿雲房源</h2>
      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 mb-12 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">入住日期</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full py-4 px-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">退房日期</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="w-full py-4 px-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">旅客總數</label>
          <select value={guests} onChange={e => setGuests(Number(e.target.value))} className="w-full py-4 px-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
            {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} 位旅客</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <div className="w-full bg-blue-600 text-white font-black p-4 rounded-2xl text-center shadow-lg shadow-blue-100"><Search size={20} className="inline mr-2" /> 即時篩選</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {filteredRooms.map(room => (
          <div key={room.id} className="bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100 overflow-hidden group">
            <div className="h-64 relative overflow-hidden bg-slate-100">
              <img src={room.imageUrl || "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={room.name} />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl text-xs font-black text-slate-800 border border-white/50 shadow-sm">最多 {room.capacity} 人</div>
            </div>
            <div className="p-8">
              <h3 className="text-2xl font-black mb-3 text-slate-800 leading-tight">{room.name}</h3>
              <p className="text-slate-400 text-sm mb-8 line-clamp-2 h-10 font-medium">{room.description || "體驗智宿雲帶給您的極致放鬆體驗。"}</p>
              <div className="flex items-center justify-between border-t border-slate-50 pt-6">
                <span className="text-2xl font-black text-blue-600 tracking-tight">${room.price}<span className="text-xs text-slate-400 font-normal"> /晚</span></span>
                <button onClick={() => setBookingRoom(room)} disabled={!startDate || !endDate} className={`px-8 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95 ${(!startDate || !endDate) ? 'bg-slate-100 text-slate-300 shadow-none' : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-100'}`}>立即預訂</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {bookingRoom && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in duration-300 border border-white/20">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-800">填寫住客資訊</h3>
              <button onClick={() => setBookingRoom(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><X/></button>
            </div>
            <div className="space-y-4 mb-8">
              <div className="flex justify-between border-b border-slate-50 pb-3 text-sm text-slate-500 font-medium"><span>智宿房型</span><span className="font-bold text-slate-800">{bookingRoom.name}</span></div>
              <div className="flex justify-between border-b border-slate-50 pb-3 text-sm text-slate-500 font-medium"><span>預訂時段</span><span className="font-bold text-slate-800 font-mono">{startDate} → {endDate}</span></div>
              <div className="flex justify-between items-end pt-4"><span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">預估實付金額</span><span className="text-4xl font-black text-red-500 tracking-tighter">${calculateTotal(startDate, endDate, bookingRoom)}</span></div>
              <div className="pt-6 space-y-4">
                <input placeholder="住客真實姓名" className="w-full border-none rounded-2xl p-5 bg-slate-100 font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" value={guestName} onChange={e => setGuestName(e.target.value)} />
                <input placeholder="聯絡電話" className="w-full border-none rounded-2xl p-5 bg-slate-100 font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
              </div>
            </div>
            <button onClick={handleBooking} className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all">送出預訂申請</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MyBookingsView({ bookings, userId }) {
  // 過濾邏輯：只顯示屬於自己的訂單，或是在匿名狀態下生成的訂單
  const myBookings = useMemo(() => {
    return bookings
      .filter(b => b.userId === userId || (userId === null && b.userId === 'anonymous'))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [bookings, userId]);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'confirmed': return { text: '預訂成功', style: 'bg-green-50 text-green-600 border-green-100 shadow-green-50', icon: <CheckCircle size={14} /> };
      case 'cancelled': return { text: '預訂已拒絕', style: 'bg-red-50 text-red-600 border-red-100 shadow-red-50', icon: <XCircle size={14} /> };
      case 'pending':
      default: return { text: '審核中', style: 'bg-yellow-50 text-yellow-600 border-yellow-100 shadow-yellow-50', icon: <Clock size={14} /> };
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10">
        <h2 className="text-3xl font-black tracking-tight text-slate-800">個人預訂中心</h2>
        <p className="text-slate-400 font-medium mt-1">追蹤您在智宿雲的所有住房記錄</p>
      </div>
      
      <div className="space-y-6">
        {myBookings.map(b => {
          const status = getStatusLabel(b.status);
          return (
            <div key={b.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 items-center transition-all duration-300 hover:shadow-xl group">
              <div className="flex-1 w-full">
                <div className="flex items-center gap-4 mb-5">
                  <h3 className="text-2xl font-black text-slate-800">{b.roomName}</h3>
                  <span className={`text-[10px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest border flex items-center gap-1.5 shadow-sm ${status.style}`}>
                    {status.icon} {status.text}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
                  <div><label className="block text-[10px] font-black text-slate-300 uppercase mb-2 tracking-widest px-1">入住時間</label><span className="font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{b.startDate}</span></div>
                  <div><label className="block text-[10px] font-black text-slate-300 uppercase mb-2 tracking-widest px-1">退房時間</label><span className="font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{b.endDate}</span></div>
                  <div><label className="block text-[10px] font-black text-slate-300 uppercase mb-2 tracking-widest px-1">旅伴人數</label><span className="font-bold text-slate-600">{b.guests} 位旅客</span></div>
                  <div><label className="block text-[10px] font-black text-slate-300 uppercase mb-2 tracking-widest px-1">實付總額</label><span className="font-black text-blue-600 text-lg tracking-tight">${b.totalAmount}</span></div>
                </div>
              </div>
            </div>
          );
        })}
        {myBookings.length === 0 && (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-300 flex flex-col items-center gap-4">
            <Search size={48} className="opacity-20" />
            <span className="font-black uppercase tracking-[0.3em] text-xs">目前無預訂記錄，智宿雲期待您的造訪</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [pwd, setPwd] = useState('');
  return (
    <div className="flex items-center justify-center py-20 animate-in zoom-in duration-500">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center border border-slate-50 text-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-blue-600 opacity-20"></div>
        <div className="bg-blue-600 w-20 h-20 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-blue-200 transform hover:rotate-12 transition-transform cursor-pointer"><Settings size={40} /></div>
        <h2 className="text-3xl font-black mb-3 tracking-tight text-slate-800">管理者驗證</h2>
        <p className="text-slate-400 font-medium mb-10 text-sm leading-relaxed">請輸入系統管理權限密碼<br/>以存取後台資料看板</p>
        <input type="password" placeholder="管理授權密碼" className="w-full border-none rounded-2xl p-5 bg-slate-100 font-bold text-center text-xl mb-6 outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 transition-all" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin(pwd)} />
        <button onClick={() => onLogin(pwd)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all active:scale-95">登入系統管理中心</button>
      </div>
    </div>
  );
}

function AdminDashboard({ rooms, bookings, onLogout }) {
  const [tab, setTab] = useState('calendar');
  const [editingRoom, setEditingRoom] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // 日曆邏輯
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayBookings = bookings.filter(b => b.status === 'confirmed' && dateStr >= b.startDate && dateStr < b.endDate);
      days.push({ day: d, dateStr, bookings: dayBookings });
    }
    return days;
  }, [currentDate, bookings]);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const saveRoom = async (roomData) => {
    try {
      if (roomData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomData.id), roomData);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'), { ...roomData, status: 'available' });
      }
      setEditingRoom(null);
    } catch (err) { alert("系統存取失敗"); }
  };

  const updateBookingStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id), { status });
    } catch (err) { alert("更新狀態失敗"); }
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in duration-500">
      <div className="bg-slate-900 text-white p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h2 className="text-2xl font-black tracking-tight uppercase tracking-widest text-slate-100">Smart Management Console</h2>
          <p className="text-slate-500 font-bold text-[10px] mt-1 tracking-[0.3em] uppercase">Cloud System V1.0</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-slate-100">
          <button onClick={() => setTab('calendar')} className={`px-6 py-3 rounded-2xl font-black transition-all ${tab === 'calendar' ? 'bg-blue-600 shadow-lg shadow-blue-500/30 scale-105' : 'bg-slate-800 hover:bg-slate-700'}`}>房態日曆</button>
          <button onClick={() => setTab('rooms')} className={`px-6 py-3 rounded-2xl font-black transition-all ${tab === 'rooms' ? 'bg-blue-600 shadow-lg shadow-blue-500/30 scale-105' : 'bg-slate-800 hover:bg-slate-700'}`}>房源維護</button>
          <button onClick={() => setTab('orders')} className={`px-6 py-3 rounded-2xl font-black transition-all ${tab === 'orders' ? 'bg-blue-600 shadow-lg shadow-blue-500/30 scale-105' : 'bg-slate-800 hover:bg-slate-700'}`}>訂單中心</button>
          <button onClick={onLogout} className="p-3 text-slate-500 hover:text-white transition-colors ml-4"><LogOut size={24} /></button>
        </div>
      </div>

      <div className="p-8 md:p-10 text-slate-800">
        {tab === 'calendar' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
              <div>
                <h3 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">住房即時看板</h3>
                <p className="text-slate-400 font-medium">查看每日預訂進度與各房型目前狀態</p>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-sm self-start md:self-center">
                <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-white rounded-xl text-slate-400 hover:text-slate-800 transition-all"><ChevronLeft size={20}/></button>
                <span className="font-black text-lg px-6 min-w-[160px] text-center">{currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月</span>
                <button onClick={() => changeMonth(1)} className="p-3 hover:bg-white rounded-xl text-slate-400 hover:text-slate-800 transition-all"><ChevronRight size={20}/></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-4 mb-16">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] pb-4">{d}</div>
              ))}
              {calendarData.map((day, idx) => (
                <div key={idx} className={`min-h-[140px] p-4 rounded-3xl border transition-all ${day ? 'bg-white border-slate-100 hover:shadow-2xl hover:border-blue-100 group' : 'bg-slate-50/30 border-transparent cursor-default opacity-20'}`}>
                  {day && (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <span className={`font-black text-lg transition-colors ${day.bookings.length > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{day.day}</span>
                        {day.bookings.length > 0 && <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-sm shadow-blue-200">{day.bookings.length} 筆</span>}
                      </div>
                      <div className="space-y-1.5 overflow-y-auto max-h-[85px] scrollbar-hide">
                        {day.bookings.map(b => (
                          <div key={b.id} className="text-[9px] font-bold p-2 bg-slate-50 border border-slate-100 rounded-lg flex flex-col gap-0.5 border-l-2 border-l-blue-500 shadow-sm">
                            <span className="text-blue-700 leading-none">{b.roomName}</span>
                            <span className="text-slate-400 truncate">{b.guestName}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {rooms.map(room => (
                <div key={room.id} className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 hover:bg-white hover:shadow-2xl transition-all group">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-slate-800">{room.name}</h3>
                    <div className={`w-3 h-3 rounded-full ${room.status === 'available' ? 'bg-green-500' : 'bg-orange-500'} animate-pulse shadow-lg`}></div>
                  </div>
                  <select value={room.status} onChange={async (e) => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: e.target.value })} className="w-full border-none bg-white rounded-xl px-4 py-4 text-sm font-bold shadow-sm outline-none text-slate-800 cursor-pointer hover:shadow-md transition-shadow">
                    <option value="available">● 目前正常營運 (Available)</option>
                    <option value="cleaning">○ 房務清潔維修 (Cleaning)</option>
                    <option value="maintenance">× 設備停用維修 (Blocked)</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'rooms' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-slate-800">智宿雲資產維護</h3>
              <button onClick={() => setEditingRoom({ name: '', price: 2000, holidayPrice: 2500, capacity: 2, description: '', imageUrl: '' })} className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"><Plus size={20} /> 上架新房源</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rooms.map(room => (
                <div key={room.id} className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all group">
                  <div className="h-44 bg-slate-100 relative">
                    <img src={room.imageUrl || "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover" alt={room.name} />
                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button onClick={() => setEditingRoom(room)} className="bg-white/95 backdrop-blur-md p-3 rounded-2xl text-blue-600 shadow-xl hover:scale-110 transition-all"><Settings size={18} /></button>
                      <button onClick={async () => { if(window.confirm('確定刪除此房型？')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id)); }} className="bg-white/95 backdrop-blur-md p-3 rounded-2xl text-red-500 shadow-xl hover:scale-110 transition-all"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  <div className="p-8">
                    <h4 className="font-black text-xl mb-4 text-slate-800">{room.name}</h4>
                    <div className="flex justify-between items-center pt-5 border-t border-slate-50">
                      <div><span className="text-[10px] font-black text-slate-300 uppercase block mb-1 font-bold">載客量</span><span className="font-bold text-slate-700 text-sm">{room.capacity} 人</span></div>
                      <div className="text-right"><span className="text-[10px] font-black text-slate-300 uppercase block mb-1 font-bold">每晚單價</span><span className="font-black text-slate-800 text-sm tracking-tight">${room.price} <span className="text-slate-300">/</span> ${room.holidayPrice}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="animate-in fade-in duration-500">
            <h3 className="text-2xl font-black tracking-tight mb-8 text-slate-800">全站預訂紀錄中心</h3>
            <div className="space-y-4">
              {bookings.sort((a,b)=>new Date(b.createdAt) - new Date(a.createdAt)).map(b => (
                <div key={b.id} className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 flex flex-col md:flex-row justify-between items-center gap-8 hover:bg-white hover:shadow-2xl hover:border-blue-50 transition-all group">
                  <div className="w-full text-slate-800">
                    <div className="flex flex-wrap items-center gap-4 mb-3">
                      <span className="text-xl font-black">{b.guestName}</span>
                      <span className={`text-[10px] px-3 py-1 rounded-lg font-black tracking-widest uppercase border transition-colors ${
                        b.status === 'confirmed' ? 'bg-green-50 text-green-600 border-green-200' :
                        b.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-400 border-slate-200'
                      }`}>
                        {b.status === 'confirmed' ? '已核准' : b.status === 'cancelled' ? '已拒絕' : '待審核'}
                      </span>
                      <span className="text-[10px] text-slate-300 font-bold ml-auto group-hover:text-slate-500 transition-colors">{b.guestPhone}</span>
                    </div>
                    <div className="text-sm text-slate-500 font-medium flex flex-wrap gap-x-8 gap-y-2">
                      <span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-300"/> {b.roomName}</span>
                      <span className="flex items-center gap-1.5"><CalendarIcon size={14} className="text-slate-300"/> {b.startDate} 至 {b.endDate}</span>
                      <span className="font-black text-blue-600 tracking-tighter text-lg">金額：${b.totalAmount}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    {b.status !== 'confirmed' && (
                      <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="flex-1 md:flex-none bg-blue-600 text-white px-8 py-3 rounded-2xl text-sm font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:scale-105">核准預訂</button>
                    )}
                    {b.status !== 'cancelled' && (
                      <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="flex-1 md:flex-none bg-white text-red-500 border border-red-100 px-8 py-3 rounded-2xl text-sm font-black hover:bg-red-50 transition-all hover:border-red-200">拒絕/取消</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 編輯房源 Modal */}
      {editingRoom && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-10 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] animate-in zoom-in duration-300 relative border border-white/20">
            <button onClick={() => setEditingRoom(null)} className="absolute top-8 right-8 p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-colors"><X/></button>
            <h3 className="text-3xl font-black mb-10 text-slate-800 tracking-tight">{editingRoom.id ? '更新房源資料' : '新增智宿雲房源'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block font-bold">房型名稱</label>
                <input value={editingRoom.name} onChange={e => setEditingRoom({...editingRoom, name: e.target.value})} className="w-full border-none rounded-2xl p-5 bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/10 font-bold outline-none transition-all text-slate-800" placeholder="例如：智宿雲景套房" />
              </div>
              <div className="md:col-span-2 bg-blue-50/50 p-7 rounded-[2rem] border border-blue-100 shadow-inner">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-2 font-bold">房型最大容納人數</label>
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full font-black text-xs shadow-md shadow-blue-200">{editingRoom.capacity || 2} 人</span>
                </div>
                <input type="range" min="1" max="12" value={editingRoom.capacity || 2} onChange={e => setEditingRoom({...editingRoom, capacity: Number(e.target.value)})} className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block font-bold">平日每晚價格</label>
                <input type="number" value={editingRoom.price} onChange={e => setEditingRoom({...editingRoom, price: Number(e.target.value)})} className="w-full border-none rounded-2xl p-5 bg-slate-100 focus:bg-white font-bold transition-all outline-none text-slate-800" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block font-bold">假日每晚價格</label>
                <input type="number" value={editingRoom.holidayPrice} onChange={e => setEditingRoom({...editingRoom, holidayPrice: Number(e.target.value)})} className="w-full border-none rounded-2xl p-5 bg-slate-100 focus:bg-white font-bold transition-all outline-none text-slate-800" />
              </div>
              <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block font-bold">房型實景照片連結</label><input value={editingRoom.imageUrl} onChange={e => setEditingRoom({...editingRoom, imageUrl: e.target.value})} className="w-full border-none rounded-2xl p-5 bg-slate-100 focus:bg-white font-bold transition-all outline-none text-slate-800" placeholder="貼上照片 URL (例如 Unsplash)..." /></div>
              <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block font-bold">特色介紹與坪數</label><textarea value={editingRoom.description} onChange={e => setEditingRoom({...editingRoom, description: e.target.value})} className="w-full border-none rounded-2xl p-5 bg-slate-100 font-bold h-28 outline-none transition-all resize-none text-slate-800" placeholder="簡述房間設備、景觀、服務..." /></div>
            </div>
            <div className="mt-12 flex gap-4">
              <button onClick={() => setEditingRoom(null)} className="flex-1 py-5 border-2 border-slate-50 rounded-2xl font-black text-slate-400 hover:bg-slate-50 transition-all">取消更動</button>
              <button onClick={() => saveRoom(editingRoom)} className="flex-1 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all">確認儲存房型資料</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 慢速動畫樣式修正
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.innerHTML = `
    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .animate-spin-slow { animation: spin-slow 8s linear infinite; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      height: 24px;
      width: 24px;
      border-radius: 50%;
      background: #2563eb;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(37, 99, 235, 0.3);
      border: 4px solid white;
    }
  `;
  document.head.appendChild(styleElement);
}
