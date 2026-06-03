'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function ResearchLandingPage() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) {
      router.push(`/research/catalog?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <div style={{
      width: '100%',
      backgroundColor: '#05070a',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      minHeight: '100vh',
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        aspectRatio: '682 / 1024',
      }}>
        {/* The Base Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/research/research-landing-bg.jpg"
          alt="Research Library"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* 1. The Search Input Field */}
        <form onSubmit={handleSearch} style={{
          position: 'absolute',
          top: '26.8%',
          left: '7.5%',
          width: '71%',
          height: '4.0%',
          zIndex: 10,
          backgroundColor: '#0a1017', // Match the image's dark color to cover baked-in text
          borderRadius: '24px 0 0 24px',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '16px'
        }}>
          <Search size={20} color="#A8B4C0" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Any Compound, Mechanism, Target, Pathway..."
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: 'clamp(12px, 1.4vw, 16px)',
              padding: '0 12px 0 12px',
            }}
          />
        </form>

        {/* 2. The Search Button (Submit) */}
        <div 
          onClick={handleSearch}
          style={{
            position: 'absolute',
            top: '26.8%',
            left: '79%',
            width: '13.5%',
            height: '4.0%',
            cursor: 'pointer',
            zIndex: 10,
          }}
        />

        {/* 3. The 4 Big Grid Buttons */}
        <Link href="/research/areas" style={{
          position: 'absolute', top: '35.5%', left: '4%', width: '44%', height: '18.5%', cursor: 'pointer',
        }} />
        <Link href="/research/catalog" style={{
          position: 'absolute', top: '35.5%', left: '50.5%', width: '44%', height: '18.5%', cursor: 'pointer',
        }} />
        <Link href="/research/compare" style={{
          position: 'absolute', top: '56%', left: '4%', width: '44%', height: '18.5%', cursor: 'pointer',
        }} />
        <Link href="/research/stacks" style={{
          position: 'absolute', top: '56%', left: '50.5%', width: '44%', height: '18.5%', cursor: 'pointer',
        }} />

        {/* 4. Quick Access Top Row */}
        <Link href="/research/area/tissue_repair" style={{
          position: 'absolute', top: '78.5%', left: '5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />
        <Link href="/research/area/healing" style={{
          position: 'absolute', top: '78.5%', left: '22.5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />
        <Link href="/research/area/cognitive" style={{
          position: 'absolute', top: '78.5%', left: '40.5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />
        <Link href="/research/area/metabolic" style={{
          position: 'absolute', top: '78.5%', left: '58.5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />
        <Link href="/research/area/longevity" style={{
          position: 'absolute', top: '78.5%', left: '76.5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />

        {/* 5. Quick Access Bottom Row */}
        <Link href="/research/area/immune" style={{
          position: 'absolute', top: '86%', left: '5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />
        <Link href="/research/area/sleep" style={{
          position: 'absolute', top: '86%', left: '22.5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />
        <Link href="/research/area/cosmetic" style={{
          position: 'absolute', top: '86%', left: '40.5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />
        <Link href="/research/area/performance" style={{
          position: 'absolute', top: '86%', left: '58.5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />
        <Link href="/research/area/mitochondrial" style={{
          position: 'absolute', top: '86%', left: '76.5%', width: '16.5%', height: '5%', cursor: 'pointer',
        }} />
      </div>
    </div>
  );
}
