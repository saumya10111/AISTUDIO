import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp,
  orderBy,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { initialVoters } from './data/initialVoters';
import { 
  Search, 
  User as UserIcon, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Phone, 
  MessageSquare, 
  Filter,
  ChevronRight,
  ChevronLeft,
  Database,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Voter {
  id: string;
  name: string;
  epicNo: string;
  partSerialNo: number;
  age?: number;
  status?: 'A' | 'B' | 'Shifted' | 'Dead' | 'Other' | 'Pending';
  comments?: string;
  phoneNumber?: string;
  updatedAt?: any;
  updatedBy?: string;
}

const STATUS_OPTIONS = ['A', 'B', 'Shifted', 'Dead', 'Other', 'Pending'] as const;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listener
  useEffect(() => {
    if (!user) {
      setVoters([]);
      return;
    }

    const q = query(collection(db, 'voters'), orderBy('partSerialNo', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Voter[];
      setVoters(data);
    }, (err) => {
      console.error("Firestore error:", err);
      setError("Failed to load data. Check your permissions.");
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to sign in.");
    }
  };

  const handleLogout = () => signOut(auth);

  const seedData = async () => {
    if (!user) return;
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      initialVoters.forEach((v) => {
        // Sanitize EPIC No for use as document ID (replace slashes)
        const sanitizedId = v.epicNo.replace(/\//g, '_');
        const docRef = doc(collection(db, 'voters'), sanitizedId);
        batch.set(docRef, {
          ...v,
          status: 'Pending',
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
      });
      await batch.commit();
      alert("Data seeded successfully!");
    } catch (err) {
      console.error("Seed error:", err);
      setError("Failed to seed data. You might already have data or lack permissions.");
    } finally {
      setIsSeeding(false);
    }
  };

  const updateVoter = async (voterId: string, updates: Partial<Voter>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'voters', voterId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
      setSelectedVoter(null);
    } catch (err) {
      console.error("Update error:", err);
      setError("Failed to update voter.");
    }
  };

  const filteredVoters = useMemo(() => {
    return voters.filter(v => {
      const matchesSearch = 
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        v.epicNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.partSerialNo.toString().includes(searchTerm);
      
      const matchesFilter = statusFilter === 'All' || v.status === statusFilter;
      
      return matchesSearch && matchesFilter;
    });
  }, [voters, searchTerm, statusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-stone-200 text-center"
        >
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Database className="w-8 h-8 text-stone-600" />
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 mb-2 italic serif">Voter Mapping</h1>
          <p className="text-stone-500 mb-8">Sign in to access and update voter data.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
          >
            <UserIcon className="w-4 h-4" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-bottom border-stone-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-stone-900 leading-tight">Voter Mapping</h1>
              <p className="text-xs text-stone-500">Mapping Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {voters.length === 0 && (
              <button 
                onClick={seedData}
                disabled={isSeeding}
                className="text-xs font-medium px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSeeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                Seed Data
              </button>
            )}
            <div className="flex items-center gap-2">
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-stone-200" />
              <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pb-24">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-xs font-bold">DISMISS</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={voters.length} icon={<Database className="w-4 h-4" />} />
          <StatCard label="Mapped" value={voters.filter(v => v.status !== 'Pending').length} icon={<CheckCircle2 className="w-4 h-4" />} color="text-emerald-600" />
          <StatCard label="Pending" value={voters.filter(v => v.status === 'Pending').length} icon={<Clock className="w-4 h-4" />} color="text-amber-600" />
          <StatCard label="Dead" value={voters.filter(v => v.status === 'Dead').length} icon={<XCircle className="w-4 h-4" />} color="text-red-600" />
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search by Name, EPIC, or Serial No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
            <Filter className="w-4 h-4 text-stone-400 ml-2 hidden sm:block" />
            {['All', ...STATUS_OPTIONS].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border",
                  statusFilter === status 
                    ? "bg-stone-900 text-white border-stone-900" 
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Voter List */}
        <div className="space-y-3">
          {filteredVoters.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
              <Database className="w-12 h-12 text-stone-200 mx-auto mb-4" />
              <p className="text-stone-500">No voters found matching your criteria.</p>
            </div>
          ) : (
            filteredVoters.map((voter) => (
              <VoterCard 
                key={voter.id} 
                voter={voter} 
                onClick={() => setSelectedVoter(voter)} 
              />
            ))
          )}
        </div>
      </main>

      {/* Edit Modal */}
      <AnimatePresence>
        {selectedVoter && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVoter(null)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">{selectedVoter.name}</h2>
                    <p className="text-sm text-stone-500">EPIC: {selectedVoter.epicNo} • Serial: {selectedVoter.partSerialNo}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedVoter(null)}
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
                    <XCircle className="w-6 h-6 text-stone-400" />
                  </button>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updateVoter(selectedVoter.id, {
                    status: formData.get('status') as any,
                    phoneNumber: formData.get('phoneNumber') as string,
                    comments: formData.get('comments') as string,
                  });
                }} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Status</label>
                    <div className="grid grid-cols-3 gap-2">
                      {STATUS_OPTIONS.map(status => (
                        <label key={status} className="relative cursor-pointer">
                          <input 
                            type="radio" 
                            name="status" 
                            value={status} 
                            defaultChecked={selectedVoter.status === status}
                            className="peer sr-only"
                          />
                          <div className="px-3 py-2 text-center text-sm font-medium rounded-xl border border-stone-200 peer-checked:bg-stone-900 peer-checked:text-white peer-checked:border-stone-900 transition-all">
                            {status}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input 
                        type="tel" 
                        name="phoneNumber"
                        defaultValue={selectedVoter.phoneNumber}
                        placeholder="Enter phone number..."
                        className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Comments</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                      <textarea 
                        name="comments"
                        defaultValue={selectedVoter.comments}
                        placeholder="Add extra details or notes..."
                        rows={3}
                        className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/5 resize-none"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-semibold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
                  >
                    Save Changes
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon, color = "text-stone-600" }: { label: string, value: number, icon: React.ReactNode, color?: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-stone-200">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-stone-900">{value}</div>
    </div>
  );
}

const VoterCard = ({ voter, onClick }: { voter: Voter, onClick: () => void, key?: React.Key }) => {
  const statusColors = {
    'A': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'B': 'bg-blue-100 text-blue-700 border-blue-200',
    'Shifted': 'bg-purple-100 text-purple-700 border-purple-200',
    'Dead': 'bg-red-100 text-red-700 border-red-200',
    'Other': 'bg-stone-100 text-stone-700 border-stone-200',
    'Pending': 'bg-stone-50 text-stone-400 border-stone-100',
  };

  return (
    <motion.div 
      layout
      onClick={onClick}
      className="group bg-white p-4 rounded-2xl border border-stone-200 hover:border-stone-400 hover:shadow-sm transition-all cursor-pointer flex items-center gap-4"
    >
      <div className="w-12 h-12 bg-stone-50 rounded-xl flex flex-col items-center justify-center border border-stone-100 group-hover:bg-stone-100 transition-colors">
        <span className="text-[10px] font-bold text-stone-400 leading-none mb-0.5">SL</span>
        <span className="text-lg font-bold text-stone-900 leading-none">{voter.partSerialNo}</span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-stone-900 truncate">{voter.name}</h3>
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-tight",
            statusColors[voter.status || 'Pending']
          )}>
            {voter.status || 'Pending'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span>EPIC: {voter.epicNo}</span>
          <span>Age: {voter.age}</span>
          {voter.phoneNumber && (
            <span className="flex items-center gap-1 text-stone-500">
              <Phone className="w-3 h-3" /> {voter.phoneNumber}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {voter.comments && <MessageSquare className="w-4 h-4 text-stone-300" />}
        <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-colors" />
      </div>
    </motion.div>
  );
}
