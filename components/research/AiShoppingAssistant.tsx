'use client';

import { useState } from 'react';
import { MessageCircle, X, Send, Bot, User, ShoppingCart, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AiShoppingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string; slugs?: string[] }[]>([
    { role: 'ai', text: 'Hi! I am your AI Lab Assistant. What kind of research are you conducting today? (e.g. "I want something for tendon repair that is not injectable")' }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!prompt.trim() || isTyping) return;
    
    const userMessage = prompt;
    setPrompt('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/storefront/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage })
      });
      const data = await res.json();
      
      setChatHistory(prev => [...prev, { 
        role: 'ai', 
        text: data.answer || 'Sorry, I encountered an error.',
        slugs: data.recommendedSlugs
      }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Failed to connect to AI server.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'linear-gradient(135deg, #00C4BC 0%, #008f89 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px -5px rgba(0, 196, 188, 0.5)',
          cursor: 'pointer',
          zIndex: 50,
          transition: 'transform 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        aria-label="Open AI Shopping Assistant"
      >
        <MessageCircle size={28} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '380px',
          height: '550px',
          background: 'var(--black)',
          border: '1px solid rgba(0, 196, 188, 0.3)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8)',
          zIndex: 50,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            background: 'rgba(0, 196, 188, 0.1)',
            borderBottom: '1px solid rgba(0, 196, 188, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#00C4BC', padding: '6px', borderRadius: '8px', color: '#000' }}>
                <Bot size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--white)' }}>AI Lab Assistant</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#00C4BC' }}>Gemini 2.5 Intelligence</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: msg.role === 'user' ? 'var(--space-800)' : '#00C4BC',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: msg.role === 'user' ? 'var(--silver)' : '#000', flexShrink: 0
                  }}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div style={{
                    background: msg.role === 'user' ? 'rgba(255,255,255,0.05)' : 'rgba(0, 196, 188, 0.1)',
                    border: `1px solid ${msg.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(0, 196, 188, 0.2)'}`,
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    color: 'var(--white)',
                    fontSize: '0.9rem',
                    lineHeight: 1.5
                  }}>
                    <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                    
                    {/* Render Recommended Products */}
                    {msg.slugs && msg.slugs.length > 0 && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {msg.slugs.map(slug => (
                          <Link 
                            key={slug} 
                            href={`/research/${slug}`}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              background: 'var(--black)', border: '1px solid #00C4BC', padding: '8px 12px',
                              borderRadius: '8px', textDecoration: 'none', color: 'var(--white)', fontSize: '0.85rem'
                            }}
                          >
                            <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{slug.replace(/-/g, ' ')}</span>
                            <ShoppingCart size={14} color="#00C4BC" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00C4BC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                  <Bot size={14} />
                </div>
                <div style={{ background: 'rgba(0, 196, 188, 0.1)', padding: '12px 16px', borderRadius: '4px 16px 16px 16px' }}>
                  <Loader2 size={16} className="animate-spin" color="#00C4BC" />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask for a recommendation..."
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '99px', padding: '10px 16px', color: 'var(--white)', outline: 'none'
                }}
              />
              <button 
                onClick={handleSend}
                disabled={isTyping || !prompt.trim()}
                style={{
                  background: '#00C4BC', color: '#000', border: 'none', borderRadius: '50%',
                  width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (isTyping || !prompt.trim()) ? 'not-allowed' : 'pointer', opacity: (isTyping || !prompt.trim()) ? 0.5 : 1
                }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
