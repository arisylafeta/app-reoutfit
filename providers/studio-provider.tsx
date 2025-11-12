"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { StudioProduct, StudioState, GeneratedLook } from '@/types/studio';
import { Avatar } from '@/types/lookbook';
import { canAddToOutfit as validateOutfit } from '@/types/outfit-roles';

/**
 * Studio Context Type
 */
interface StudioContextType {
  state: StudioState;
  // Actions
  addToSelected: (product: StudioProduct) => void;
  removeFromSelected: (productId: string) => void;
  moveToOutfit: (productId: string) => void;
  removeFromOutfit: (productId: string) => void;
  clearSelected: () => void;
  clearOutfit: () => void;
  setGeneratedLook: (look: GeneratedLook | null) => void;
  setGenerating: (isGenerating: boolean) => void;
  setGeneratedLookAndStopGenerating: (look: GeneratedLook) => void;
  setActiveDrawer: (drawer: 'wardrobe' | 'shopping' | 'looks' | null) => void;
  setSelectedAvatar: (avatar: Avatar | null) => void;
  setLoadingAvatar: (isLoading: boolean) => void;
  // Computed values
  selectedCount: number;
  outfitCount: number;
  canAddToOutfit: boolean;
  hasGeneratedLook: boolean;
}

const StudioContext = createContext<StudioContextType | null>(null);

const STORAGE_KEY = 'studio-state';
const MAX_OUTFIT_ITEMS = 6;

/**
 * Initial state
 */
const initialState: StudioState = {
  selectedProducts: [],
  currentOutfit: [],
  generatedLook: null,
  isGenerating: false,
  activeDrawer: null,
  selectedAvatar: null,
  isLoadingAvatar: false,
};

/**
 * Studio Provider Component
 * Manages global state for the Studio feature with localStorage persistence
 */
export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StudioState>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate structure
        if (parsed && typeof parsed === 'object') {
          setState(prev => ({
            ...prev,
            selectedProducts: Array.isArray(parsed.selectedProducts) ? parsed.selectedProducts : [],
            currentOutfit: Array.isArray(parsed.currentOutfit) ? parsed.currentOutfit : [],
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load studio state from localStorage:', error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save to localStorage with debouncing
  useEffect(() => {
    if (!isHydrated) return;

    const timeoutId = setTimeout(() => {
      try {
        const toSave = {
          selectedProducts: state.selectedProducts,
          currentOutfit: state.currentOutfit,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (error) {
        console.error('Failed to save studio state to localStorage:', error);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [state.selectedProducts, state.currentOutfit, isHydrated]);

  /**
   * Add a product to selected products list
   */
  const addToSelected = useCallback((product: StudioProduct) => {
    setState(prev => {
      // Check if product already exists
      const exists = prev.selectedProducts.some(p => p.id === product.id);
      if (exists) {
        return prev; // Idempotent
      }
      return {
        ...prev,
        selectedProducts: [...prev.selectedProducts, product],
      };
    });
  }, []);

  /**
   * Remove a product from selected products list
   */
  const removeFromSelected = useCallback((productId: string) => {
    setState(prev => ({
      ...prev,
      selectedProducts: prev.selectedProducts.filter(p => p.id !== productId),
    }));
  }, []);

  /**
   * Move a product from selected to current outfit
   */
  const moveToOutfit = useCallback((productId: string) => {
    setState(prev => {
      // Check if outfit has space
      if (prev.currentOutfit.length >= MAX_OUTFIT_ITEMS) {
        toast.error(`Maximum ${MAX_OUTFIT_ITEMS} items allowed in outfit`);
        return prev;
      }

      // Check if product already in outfit
      const alreadyInOutfit = prev.currentOutfit.some(p => p.id === productId);
      if (alreadyInOutfit) {
        return prev;
      }

      // Find product in selected
      const product = prev.selectedProducts.find(p => p.id === productId);
      if (!product) {
        return prev;
      }

      // Validate outfit composition before adding
      // Convert StudioProduct to ProductWithRole by using sourceData
      const validation = validateOutfit(
        prev.currentOutfit.map(p => p.sourceData),
        product.sourceData
      );

      if (!validation.canAdd) {
        toast.error(validation.reason || 'Cannot add this item to outfit');
        return prev;
      }

      return {
        ...prev,
        currentOutfit: [...prev.currentOutfit, product],
      };
    });
  }, []);

  /**
   * Remove a product from current outfit
   */
  const removeFromOutfit = useCallback((productId: string) => {
    setState(prev => ({
      ...prev,
      currentOutfit: prev.currentOutfit.filter(p => p.id !== productId),
    }));
  }, []);

  /**
   * Clear all selected products
   */
  const clearSelected = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedProducts: [],
    }));
  }, []);

  /**
   * Clear current outfit
   */
  const clearOutfit = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentOutfit: [],
    }));
  }, []);

  /**
   * Set or clear generated look
   */
  const setGeneratedLook = useCallback((look: GeneratedLook | null) => {
    setState(prev => ({
      ...prev,
      generatedLook: look,
    }));
  }, []);

  /**
   * Set generating state
   */
  const setGenerating = useCallback((isGenerating: boolean) => {
    setState(prev => ({
      ...prev,
      isGenerating,
    }));
  }, []);

  /**
   * Set generated look and stop generating in a single atomic update
   */
  const setGeneratedLookAndStopGenerating = useCallback((look: GeneratedLook) => {
    setState(prev => ({
      ...prev,
      generatedLook: look,
      isGenerating: false,
    }));
  }, []);

  /**
   * Set active drawer
   */
  const setActiveDrawer = useCallback((drawer: 'wardrobe' | 'shopping' | 'looks' | null) => {
    setState(prev => ({
      ...prev,
      activeDrawer: drawer,
    }));
  }, []);

  /**
   * Set selected avatar
   */
  const setSelectedAvatar = useCallback((avatar: Avatar | null) => {
    setState(prev => ({
      ...prev,
      selectedAvatar: avatar,
    }));
  }, []);

  /**
   * Set loading avatar state
   */
  const setLoadingAvatar = useCallback((isLoading: boolean) => {
    setState(prev => ({
      ...prev,
      isLoadingAvatar: isLoading,
    }));
  }, []);

  // Computed values
  const selectedCount = state.selectedProducts.length;
  const outfitCount = state.currentOutfit.length;
  const canAddToOutfit = state.currentOutfit.length < MAX_OUTFIT_ITEMS;
  const hasGeneratedLook = state.generatedLook !== null;

  const value: StudioContextType = {
    state,
    addToSelected,
    removeFromSelected,
    moveToOutfit,
    removeFromOutfit,
    clearSelected,
    clearOutfit,
    setGeneratedLook,
    setGenerating,
    setGeneratedLookAndStopGenerating,
    setActiveDrawer,
    setSelectedAvatar,
    setLoadingAvatar,
    selectedCount,
    outfitCount,
    canAddToOutfit,
    hasGeneratedLook,
  };

  return (
    <StudioContext.Provider value={value}>
      {children}
    </StudioContext.Provider>
  );
}

/**
 * Hook to access Studio context
 * @throws Error if used outside StudioProvider
 */
export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within StudioProvider');
  }
  return context;
}
