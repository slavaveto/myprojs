'use client';

import React from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { TreeNode } from './FileTreeUtils';
import { useLoggerContext } from './LoggerContext';
import { TreeNodeComponent } from './FileTree';

interface FolderNodeProps {
   node: TreeNode;
   level: number;
   parentBlocked?: boolean;
   parentSwitchDisabled?: boolean;
}

export function FolderNode({
   node,
   level,
   parentBlocked = false,
   parentSwitchDisabled = false,
}: FolderNodeProps) {
   const {
      collapsedFolders,
      folderFilters,
      selectedFolder,
      toggleFolder,
      toggleFolderHidden,
      hiddenFolders,
      handleSelectFolder,
      filteredLoggers,
      getLoggerCallsCount,
      currentTabPath,
      pinnedComponents,
      getLoggerKey
   } = useLoggerContext();

   // Вычисляем полный путь папки для корректного скрытия (node.path относительный внутри таба)
   const fullFolderPath = React.useMemo(() => {
       if (!currentTabPath) return node.path;
       return `${currentTabPath}/${node.path}`.replace(/\/+/g, '/');
   }, [currentTabPath, node.path]);

   // Проверяем, есть ли закрепленные компоненты внутри этой папки
   const hasPinnedChildren = React.useMemo(() => {
       const checkNode = (n: TreeNode): boolean => {
           if (n.type === 'file' && n.loggerInfo) {
               const key = getLoggerKey(n.loggerInfo);
               return pinnedComponents.includes(key);
           }
           if (n.type === 'folder' && n.children) {
               return n.children.some(child => checkNode(child));
           }
           return false;
       };
       return checkNode(node);
   }, [node, pinnedComponents, getLoggerKey]);

   // Для корневого узла нужно знать, является ли он первым, чтобы убрать отступ сверху
   // Это немного костыль, но мы попытаемся определить это через filteredLoggers и buildFileTree
   // или просто передадим флаг через пропсы (но мы хотим избежать проп дриллинга)
   // В оригинале было: level === 0 && node.path === treeData[0]?.path
   // Мы можем получить treeData из filteredLoggers + buildFileTree
   // Но это дорого. Пока оставим отступ всегда или уберем его.
   // В оригинале: marginTop: level === 0 && node.path === treeData[0]?.path ? '0' : level === 0 ? '18px' : '0'
   
   const isExpanded = !collapsedFolders.has(node.path);

   // Если родитель уже заблокирован - не проверяем дальше
   const isCurrentFolderDisabled = !folderFilters.has(node.path);
   const shouldShowAsBlocked = parentBlocked || isCurrentFolderDisabled;
   const isBlockedForChildren = parentBlocked || isCurrentFolderDisabled;

   // КОРНЕВЫЕ ПАПКИ (level === 0) НИКОГДА не приглушаются
   // Подпапки приглушаются ТОЛЬКО если родитель заблокирован (parentBlocked)
   // НЕ приглушаем если папка сама выключена - только если отфильтрована сверху
   const shouldApplyOpacity = level > 0 && parentBlocked;

   return (
      <div className="relative">
         {/* Вертикальная линия для уровня */}
         {level > 0 && (
            <div
               className="absolute top-0 bottom-0 w-px bg-default-200 z-10"
               style={{ left: `${level * 30 - 13}px` }}
            />
         )}

         <div
            className="group flex items-center  px-3 py-1 rounded-md transition-colors relative cursor-pointer"
            style={{
               paddingLeft: `${level * 30 + 8}px`,
               // Упрощаем логику отступа: для всех корневых папок небольшой отступ, кроме первой
               // Но мы не знаем, первая ли она. Сделаем просто небольшой отступ для всех корневых.
               marginTop: level === 0 ? '4px' : '0',
               marginBottom: '4px',
               opacity: shouldApplyOpacity ? 0.5 : 1,
            }}
            onClick={() => {
               // Клик на общий div - выбираем папку для показа всех логгеров
               handleSelectFolder(node.path);
            }}
         >
            {/* Фон папки - серый или с рамкой (если выбрана) - для level 0 от края, для вложенных сдвиг влево на 3px */}
            <div
               className={clsx(
                  'absolute top-0 bottom-0 right-0 rounded-md z-0 transition-colors border',
                  selectedFolder === node.path
                     ? 'bg-blue-50 border-primary-500 dark:bg-blue-900/80 dark:border-primary-400'
                     : 'bg-blue-50 border-transparent dark:bg-blue-900/80 group-hover:bg-blue-100 dark:group-hover:bg-blue-800'
               )}
               style={{
                  left: level === 0 ? '0' : `${level * 30 + 8 - 3}px`,
               }}
            />

            <div className="flex items-center gap-3 flex-1 relative z-10">
               <div
                  className="cursor-pointer"
                  onClick={(e) => {
                     e.stopPropagation();
                     toggleFolder(node.path);
                     // Выбираем папку ТОЛЬКО если разворачиваем (isExpanded = false сейчас, станет true)
                     if (!isExpanded) {
                        handleSelectFolder(node.path);
                     }
                  }}
               >
                  {isExpanded ? (
                     <ChevronDown size={20} className="text-default-500" />
                  ) : (
                     <ChevronRight size={20} className="text-default-500" />
                  )}
               </div>
               <div
                  className="cursor-pointer"
                  onClick={(e) => {
                     e.stopPropagation();
                     toggleFolder(node.path);
                     // Выбираем папку ТОЛЬКО если разворачиваем
                     if (!isExpanded) {
                        handleSelectFolder(node.path);
                     }
                  }}
               >
                  {isExpanded ? (
                     <FolderOpen
                        size={20}
                        className={level === 0 ? 'text-blue-500' : 'text-blue-500'}
                     />
                  ) : (
                     <Folder
                        size={20}
                        className={level === 0 ? 'text-blue-500' : 'text-blue-500'}
                     />
                  )}
               </div>
               <span
                  className={clsx(
                     'text-foreground text-[18px] cursor-pointer',
                     level === 0 ? 'font-semibold' : 'font-medium'
                  )}
                  onClick={(e) => {
                     e.stopPropagation();
                     toggleFolder(node.path);
                     // Выбираем папку ТОЛЬКО если разворачиваем
                     if (!isExpanded) {
                        handleSelectFolder(node.path);
                     }
                  }}
               >
                  {node.name}
               </span>

               {!hasPinnedChildren && (
                  <button
                     onClick={(e) => {
                        e.stopPropagation();
                        toggleFolderHidden(fullFolderPath);
                     }}
                      className={clsx(
                         'p-1 rounded transition-colors cursor-pointer ml-auto',
                         hiddenFolders.has(fullFolderPath)
                            ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'hover:bg-default-200 text-default-400 opacity-0 group-hover:opacity-100'
                      )}
                     title={hiddenFolders.has(fullFolderPath) ? 'Показать (раскрыть)' : 'Скрыть папку'}
                  >
                     {hiddenFolders.has(fullFolderPath) ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
               )}
            </div>
         </div>

         {isExpanded && node.children && (
            <div>
               {node.children.map((child) => (
                  <TreeNodeComponent
                     key={child.path}
                     node={child}
                     level={level + 1}
                     parentBlocked={isBlockedForChildren}
                     parentSwitchDisabled={parentSwitchDisabled}
                  />
               ))}
            </div>
         )}
      </div>
   );
}

