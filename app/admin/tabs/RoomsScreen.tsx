'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import {
   Plus as IconPlus,
   CheckCircle2,
   RefreshCw as IconRefresh,
   Search as IconSearch,
} from 'lucide-react';
import { Button, Spinner, Input } from '@heroui/react';
import toast from 'react-hot-toast'; // Added toast
import { useSupabase } from '@/utils/supabase/useSupabase';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { SortableRoomRow, Room } from './components/SortableRoomRow';
import { useUser } from '@clerk/nextjs';
import { roomService } from '@/app/admin/_services/roomService';
import { useRoomActions } from '@/app/admin/tabs/hooks/useRoomActions';
import { AdminUserMenu } from '@/app/admin/AdminUserMenu';

import { usePermission } from '@/app/admin/_services/usePermission'; // Added usePermission
import { PERMISSIONS } from '@/app/admin/_services/acl';

import {
   DndContext,
   closestCenter,
   KeyboardSensor,
   PointerSensor,
   useSensor,
   useSensors,
   DragOverlay,
   defaultDropAnimationSideEffects,
   DragEndEvent,
   DragStartEvent,
} from '@dnd-kit/core';
import {
   arrayMove,
   SortableContext,
   sortableKeyboardCoordinates,
   verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import clsx from 'clsx';

const dropAnimation = {
   sideEffects: defaultDropAnimationSideEffects({
      styles: {
         active: {
            opacity: '0.5',
         },
      },
   }),
};

interface RoomsScreenProps {
   onReady?: () => void;
   isActive: boolean;
   canLoad?: boolean;
   texts: {
      saveLoading: string;
      saveSuccess: string;
      refreshLoading: string;
      refreshSuccess: string;
   };
   showToast?: boolean;
}

export const RoomsScreen = ({ onReady, isActive, canLoad, texts, showToast = true }: RoomsScreenProps) => {
   const logger = createLogger('RoomsScreen');
   const { user, isLoaded } = useUser();
   const { supabase } = useSupabase();
   const [rooms, setRooms] = useState<Room[]>([]);

   // Service Hook
   const { createRoom, updateRoom, deleteRoom, isCreating, isDeleting, isUpdating } =
      useRoomActions();

   // Permissions
   const { can, roomLimit } = usePermission();

   // New state for search and loading
   const [searchQuery, setSearchQuery] = useState('');
   const [isLoading, setIsLoading] = useState(false);

   // Hook for manual refresh (only for fetching list)
   const {
      execute: executeRefresh,
      status: refreshStatus,
      error: refreshError,
   } = useAsyncAction({
      minDuration: 1000,
      useToast: showToast,
      loadingMessage: texts.refreshLoading,
      successMessage: texts.refreshSuccess,
      errorMessage: 'Ошибка обновления',
   });

   // Хук для отслеживания статуса любых операций сохранения (create/update/delete)
   // Используем его как обертку над actions
   const {
      execute: executeSave,
      status: saveStatus,
      error: saveError,
   } = useAsyncAction({
      minDuration: 800,
      successDuration: 2000,
      useToast: showToast,
      loadingMessage: texts.saveLoading,
      successMessage: texts.saveSuccess,
      errorMessage: (err) => `Error: ${err.message}`,
   });

   // Объединяем статусы для баджа: если идет refresh - показываем его, иначе saveStatus
   const isRefreshing = refreshStatus !== 'idle';
   const badgeStatus = isRefreshing ? refreshStatus : saveStatus;
   const badgeError = refreshStatus === 'error' ? refreshError?.message : saveError?.message;

   const loadingText = isRefreshing ? texts.refreshLoading : texts.saveLoading;
   const successText = isRefreshing ? texts.refreshSuccess : texts.saveSuccess;

   // DnD Sensors
   const sensors = useSensors(
      useSensor(PointerSensor, {
         activationConstraint: {
            distance: 8, // Avoid accidental drags
         },
      }),
      useSensor(KeyboardSensor, {
         coordinateGetter: sortableKeyboardCoordinates,
      })
   );

   const [activeId, setActiveId] = useState<string | null>(null);

   const loadData = async (isManualRefresh = false) => {
      const targetUserId = user?.id;

      if (!targetUserId) return;

      setIsLoading(true);

      const fetchRooms = async () => {
         const data = await roomService.getRooms(supabase, targetUserId);
         setRooms(data);
      };

      if (isManualRefresh) {
         await executeRefresh(fetchRooms);
      } else {
         try {
            await fetchRooms();
         } catch (err) {
            logger.error('Background load failed', err);
         }
      }

      setIsLoading(false);

      if (onReady) {
         setTimeout(() => onReady(), 0);
      }
   };

   useEffect(() => {
      if (isLoaded && user && canLoad) {
         loadData(false);
      }
   }, [isLoaded, user, canLoad]);

   // Filtered Rooms
   const filteredRooms = useMemo(() => {
      if (!searchQuery) return rooms;
      const lower = searchQuery.toLowerCase();
      return rooms.filter(
         (r) =>
            r.room_id.toLowerCase().includes(lower) || r.room_title.toLowerCase().includes(lower)
      );
   }, [rooms, searchQuery]);

   const generateRoomId = () => {
      const part = () => Math.random().toString(36).substring(2, 5);
      return `${part()}-${part()}`;
   };

   const validateRoomId = (id: string) => {
      if (!id.trim()) return 'ID cannot be empty';
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) return 'Only Latin letters, numbers, "-" and "_" allowed';

      const exists = rooms.some((r) => r.room_id === id);
      if (exists) return 'ID already exists';

      return null;
   };

   const handleCreateRoom = async () => {
      const targetUserId = user?.id;
      if (!targetUserId) return;

      if (rooms.length >= roomLimit) {
         toast.error(`Достигнут лимит комнат (${roomLimit}). Пожалуйста, обновите тариф.`);
         return;
      }

      const newId = generateRoomId();
      const minOrder = rooms.length > 0 ? Math.min(...rooms.map((r) => r.sort_order || 0)) : 0;
      const newOrder = minOrder - 1;

      const newRoom: Room = {
         room_id: newId,
         room_title: '',
         sort_order: newOrder,
         isNew: true,
         is_active: true,
         is_section: false,
      };

      logger.info('Creating new room', newRoom);

      // Optimistic update
      setRooms((prev) => [newRoom, ...prev]);

      // Оборачиваем вызов сервиса в executeSave для обновления статуса баджа
      try {
         await executeSave(async () => {
            await createRoom({
               title: '',
               userId: targetUserId,
               roomId: newId,
               sortOrder: newOrder,
               isSection: false,
               isActive: true,
            });
         });
      } catch (err) {
         logger.error('Error creating room', err);
         // Rollback
         setRooms((prev) => prev.filter((r) => r.room_id !== newId));
      }
   };

   const handleDeleteRoom = async (roomId: string) => {
      logger.info('Deleting room', { roomId });
      const prevRooms = [...rooms];
      setRooms((prev) => prev.filter((r) => r.room_id !== roomId));

      try {
         await executeSave(async () => {
            await deleteRoom(roomId);
         });
      } catch (err) {
         setRooms(prevRooms); // Rollback
      }
   };

   const handleCancelRoom = (item: Room) => {
      handleDeleteRoom(item.room_id);
   };

   const handleToggleSection = async (item: Room) => {
      const newIsSection = !item.is_section;
      logger.info('Toggling section', { roomId: item.room_id, newIsSection });

      const prevRooms = [...rooms];
      setRooms((prev) =>
         prev.map((r) => (r.room_id === item.room_id ? { ...r, is_section: newIsSection } : r))
      );

      try {
         await executeSave(async () => {
            await updateRoom(item.room_id, { is_section: newIsSection });
         });
      } catch (err) {
         setRooms(prevRooms);
      }
   };

   const handleToggleActive = async (item: Room) => {
      const nextVal = item.is_active === false ? true : false;

      const prevRooms = [...rooms];
      setRooms((prev) =>
         prev.map((r) => (r.room_id === item.room_id ? { ...r, is_active: nextVal } : r))
      );

      try {
         await executeSave(async () => {
            await updateRoom(item.room_id, { is_active: nextVal });
         });
      } catch (err) {
         setRooms(prevRooms);
      }
   };

   const handleUpdateRoomTitle = async (roomId: string, newTitle: string) => {
      logger.info('Updating room title', { roomId, newTitle });

      const prevRooms = [...rooms];
      setRooms((prev) =>
         prev.map((r) => (r.room_id === roomId ? { ...r, room_title: newTitle } : r))
      );

      try {
         await executeSave(async () => {
            await updateRoom(roomId, { room_title: newTitle });
         });
      } catch (err) {
         setRooms(prevRooms);
      }
   };

   const handleUpdateRoomId = async (oldRoomId: string, newRoomId: string) => {
      if (oldRoomId === newRoomId) return;

      const validationError = validateRoomId(newRoomId);
      if (validationError) {
         throw new Error(validationError);
      }

      logger.info('Updating room ID', { oldRoomId, newRoomId });

      const prevRooms = [...rooms];
      setRooms((prev) =>
         prev.map((r) => (r.room_id === oldRoomId ? { ...r, room_id: newRoomId } : r))
      );

      try {
         await executeSave(async () => {
            await updateRoom(oldRoomId, { room_id: newRoomId });
         });
      } catch (err) {
         setRooms(prevRooms);
         throw err;
      }
   };

   const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
   };

   const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (over && active.id !== over.id) {
         const oldIndex = rooms.findIndex((item) => item.room_id === active.id);
         const newIndex = rooms.findIndex((item) => item.room_id === over.id);

         if (oldIndex !== -1 && newIndex !== -1) {
            const newItems = arrayMove(rooms, oldIndex, newIndex);

            // Recalculate sort orders
            const updatedItems = newItems.map((item, index) => ({
               ...item,
               sort_order: index,
            }));

            // Optimistic update
            setRooms(updatedItems);

            // Save new order
            // Note: For mass update we still use updateRoom in loop or need a bulk update method in service.
            // Using updateRoom in loop is fine for now (fire and forget).
            // We won't await all of them to block UI, but we should log errors.

            try {
               await executeSave(async () => {
                  const updates = updatedItems.map((item) =>
                     updateRoom(item.room_id, { sort_order: item.sort_order })
                  );
                  await Promise.all(updates);
               });
            } catch (err) {
               logger.error('Failed to update sort order', err);
               // Here rollback is hard, maybe just toast error
            }
         }
      }
   };

   const activeItem = rooms.find((item) => item.room_id === activeId);

   if (!isLoaded || !user) return null;

   return (
      <div className="h-full flex flex-col ">

         <div className="grid grid-cols-[250px_1fr_250px] min-h-[60px] items-center pb-4 gap-4">
            <h1 className="tab-title">My Rooms</h1>

            {/* Search Bar */}
            <div className="w-full max-w-md mx-auto">
               <Input
                  placeholder="Search pages by ID or Title..."
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
            </div>

            <div className="flex items-center gap-3 justify-self-end">
               {/* Fixed width container to prevent layout shift */}
               <div className="w-[140px] flex justify-end">
                  {/* Using refresh status or updating status */}
                  <StatusBadge
                     status={badgeStatus}
                     errorMessage={badgeError}
                     loadingText={loadingText}
                     successText={successText}
                  />
               </div>

               <div className="flex gap-2 items-center">
                  <Button
                     isIconOnly
                     variant="flat"
                     onPress={() => loadData(true)}
                     isLoading={isLoading}
                     className="shadow-lg bg-background/80 backdrop-blur-md border border-default-200"
                  >
                     <IconRefresh size={16} />
                  </Button>

                  <AdminUserMenu />
               </div>
            </div>
         </div>

         {/* Table Header */}
         <div className="grid grid-cols-[230px_1fr_40px_200px] gap-1 py-2 bg-default-100 border border-default-300 rounded-lg font-bold text-small text-default-600 items-center mb-2">
            <div className="pl-2 flex items-center justify-between pr-2">
               Room ID
               <Button
                  size="sm"
                  color="success"
                  variant="flat"
                  className="h-6 min-w-0 px-2 text-tiny"
                  onPress={handleCreateRoom}
                  startContent={<IconPlus size={14} />}
               >
                  Add
               </Button>
            </div>
            <div className="pl-2 border-l border-default-300">Title</div>
            <div className="flex items-center justify-center border-l border-default-300 h-full">
               <CheckCircle2 size={16} className="text-default-400" />
            </div>
            <div className="text-center pr-0 border-l border-default-300">Actions</div>
         </div>

         {/* Rooms List */}
         <div className="flex flex-col gap-1 pb-20 overflow-y-auto">
            <DndContext
               sensors={sensors}
               collisionDetection={closestCenter}
               onDragStart={handleDragStart}
               onDragEnd={handleDragEnd}
            >
               <SortableContext
                  items={filteredRooms.map((r) => r.room_id)}
                  strategy={verticalListSortingStrategy}
               >
                  {filteredRooms.map((room) => (
                     <SortableRoomRow
                        key={room.room_id}
                        item={room}
                        onUpdateId={handleUpdateRoomId}
                        onUpdateTitle={handleUpdateRoomTitle}
                        onDelete={handleDeleteRoom}
                        onCancel={room.isNew ? handleCancelRoom : undefined}
                        onToggleSection={handleToggleSection}
                        onToggleActive={handleToggleActive}
                        onValidateId={(val) => {
                           if (val === room.room_id) return null;
                           return validateRoomId(val);
                        }}
                        canEditId={can(PERMISSIONS.CUSTOM_ROOM_ID)}
                     />
                  ))}
               </SortableContext>
               <DragOverlay dropAnimation={dropAnimation}>
                  {activeItem ? (
                     <SortableRoomRow
                        item={activeItem}
                        onUpdateId={handleUpdateRoomId}
                        onUpdateTitle={handleUpdateRoomTitle}
                        onDelete={handleDeleteRoom}
                        isOverlay
                        onToggleSection={handleToggleSection}
                        onToggleActive={handleToggleActive}
                        canEditId={can(PERMISSIONS.CUSTOM_ROOM_ID)}
                     />
                  ) : null}
               </DragOverlay>
            </DndContext>

            {rooms.length === 0 && !isLoading && (
               <div className="p-8 text-center text-default-500">
                  {user ? 'У вас пока нет созданных комнат' : 'Загрузка...'}
               </div>
            )}
            {filteredRooms.length === 0 && rooms.length > 0 && (
               <div className="p-8 text-center text-default-500 border border-dashed border-default-300 rounded-lg">
                  No pages found matching "{searchQuery}"
               </div>
            )}
         </div>
      </div>
   );
};
