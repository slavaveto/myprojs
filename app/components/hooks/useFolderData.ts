import { useState, useCallback } from 'react';
import { Folder } from '@/app/types';
import { folderService } from '@/app/_services/folderService';
import { createLogger } from '@/utils/logger/Logger';
import { toast } from 'react-hot-toast';
import { arrayMove } from '@dnd-kit/sortable';

const logger = createLogger('UseFolderData');

export const useFolderData = (projectId: string, executeSave: (fn: () => Promise<void>) => Promise<void>) => {
    const [folders, setFolders] = useState<Folder[]>([]);

    const loadFolders = useCallback(async () => {
        try {
            const data = await folderService.getFolders(projectId);
            setFolders(data);
            return data;
        } catch (err) {
            logger.error('Failed to load folders', err);
            return [];
        }
    }, [projectId]);

    const handleAddFolder = async (title: string): Promise<Folder | null> => {
       const newOrder = folders.length > 0 
          ? Math.max(...folders.map(f => f.sort_order)) + 1 
          : 0;
       
       const tempId = crypto.randomUUID();
       const newFolder = {
           id: tempId,
           project_id: projectId,
           title,
           sort_order: newOrder,
           created_at: new Date().toISOString(),
           updated_at: new Date().toISOString(),
       };
       
       setFolders(prev => [...prev, newFolder]);
       
       // Return the tempId so caller can select it immediately if needed
       // Or handle selection logic outside? 
       // In original code: setSelectedFolderId(data.id) was called.
       // We can return the PROMISE of the real folder or just the temp folder.
       
       try {
           let createdFolder: Folder | null = null;
           await executeSave(async () => {
               const data = await folderService.createFolder(projectId, title, newOrder);
               createdFolder = data;
               setFolders(prev => prev.map(f => f.id === tempId ? data : f));
           });
           return createdFolder;
       } catch (err) {
           logger.error('Failed to create folder', err);
           setFolders(prev => prev.filter(f => f.id !== tempId));
           return null;
       }
   };

   const handleUpdateFolder = async (folderId: string, title: string) => {
       setFolders(prev => prev.map(f => f.id === folderId ? { ...f, title, updated_at: new Date().toISOString() } : f));
       try {
           await executeSave(async () => {
               await folderService.updateFolder(folderId, { title });
           });
       } catch (err) {
           logger.error('Failed to update folder', err);
       }
   };

   const handleDeleteFolder = async (folderId: string) => {
       const oldFolders = [...folders];
       
       setFolders(prev => prev.filter(f => f.id !== folderId));
       
       try {
           await executeSave(async () => {
               await folderService.deleteFolder(folderId);
           });
           toast.success('Folder deleted');
           return true;
       } catch (err) {
           logger.error('Failed to delete folder', err);
           toast.error('Failed to delete folder');
           setFolders(oldFolders);
           return false;
       }
   };

   const handleMoveFolder = async (folderId: string, direction: 'left' | 'right') => {
       const currentIndex = folders.findIndex(f => f.id === folderId);
       if (currentIndex === -1) return;

       const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
       if (newIndex < 0 || newIndex >= folders.length) return;

       const newFolders = arrayMove(folders, currentIndex, newIndex);
       setFolders(newFolders);

       const updates = newFolders.map((f, index) => ({ id: f.id, sort_order: index }));
       
       try {
           await executeSave(async () => {
               await folderService.updateFolderOrder(updates);
           });
       } catch (err) {
           logger.error('Failed to move folder', err);
       }
   };

   return {
       folders,
       setFolders,
       loadFolders,
       handleAddFolder,
       handleUpdateFolder,
       handleDeleteFolder,
       handleMoveFolder
   };
};

