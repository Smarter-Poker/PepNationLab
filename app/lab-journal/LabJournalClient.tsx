'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import SmartStackBuilder from '@/components/researcher/SmartStackBuilder';
import { Heart, Trash2, ExternalLink, PackageOpen, History, LayoutGrid, List as ListIcon, Search, X, Check, ShoppingCart, Info, TrendingUp, XCircle, Layers, FlaskConical, Zap, Target } from 'lucide-react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart, Bar, ReferenceLine } from 'recharts';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { getProductImage } from '@/lib/categoryImage';
import DynamicAddToCartButton from '@/components/storefront/DynamicAddToCartButton';

interface Item {
  product_id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  base_cost: number | null;
  retail_price: number | null;
  in_stock: boolean | null;
  unit_size: string | null;
  unit_measure: string | null;
  last_purchased_date?: string;
  purchase_count?: number;
  viewed_at?: string;
  is_on_sale?: boolean;
  agent_product_id?: string | null;
}

interface Props {
  favorites: Item[];
  pastOrders: Item[];
  recentlyViewed: Item[];
  bundles: Item[];
  catalog: Item[];
  trending: { id: string; name: string; image_url: string | null; category: string | null; }[];
  categories: string[];
  storefrontSlug: string | null;
}

export default function LabJournalClient({ favorites: initialFavorites, pastOrders, recentlyViewed: initialRecentlyViewed, bundles, catalog, trending, categories, storefrontSlug }: Props) {
  const [favorites, setFavorites] = useState<Item[]>(initialFavorites);
  const [recentlyViewed, setRecentlyViewed] = useState<Item[]>(initialRecentlyViewed);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [helpfulData, setHelpfulData] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [doses, setDoses] = useState<any[]>([]);
  const [biometrics, setBiometrics] = useState<any[]>([]);
  
  // Goals State
  const [goals, setGoals] = useState<any[]>([]);
  const [goalName, setGoalName] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  
  // Notes UI State
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteCompoundSlug, setNoteCompoundSlug] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Intelligence State
  const [intelligenceCompound, setIntelligenceCompound] = useState<string | null>(null);
  const [intelligenceData, setIntelligenceData] = useState<any>(null);

  // AI Protocol State
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [aiCompounds, setAiCompounds] = useState<string[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiExperience, setAiExperience] = useState('Beginner');
  const [aiMetrics, setAiMetrics] = useState('');

  // Dose UI State
  const [doseCompound, setDoseCompound] = useState('');
  const [doseAmount, setDoseAmount] = useState('');
  const [doseUnit, setDoseUnit] = useState('mcg');
  const [doseSaving, setDoseSaving] = useState(false);

  // Biometrics UI State
  const [bioName, setBioName] = useState('');
  const [bioValue, setBioValue] = useState('');
  const [bioUnit, setBioUnit] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [biometricGoals, setBiometricGoals] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pnl_biometric_goals');
      if (saved) setBiometricGoals(JSON.parse(saved));
    } catch {}
  }, []);

  const setGoal = (metric: string, val: number) => {
    if (isNaN(val)) return;
    const updated = { ...biometricGoals, [metric]: val };
    setBiometricGoals(updated);
    try { localStorage.setItem('pnl_biometric_goals', JSON.stringify(updated)); } catch {}
  };
  
  // UX Features State
  const [activeTab, setActiveTab] = useState<'bundles' | 'favorites' | 'recentlyViewed' | 'inventory' | 'compareHistory' | 'notes' | 'doses' | 'biometrics' | 'goals'>('bundles');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'priceAsc' | 'priceDesc' | 'alpha' | 'frequent'>('recent');
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quickViewItem, setQuickViewItem] = useState<Item | null>(null);
  const [localCartIds, setLocalCartIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(24);
  const [isComparing, setIsComparing] = useState(false);

  // Inventory & Calc State
  const [inventoryData, setInventoryData] = useState<Record<string, { on_hand: number, lot: string, expiration: string }>>({});
  const [reconMg, setReconMg] = useState('5');
  const [reconMl, setReconMl] = useState('2');
  const [reconDose, setReconDose] = useState('250');

  // Scheduler & Injection Sites State
  const [scheduledDoses, setScheduledDoses] = useState<any[]>([]);
  const [scheduleCompound, setScheduleCompound] = useState('');
  const [scheduleAmount, setScheduleAmount] = useState('');
  const [scheduleUnit, setScheduleUnit] = useState('mcg');
  const [scheduleFrequency, setScheduleFrequency] = useState('Every Day');
  const [selectedSite, setSelectedSite] = useState<string>('');

  // Check cart status

  useEffect(() => {
    const checkCart = () => {
      try {
        const storageKey = storefrontSlug ? `pnl_storefront_cart_${storefrontSlug}` : 'pnl_storefront_cart';
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const ids = new Set<string>((parsed.items || []).map((i: any) => i.id));
          setLocalCartIds(ids);
        }
      } catch {}
    };
    checkCart();
    window.addEventListener('storage', checkCart);
    return () => window.removeEventListener('storage', checkCart);
  }, [storefrontSlug]);

  const computedInjectionSites = useMemo(() => {
    const sites: Record<string, number> = {};
    doses.forEach(d => {
      if (d.injection_site && d.dosed_at) {
        const ts = new Date(d.dosed_at).getTime();
        if (!sites[d.injection_site] || ts > sites[d.injection_site]) {
          sites[d.injection_site] = ts;
        }
      }
    });
    return sites;
  }, [doses]);

  useEffect(() => {
    const syncLegacyData = async () => {
      try {
        const savedInv = localStorage.getItem('pnl_inventory_data');
        if (savedInv) {
          const invData = JSON.parse(savedInv);
          for (const [productId, data] of Object.entries<any>(invData)) {
            await fetch('/api/researcher/inventory', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ product_id: productId, on_hand: data.on_hand, lot_number: data.lot, expiration_date: data.expiration })
            });
          }
          localStorage.removeItem('pnl_inventory_data');
        }

        const savedSched = localStorage.getItem('pnl_scheduled_doses');
        if (savedSched) {
          const schedData = JSON.parse(savedSched);
          for (const s of schedData) {
            await fetch('/api/researcher/protocols', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ compound_slug: s.compound, amount: s.amount, unit: s.unit, frequency: s.frequency })
            });
          }
          localStorage.removeItem('pnl_scheduled_doses');
        }
      } catch (e) {
        console.error('Legacy sync failed', e);
      }
    };
    syncLegacyData();
  }, []);

  const updateInventory = async (productId: string, field: string, value: any) => {
    const updated = { ...inventoryData };
    if (!updated[productId]) updated[productId] = { on_hand: 1, lot: '', expiration: '' };
    updated[productId] = { ...updated[productId], [field]: value };
    setInventoryData(updated);
    
    try {
      await fetch('/api/researcher/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_id: productId, 
          on_hand: updated[productId].on_hand,
          lot_number: updated[productId].lot, 
          expiration_date: updated[productId].expiration
        })
      });
    } catch {}
  };

  const addScheduledDose = async () => {
    if (!scheduleCompound || !scheduleAmount) return;
    
    const payload = { compound_slug: scheduleCompound, amount: scheduleAmount, unit: scheduleUnit, frequency: scheduleFrequency };
    try {
      const res = await fetch('/api/researcher/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.protocol) {
        setScheduledDoses(prev => [data.protocol, ...prev]);
        setScheduleCompound(''); setScheduleAmount('');
      }
    } catch {}
  };

  const deleteScheduledDose = async (id: string) => {
    try {
      await fetch('/api/researcher/protocols', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setScheduledDoses(prev => prev.filter(s => s.id !== id));
    } catch {}
  };

  const logInjectionSite = (siteId: string) => {
    // This now just sets selectedSite. The actual saving happens in saveDose.
  };

  // Fetch helpful data and notes
  useEffect(() => {
    fetch('/api/researcher/helpful-data')
      .then(res => res.json())
      .then(data => { if (data.helpfulData) setHelpfulData(data.helpfulData); })
      .catch(console.error);

    fetch('/api/researcher/notes')
      .then(res => res.json())
      .then(data => { if (data.notes) setNotes(data.notes); })
      .catch(console.error);

    fetch('/api/researcher/comparisons')
      .then(res => res.json())
      .then(data => { if (data.comparisons) setComparisons(data.comparisons); })
      .catch(console.error);

    fetch('/api/researcher/doses')
      .then(res => res.json())
      .then(data => { if (data.doses) setDoses(data.doses); })
      .catch(console.error);

    fetch('/api/researcher/biometrics')
      .then(res => res.json())
      .then(data => { if (data.biometrics) setBiometrics(data.biometrics); })
      .catch(console.error);

    fetch('/api/researcher/inventory')
      .then(res => res.json())
      .then(data => { 
        if (data.inventory) {
          const invMap: Record<string, any> = {};
          data.inventory.forEach((i: any) => invMap[i.product_id] = i);
          setInventoryData(invMap);
        }
      })
      .catch(console.error);

    fetch('/api/researcher/protocols')
      .then(res => res.json())
      .then(data => { if (data.protocols) setScheduledDoses(data.protocols); })
      .catch(console.error);

    fetch('/api/researcher/goals')
      .then(res => res.json())
      .then(data => { if (data.goals) setGoals(data.goals); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!intelligenceCompound) {
      setIntelligenceData(null);
      return;
    }
    setIntelligenceData({ loading: true });
    fetch(`/api/researcher/intelligence?slug=${encodeURIComponent(intelligenceCompound)}`)
      .then(res => res.json())
      .then(data => {
        if (data.intelligence) setIntelligenceData(data.intelligence);
        else setIntelligenceData(null);
      })
      .catch(() => setIntelligenceData(null));
  }, [intelligenceCompound]);

  const saveGoal = async () => {
    if (!goalName) return;
    setGoalSaving(true);
    try {
      const res = await fetch('/api/researcher/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_name: goalName, is_active: goals.length === 0 })
      });
      const data = await res.json();
      if (res.ok && data.goal) {
        setGoals(prev => [data.goal, ...prev.map(g => goals.length === 0 ? g : { ...g, is_active: false })]);
        setGoalName('');
        toast.success('Goal saved');
        if (goals.length === 0) {
           fetch('/api/researcher/goals').then(r => r.json()).then(d => { if (d.goals) setGoals(d.goals) });
        }
      }
    } catch {
      toast.error('Failed to save goal');
    } finally {
      setGoalSaving(false);
    }
  };

  const activateGoal = async (id: string) => {
    try {
      await fetch('/api/researcher/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: true })
      });
      setGoals(prev => prev.map(g => ({ ...g, is_active: g.id === id })));
      toast.success('Active goal updated');
    } catch {}
  };

  const deleteGoal = async (id: string) => {
    try {
      await fetch('/api/researcher/goals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setGoals(prev => prev.filter(g => g.id !== id));
      toast.success('Goal deleted');
    } catch {}
  };

  const saveComparison = async (ids: string[]) => {
    try {
      const res = await fetch('/api/researcher/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: ids })
      });
      const data = await res.json();
      if (res.ok && data.comparison) {
        setComparisons(prev => [data.comparison, ...prev]);
      }
    } catch (e) {
      console.error('Failed to save comparison', e);
    }
  };

  const exportJournalToCSV = () => {
    let csv = 'Type,Date,Title/Items,Details\n';
    
    // Add Notes
    notes.forEach(n => {
      csv += `Note,${new Date(n.updated_at).toLocaleDateString()},"${(n.title || 'Journal Entry').replace(/"/g, '""')}","${(n.note_text || '').replace(/"/g, '""')}"\n`;
    });
    
    // Add Comparisons
    comparisons.forEach(c => {
      csv += `Comparison,${new Date(c.created_at).toLocaleDateString()},"Folder: ${(c.folder_name || 'Unsorted').replace(/"/g, '""')} | Items: ${c.product_ids.join(', ')}","${(c.notes || '').replace(/"/g, '""')}"\n`;
    });

    // Add Inventory
    Object.entries(inventoryData).forEach(([pid, data]) => {
      const item = [...favorites, ...pastOrders, ...recentlyViewed, ...catalog].find(i => i.product_id === pid);
      if (item) {
        csv += `Inventory,${new Date().toLocaleDateString()},"${(item.name || '').replace(/"/g, '""')}","On Hand: ${data.on_hand} | Lot: ${data.lot} | Exp: ${data.expiration}"\n`;
      }
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lab_Journal_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Journal Exported To CSV');
  };

  async function removeItem(productId: string) {
    setPendingId(productId);
    try {
      const res = await fetch('/api/researcher/wishlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        startTransition(() => {
          setFavorites(prev => prev.filter(it => it.product_id !== productId));
          const nextSel = new Set(selectedItems);
          nextSel.delete(productId);
          setSelectedItems(nextSel);
        });
      }
    } finally {
      setPendingId(null);
    }
  }

  async function toggleFavorite(item: Item) {
    const isFav = favorites.some(f => f.product_id === item.product_id);
    setPendingId(item.product_id);
    try {
      if (isFav) {
        const res = await fetch('/api/researcher/wishlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ productId: item.product_id }),
        });
        if (res.ok) {
          startTransition(() => {
            setFavorites(prev => prev.filter(f => f.product_id !== item.product_id));
          });
          toast.success('Removed From Saved Compounds');
        }
      } else {
        const res = await fetch('/api/researcher/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ productId: item.product_id }),
        });
        if (res.ok) {
          startTransition(() => {
            setFavorites(prev => [item, ...prev]);
          });
          toast.success('Added To Saved Compounds');
        }
      }
    } catch (e) {
      toast.error('Error updating saved compounds');
    } finally {
      setPendingId(null);
    }
  }

  async function clearRecentlyViewed() {
    if (!confirm('Are You Sure You Want To Clear Your Recently Viewed History?')) return;
    try {
      const res = await fetch('/api/researcher/recently-viewed', { method: 'DELETE' });
      if (res.ok) {
        startTransition(() => {
          setRecentlyViewed([]);
        });
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  // Notes Functions
  const openNewNote = () => {
    setNoteTitle('');
    setNoteText('');
    setNoteCompoundSlug('');
    setEditingNote(null);
    setIsCreatingNote(true);
  };

  const editNote = (n: any) => {
    setNoteTitle(n.title || '');
    setNoteText(n.note_text || '');
    setNoteCompoundSlug(n.compound_slug || '');
    setEditingNote(n);
    setIsCreatingNote(true);
  };

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    try {
      const url = '/api/researcher/notes';
      const method = editingNote ? 'PATCH' : 'POST';
      const body = editingNote 
        ? { id: editingNote.id, title: noteTitle, note_text: noteText, compound_slug: noteCompoundSlug || null } 
        : { title: noteTitle, note_text: noteText, compound_slug: noteCompoundSlug || null };
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.note) {
        if (editingNote) setNotes(prev => prev.map(n => n.id === data.note.id ? data.note : n));
        else setNotes(prev => [data.note, ...prev]);
        setIsCreatingNote(false);
        toast.success(editingNote ? 'Note Updated' : 'Note Saved');
      } else throw new Error(data.error);
    } catch (e) {
      toast.error('Failed To Save Note');
    } finally {
      setNoteSaving(false);
    }
  };

  const generateAiProtocol = async () => {
    if (aiCompounds.length === 0 || !aiGoal.trim()) return;
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/researcher/ai-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compounds: aiCompounds, goal: aiGoal, experienceLevel: aiExperience, subjectMetrics: aiMetrics })
      });
      const data = await res.json();
      if (res.ok && data.note) {
        setNotes(prev => [data.note, ...prev]);
        setShowAiBuilder(false);
        setAiGoal('');
        setAiCompounds([]);
        toast.success('AI Protocol Generated And Saved To Notes!');
      } else throw new Error(data.error);
    } catch (e) {
      toast.error('Failed To Generate Protocol');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Delete This Note?')) return;
    try {
      const res = await fetch('/api/researcher/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== id));
        toast.success('Note Deleted');
      }
    } catch (e) {
      toast.error('Failed To Delete Note');
    }
  };

  const deleteComparison = async (id: string) => {
    if (!confirm('Delete This Saved Comparison?')) return;
    try {
      const res = await fetch('/api/researcher/comparisons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setComparisons(c => c.filter(x => x.id !== id));
        toast.success('Comparison Deleted');
      } else {
        toast.error('Failed To Delete Comparison');
      }
    } catch {
      toast.error('Error Deleting Comparison');
    }
  };

  const saveDose = async () => {
    if (!doseCompound || !doseAmount) return;
    setDoseSaving(true);
    try {
      const payload = {
        compound_slug: doseCompound,
        dose_amount: parseFloat(doseAmount),
        unit: doseUnit,
        dosed_at: new Date().toISOString(),
        injection_site: selectedSite
      };
      
      const res = await fetch('/api/researcher/doses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok && data.dose) {
        setDoses(prev => [data.dose, ...prev]);
        setDoseAmount('');
        setSelectedSite('');
        toast.success('Dose logged!');
      } else throw new Error(data.error || 'Failed to log dose');
    } catch (e) {
      toast.error('Failed To Log Dose');
    } finally {
      setDoseSaving(false);
    }
  };

  const deleteDose = async (id: string) => {
    if (!confirm('Delete This Dose Log?')) return;
    try {
      const res = await fetch('/api/researcher/doses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setDoses(prev => prev.filter(d => d.id !== id));
        toast.success('Dose Deleted');
      } else {
        toast.error('Failed To Delete Dose');
      }
    } catch {
      toast.error('Error Deleting Dose');
    }
  };

  const saveBiometric = async () => {
    if (!bioName || !bioValue) return;
    setBioSaving(true);
    try {
      const res = await fetch('/api/researcher/biometrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric_name: bioName, metric_value: parseFloat(bioValue), unit: bioUnit })
      });
      const data = await res.json();
      if (res.ok && data.biometric) {
        setBiometrics(prev => [...prev, data.biometric]);
        setBioValue('');
        toast.success('Biometric Logged');
      } else throw new Error(data.error);
    } catch (e) {
      toast.error('Failed To Log Biometric');
    } finally {
      setBioSaving(false);
    }
  };

  const deleteBiometric = async (id: string) => {
    if (!confirm('Delete This Biometric Log?')) return;
    try {
      const res = await fetch('/api/researcher/biometrics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setBiometrics(prev => prev.filter(b => b.id !== id));
        toast.success('Biometric Deleted');
      } else {
        toast.error('Failed To Delete Biometric');
      }
    } catch {
      toast.error('Error Deleting Biometric');
    }
  };

  const renderCombinedChart = (metric: string) => {
    // Group by day string
    const byDay: Record<string, any> = {};
    let hasData = false;
    
    if (metric !== 'Doses Only') {
      const mData = biometrics.filter(b => b.metric_name === metric).sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
      mData.forEach(m => {
        const day = new Date(m.measured_at).toLocaleDateString();
        if (!byDay[day]) byDay[day] = { date: day };
        byDay[day][metric] = m.metric_value;
        hasData = true;
      });
    }
    
    // Also include doses in the same chart
    doses.forEach(d => {
      const day = new Date(d.dosed_at).toLocaleDateString();
      if (!byDay[day]) byDay[day] = { date: day };
      byDay[day][d.compound_slug] = (byDay[day][d.compound_slug] || 0) + d.dose_amount;
      hasData = true;
    });

    const chartData = Object.values(byDay).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!hasData || chartData.length === 0) return null;
    
    const compoundsPresent = Array.from(new Set(doses.map(d => d.compound_slug)));
    const colors = ['#00E5FF', '#F6AD55', '#68D391', '#D6BCFA', '#FC8181'];
    const goal = metric !== 'Doses Only' ? biometricGoals[metric] : undefined;

    return (
      <div key={metric} style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
           <h3 style={{ color: 'var(--white)', margin: 0 }}>Protocol Correlation: {metric}</h3>
           {metric !== 'Doses Only' && (
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <span style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>Target Goal:</span>
               <input 
                 type="number" 
                 placeholder="Set Goal"
                 value={goal || ''}
                 onChange={e => setGoal(metric, parseFloat(e.target.value))}
                 style={{ width: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4, color: 'var(--white)', fontSize: '0.9rem' }}
               />
             </div>
           )}
        </div>
        <div style={{ width: '100%', height: 350, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 'var(--space-4)', position: 'relative' }}>
          {goal && (
             <div style={{ position: 'absolute', top: 10, left: 20, zIndex: 10, color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                Active Target: {goal}
             </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{fill: 'var(--silver)', fontSize: 11}} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="rgba(255,255,255,0.3)" tick={{fill: 'var(--silver)', fontSize: 11}} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" tick={{fill: 'var(--silver)', fontSize: 11}} tickLine={false} axisLine={false} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#1A202C', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }} 
                itemStyle={{ color: '#fff', fontSize: '0.9rem' }} 
                labelStyle={{ color: 'var(--silver)', marginBottom: 4 }}
              />
              <Legend wrapperStyle={{ paddingTop: 10, fontSize: '0.85rem', color: 'var(--silver)' }} />
              
              {goal && <ReferenceLine yAxisId="left" y={goal} stroke="var(--teal)" strokeDasharray="4 4" />}
              
              {metric !== 'Doses Only' && (
                <Line yAxisId="left" type="monotone" name={`${metric} Trend`} dataKey={metric} stroke="var(--white)" strokeWidth={3} dot={{r: 4, fill: '#1A202C', stroke: 'var(--white)', strokeWidth: 2}} activeDot={{r: 6}} connectNulls />
              )}
              
              {compoundsPresent.map((cmp, idx) => (
                <Bar key={cmp} yAxisId={metric !== 'Doses Only' ? "right" : "left"} name={`${cmp} Dose`} dataKey={cmp} fill={colors[idx % colors.length]} opacity={0.6} radius={[4,4,0,0]} barSize={20} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderGanttChart = () => {
    if (pastOrders.length === 0) return null;
    
    // Sort orders by purchase date
    const orders = [...pastOrders].filter(o => o.last_purchased_date).sort((a, b) => new Date(a.last_purchased_date!).getTime() - new Date(b.last_purchased_date!).getTime());
    if (orders.length === 0) return null;

    const earliestDate = new Date(orders[0].last_purchased_date!).getTime();
    const latestOrderDate = new Date(orders[orders.length - 1].last_purchased_date!).getTime();
    // End date is 8 weeks after the latest order
    const latestDate = latestOrderDate + (8 * 7 * 24 * 60 * 60 * 1000);
    // totalDuration intentionally removed (unused; clampedTotalDuration is used instead)

    // We don't want to show years of history on a small chart, so clamp to the last 6 months if needed
    const minTime = Math.max(earliestDate, new Date().getTime() - (180 * 24 * 60 * 60 * 1000));
    const clampedTotalDuration = latestDate - minTime;

    return (
      <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Layers size={20} color="var(--teal)" />
          <h3 style={{ margin: 0, color: 'var(--white)' }}>Interactive Cycle Timeline (8-Week Lifecycle)</h3>
        </div>
        <div style={{ position: 'relative', padding: '10px 0', minHeight: 100 }}>
          {/* Today Line */}
          <div style={{ position: 'absolute', left: `${Math.max(0, ((new Date().getTime() - minTime) / clampedTotalDuration) * 100)}%`, top: 0, bottom: 0, width: 2, background: 'rgba(255,100,100,0.5)', zIndex: 0 }} />
          
          {orders.filter(o => new Date(o.last_purchased_date!).getTime() >= minTime).map((order, i) => {
             const start = new Date(order.last_purchased_date!).getTime();
             const end = start + (8 * 7 * 24 * 60 * 60 * 1000); // 8 weeks
             const leftPct = ((start - minTime) / clampedTotalDuration) * 100;
             const widthPct = ((end - start) / clampedTotalDuration) * 100;
             
             const isActive = start <= new Date().getTime() && end >= new Date().getTime();

             return (
               <div key={order.product_id + i} style={{ marginBottom: 12, position: 'relative', height: 28 }}>
                 <div style={{ 
                   position: 'absolute', 
                   left: `${Math.max(0, leftPct)}%`, 
                   width: `${Math.min(100 - leftPct, widthPct)}%`, 
                   height: '100%', 
                   background: isActive ? 'linear-gradient(90deg, rgba(0, 229, 255, 0.2), rgba(0, 229, 255, 0.8))' : 'rgba(255,255,255,0.1)',
                   borderRadius: 4,
                   display: 'flex',
                   alignItems: 'center',
                   padding: '0 8px',
                   border: isActive ? '1px solid var(--teal)' : '1px solid rgba(255,255,255,0.05)',
                   whiteSpace: 'nowrap',
                   overflow: 'hidden',
                   textOverflow: 'ellipsis',
                   fontSize: '0.75rem',
                   color: isActive ? 'var(--white)' : 'var(--silver)',
                   zIndex: 1
                 }} title={`${order.name}\nPurchased: ${new Date(start).toLocaleDateString()}\nEst. End: ${new Date(end).toLocaleDateString()}`}>
                    {order.name}
                 </div>
               </div>
             );
          })}
          {/* Axis Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 16 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--silver)' }}>{new Date(minTime).toLocaleDateString()}</span>
            <span style={{ fontSize: '0.75rem', color: '#FF6464' }}>Today</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--silver)' }}>{new Date(latestDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  };

  function handleQuickAdd(item: Item, qty = 1, silent = false) {
    try {
      const storageKey = storefrontSlug ? `pnl_storefront_cart_${storefrontSlug}` : 'pnl_storefront_cart';
      const rawCart = localStorage.getItem(storageKey);
      let pnlCart = { items: [] as any[], _savedAt: Date.now() };
      if (rawCart) {
        try { pnlCart = JSON.parse(rawCart); } catch {}
      }

      const existing = pnlCart.items.find((i: any) => i.id === item.product_id);
      if (existing) {
        existing.quantity += qty;
      } else {
        const perVial = item.retail_price ?? item.base_cost ?? 0;
        pnlCart.items.push({
          id: item.product_id,
          name: `${item.name} ${item.unit_size ? `(${item.unit_size}${item.unit_measure || ''})` : ''}`.trim(),
          sku: item.product_id,
          quantity: qty,
          retailPrice: perVial,
          costPrice: perVial,
          weightOz: 0.5,
          agentSelfBuy: false,
        });
      }

      pnlCart._savedAt = Date.now();
      localStorage.setItem(storageKey, JSON.stringify(pnlCart));

      if (item.agent_product_id) {
        const gridKey = `cart_${storefrontSlug}`;
        const rawGrid = localStorage.getItem(gridKey);
        let gridMap: Record<string, number> = {};
        if (rawGrid) {
          try { gridMap = JSON.parse(rawGrid) || {}; } catch {}
        }
        gridMap[item.agent_product_id] = (gridMap[item.agent_product_id] || 0) + qty;
        localStorage.setItem(gridKey, JSON.stringify(gridMap));
      }

      window.dispatchEvent(new Event('storage'));
      
      const nextIds = new Set(localCartIds);
      nextIds.add(item.product_id);
      setLocalCartIds(nextIds);
      
      if (!silent) {
        toast.success(`Added ${item.name} to Cart`);
      }
    } catch (err) {
      console.error('Failed to quick add:', err);
    }
  }

  function handleBulkAdd() {
    if (selectedItems.size === 0) return;
    const baseItems = activeTab === 'favorites' ? favorites : activeTab === 'inventory' ? pastOrders : activeTab === 'bundles' ? bundles : recentlyViewed;
    const toAdd = baseItems.filter(i => selectedItems.has(i.product_id) && i.in_stock !== false);
    if (toAdd.length === 0) return;
    
    toAdd.forEach(i => handleQuickAdd(i, 1, true));
    setSelectedItems(new Set());
    toast.success(`Added ${toAdd.length} Items To Cart`);
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  }

  // Derived Data
  let currentItems = activeTab === 'favorites' ? favorites : activeTab === 'inventory' ? pastOrders : activeTab === 'bundles' ? bundles : activeTab === 'recentlyViewed' ? recentlyViewed : [];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    currentItems = currentItems.filter(i => i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
  }
  if (filterCategory !== 'all') {
    currentItems = currentItems.filter(i => i.category === filterCategory);
  }

  currentItems = [...currentItems].sort((a, b) => {
    if (sortBy === 'priceAsc') return (a.retail_price || 0) - (b.retail_price || 0);
    if (sortBy === 'priceDesc') return (b.retail_price || 0) - (a.retail_price || 0);
    if (sortBy === 'alpha') return a.name.localeCompare(b.name);
    if (sortBy === 'frequent' && activeTab === 'inventory') return (b.purchase_count || 0) - (a.purchase_count || 0);
    return 0; // recent/default
  });

  const visibleItems = currentItems.slice(0, visibleCount);

  const shouldGroup = viewMode === 'grid' && filterCategory === 'all' && sortBy === 'recent' && !searchQuery;

  const groupedItems = shouldGroup ? visibleItems.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, Item[]>) : { 'All': visibleItems };

  const renderEmptyState = () => (
    <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {activeTab === 'favorites' ? (
        <Heart size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      ) : activeTab === 'inventory' ? (
        <PackageOpen size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      ) : activeTab === 'bundles' ? (
        <Layers size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      ) : (
        <History size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      )}
      <h2 style={{ color: 'var(--white)', fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>
        {activeTab === 'favorites' ? 'Your Wishlist Is Empty' : activeTab === 'inventory' ? 'No Inventory Found' : activeTab === 'bundles' ? 'No Bundles Found' : 'Nothing Here Yet'}
      </h2>
      <p style={{ color: 'var(--silver)', fontSize: '0.95rem', maxWidth: 400 }}>
        {activeTab === 'favorites' ? 'Tap the heart icon on any product to save it here for later.' : 
         activeTab === 'inventory' ? 'Items you purchase will appear here. Manage your stock and usage.' : 
         activeTab === 'bundles' ? 'Bundles and stacks curated for optimal results will appear here.' :
         activeTab === 'compareHistory' ? 'Compounds you have compared will appear here.' :
         activeTab === 'notes' ? 'Your personal lab journal notes will appear here.' :
         activeTab === 'goals' ? 'Create a research goal to focus your studies and receive intelligent recommendations.' :
         'Browse products on a storefront and they will magically appear here.'}
      </p>
      {storefrontSlug && (
        <Link href={`/${storefrontSlug}`} className="btn btn-primary" style={{ marginTop: 'var(--space-6)', padding: '12px 24px' }}>
          Explore The Catalog
        </Link>
      )}
    </div>
  );

  const renderItemCard = (item: Item, index: number) => {
    const displayPrice = item.retail_price ?? item.base_cost ?? 0;
    const inCart = localCartIds.has(item.product_id);
    const isSelected = selectedItems.has(item.product_id);

    return (
      <div
        key={item.product_id}
        className="glass-panel hover-lift stagger-fade-in"
        style={{
          display: 'flex',
          flexDirection: viewMode === 'grid' ? 'column' : 'row',
          overflow: 'hidden',
          padding: 0,
          borderRadius: 'var(--radius-lg)',
          animationDelay: `${Math.min(index * 0.05, 0.5)}s`,
          border: isSelected ? '1px solid var(--teal)' : undefined,
          boxShadow: isSelected ? '0 0 0 1px var(--teal)' : undefined,
          transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          cursor: 'pointer',
        }}
        onClick={(e) => {
          // If clicking a button, ignore
          if ((e.target as HTMLElement).closest('button, a')) return;
          setQuickViewItem(item);
        }}
      >
        <div
          style={{
            height: viewMode === 'grid' ? 160 : 100,
            width: viewMode === 'list' ? 100 : 'auto',
            background: 'radial-gradient(circle at 50% 50%, rgba(192,184,168,0.10) 0%, var(--black) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', flexShrink: 0, overflow: 'hidden'
          }}
        >
          <Image
            src={item.image_url || getProductImage(null, item.category || 'Other', item.name)}
            alt={item.name}
            fill
            unoptimized
            style={{ objectFit: 'cover', transition: 'transform 0.4s' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const fallback = getProductImage(null, item.category || 'Other', item.name);
              if (target.src !== fallback) target.src = fallback;
            }}
          />
          
          {/* Checkbox Overlay */}
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }} onClick={e => { e.stopPropagation(); toggleSelection(item.product_id); }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.4)', background: isSelected ? 'var(--teal)' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isSelected && <Check size={14} color="var(--black)" />}
            </div>
          </div>

          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', zIndex: 2 }}>
            {inCart && (
              <Image src="/images/badges/badge_in_cart.png" alt="In Cart" width={22} height={22} unoptimized style={{ borderRadius: 9999, overflow: 'hidden', objectFit: 'contain' }} />
            )}
            {item.is_on_sale && (
              <Image src="/images/badges/badge_price_drop.png" alt="Price Drop" width={22} height={22} unoptimized style={{ borderRadius: 9999, overflow: 'hidden', objectFit: 'contain' }} />
            )}
            {activeTab === 'inventory' && item.purchase_count && item.purchase_count > 1 && sortBy === 'frequent' && (
              <div style={{ background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.5)', color: '#EAB308', padding: '2px 8px', borderRadius: 12, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', backdropFilter: 'blur(4px)' }}>
                Ordered {item.purchase_count}x
              </div>
            )}
          </div>
          
          {item.in_stock === false && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'grayscale(100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
              <Image src="/images/badges/badge_out_of_stock.png" alt="Out of Stock" width={80} height={26} unoptimized style={{ borderRadius: 9999, overflow: 'hidden', objectFit: 'contain' }} />
            </div>
          )}

          {/* Heart Icon Overlay */}
          <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 10 }}>
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item); }} disabled={pendingId === item.product_id} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: pendingId === item.product_id ? 0.5 : 1 }}>
              <Heart size={16} color={favorites.some(f => f.product_id === item.product_id) ? 'var(--red)' : 'var(--silver)'} fill={favorites.some(f => f.product_id === item.product_id) ? 'var(--red)' : 'none'} />
            </button>
          </div>
        </div>

        <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, whiteSpace: viewMode === 'list' ? 'nowrap' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </div>
          <div style={{ color: 'var(--silver)', fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2 }}>
            {item.category || 'Compound'} {item.unit_size && `• ${item.unit_size}${item.unit_measure}`}
          </div>
          
          {activeTab === 'inventory' && (
            <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--silver)' }}>On Hand:</span>
                <input type="number" value={inventoryData[item.product_id]?.on_hand ?? 0} onChange={e => updateInventory(item.product_id, 'on_hand', parseInt(e.target.value) || 0)} style={{ width: 60, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '2px 6px', borderRadius: 4, textAlign: 'right' }} onClick={e => e.stopPropagation()} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--silver)' }}>Lot #:</span>
                <input type="text" placeholder="e.g. 1A2B" value={inventoryData[item.product_id]?.lot ?? ''} onChange={e => updateInventory(item.product_id, 'lot', e.target.value)} style={{ width: 90, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '2px 6px', borderRadius: 4, textAlign: 'right' }} onClick={e => e.stopPropagation()} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--silver)' }}>Expires:</span>
                <input type="month" value={inventoryData[item.product_id]?.expiration ?? ''} onChange={e => updateInventory(item.product_id, 'expiration', e.target.value)} style={{ width: 110, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '2px 6px', borderRadius: 4, textAlign: 'right' }} onClick={e => e.stopPropagation()} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: viewMode === 'grid' ? 'auto' : 4, paddingTop: viewMode === 'grid' ? 'var(--space-3)' : 0 }}>
            {displayPrice > 0 ? (
              <div style={{ color: 'var(--teal)', fontWeight: 800, fontSize: '1.05rem', fontFamily: 'var(--font-brand)' }}>
                ${displayPrice.toFixed(2)}
              </div>
            ) : <div/>}
            {viewMode === 'list' && (
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {storefrontSlug && (
                  <>
                    <Link href={`/${storefrontSlug}?product=${encodeURIComponent(item.product_id)}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 12px' }}>View</Link>
                    <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(item); }} disabled={item.in_stock === false} className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }}>Add</button>
                  </>
                )}
                {activeTab === 'favorites' && (
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.product_id); }} disabled={pendingId === item.product_id} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--red)' }}><Trash2 size={14}/></button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Top Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-2)', flex: 1, minWidth: 0 }}>
          {[
            { id: 'goals', label: 'Research Goals', icon: Target },
            { id: 'notes', label: 'My Notes', icon: Info },
            { id: 'bundles', label: 'Bundles & Stacks', icon: Layers },
            { id: 'favorites', label: 'Saved Compounds', icon: Heart },
            { id: 'inventory', label: 'Inventory', icon: PackageOpen },
            { id: 'doses', label: 'Dose Tracker', icon: Layers },
            { id: 'biometrics', label: 'Biometrics', icon: Layers },
            { id: 'recentlyViewed', label: 'Recently Viewed', icon: History },
            { id: 'compareHistory', label: 'Compare History', icon: Search }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id as any); setShowBuilder(false); setSelectedItems(new Set()); }}
              style={{
                background: 'none', border: 'none',
                color: activeTab === t.id ? 'var(--teal)' : 'var(--silver)',
                fontWeight: activeTab === t.id ? 'bold' : 'normal',
                padding: 'var(--space-2) var(--space-4)',
                cursor: 'pointer', whiteSpace: 'nowrap',
                borderBottom: activeTab === t.id ? '2px solid var(--teal)' : '2px solid transparent',
                transition: 'all 0.2s ease', fontSize: '0.95rem',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
        <button onClick={exportJournalToCSV} className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap', borderRadius: 20, flexShrink: 0 }}>
          Export Journal to CSV
        </button>
      </div>

      {activeTab === 'bundles' && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <button 
            className={`btn ${!showBuilder ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowBuilder(false)}
            style={{ borderRadius: 20, padding: '8px 24px' }}
          >
            Pre-Built Famous Stacks
          </button>
          <button 
            className={`btn ${showBuilder ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowBuilder(true)}
            style={{ borderRadius: 20, padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FlaskConical size={16} /> Experiment & Build Custom
          </button>
        </div>
      )}

      {/* Main Content */}
      {activeTab === 'bundles' && showBuilder ? (
        <SmartStackBuilder 
          catalog={catalog} 
          onAddStackToCart={(items, name) => {
            items.forEach(i => handleQuickAdd(i, 1, true));
            toast.success(`Custom Stack "${name}" Added To Cart!`);
          }} 
        />
      ) : (
        <>
          <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', padding: 'var(--space-3)', marginBottom: 'var(--space-6)', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)' }} />
              <input 
                type="text" 
                placeholder="Search Journal..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px 8px 34px', borderRadius: 8, color: 'var(--white)', fontSize: '0.9rem' }}
              />
              {searchQuery && <X size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
            </div>
            
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
              <option value="recent">Recently Added</option>
              <option value="priceAsc">Price: Low to High</option>
              <option value="priceDesc">Price: High to Low</option>
              <option value="alpha">Alphabetical</option>
              {activeTab === 'inventory' && <option value="frequent">Most Frequently Ordered</option>}
            </select>

            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => setViewMode('grid')} style={{ padding: '8px 12px', background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: viewMode === 'grid' ? 'var(--white)' : 'var(--silver)', cursor: 'pointer' }}><LayoutGrid size={16} /></button>
              <button onClick={() => setViewMode('list')} style={{ padding: '8px 12px', background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: viewMode === 'list' ? 'var(--white)' : 'var(--silver)', cursor: 'pointer' }}><ListIcon size={16} /></button>
            </div>
          </div>

          {currentItems.length === 0 && activeTab !== 'notes' && activeTab !== 'compareHistory' && activeTab !== 'doses' && activeTab !== 'biometrics' && activeTab !== 'goals' ? renderEmptyState() : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {activeTab === 'inventory' && (
                <>
                  <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
                    <div style={{ flex: '1 1 300px' }}>
                      <h3 style={{ color: 'var(--teal)', marginBottom: 'var(--space-2)' }}>Reconstitution Calculator</h3>
                      <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>Calculate your syringe pull (units) based on vial size and bac water added.</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Vial Size (mg)</label>
                          <input type="number" value={reconMg} onChange={e => setReconMg(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Bac Water Added (ml)</label>
                          <input type="number" value={reconMl} onChange={e => setReconMl(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Desired Dose (mcg)</label>
                          <input type="number" value={reconDose} onChange={e => setReconDose(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,196,188,0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0,196,188,0.2)', padding: 'var(--space-4)' }}>
                      <div style={{ color: 'var(--silver)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: 8 }}>Pull Syringe To</div>
                      <div style={{ color: 'var(--teal)', fontSize: '3rem', fontWeight: 800, lineHeight: 1, textShadow: '0 0 20px rgba(0,196,188,0.3)' }}>
                        {(() => {
                          const mg = parseFloat(reconMg); const ml = parseFloat(reconMl); const dose = parseFloat(reconDose);
                          if (!mg || !ml || !dose) return '0.0';
                          return ((dose * ml * 100) / (mg * 1000)).toFixed(1);
                        })()}
                      </div>
                      <div style={{ color: 'var(--white)', fontSize: '1.2rem', marginTop: 4 }}>Units (IU)</div>
                      <div style={{ color: 'var(--silver)', fontSize: '0.7rem', marginTop: 8, opacity: 0.6 }}>*Assuming standard U-100 syringe</div>
                    </div>
                  </div>

                  {renderGanttChart()}
                  {helpfulData && (
                    <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                      <h3 style={{ color: 'var(--teal)', marginBottom: 'var(--space-2)' }}>Personalized Research Insights</h3>
                      <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>{helpfulData.message}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
                        {helpfulData.insights?.map((insight: any, i: number) => (
                          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ color: 'var(--white)', fontWeight: 'bold', marginBottom: 'var(--space-1)' }}>{insight.compoundName}</div>
                            <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>{insight.insightText}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {activeTab === 'goals' ? (
                <div>
                  <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                    <h2 style={{ color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-2)' }}>
                      <Target size={24} /> Set Your Research Goal
                    </h2>
                    <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Define your primary objective to tailor your lab journal and unlock intelligent compound recommendations.</p>
                    
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <input 
                        type="text" 
                        placeholder="e.g. Muscle Growth, Injury Repair, Cognitive Enhancement" 
                        value={goalName} 
                        onChange={e => setGoalName(e.target.value)}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                      />
                      <button onClick={saveGoal} disabled={!goalName.trim() || goalSaving} className="btn btn-primary" style={{ padding: '8px 24px', whiteSpace: 'nowrap' }}>
                        {goalSaving ? 'Saving...' : 'Add Goal'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <h3 style={{ color: 'var(--white)', marginTop: 'var(--space-2)' }}>Your Active & Past Goals</h3>
                    {goals.length === 0 ? renderEmptyState() : goals.map(g => (
                      <div key={g.id} className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', position: 'relative', border: g.is_active ? '1px solid var(--teal)' : '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
                          {!g.is_active && <button onClick={() => activateGoal(g.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--teal)' }}>Set Active</button>}
                          <button onClick={() => deleteGoal(g.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--red)' }}><Trash2 size={16}/></button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--space-2)' }}>
                          <h4 style={{ margin: 0, fontSize: '1.2rem', color: g.is_active ? 'var(--white)' : 'var(--silver)' }}>{g.goal_name}</h4>
                          {g.is_active && <span style={{ background: 'var(--teal)', color: 'var(--black)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 'bold' }}>ACTIVE</span>}
                        </div>
                        <p style={{ margin: 0, color: 'var(--silver)', fontSize: '0.9rem' }}>Created: {new Date(g.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : activeTab === 'notes' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <button onClick={() => setShowAiBuilder(!showAiBuilder)} className="btn btn-secondary" style={{ padding: '8px 20px', borderRadius: 20 }}>{showAiBuilder ? 'Hide AI Builder' : 'Use AI Builder'}</button>
                    <button onClick={openNewNote} className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: 20 }}>+ Add New Note</button>
                  </div>
                  
                  {showAiBuilder ? (
                    <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
                      <h2 style={{ color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-2)' }}>
                        <Zap size={24} /> Generate 12-Week Protocol
                      </h2>
                      <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-6)' }}>Our AI will generate a structured week-by-week schedule, safety notes, and milestones.</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', marginBottom: 8 }}>Primary Goal</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Tendon Repair and Inflammation Reduction" 
                            value={aiGoal} 
                            onChange={e => setAiGoal(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', marginBottom: 8 }}>Select Compounds</label>
                          <select 
                            multiple
                            value={aiCompounds} 
                            onChange={e => setAiCompounds(Array.from(e.target.selectedOptions, option => option.value))}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem', height: 120 }}
                          >
                            {Array.from(new Set([...favorites, ...pastOrders, ...recentlyViewed].filter(i => i.name).map(i => i.name))).map(slug => (
                              <option key={slug as string} value={slug as string}>{slug}</option>
                            ))}
                          </select>
                          <p style={{ fontSize: '0.8rem', color: 'var(--silver)', marginTop: 4 }}>Hold Cmd/Ctrl to select multiple.</p>
                        </div>
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', marginBottom: 8 }}>Experience Level</label>
                          <select 
                            value={aiExperience} 
                            onChange={e => setAiExperience(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                          >
                            <option value="Beginner">Beginner (First Time Researcher)</option>
                            <option value="Intermediate">Intermediate (1-3 Years)</option>
                            <option value="Advanced">Advanced (3+ Years)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', marginBottom: 8 }}>Subject Metrics (Optional)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 180lbs, 15% body fat, age 35 male" 
                            value={aiMetrics} 
                            onChange={e => setAiMetrics(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                          <button onClick={() => setShowAiBuilder(false)} className="btn btn-ghost" style={{ color: 'var(--silver)' }}>Cancel</button>
                          <button onClick={generateAiProtocol} disabled={aiCompounds.length === 0 || !aiGoal.trim() || isGeneratingAi} className="btn btn-primary" style={{ padding: '8px 24px', background: 'var(--teal)', color: 'var(--black)' }}>
                            {isGeneratingAi ? 'Generating...' : 'Generate AI Protocol'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : isCreatingNote ? (
                    <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
                      <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>{editingNote ? 'Edit Note' : 'New Lab Note'}</h2>
                      
                      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                        <input 
                          type="text" 
                          placeholder="Note Title (Optional)" 
                          value={noteTitle} 
                          onChange={e => setNoteTitle(e.target.value)}
                          style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                        />
                        <select 
                          value={noteCompoundSlug} 
                          onChange={e => setNoteCompoundSlug(e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem', width: 200 }}
                        >
                          <option value="">No Compound Tag</option>
                          {Array.from(new Set([...favorites, ...pastOrders, ...recentlyViewed].filter(i => i.name).map(i => i.name))).map(slug => (
                            <option key={slug as string} value={slug as string}>{slug}</option>
                          ))}
                        </select>
                      </div>
                      
                      <textarea 
                        placeholder="Write your research notes, protocol logs, or observations here..." 
                        value={noteText} 
                        onChange={e => setNoteText(e.target.value)}
                        rows={8}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', marginBottom: 'var(--space-4)', fontSize: '1rem', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                        <button onClick={() => setIsCreatingNote(false)} className="btn btn-ghost" style={{ color: 'var(--silver)' }}>Cancel</button>
                        <button onClick={saveNote} disabled={!noteText.trim() || noteSaving} className="btn btn-primary" style={{ padding: '8px 24px' }}>
                          {noteSaving ? 'Saving...' : 'Save Note'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                    {notes.length === 0 && !isCreatingNote && !showAiBuilder ? renderEmptyState() : notes.map(n => (
                      <div key={n.id} className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
                          <button onClick={() => editNote(n)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--silver)' }}>Edit</button>
                          <button onClick={() => deleteNote(n.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--red)' }}><Trash2 size={16}/></button>
                        </div>
                        {n.compound_slug && (
                          <div style={{ display: 'inline-block', background: 'rgba(0,196,188,0.1)', color: 'var(--teal)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', marginBottom: 'var(--space-2)' }}>
                            #{n.compound_slug}
                          </div>
                        )}
                        <h3 style={{ color: 'var(--white)', paddingRight: 80 }}>{n.title || 'Journal Entry'}</h3>
                        <p style={{ color: 'var(--silver)', whiteSpace: 'pre-wrap', marginTop: 'var(--space-3)' }}>{n.note_text}</p>
                        <div style={{ marginTop: 'var(--space-4)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', paddingTop: 'var(--space-2)' }}>
                          Last updated: {new Date(n.updated_at).toLocaleDateString()} at {new Date(n.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              ) : activeTab === 'doses' ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                    <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
                      <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)' }}>Log a Dose</h2>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select 
                          value={doseCompound} 
                          onChange={e => {
                            const cmp = e.target.value;
                            setDoseCompound(cmp);
                            const lastDose = doses.find(d => d.compound_slug === cmp);
                            if (lastDose) {
                              setDoseAmount(lastDose.dose_amount.toString());
                              setDoseUnit(lastDose.unit);
                            } else {
                              setDoseAmount('');
                            }
                          }}
                          style={{ flex: 1, minWidth: 200, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                        >
                          <option value="">Select Compound</option>
                          {Array.from(new Set([...favorites, ...pastOrders, ...recentlyViewed].filter(i => i.name).map(i => i.name))).map(slug => (
                            <option key={slug as string} value={slug as string}>{slug}</option>
                          ))}
                        </select>
                        <input 
                          type="number" 
                          placeholder="Amount" 
                          value={doseAmount} 
                          onChange={e => setDoseAmount(e.target.value)}
                          style={{ width: 120, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                        />
                        <select 
                          value={doseUnit} 
                          onChange={e => setDoseUnit(e.target.value)}
                          style={{ width: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                        >
                          <option value="mcg">mcg</option>
                          <option value="mg">mg</option>
                          <option value="iu">IU</option>
                          <option value="ml">ml</option>
                        </select>
                        <button onClick={saveDose} disabled={!doseCompound || !doseAmount || doseSaving || !selectedSite} className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: 8, flexGrow: 1 }}>
                          {doseSaving ? 'Saving...' : 'Log'}
                        </button>
                      </div>
                      {!selectedSite && <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: 8 }}>* Please select an injection site from the visualizer to log a dose.</div>}
                      
                      <h3 style={{ color: 'var(--white)', marginTop: 'var(--space-6)' }}>Protocol Correlation Graph</h3>
                      {biometrics.length > 0 
                         ? Array.from(new Set(biometrics.map(b => b.metric_name))).map(metric => renderCombinedChart(metric))
                         : renderCombinedChart('Doses Only')}
                    </div>

                    <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                      <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>Injection Site Rotation</h3>
                      <div style={{ position: 'relative', width: 200, height: 350, background: 'rgba(255,255,255,0.02)', borderRadius: 12, margin: '0 auto', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <path d="M50 5 a8 8 0 1 0 0 16 a8 8 0 1 0 0 -16 z M30 25 q20 -10 40 0 l10 30 l-10 -5 l-10 45 l-10 0 l0 -30 l0 30 l-10 0 l-10 -45 l-10 5 z" fill="rgba(0,196,188,0.05)" stroke="rgba(0,196,188,0.3)" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
                        </svg>
                        {[
                          { id: 'left_arm', x: 25, y: 35, label: 'L Arm' }, { id: 'right_arm', x: 75, y: 35, label: 'R Arm' },
                          { id: 'left_abdomen', x: 40, y: 50, label: 'L Abdomen' }, { id: 'right_abdomen', x: 60, y: 50, label: 'R Abdomen' },
                          { id: 'left_thigh', x: 35, y: 75, label: 'L Thigh' }, { id: 'right_thigh', x: 65, y: 75, label: 'R Thigh' },
                          { id: 'left_glute', x: 40, y: 65, label: 'L Glute (Back)' }, { id: 'right_glute', x: 60, y: 65, label: 'R Glute (Back)' }
                        ].map(site => {
                          const lastUsed = computedInjectionSites[site.id];
                          const daysSince = lastUsed ? (Date.now() - lastUsed) / 86400000 : Infinity;
                          let color = 'rgba(255,255,255,0.3)';
                          if (daysSince < 2) color = 'var(--red)';
                          else if (daysSince < 5) color = '#eab308';
                          else if (lastUsed) color = 'var(--teal)';
                          return (
                            <div key={site.id} onClick={() => { setSelectedSite(site.id); logInjectionSite(site.id); }} style={{ position: 'absolute', left: `${site.x}%`, top: `${site.y}%`, transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: color, border: selectedSite === site.id ? '2px solid white' : '1px solid rgba(0,0,0,0.5)', cursor: 'pointer', boxShadow: '0 0 10px rgba(0,0,0,0.5)', transition: 'all 0.2s' }} title={`${site.label} ${lastUsed ? `(${Math.round(daysSince)} days ago)` : '(Never)'}`} />
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16, fontSize: '0.75rem', color: 'var(--silver)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }}/> &lt;2d</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }}/> 2-5d</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)' }}/> &gt;5d</div>
                      </div>
                      {selectedSite && <div style={{ textAlign: 'center', marginTop: 12, color: 'var(--white)', fontWeight: 'bold' }}>Selected: {selectedSite.replace('_', ' ').toUpperCase()}</div>}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                    <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>Protocol Scheduler</h3>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                      <select value={scheduleCompound} onChange={e => setScheduleCompound(e.target.value)} style={{ flex: 1, minWidth: 200, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)' }}>
                        <option value="">Select Compound</option>
                        {Array.from(new Set([...favorites, ...pastOrders, ...recentlyViewed].filter(i => i.name).map(i => i.name))).map(slug => (<option key={slug as string} value={slug as string}>{slug}</option>))}
                      </select>
                      <input type="number" placeholder="Amount" value={scheduleAmount} onChange={e => setScheduleAmount(e.target.value)} style={{ width: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)' }} />
                      <select value={scheduleUnit} onChange={e => setScheduleUnit(e.target.value)} style={{ width: 90, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)' }}>
                        <option value="mcg">mcg</option><option value="mg">mg</option><option value="iu">IU</option><option value="ml">ml</option>
                      </select>
                      <select value={scheduleFrequency} onChange={e => setScheduleFrequency(e.target.value)} style={{ width: 140, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)' }}>
                        <option value="Every Day">Every Day</option><option value="Every Other Day">Every Other Day</option><option value="5 Days On, 2 Off">5 Days On, 2 Off</option><option value="Once Weekly">Once Weekly</option><option value="Twice Weekly">Twice Weekly</option>
                      </select>
                      <button onClick={addScheduledDose} disabled={!scheduleCompound || !scheduleAmount} className="btn btn-secondary" style={{ padding: '12px 24px', borderRadius: 8 }}>Add Schedule</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-3)' }}>
                      {scheduledDoses.map(s => (
                        <div key={s.id} style={{ background: 'rgba(255,255,255,0.05)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', position: 'relative' }}>
                          <button onClick={() => deleteScheduledDose(s.id)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}><X size={16}/></button>
                          <div style={{ color: 'var(--teal)', fontWeight: 'bold' }}>{s.compound}</div>
                          <div style={{ color: 'var(--white)' }}>{s.amount} {s.unit}</div>
                          <div style={{ color: 'var(--silver)', fontSize: '0.85rem', marginTop: 4 }}><Layers size={12} style={{ display: 'inline', marginRight: 4 }}/>{s.frequency}</div>
                        </div>
                      ))}
                      {scheduledDoses.length === 0 && <div style={{ color: 'var(--silver)' }}>No scheduled protocols yet.</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <h3 style={{ color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>Recent History</h3>
                    {doses.map(d => (
                      <div key={d.id} className="glass-panel" style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: 'var(--teal)', fontWeight: 'bold' }}>{d.compound_slug}</div>
                          <div style={{ color: 'var(--white)' }}>{d.dose_amount} {d.unit}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                          <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
                            {new Date(d.dosed_at).toLocaleDateString()} at {new Date(d.dosed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          <button onClick={() => deleteDose(d.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--red)' }}><Trash2 size={16}/></button>
                        </div>
                      </div>
                    ))}
                    {doses.length === 0 && <div style={{ color: 'var(--silver)' }}>No doses logged yet.</div>}
                  </div>
                </div>

              ) : activeTab === 'biometrics' ? (
                <div>
                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                    <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)' }}>Log Biometrics</h2>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                      <select 
                        value={bioName} 
                        onChange={e => {
                          setBioName(e.target.value);
                          if (e.target.value === 'Weight') setBioUnit('lbs');
                          else if (e.target.value === 'Sleep Quality' || e.target.value === 'Pain Level') setBioUnit('/10');
                          else setBioUnit('');
                        }}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                      >
                        <option value="">Select Metric</option>
                        <option value="Weight">Weight</option>
                        <option value="Sleep Quality">Sleep Quality (1-10)</option>
                        <option value="Pain Level">Pain Level (1-10)</option>
                        <option value="Blood Pressure">Blood Pressure</option>
                        <option value="Body Fat %">Body Fat %</option>
                      </select>
                      <input 
                        type="number" 
                        placeholder="Value" 
                        value={bioValue} 
                        onChange={e => setBioValue(e.target.value)}
                        style={{ width: 120, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Unit" 
                        value={bioUnit} 
                        onChange={e => setBioUnit(e.target.value)}
                        style={{ width: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                      />
                      <button onClick={saveBiometric} disabled={!bioName || !bioValue || bioSaving} className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: 8 }}>
                        {bioSaving ? 'Saving...' : 'Log'}
                      </button>
                    </div>
                  </div>

                  {/* Protocol Correlation Charts via Recharts */}
                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>Protocol Correlation & Trends</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {biometrics.length === 0 ? <div style={{ color: 'var(--silver)' }}>No biometrics logged yet.</div> : null}
                      {Array.from(new Set(biometrics.map(b => b.metric_name))).map(metric => renderCombinedChart(metric))}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginTop: 'var(--space-6)' }}>
                    <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>Recent Biometrics</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {biometrics.map(b => (
                        <div key={b.id} className="glass-panel" style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                          <div>
                            <div style={{ color: 'var(--teal)', fontWeight: 'bold' }}>{b.metric_name}</div>
                            <div style={{ color: 'var(--white)' }}>{b.metric_value} {b.unit}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
                              {new Date(b.measured_at).toLocaleDateString()} at {new Date(b.measured_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                            <button onClick={() => deleteBiometric(b.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--red)' }}><Trash2 size={16}/></button>
                          </div>
                        </div>
                      ))}
                      {biometrics.length === 0 && <div style={{ color: 'var(--silver)' }}>No biometrics logged yet.</div>}
                    </div>
                  </div>
                </div>

              ) : activeTab === 'compareHistory' ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {comparisons.length === 0 ? renderEmptyState() : comparisons.map(c => (
                      <div key={c.id} className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                          <div>
                            {c.folder_name && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,196,188,0.15)', color: 'var(--teal)', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, border: '1px solid rgba(0,196,188,0.3)' }}>
                                <Layers size={12} /> {c.folder_name}
                              </div>
                            )}
                            <h3 style={{ color: 'var(--white)', margin: 0 }}>Comparison from {new Date(c.created_at).toLocaleDateString()}</h3>
                            {c.notes && (
                              <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginTop: 8, fontStyle: 'italic', maxWidth: '600px' }}>
                                {`"${c.notes}"`}
                              </p>
                            )}
                          </div>
                          <button onClick={() => deleteComparison(c.id)} className="btn btn-ghost btn-sm" style={{ padding: 6, color: 'var(--red)', background: 'rgba(229,62,62,0.1)' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
                          {c.product_ids.map((pid: string) => {
                            const item = [...favorites, ...pastOrders, ...recentlyViewed, ...catalog].find(i => i.product_id === pid);
                            if (!item) return <div key={pid} style={{ color: 'var(--silver)' }}>Unknown Item</div>;
                            return (
                              <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'rgba(255,255,255,0.05)', padding: 'var(--space-2) var(--space-3)', borderRadius: 20, whiteSpace: 'nowrap' }}>
                                <Image src={item.image_url || getProductImage(null, item.category || 'Other', item.name)} width={24} height={24} unoptimized style={{ objectFit: 'contain', borderRadius: 4 }} alt={item.name} />
                                <div style={{ color: 'var(--white)', fontSize: '0.9rem', fontWeight: 600 }}>{item.name}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                        <button onClick={() => { setSelectedItems(new Set(c.product_ids)); setIsComparing(true); }} className="btn btn-secondary btn-sm" style={{ padding: '6px 16px', borderRadius: 20 }}>View Comparison Again</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
              {activeTab === 'recentlyViewed' && recentlyViewed.length > 0 && !searchQuery && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-var(--space-4)' }}>
                  <button onClick={clearRecentlyViewed} className="btn btn-ghost btn-sm" style={{ color: 'var(--silver)', fontSize: '0.8rem', padding: '4px 12px' }}>Clear History</button>
                </div>
              )}
              {activeTab === 'inventory' && !searchQuery && (
                <div className="glass-panel" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <PackageOpen size={18} style={{ color: 'var(--teal)' }} />
                    <span style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>Looking for a specific receipt or tracking number?</span>
                  </div>
                  <Link href="/orders" className="btn btn-ghost btn-sm" style={{ color: 'var(--white)', whiteSpace: 'nowrap' }}>
                    View Full Order History &rarr;
                  </Link>
                </div>
              )}
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category}>
                  {shouldGroup && <h3 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)' }}>{category}</h3>}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : '1fr',
                    gap: 'var(--space-3)'
                  }}>
                    {items.map((item, idx) => renderItemCard(item, idx))}
                  </div>
                </div>
              ))}
              </>
            )}
            </div>
          )}
        </>
      )}

      {/* Trending Section for Recently Viewed */}
      {activeTab === 'recentlyViewed' && trending.length > 0 && !searchQuery && (
        <div className="glass-panel hover-lift stagger-fade-in" style={{ marginTop: 'var(--space-8)', padding: 'var(--space-5) var(--space-5) var(--space-6)', animationDelay: '0.2s' }}>
          <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>Trending Now</h2>
          <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>The Top Eight Products Researchers Have Ordered In The Last Sixty Days.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
            {trending.map((t, idx) => {
              const inner = (
                <div key={idx} style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', position: 'relative' }}>
                    <div style={{ height: 100, background: 'radial-gradient(circle at 50% 50%, rgba(192,184,168,0.10) 0%, var(--black) 100%)', borderRadius: 8, marginBottom: 12, position: 'relative' }}>
                    <Image src={t.image_url || getProductImage(null, t.category || 'Other', t.name)} alt={t.name} fill unoptimized style={{ objectFit: 'contain', padding: 8 }} />
                    </div>
                    <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.95rem' }}>{t.name}</div>  
                </div>
              );
              return storefrontSlug ? (
                <Link key={t.id} href={`/${storefrontSlug}?product=${encodeURIComponent(t.id)}`} style={{ textDecoration: 'none' }}>
                  {inner}
                </Link>
              ) : (
                <div key={t.id}>{inner}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination: Load More */}
      {visibleCount < currentItems.length && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
          <button 
            onClick={() => setVisibleCount(v => v + 24)} 
            className="btn btn-secondary"
            style={{ padding: '12px 32px', borderRadius: 30, background: 'rgba(255,255,255,0.05)' }}
          >
            Load More ({currentItems.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,20,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,196,188,0.3)', padding: '12px 24px', borderRadius: 40, zIndex: 100, display: 'flex', alignItems: 'center', gap: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ color: 'var(--white)', fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedItems.size} Selected</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(selectedItems.size >= 2 && selectedItems.size <= 4) && (
              <button onClick={() => { setIsComparing(true); saveComparison(Array.from(selectedItems)); }} className="btn btn-secondary" style={{ borderRadius: 20, padding: '8px 20px', background: 'rgba(0,196,188,0.1)', color: 'var(--teal)', border: '1px solid rgba(0,196,188,0.2)' }}>Compare</button>
            )}
            <DynamicAddToCartButton
              onClick={handleBulkAdd}
              isSmall={true}
            />
            <button onClick={() => setSelectedItems(new Set())} className="btn btn-ghost" style={{ borderRadius: 20, color: 'var(--silver)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }} onClick={() => setQuickViewItem(null)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 800, padding: 0, borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setQuickViewItem(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'var(--white)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}><X size={16} /></button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div style={{ flex: '0 0 300px', background: 'radial-gradient(circle at 50% 50%, rgba(192,184,168,0.10) 0%, var(--black) 100%)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', position: 'relative' }}>
                <Image src={quickViewItem.image_url || getProductImage(null, quickViewItem.category || 'Other', quickViewItem.name)} fill unoptimized style={{ objectFit: 'contain' }} alt={quickViewItem.name} />
              </div>
              <div style={{ flex: 1, padding: 'var(--space-6)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: 'var(--teal)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', marginBottom: 8 }}>{quickViewItem.category || 'Compound'}</div>
                <h2 style={{ color: 'var(--white)', fontSize: '1.8rem', lineHeight: 1.2, marginBottom: 16 }}>{quickViewItem.name}</h2>
                <div style={{ color: 'var(--silver)', fontSize: '0.95rem', marginBottom: 24, flex: 1 }}>
                  This item is saved in your Lab Journal. It is {quickViewItem.in_stock === false ? 'currently out of stock' : 'in stock and ready to ship'}.
                  {quickViewItem.unit_size && <div><br/><strong>Unit Size:</strong> {quickViewItem.unit_size}{quickViewItem.unit_measure}</div>}
                </div>
                <div style={{ paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: 'var(--teal)', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-brand)' }}>
                    ${(quickViewItem.retail_price ?? quickViewItem.base_cost ?? 0).toFixed(2)}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {activeTab === 'favorites' && (
                      <button onClick={() => { removeItem(quickViewItem.product_id); setQuickViewItem(null); }} className="btn btn-ghost" style={{ color: 'var(--red)' }}><Trash2 size={16}/> Remove</button>
                    )}
                    {storefrontSlug && (
                      <Link href={`/${storefrontSlug}?product=${encodeURIComponent(quickViewItem.product_id)}`} className="btn btn-secondary">View Product</Link>
                    )}
                    {storefrontSlug && (
                      <DynamicAddToCartButton
                        onClick={() => { handleQuickAdd(quickViewItem); setQuickViewItem(null); }}
                        disabled={quickViewItem.in_stock === false}
                        isSmall={true}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {isComparing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }} onClick={() => setIsComparing(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 1000, padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsComparing(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--white)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}><X size={16} /></button>
            <h2 style={{ color: 'var(--white)', fontSize: '1.4rem', marginBottom: 'var(--space-6)' }}>Comparing {selectedItems.size} Compounds</h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedItems.size}, 1fr)`, gap: 'var(--space-4)', overflowY: 'auto' }}>
              {Array.from(selectedItems).map(id => {
                const item = [...favorites, ...pastOrders, ...recentlyViewed].find(i => i.product_id === id);
                if (!item) return null;
                const displayPrice = item.retail_price ?? item.base_cost ?? 0;
                return (
                  <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'rgba(255,255,255,0.03)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ width: '100%', height: 120, background: 'var(--black-2)', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <Image src={item.image_url || getProductImage(null, item.category || 'Other', item.name)} fill unoptimized style={{ objectFit: 'contain', padding: 8 }} alt={item.name} />
                    </div>
                    <div style={{ color: 'var(--teal)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.category || 'N/A'}</div>
                    <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1.1rem' }}>{item.name}</div>
                    <div style={{ color: 'var(--silver)', fontSize: '0.9rem', paddingTop: 12, marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Price:</span> <strong style={{ color: 'var(--teal)' }}>${displayPrice.toFixed(2)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Size:</span> <strong style={{ color: 'var(--white)' }}>{item.unit_size}{item.unit_measure}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Status:</span> <strong style={{ color: item.in_stock === false ? 'var(--red)' : 'var(--teal)' }}>{item.in_stock === false ? 'Out of Stock' : 'In Stock'}</strong></div>
                    </div>
                    {storefrontSlug && (
                      <DynamicAddToCartButton
                        onClick={() => { handleQuickAdd(item); setSelectedItems(s => { const ns = new Set(s); ns.delete(item.product_id); return ns; }); if (selectedItems.size <= 2) setIsComparing(false); }}
                        disabled={item.in_stock === false}
                        isSmall={true}
                        style={{ marginTop: 12 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {intelligenceCompound && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setIntelligenceCompound(null)}>
          <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-card)', height: '100%', borderLeft: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()} className="slide-in-right">
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--teal)' }}><FlaskConical size={20}/> Intelligence</h2>
              <button onClick={() => setIntelligenceCompound(null)} className="btn btn-ghost btn-sm"><X size={20}/></button>
            </div>
            <div style={{ padding: 'var(--space-6)' }}>
              <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>{intelligenceCompound}</h1>
              
              {!intelligenceData ? (
                <p style={{ color: 'var(--silver)' }}>Loading intelligence data...</p>
              ) : intelligenceData.loading ? (
                <p style={{ color: 'var(--silver)' }}>Analyzing compound...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  {intelligenceData.evidence_tier && (
                    <div>
                      <span style={{ background: intelligenceData.evidence_tier === 'FDA Approved' ? 'var(--teal)' : 'rgba(255,255,255,0.1)', color: intelligenceData.evidence_tier === 'FDA Approved' ? '#000' : 'var(--white)', padding: '4px 12px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 'bold' }}>
                        Tier: {intelligenceData.evidence_tier}
                      </span>
                    </div>
                  )}
                  
                  <p style={{ color: 'var(--silver)', lineHeight: 1.6 }}>{intelligenceData.description}</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="glass-panel" style={{ padding: 'var(--space-3)', borderRadius: 8 }}>
                      <p style={{ margin: 0, color: 'var(--silver)', fontSize: '0.8rem', marginBottom: 4 }}>Half-Life</p>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>{intelligenceData.half_life || 'Unknown'}</p>
                    </div>
                    <div className="glass-panel" style={{ padding: 'var(--space-3)', borderRadius: 8 }}>
                      <p style={{ margin: 0, color: 'var(--silver)', fontSize: '0.8rem', marginBottom: 4 }}>Clinical Dosage</p>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>{intelligenceData.clinical_dosage || 'Unknown'}</p>
                    </div>
                  </div>

                  {intelligenceData.warnings && (
                    <div style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', padding: 'var(--space-4)', borderRadius: 8 }}>
                      <p style={{ margin: 0, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold', marginBottom: 8 }}><Info size={16}/> Warnings & Interactions</p>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', lineHeight: 1.5 }}>{intelligenceData.warnings}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style dangerouslySetInnerHTML={{__html: `
        .slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}} />
    </div>
  );
}
