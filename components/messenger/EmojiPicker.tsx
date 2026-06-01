'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// round-19: expanded emoji set spanning faces, gestures, hearts, animals,
// food, activities, travel, objects, symbols, and party. Was a tiny 30-
// emoji quick list — now ~400+ across categories.
const EMOJI_QUICK = [
  // Faces & expressions
  '\u{1F600}', '\u{1F603}', '\u{1F604}', '\u{1F601}', '\u{1F606}', '\u{1F605}',
  '\u{1F923}', '\u{1F602}', '\u{1F642}', '\u{1F643}', '\u{1F609}', '\u{1F60A}',
  '\u{1F607}', '\u{1F970}', '\u{1F60D}', '\u{1F929}', '\u{1F618}', '\u{1F617}',
  '\u{1F61A}', '\u{1F619}', '\u{1F60B}', '\u{1F61B}', '\u{1F61C}', '\u{1F92A}',
  '\u{1F914}', '\u{1F910}', '\u{1F928}', '\u{1F610}', '\u{1F611}', '\u{1F636}',
  '\u{1F60F}', '\u{1F612}', '\u{1F644}', '\u{1F62C}', '\u{1F925}', '\u{1F60C}',
  '\u{1F614}', '\u{1F62A}', '\u{1F924}', '\u{1F634}', '\u{1F62F}', '\u{1F632}',
  '\u{1F628}', '\u{1F630}', '\u{1F625}', '\u{1F622}', '\u{1F62D}', '\u{1F631}',
  '\u{1F616}', '\u{1F623}', '\u{1F61E}', '\u{1F613}', '\u{1F629}', '\u{1F62B}',
  '\u{1F624}', '\u{1F621}', '\u{1F620}', '\u{1F92C}', '\u{1F608}', '\u{1F47F}',
  '\u{1F480}', '\u{1F4A9}', '\u{1F921}', '\u{1F47B}', '\u{1F47D}', '\u{1F47E}',
  '\u{1F916}', '\u{1F60E}', '\u{1F973}', '\u{1F913}', '\u{1F9D0}',
  // Hand gestures
  '\u{1F44D}', '\u{1F44E}', '\u{1F44C}', '\u{1F44F}', '\u{1F64C}', '\u{1F64F}',
  '\u{1F91D}', '\u{1F4AA}', '\u{1F91E}', '\u{1F91F}', '\u{270C}\u{FE0F}',
  '\u{1F44A}', '\u{270A}', '\u{1F91B}', '\u{1F91C}', '\u{270B}', '\u{1F44B}',
  '\u{1F919}', '\u{1F448}', '\u{1F449}', '\u{1F446}', '\u{1F447}',
  // Hearts & sparkles
  '\u{2764}\u{FE0F}', '\u{1F9E1}', '\u{1F49B}', '\u{1F49A}', '\u{1F499}',
  '\u{1F49C}', '\u{1F90E}', '\u{1F5A4}', '\u{1F90D}', '\u{1F494}',
  '\u{1F495}', '\u{1F49E}', '\u{1F493}', '\u{1F497}', '\u{1F496}', '\u{1F498}',
  '\u{1F49D}', '\u{1F49F}', '\u{2728}', '\u{1F4AB}', '\u{1F4A5}', '\u{1F4A6}',
  '\u{1F4A8}', '\u{1F525}', '\u{1F4AF}', '\u{2705}',
  // Animals & nature
  '\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F439}', '\u{1F430}', '\u{1F98A}',
  '\u{1F43B}', '\u{1F43C}', '\u{1F428}', '\u{1F42F}', '\u{1F981}', '\u{1F42E}',
  '\u{1F437}', '\u{1F438}', '\u{1F435}', '\u{1F648}', '\u{1F649}', '\u{1F64A}',
  '\u{1F412}', '\u{1F414}', '\u{1F427}', '\u{1F426}', '\u{1F985}', '\u{1F989}',
  '\u{1F40D}', '\u{1F419}', '\u{1F41F}', '\u{1F420}', '\u{1F40B}', '\u{1F42C}',
  '\u{1F40A}', '\u{1F993}', '\u{1F42A}', '\u{1F418}', '\u{1F411}', '\u{1F415}',
  '\u{1F408}', '\u{1F413}', '\u{1F983}', '\u{1F433}',
  // Food & drinks
  '\u{1F347}', '\u{1F348}', '\u{1F349}', '\u{1F34A}', '\u{1F34B}', '\u{1F34C}',
  '\u{1F34D}', '\u{1F34E}', '\u{1F34F}', '\u{1F350}', '\u{1F351}', '\u{1F352}',
  '\u{1F353}', '\u{1F345}', '\u{1F951}', '\u{1F346}', '\u{1F954}', '\u{1F33D}',
  '\u{1F336}\u{FE0F}', '\u{1F952}', '\u{1F344}', '\u{1F330}', '\u{1F950}',
  '\u{1F956}', '\u{1F9C0}', '\u{1F356}', '\u{1F357}', '\u{1F953}', '\u{1F354}',
  '\u{1F35F}', '\u{1F355}', '\u{1F32D}', '\u{1F32E}', '\u{1F32F}', '\u{1F959}',
  '\u{1F95A}', '\u{1F373}', '\u{1F372}', '\u{1F963}', '\u{1F37F}', '\u{1F371}',
  '\u{1F358}', '\u{1F359}', '\u{1F35A}', '\u{1F35B}', '\u{1F35C}', '\u{1F35D}',
  '\u{1F360}', '\u{1F362}', '\u{1F363}', '\u{1F364}', '\u{1F365}', '\u{1F361}',
  '\u{1F366}', '\u{1F367}', '\u{1F368}', '\u{1F369}', '\u{1F36A}', '\u{1F382}',
  '\u{1F370}', '\u{1F36B}', '\u{1F36C}', '\u{1F36D}', '\u{1F36E}', '\u{1F36F}',
  '\u{1F37C}', '\u{2615}', '\u{1F375}', '\u{1F376}', '\u{1F37E}', '\u{1F377}',
  '\u{1F378}', '\u{1F379}', '\u{1F37A}', '\u{1F37B}',
  // Activities, sports
  '\u{26BD}', '\u{1F3C0}', '\u{1F3C8}', '\u{26BE}', '\u{1F3BE}', '\u{1F3D0}',
  '\u{1F3C9}', '\u{1F3B1}', '\u{1F3D3}', '\u{1F3F8}', '\u{1F3D2}', '\u{1F3AF}',
  '\u{26F3}', '\u{1F3A3}', '\u{1F3BF}', '\u{1F3C2}', '\u{1F94A}', '\u{1F94B}',
  '\u{1F945}', '\u{1F3AE}', '\u{1F3B2}', '\u{1F3AD}', '\u{1F3A8}', '\u{1F3AC}',
  '\u{1F3A4}', '\u{1F3A7}', '\u{1F3BC}', '\u{1F3B5}', '\u{1F3B6}', '\u{1F3B7}',
  '\u{1F3BA}', '\u{1F3B8}', '\u{1F3BB}',
  // Travel & places
  '\u{1F697}', '\u{1F695}', '\u{1F699}', '\u{1F68C}', '\u{1F6FB}', '\u{1F694}',
  '\u{1F692}', '\u{1F691}', '\u{1F693}', '\u{1F69A}', '\u{1F6F2}', '\u{1F680}',
  '\u{1F6F8}', '\u{26F5}', '\u{2708}\u{FE0F}', '\u{1F3E0}', '\u{1F3E2}', '\u{1F3EB}',
  // Objects, symbols
  '\u{1F4B0}', '\u{1F4B5}', '\u{1F4B8}', '\u{1F4B3}', '\u{1F4B2}', '\u{1F4BC}',
  '\u{1F4BB}', '\u{1F4F1}', '\u{1F4F2}', '\u{260E}\u{FE0F}', '\u{1F4DE}',
  '\u{1F4E0}', '\u{1F50B}', '\u{1F50C}', '\u{1F4A1}', '\u{1F526}', '\u{1F4E1}',
  '\u{1F4FA}', '\u{1F4F7}', '\u{1F4F9}', '\u{1F50D}', '\u{1F50E}', '\u{1F4DA}',
  '\u{1F4D6}', '\u{1F4F0}', '\u{1F4C5}', '\u{1F4CB}', '\u{1F4CC}', '\u{1F4CE}',
  '\u{2702}\u{FE0F}', '\u{1F512}', '\u{1F513}', '\u{1F511}', '\u{1F528}',
  '\u{1F527}', '\u{2699}\u{FE0F}', '\u{1F4A1}', '\u{1F6AA}',
  // Stars, weather, party
  '\u{2B50}', '\u{1F31F}', '\u{1F320}', '\u{1F30C}', '\u{2600}\u{FE0F}', '\u{26C5}',
  '\u{2601}\u{FE0F}', '\u{26C8}\u{FE0F}', '\u{1F300}', '\u{1F308}', '\u{2614}',
  '\u{26A1}', '\u{2744}\u{FE0F}', '\u{2603}\u{FE0F}', '\u{26C4}', '\u{1F4A7}',
  '\u{1F30A}', '\u{1F388}', '\u{1F389}', '\u{1F38A}', '\u{1F386}', '\u{1F387}',
  '\u{1F384}', '\u{1F381}', '\u{1F3C6}', '\u{1F947}', '\u{1F948}', '\u{1F949}',
];

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onPick, onClose }: Props) {
  // round-19: portal-render the picker into document.body with
  // position:fixed so it's visible above EVERY ancestor — no overflow,
  // transform, or word-break rule from globals-round2.css can clip it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const picker = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick An Emoji"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(120px + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        width: 'min(360px, 92vw)',
        maxHeight: '50vh',
        overflowY: 'auto',
        background: 'var(--surface-2, #162230)',
        border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 14,
        padding: 10,
        boxShadow: '0 12px 36px rgba(0,0,0,0.55)',
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: 4,
        zIndex: 9999,
        WebkitOverflowScrolling: 'touch',
      }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {EMOJI_QUICK.map((e, idx) => (
        <button
          key={`${idx}-${e}`}
          type="button"
          onClick={() => {
            onPick(e);
            onClose();
          }}
          style={{
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            padding: 8,
            borderRadius: 8,
            fontSize: '1.5rem',
            lineHeight: 1,
            minWidth: 36,
            minHeight: 36,
          }}
          aria-label={`Insert ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(picker, document.body);
}
