import { MatchedProduct } from '../storefront/StorefrontDiscovery';
import { Calendar, Droplet, Pill, Zap } from 'lucide-react';

export function ProtocolScheduler({ results, primaryColor }: { results: MatchedProduct[]; primaryColor: string }) {
  // Extract compounds with known half-lives
  const scheduled = results.filter(r => r.halfLife && r.halfLife.toLowerCase() !== 'n/a');

  if (scheduled.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#A8B4C0' }}>
        No Scheduling Data Available For This Protocol.
      </div>
    );
  }

  // Very naive heuristic parser for demonstration
  // Real implementation would use exact hours/days mapped from the DB
  const getFrequency = (halfLife: string) => {
    const hl = halfLife.toLowerCase();
    if (hl.includes('min') || hl.includes('hour') && parseInt(hl) < 24) return 'Daily (AM/PM)';
    if (hl.includes('day') && parseInt(hl) < 3) return 'Daily';
    if (hl.includes('day') && parseInt(hl) >= 3) return '2x Weekly';
    if (hl.includes('week') || (hl.includes('day') && parseInt(hl) >= 7)) return 'Weekly';
    return 'Daily'; // Fallback
  };

  const getIcon = (freq: string) => {
    if (freq.includes('AM/PM')) return <Zap size={16} color={primaryColor} />;
    if (freq === 'Weekly' || freq === '2x Weekly') return <Droplet size={16} color={primaryColor} />;
    return <Pill size={16} color={primaryColor} />;
  };

  return (
    <div style={{ marginTop: 24, padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Calendar size={20} color={primaryColor} />
        Suggested Administration Schedule
      </h3>
      <p style={{ color: '#A8B4C0', fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.5 }}>
        Based On The Pharmacokinetic Half-Life Of These Compounds, Here Is A Theoretical Research Schedule To Maintain Stable Blood Serum Levels. 
        <strong style={{ color: '#FC8181' }}> Research Use Only.</strong>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {scheduled.map((item, idx) => {
          const freq = getFrequency(item.halfLife!);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }}>
              <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 12, marginRight: 16 }}>
                {getIcon(freq)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#FFF' }}>{item.display_name}</div>
                <div style={{ color: '#A8B4C0', fontSize: '0.85rem', marginTop: 4 }}>Half-Life: {item.halfLife}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, color: primaryColor, fontSize: '0.95rem' }}>{freq}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
