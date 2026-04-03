import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Library, 
  Book, 
  Truck, 
  ShoppingCart, 
  BarChart3, 
  Settings, 
  Plus, 
  Search, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  History,
  Menu,
  X,
  LogOut,
  User,
  BookOpen,
  Sparkles,
  Loader2,
  ClipboardList,
  Check,
  ArrowLeft,
  Lock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

// --- Types ---
interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  author: string;
  description: string;
  category_id: number;
  category_name: string;
  unit_price: number;
  min_stock_level: number;
  total_stock: number;
  image_url?: string;
}

interface DashboardStats {
  totalProducts: number;
  lowStock: number;
  totalSales: number;
  pendingPOs: number;
  inventoryValue: number;
}

interface AuditLog {
  id: number;
  username: string;
  action: string;
  details: string;
  created_at: string;
}

interface Supplier {
  id: number;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
}

interface Sale {
  id: number;
  invoice_number: string;
  total_amount: number;
  created_at: string;
}

interface Branch {
  id: number;
  name: string;
  address: string;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  status: 'pending' | 'received' | 'cancelled';
  total_amount: number;
  created_at: string;
}

interface UserProfile {
  id: number;
  username: string;
  role: string;
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'sidebar-active text-white' 
        : 'text-slate-500 hover:bg-slate-100'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, color, trend }: any) => (
  <div className="glass-card p-6 rounded-2xl flex items-start justify-between">
    <div>
      <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      {trend && (
        <p className={`text-xs mt-2 flex items-center gap-1 ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend)}% from last month
        </p>
      )}
    </div>
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginRole, setLoginRole] = useState<'customer' | 'admin'>('customer');
  const [rememberMe, setRememberMe] = useState(false);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<{id: number, name: string}[]>([]);
  const [salesData, setSalesData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEstimatingPrice, setIsEstimatingPrice] = useState(false);
  const [isFetchingBook, setIsFetchingBook] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [externalBooks, setExternalBooks] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBookDetails, setSelectedBookDetails] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState(1);
  const [newPO, setNewPO] = useState({
    supplier_id: 0,
    items: [{ product_id: 0, quantity: 1, unit_price: 0 }]
  });
  const [newProduct, setNewProduct] = useState({
    name: '', sku: '', author: '', barcode: '', category_id: 1, unit_price: 0, min_stock_level: 5, description: '', initial_stock: 0, image_url: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        if (rememberMe) {
          localStorage.setItem('lumina_books_user', JSON.stringify(userData));
        } else {
          sessionStorage.setItem('lumina_books_user', JSON.stringify(userData));
        }
        if (userData.role === 'customer') {
          setActiveTab('inventory');
        } else {
          setActiveTab('dashboard');
        }
      } else {
        setLoginError('Invalid username or password');
      }
    } catch (err) {
      setLoginError('Connection error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        if (rememberMe) {
          localStorage.setItem('lumina_books_user', JSON.stringify(userData));
        } else {
          sessionStorage.setItem('lumina_books_user', JSON.stringify(userData));
        }
        setActiveTab('inventory');
      } else {
        const data = await res.json();
        setLoginError(data.error || 'Registration failed');
      }
    } catch (err) {
      setLoginError('Connection error');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('lumina_books_user');
    sessionStorage.removeItem('lumina_books_user');
    setActiveTab('dashboard');
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    
    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          location_id: 1, // Default to Main Branch
          quantity: adjustQty,
          type: 'in',
          reference_id: 'Manual Adjustment',
          user_id: user?.id
        })
      });
      if (res.ok) {
        setIsAdjustStockModalOpen(false);
        fetchData();
        setAdjustQty(1);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to adjust stock'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
    }
  };

  const estimatePrice = async (title: string, author: string) => {
    if (!title || !author) return;
    
    setIsEstimatingPrice(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Suggest a realistic retail price in Indian Rupees (₹) for a new copy of the book titled "${title}" by ${author}. Return ONLY the numeric value without currency symbols or text. Example: 499`,
      });
      
      const priceText = response.text?.trim();
      const price = parseFloat(priceText || '0');
      
      if (!isNaN(price) && price > 0) {
        setNewProduct(prev => ({ ...prev, unit_price: price }));
      }
    } catch (err) {
      console.error("Price estimation failed:", err);
    } finally {
      setIsEstimatingPrice(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newProduct.name.length > 3 && newProduct.author.length > 3 && newProduct.unit_price === 0) {
        estimatePrice(newProduct.name, newProduct.author);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [newProduct.name, newProduct.author]);

  useEffect(() => {
    const isbn = newProduct.sku.replace(/-/g, '').trim();
    if (isbn.length === 10 || isbn.length === 13) {
      const timer = setTimeout(() => {
        lookupBook(newProduct.sku);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [newProduct.sku]);

  useEffect(() => {
    const savedUser = localStorage.getItem('lumina_books_user') || sessionStorage.getItem('lumina_books_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      if (parsedUser.role === 'customer') {
        setActiveTab('inventory');
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [user]);

  const handlePlaceOrder = async (product: Product) => {
    if (!user) return;
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          items: [{
            product_id: product.id,
            quantity: 1,
            unit_price: product.unit_price
          }]
        })
      });
      
      if (res.ok) {
        setSelectedBookDetails(null);
        alert('Order placed successfully!');
        fetchData();
      } else {
        const err = await res.json();
        alert(`Failed to place order: ${err.error}`);
      }
    } catch (err) {
      console.error('Order error:', err);
      alert('Network error. Please try again.');
    }
  };

  const handleCreatePO = async (supplier_id: number, items: any[]) => {
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id, items })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error creating PO:', err);
    }
  };

  const handleReceivePO = async (po_id: number, location_id: number) => {
    try {
      const res = await fetch(`/api/purchase-orders/${po_id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id, user_id: user?.id })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error receiving PO:', err);
    }
  };

  const fetchData = async () => {
    try {
      const statsUrl = user ? `/api/dashboard/stats?userId=${user.id}&role=${user.role}` : '/api/dashboard/stats';
      const responses = await Promise.all([
        fetch(statsUrl),
        fetch('/api/products'),
        user?.role === 'customer' ? fetch(`/api/sales/user/${user.id}`) : fetch('/api/sales/report'),
        fetch('/api/suppliers'),
        fetch('/api/locations'),
        fetch('/api/purchase-orders'),
        fetch('/api/analytics/category-distribution'),
        fetch('/api/audit-logs'),
        fetch('/api/categories'),
        fetch('/api/users')
      ]);
      
      const [statsRes, productsRes, salesRes, suppliersRes, branchesRes, posRes, categoryRes, auditRes, allCategoriesRes, usersRes] = responses;

      if (responses.some(r => !r.ok)) {
        console.error("One or more data fetches failed");
        return;
      }
      
      const statsData = await statsRes.json();
      const productsData = await productsRes.json();
      const salesReportData = await salesRes.json();
      const suppliersData = await suppliersRes.json();
      const branchesData = await branchesRes.json();
      const posData = await posRes.json();
      const catData = await categoryRes.json();
      const logsData = await auditRes.json();
      const allCategoriesData = await allCategoriesRes.json();
      const usersData = await usersRes.json();
      
      setStats({
        totalProducts: statsData.totalProducts || 0,
        lowStock: statsData.lowStock || 0,
        totalSales: statsData.totalSales || 0,
        pendingPOs: statsData.pendingPOs || 0,
        inventoryValue: statsData.inventoryValue || 0
      });
      setProducts((productsData || []).map((p: any) => ({
        ...p,
        unit_price: isNaN(parseFloat(p.unit_price)) ? 0 : parseFloat(p.unit_price),
        total_stock: isNaN(parseInt(p.total_stock)) ? 0 : parseInt(p.total_stock),
        min_stock_level: isNaN(parseInt(p.min_stock_level)) ? 5 : parseInt(p.min_stock_level)
      })));
      setSalesData(salesReportData.map((d: any) => ({
        ...d,
        total: isNaN(parseFloat(d.total_amount || d.total)) ? 0 : parseFloat(d.total_amount || d.total),
        date: d.created_at ? format(new Date(d.created_at), 'MMM dd, yyyy HH:mm') : d.date
      })));
      setSuppliers(suppliersData || []);
      setBranches(branchesData || []);
      setPurchaseOrders(posData || []);
      setCategoryData(catData || []);
      setAuditLogs(logsData || []);
      setCategories(allCategoriesData || []);
      setCustomers(usersData || []);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  const lookupBook = async (isbn: string) => {
    if (!isbn || isbn.length < 10) return;
    setIsFetchingBook(true);
    try {
      const res = await fetch(`/api/external/book-lookup/${isbn}`);
      if (res.ok) {
        const data = await res.json();
        setNewProduct(prev => ({
          ...prev,
          name: data.title,
          author: data.author,
          description: data.description,
          sku: isbn,
          image_url: data.thumbnail || ''
        }));
      }
    } catch (err) {
      console.error("Book lookup failed:", err);
    } finally {
      setIsFetchingBook(false);
    }
  };

  const searchExternalBooks = async (query: string) => {
    if (!query || query.length < 3) return;
    setIsSearchingExternal(true);
    try {
      const res = await fetch(`/api/external/book-search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setExternalBooks(data);
      } else {
        setExternalBooks([]);
      }
    } catch (err) {
      console.error("External search failed:", err);
      setExternalBooks([]);
    } finally {
      setIsSearchingExternal(false);
    }
  };

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] p-4">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border-4 border-rose-50"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4">
            <Book size={32} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 font-serif text-rose-600">Lumina Books</h2>
          
          {/* Bootstrap-style Role Selector */}
          <div className="mt-6 w-full flex p-1 bg-slate-100 rounded-xl">
            <button 
              onClick={() => {
                setLoginRole('customer');
                setIsRegistering(false);
              }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                loginRole === 'customer' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Customer
            </button>
            <button 
              onClick={() => {
                setLoginRole('admin');
                setIsRegistering(false);
              }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                loginRole === 'admin' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Admin
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isRegistering ? 'bg-rose-100 text-rose-700' : 
              (loginRole === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700')
            }`}>
              {isRegistering ? 'New Customer Registration' : (loginRole === 'admin' ? 'Admin Secure Login' : 'Customer Portal')}
            </span>
          </div>

          <p className="text-slate-500 mt-4 text-center text-sm">
            {isRegistering 
              ? 'Join our community of book lovers today!' 
              : (loginRole === 'admin' ? 'Restricted access for authorized personnel only.' : 'Welcome back! Sign in to explore our collection.')}
          </p>

          {loginRole === 'customer' && !isRegistering && (
            <div className="mt-4 p-3 bg-amber-50 border-l-4 border-amber-400 text-amber-700 text-xs flex items-center gap-2 rounded-r-lg w-full">
              <div className="bg-amber-400 text-white p-1 rounded-full">
                <Sparkles size={10} />
              </div>
              <span>First-time here? Click "Create an account" below to get started!</span>
            </div>
          )}
        </div>

        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-6">
          {loginError && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium animate-shake">
              {loginError}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Username</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                required
                type="text" 
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400 transition-all"
                placeholder={loginRole === 'admin' ? 'Admin username' : 'Enter username'}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                required
                type="password" 
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="rememberMe"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-rose-500 rounded border-slate-300"
              />
              <label htmlFor="rememberMe" className="text-sm font-medium text-slate-600 cursor-pointer">
                Remember Me
              </label>
            </div>
            {loginRole === 'admin' && (
              <button type="button" className="text-xs font-bold text-slate-400 hover:text-slate-600">Forgot Password?</button>
            )}
          </div>
          <button 
            type="submit" 
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl ${
              loginRole === 'admin' 
                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-100' 
                : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-100'
            }`}
          >
            {isRegistering ? 'Create Account' : (loginRole === 'admin' ? 'Secure Login' : 'Sign In')}
          </button>
        </form>

        {loginRole === 'customer' && (
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setLoginError('');
              }}
              className="text-rose-500 font-bold hover:text-rose-700 transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              {isRegistering ? (
                <>
                  <ArrowLeft size={16} />
                  Back to Sign In
                </>
              ) : (
                <>
                  New customer? <span className="underline underline-offset-4">Create an account</span>
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );

  const renderDashboard = () => {
    const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ec4899'];
    
    return (
      <div className="space-y-8 animate-pop-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            label={user?.role === 'admin' ? "Total Books" : "Books Bought"} 
            value={stats?.totalProducts || 0} 
            icon={Book} 
            color="bg-rose-400" 
            trend={user?.role === 'admin' ? 12 : undefined}
          />
          <StatCard 
            label={user?.role === 'admin' ? "Inventory Value" : "Avg. Price"} 
            value={`₹${(user?.role === 'admin' ? (stats?.inventoryValue || 0) : (stats?.totalSales / (stats?.totalProducts || 1))).toLocaleString()}`} 
            icon={Sparkles} 
            color="bg-violet-400" 
          />
          <StatCard 
            label={user?.role === 'admin' ? "Total Sales" : "Total Spent"} 
            value={`₹${(stats?.totalSales || 0).toLocaleString()}`} 
            icon={ShoppingCart} 
            color="bg-emerald-400" 
            trend={user?.role === 'admin' ? 8 : undefined}
          />
          <StatCard 
            label={user?.role === 'admin' ? "Pending Orders" : "My Orders"} 
            value={stats?.pendingPOs || 0} 
            icon={Truck} 
            color="bg-sky-400" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Revenue Overview</h3>
              <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-sm outline-none">
                <option>Last 30 Days</option>
                <option>Last 6 Months</option>
              </select>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 12}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 12}}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Genre Distribution</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {categoryData.slice(0, 4).map((cat: any, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                    <span className="text-slate-600">{cat.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{cat.value} books</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Low Stock Alerts</h3>
            <div className="space-y-4">
              {products.filter(p => p.total_stock <= p.min_stock_level).slice(0, 5).map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{product.name}</p>
                    <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-700 font-bold text-sm">{product.total_stock || 0} left</p>
                    <p className="text-[10px] text-amber-600">Min: {product.min_stock_level}</p>
                  </div>
                </div>
              ))}
              {products.filter(p => p.total_stock <= p.min_stock_level).length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <BookOpen size={40} className="mx-auto mb-2 opacity-20" />
                  <p>All stock levels healthy</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 glass-card p-6 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
              <button onClick={() => setActiveTab('audit')} className="text-sm text-rose-500 font-bold hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              {auditLogs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-900">
                      <span className="font-bold">{log.username}</span> {log.action}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{log.details}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{format(new Date(log.created_at), 'MMM dd, HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProduct, user_id: user?.id })
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        await fetchData();
        setNewProduct({ name: '', sku: '', author: '', barcode: '', category_id: 1, unit_price: 0, min_stock_level: 5, description: '', initial_stock: 0, image_url: '' });
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to add book'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
    }
  };

  const renderSuppliers = () => (
    <div className="space-y-8 animate-pop-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 font-serif">Suppliers</h2>
          <p className="text-slate-500">Manage your book distributors and publishers</p>
        </div>
        <button className="bg-rose-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-600 transition-all shadow-lg shadow-rose-100">
          <Plus size={20} />
          Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map(supplier => (
          <div key={supplier.id} className="glass-card p-6 rounded-2xl border-2 border-slate-50 hover:border-rose-100 transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
                <Truck size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{supplier.name}</h3>
                <p className="text-xs text-slate-500">{supplier.contact_person}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2"><ShoppingCart size={14} className="text-slate-400" /> {supplier.email}</p>
              <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> {supplier.address}</p>
            </div>
            <button className="w-full mt-6 py-2 rounded-lg border-2 border-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
              View Orders
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPurchaseOrders = () => (
    <div className="space-y-8 animate-pop-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 font-serif">Purchase Orders</h2>
          <p className="text-slate-500">Track and manage orders from suppliers</p>
        </div>
        <button 
          onClick={() => {
            setNewPO({ supplier_id: suppliers[0]?.id || 0, items: [{ product_id: products[0]?.id || 0, quantity: 1, unit_price: products[0]?.unit_price || 0 }] });
            setIsPOModalOpen(true);
          }}
          className="bg-rose-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-600 transition-all shadow-lg shadow-rose-100"
        >
          <Plus size={20} />
          New Order
        </button>
      </div>

      {isPOModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border-4 border-rose-100"
          >
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-rose-900 font-serif">Create Purchase Order</h3>
              <button onClick={() => setIsPOModalOpen(false)} className="text-rose-400 hover:text-rose-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreatePO(newPO.supplier_id, newPO.items);
              setIsPOModalOpen(false);
            }} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Supplier</label>
                  <select 
                    required
                    value={newPO.supplier_id}
                    onChange={e => setNewPO({...newPO, supplier_id: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400"
                  >
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase">Order Items</p>
                {newPO.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50 p-4 rounded-2xl">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Book</label>
                      <select 
                        value={item.product_id}
                        onChange={e => {
                          const updatedItems = [...newPO.items];
                          const prod = products.find(p => p.id === parseInt(e.target.value));
                          updatedItems[idx] = { ...item, product_id: parseInt(e.target.value), unit_price: prod?.unit_price || 0 };
                          setNewPO({...newPO, items: updatedItems});
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                      >
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity</label>
                      <input 
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => {
                          const updatedItems = [...newPO.items];
                          updatedItems[idx] = { ...item, quantity: parseInt(e.target.value) || 1 };
                          setNewPO({...newPO, items: updatedItems});
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit Price</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={e => {
                          const updatedItems = [...newPO.items];
                          updatedItems[idx] = { ...item, unit_price: parseFloat(e.target.value) || 0 };
                          setNewPO({...newPO, items: updatedItems});
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold">Total Amount</p>
                  <p className="text-2xl font-bold text-slate-900">₹{newPO.items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0).toLocaleString()}</p>
                </div>
                <button type="submit" className="bg-rose-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-rose-600 transition-all shadow-xl shadow-rose-100">
                  Create Order
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b-2 border-slate-100">
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">PO Number</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500 italic">
                  No purchase orders found.
                </td>
              </tr>
            ) : (
              purchaseOrders.map(po => (
                <tr key={po.id} className="data-table-row">
                  <td className="px-6 py-5 font-mono text-sm font-bold text-slate-900">{po.po_number}</td>
                  <td className="px-6 py-5 text-slate-700 font-medium">{po.supplier_name}</td>
                  <td className="px-6 py-5 text-slate-500 text-sm">{format(new Date(po.created_at), 'MMM dd, yyyy')}</td>
                  <td className="px-6 py-5 text-slate-900 font-bold">₹{po.total_amount.toLocaleString()}</td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      po.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      po.status === 'received' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {po.status === 'pending' && (
                      <button 
                        onClick={() => handleReceivePO(po.id, 1)}
                        className="text-emerald-500 hover:text-emerald-700 font-bold text-sm flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Check size={14} />
                        Receive
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSales = () => (
    <div className="space-y-8 animate-pop-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 font-serif">{user?.role === 'admin' ? 'Sales History' : 'My Orders'}</h2>
          <p className="text-slate-500">{user?.role === 'admin' ? 'Track your bookstore transactions' : 'Your recent book purchases'}</p>
        </div>
        {user?.role === 'admin' && (
          <button className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100">
            <Plus size={20} />
            New Transaction
          </button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        {user?.role === 'customer' && salesData.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <ShoppingCart size={80} className="mx-auto mb-4 opacity-10" />
            <h3 className="text-xl font-bold text-slate-500">No orders yet</h3>
            <p className="mt-2">Start your reading journey by browsing our collection!</p>
            <button 
              onClick={() => setActiveTab('inventory')}
              className="mt-6 bg-rose-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-600 transition-all"
            >
              Browse Books
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b-2 border-slate-100">
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesData.map((sale: any, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5 font-mono text-sm font-bold text-slate-700">{sale.invoice_number || `INV-${2000 + idx}`}</td>
                  <td className="px-6 py-5 text-sm text-slate-600">{sale.date}</td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-bold text-slate-900">₹{sale.total.toLocaleString()}</div>
                    {sale.items_summary && (
                      <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[200px]">
                        {sale.items_summary}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">Completed</span>
                  </td>
                  <td className="px-6 py-5">
                    <button className="text-rose-500 hover:text-rose-700 font-bold text-sm underline underline-offset-4">View Receipt</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderBranches = () => (
    <div className="space-y-8 animate-pop-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 font-serif">Branches</h2>
          <p className="text-slate-500">Manage multi-location bookstore operations</p>
        </div>
        <button className="bg-rose-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-600 transition-all shadow-lg shadow-rose-100">
          <Plus size={20} />
          Add Branch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {branches.map(branch => (
          <div key={branch.id} className="glass-card p-8 rounded-3xl border-2 border-slate-50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <MapPin size={120} />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg mb-6">
                <Library size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 font-serif mb-2">{branch.name}</h3>
              <p className="text-slate-500 mb-6 flex items-center gap-2"><MapPin size={16} /> {branch.address}</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-xs text-slate-400 uppercase font-bold mb-1">Total Stock</p>
                  <p className="text-xl font-bold text-slate-900">1,240 Books</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-xs text-slate-400 uppercase font-bold mb-1">Daily Sales</p>
                  <p className="text-xl font-bold text-emerald-600">₹12,450</p>
                </div>
              </div>
              
              <button className="w-full mt-8 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all">
                Manage Inventory
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-8 animate-pop-in">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 font-serif">Analytics</h2>
        <p className="text-slate-500">Deep dive into your bookstore performance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 rounded-3xl">
          <h3 className="text-xl font-bold text-slate-900 mb-8 font-serif">Genre Distribution</h3>
          <div className="h-[300px] flex items-center justify-center">
            <div className="w-full max-w-xs space-y-4">
              {[
                { label: 'Fiction', value: 45, color: 'bg-rose-400' },
                { label: 'Non-Fiction', value: 25, color: 'bg-amber-400' },
                { label: 'Sci-Fi', value: 15, color: 'bg-indigo-400' },
                { label: 'Mystery', value: 10, color: 'bg-emerald-400' },
                { label: 'Others', value: 5, color: 'bg-slate-400' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="text-slate-400">{item.value}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`${item.color} h-full`} style={{ width: `${item.value}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl">
          <h3 className="text-xl font-bold text-slate-900 mb-8 font-serif">Monthly Growth</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#f43f5e" strokeWidth={4} dot={{ r: 6, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAuditLogs = () => (
    <div className="space-y-8 animate-pop-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 font-serif">Audit Logs</h2>
          <p className="text-slate-500">Track all system activities and inventory changes</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b-2 border-slate-100">
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditLogs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-5 font-bold text-slate-900">{log.username || 'System'}</td>
                <td className="px-6 py-5">
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">{log.action}</span>
                </td>
                <td className="px-6 py-5 text-sm text-slate-600">{log.details}</td>
                <td className="px-6 py-5 text-xs text-slate-400">{format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="space-y-6 animate-pop-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 font-serif">Customer Directory</h2>
          <p className="text-slate-500">Manage registered customers and their accounts</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b-2 border-slate-100">
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer ID</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Username</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-5 font-mono text-sm font-bold text-slate-500">#USR-{c.id}</td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold">
                      {c.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-900">{c.username}</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold uppercase">{c.role}</span>
                </td>
                <td className="px-6 py-5">
                  <button className="text-rose-500 hover:text-rose-700 font-bold text-sm underline underline-offset-4">View Orders</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6 animate-pop-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-slate-900 font-serif">{user?.role === 'admin' ? 'Book Catalog' : 'Available Books'}</h2>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search ISBN, Title..." 
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  if (user?.role === 'customer' && e.target.value.length >= 3) {
                    searchExternalBooks(e.target.value);
                  } else if (e.target.value.length < 3) {
                    setExternalBooks([]);
                  }
                }}
                className="pl-10 pr-4 py-2 bg-white border-2 border-slate-200 rounded-xl outline-none focus:border-rose-400 transition-all w-full md:w-64"
              />
            </div>
            {isSearchingExternal && <Loader2 className="animate-spin text-rose-500" size={18} />}
          </div>
          {user?.role === 'admin' && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-rose-500 text-white px-6 py-2 rounded-xl flex items-center gap-2 hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 font-bold"
            >
              <Plus size={18} />
              Add Book
            </button>
          )}
        </div>
      </div>

      {user?.role === 'customer' && externalBooks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" />
            Found on Google Books
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {externalBooks.map((book, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 rounded-2xl flex gap-4 border-2 border-amber-50"
              >
                <div className="w-20 h-28 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                  {book.thumbnail ? (
                    <img src={book.thumbnail} alt={book.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Book size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-grow overflow-hidden">
                  <h4 className="font-bold text-slate-900 truncate">{book.title}</h4>
                  <p className="text-xs text-slate-500 italic mb-2">by {book.author}</p>
                  <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">{book.description}</p>
                  <div className="mt-2">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded">Not in Stock</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border-4 border-rose-100"
          >
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-rose-900 font-serif">Add New Book</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-rose-400 hover:text-rose-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Book Title</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. The Great Gatsby"
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Author</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. F. Scott Fitzgerald"
                    value={newProduct.author}
                    onChange={e => setNewProduct({...newProduct, author: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                    ISBN
                    {isFetchingBook && (
                      <span className="flex items-center gap-1 text-rose-500 animate-pulse">
                        <Loader2 size={10} className="animate-spin" />
                        Fetching Details...
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      required
                      type="text" 
                      value={newProduct.sku}
                      onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                      className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400"
                      placeholder="978-..."
                    />
                    <button 
                      type="button"
                      onClick={() => lookupBook(newProduct.sku)}
                      disabled={isFetchingBook}
                      className="bg-slate-900 text-white px-4 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center disabled:opacity-50"
                    >
                      {isFetchingBook ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Genre / Category</label>
                  <select 
                    required
                    value={newProduct.category_id}
                    onChange={e => setNewProduct({...newProduct, category_id: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Initial Stock</label>
                  <input 
                    required
                    type="number" 
                    value={newProduct.initial_stock}
                    onChange={e => setNewProduct({...newProduct, initial_stock: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                    Price (₹)
                    {isEstimatingPrice && (
                      <span className="flex items-center gap-1 text-rose-500 animate-pulse">
                        <Loader2 size={10} className="animate-spin" />
                        AI Estimating...
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={isNaN(newProduct.unit_price) ? '' : newProduct.unit_price}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setNewProduct({...newProduct, unit_price: isNaN(val) ? 0 : val});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400"
                    />
                    {newProduct.unit_price > 0 && !isEstimatingPrice && (
                      <Sparkles size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400" />
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cover Image URL</label>
                  <input 
                    type="text" 
                    placeholder="https://..."
                    value={newProduct.image_url}
                    onChange={e => setNewProduct({...newProduct, image_url: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-rose-400"
                  />
                  {newProduct.image_url && (
                    <div className="mt-2 w-20 h-28 rounded-lg overflow-hidden border-2 border-slate-100">
                      <img src={newProduct.image_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>
              <button type="submit" className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-rose-600 transition-all shadow-xl shadow-rose-100">
                Add to Library
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustStockModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border-4 border-emerald-100"
          >
            <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-emerald-900 font-serif">Add Stock</h3>
              <button onClick={() => setIsAdjustStockModalOpen(false)} className="text-emerald-400 hover:text-emerald-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAdjustStock} className="p-8 space-y-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">Adding stock for:</p>
                <p className="font-bold text-slate-900 font-serif">{selectedProduct.name}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantity to Add</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  value={adjustQty}
                  onChange={e => setAdjustQty(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-emerald-400"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100">
                Confirm Addition
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Book Details Modal */}
      {selectedBookDetails && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border-4 border-rose-100"
          >
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-rose-900 font-serif">Book Details</h3>
              <button onClick={() => setSelectedBookDetails(null)} className="text-rose-400 hover:text-rose-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-48 h-64 bg-rose-50 rounded-2xl overflow-hidden shadow-lg border-2 border-rose-100 flex-shrink-0">
                {selectedBookDetails.image_url ? (
                  <img src={selectedBookDetails.image_url} alt={selectedBookDetails.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-rose-200">
                    <BookOpen size={64} />
                  </div>
                )}
              </div>
              <div className="flex-grow space-y-4">
                <div>
                  <h4 className="text-2xl font-bold text-slate-900 font-serif">{selectedBookDetails.name}</h4>
                  <p className="text-lg text-slate-500 italic">by {selectedBookDetails.author}</p>
                </div>
                <div className="flex gap-4">
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase">{selectedBookDetails.category_name}</span>
                  <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-600 text-xs font-bold uppercase">₹{selectedBookDetails.unit_price.toFixed(2)}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">Description</p>
                  <p className="text-slate-600 leading-relaxed text-sm max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedBookDetails.description || "No description available for this title."}
                  </p>
                </div>
                <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                  <div className="text-xs text-slate-400">
                    <p>ISBN: {selectedBookDetails.sku}</p>
                    <p>Stock: {selectedBookDetails.total_stock} units available</p>
                  </div>
                  {user?.role === 'customer' && selectedBookDetails.total_stock > 0 && (
                    <button 
                      onClick={() => handlePlaceOrder(selectedBookDetails)}
                      className="bg-rose-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-100"
                    >
                      Buy Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b-2 border-slate-100">
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Book Details</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Genre</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.filter(p => 
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
              p.sku.includes(searchTerm) ||
              p.author.toLowerCase().includes(searchTerm.toLowerCase())
            ).map(product => (
              <tr key={product.id} className="data-table-row">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-16 rounded-lg bg-rose-100 overflow-hidden flex items-center justify-center text-rose-600 font-bold shadow-sm border border-rose-200">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <BookOpen size={20} />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 font-serif text-lg">{product.name}</p>
                      <p className="text-sm text-slate-500 italic">by {product.author}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">ISBN: {product.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className={`genre-tag ${
                    product.category_name?.toLowerCase() === 'fiction' ? 'genre-fiction' :
                    product.category_name?.toLowerCase() === 'non-fiction' ? 'genre-non-fiction' :
                    product.category_name?.toLowerCase() === 'sci-fi' ? 'genre-sci-fi' :
                    product.category_name?.toLowerCase() === 'mystery' ? 'genre-mystery' :
                    product.category_name?.toLowerCase() === 'biography' ? 'genre-biography' :
                    product.category_name?.toLowerCase() === 'children' ? 'genre-children' :
                    product.category_name?.toLowerCase() === 'history' ? 'genre-history' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {product.category_name || 'General'}
                  </span>
                </td>
                <td className="px-6 py-5 text-slate-900 font-bold">₹{product.unit_price.toFixed(2)}</td>
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span className={`font-bold text-lg ${product.total_stock <= product.min_stock_level ? 'text-rose-600' : 'text-slate-900'}`}>
                      {product.total_stock || 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Min: {product.min_stock_level}</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  {product.total_stock <= 0 ? (
                    <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold uppercase">Sold Out</span>
                  ) : product.total_stock <= product.min_stock_level ? (
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">Low Stock</span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">Available</span>
                  )}
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    {user?.role === 'admin' ? (
                      <button 
                        onClick={() => {
                          setSelectedProduct(product);
                          setIsAdjustStockModalOpen(true);
                        }}
                        className="text-emerald-500 hover:text-emerald-700 font-bold text-sm flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Plus size={14} />
                        Add Stock
                      </button>
                    ) : (
                      product.total_stock > 0 && (
                        <button 
                          onClick={() => handlePlaceOrder(product)}
                          className="bg-rose-500 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-rose-600 transition-colors flex items-center gap-2"
                        >
                          <ShoppingCart size={14} />
                          Buy Now
                        </button>
                      )
                    )}
                    <button 
                      onClick={() => setSelectedBookDetails(product)}
                      className="text-rose-500 hover:text-rose-700 font-bold text-sm underline underline-offset-4"
                    >
                      Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Initializing Lumina Books...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return renderLogin();
  }

  return (
    <div className="min-h-screen flex bg-[#FFFBF5]">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-white border-r-2 border-slate-100 overflow-hidden flex-shrink-0"
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-100">
              <Book size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-serif text-rose-600">Lumina Books</h1>
          </div>

          <nav className="space-y-3 flex-grow overflow-y-auto pr-2 custom-scrollbar">
            {user.role === 'admin' ? (
              <>
                <SidebarItem 
                  icon={Library} 
                  label="Dashboard" 
                  active={activeTab === 'dashboard'} 
                  onClick={() => setActiveTab('dashboard')} 
                />
                <SidebarItem 
                  icon={Book} 
                  label="Book Catalog" 
                  active={activeTab === 'inventory'} 
                  onClick={() => setActiveTab('inventory')} 
                />
                <SidebarItem 
                  icon={Truck} 
                  label="Suppliers" 
                  active={activeTab === 'suppliers'} 
                  onClick={() => setActiveTab('suppliers')} 
                />
                <SidebarItem 
                  icon={ClipboardList} 
                  label="Purchase Orders" 
                  active={activeTab === 'purchase_orders'} 
                  onClick={() => setActiveTab('purchase_orders')} 
                />
                <SidebarItem 
                  icon={ShoppingCart} 
                  label="Sales" 
                  active={activeTab === 'sales'} 
                  onClick={() => setActiveTab('sales')} 
                />
                <SidebarItem 
                  icon={MapPin} 
                  label="Branches" 
                  active={activeTab === 'branches'} 
                  onClick={() => setActiveTab('branches')} 
                />
                <SidebarItem 
                  icon={BarChart3} 
                  label="Analytics" 
                  active={activeTab === 'analytics'} 
                  onClick={() => setActiveTab('analytics')} 
                />
                <SidebarItem 
                  icon={History} 
                  label="Audit Logs" 
                  active={activeTab === 'audit'} 
                  onClick={() => setActiveTab('audit')} 
                />
                <SidebarItem 
                  icon={User} 
                  label="Customers" 
                  active={activeTab === 'customers'} 
                  onClick={() => setActiveTab('customers')} 
                />
              </>
            ) : (
              <>
                <SidebarItem 
                  icon={BookOpen} 
                  label="Browse Books" 
                  active={activeTab === 'inventory'} 
                  onClick={() => setActiveTab('inventory')} 
                />
                <SidebarItem 
                  icon={ShoppingCart} 
                  label="My Orders" 
                  active={activeTab === 'sales'} 
                  onClick={() => setActiveTab('sales')} 
                />
              </>
            )}
          </nav>

          <div className="pt-6 border-t-2 border-slate-50 space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 border border-rose-200">
                <User size={20} />
              </div>
              <div className="flex-grow overflow-hidden">
                <p className="text-sm font-bold text-slate-900 truncate">{user.username}</p>
                <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter">{user.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-all font-bold"
            >
              <LogOut size={20} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b-2 border-slate-100 px-8 py-4 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-rose-50 rounded-xl text-rose-500 transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          <h2 className="text-xl font-bold text-slate-800 font-serif capitalize tracking-wide">
            {activeTab === 'inventory' ? (user?.role === 'admin' ? 'Book Catalog' : 'Browse Books') : 
             activeTab === 'sales' ? (user?.role === 'admin' ? 'Sales History' : 'My Orders') : 
             activeTab === 'purchase_orders' ? 'Purchase Orders' :
             activeTab}
          </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
              user?.role === 'admin' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
            }`}>
              <User size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">{user?.role}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
              <History size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">{format(new Date(), 'MMM dd, yyyy')}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-grow overflow-y-auto p-8 bg-[#FFFBF5]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'inventory' && renderProducts()}
              {activeTab === 'suppliers' && renderSuppliers()}
              {activeTab === 'purchase_orders' && renderPurchaseOrders()}
              {activeTab === 'sales' && renderSales()}
              {activeTab === 'branches' && renderBranches()}
              {activeTab === 'analytics' && renderAnalytics()}
              {activeTab === 'audit' && renderAuditLogs()}
              {activeTab === 'customers' && renderCustomers()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
