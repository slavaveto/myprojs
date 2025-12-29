'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input, Chip } from '@heroui/react';
import { Search as IconSearch } from 'lucide-react';
import { UIElement } from '@/utils/providers/localization/types';

interface LocalizSearchProps {
   items: UIElement[];
   onSelect: (item: UIElement) => void;
}

export const LocalizSearch = ({ items, onSelect }: LocalizSearchProps) => {
   const [searchQuery, setSearchQuery] = useState('');
   const [searchResults, setSearchResults] = useState<UIElement[]>([]);
   const [isSearchOpen, setIsSearchOpen] = useState(false);
   const searchRef = useRef<HTMLDivElement>(null);

   // Search Logic
   useEffect(() => {
      if (!searchQuery || searchQuery.length < 2) {
         setSearchResults([]);
         setIsSearchOpen(false);
         return;
      }

      const lowerQuery = searchQuery.toLowerCase();
      const matches = items
         .filter(
            (item) =>
               item.item_id.toLowerCase().includes(lowerQuery) ||
               item.ru?.toLowerCase().includes(lowerQuery) ||
               item.uk?.toLowerCase().includes(lowerQuery) ||
               item.en?.toLowerCase().includes(lowerQuery)
         )
         .slice(0, 10);

      setSearchResults(matches);
      setIsSearchOpen(matches.length > 0);
   }, [searchQuery, items]);

   // Click outside logic
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
            setIsSearchOpen(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   const handleSelect = (item: UIElement) => {
      onSelect(item);
      setIsSearchOpen(false);
      setSearchQuery('');
   };

   const getHighlightedText = (text: string, highlight: string) => {
      if (!text) return null;
      if (!highlight.trim()) return <span>{text}</span>;

      const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));
      return (
         <span>
            {parts.map((part, i) =>
               part.toLowerCase() === highlight.toLowerCase() ? (
                  <span
                     key={i}
                     className="bg-yellow-200 dark:bg-yellow-800 text-foreground font-semibold"
                  >
                     {part}
                  </span>
               ) : (
                  <span key={i}>{part}</span>
               )
            )}
         </span>
      );
   };

   return (
      <div className="w-full max-w-md mx-auto relative" ref={searchRef}>
         <Input
            placeholder="Search keys or translations..."
            startContent={<IconSearch className="text-default-400" size={18} />}
            value={searchQuery}
            onValueChange={setSearchQuery}
            size="sm"
            isClearable
            onClear={() => setSearchQuery('')}
            classNames={{
               inputWrapper: 'bg-default-100',
            }}
         />

         {isSearchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-content1 rounded-medium shadow-large border border-default-200 z-50 overflow-hidden max-h-[400px] overflow-y-auto">
               {searchResults.map((item) => (
                  <button
                     key={item.item_id}
                     className="w-full text-left px-3 py-2 hover:bg-default-100 transition-colors border-b border-default-100 last:border-0 flex flex-col gap-0.5"
                     onClick={() => handleSelect(item)}
                  >
                     <div className="flex items-center gap-2 text-xs text-default-500">
                        <span className="font-bold text-primary">
                           {getHighlightedText(item.item_id, searchQuery)}
                        </span>
                        <span className="text-default-300">•</span>
                        <Chip size="sm" variant="flat" className="h-5 px-2 text-xs">
                           {item.tab_id || 'misc'}
                        </Chip>
                     </div>
                     <div className="text-sm font-medium w-full text-foreground truncate mt-1">
                        <span className="text-default-400 mr-1">RU:</span>{' '}
                        {getHighlightedText(item.ru, searchQuery)}
                     </div>
                     {item.uk && (
                        <div className="text-sm font-medium w-full text-foreground truncate mt-0.5">
                           <span className="text-default-400 mr-1">UK:</span>{' '}
                           {getHighlightedText(item.uk, searchQuery)}
                        </div>
                     )}
                     {item.en && (
                        <div className="text-sm font-medium w-full text-foreground truncate mt-0.5">
                           <span className="text-default-400 mr-1">EN:</span>{' '}
                           {getHighlightedText(item.en, searchQuery)}
                        </div>
                     )}
                  </button>
               ))}
            </div>
         )}
      </div>
   );
};

