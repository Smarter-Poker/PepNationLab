'use client';

import React, { useState, useMemo, useCallback, useEffect, useDeferredValue, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ShoppingCart, Heart, X, Search, SlidersHorizontal, ChevronDown, FileText,
  Star, Zap, Award, TrendingUp, Package, Flame, Eye, Clock,
} from 'lucide-react';
import IframeLink from './IframeLink';
import IframeModal from './IframeModal';