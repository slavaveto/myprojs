'use client';

import React from 'react';
import { TreeNode } from './FileTreeUtils';
import { useLoggerContext } from './LoggerContext';
import { FolderNode } from './FolderNode';
import { FileNode } from './FileNode';

interface TreeNodeComponentProps {
   node: TreeNode;
   level: number;
   parentBlocked?: boolean;
   parentSwitchDisabled?: boolean;
   // Все остальные пропсы теперь не нужны, они берутся из контекста внутри узлов
   // Мы оставляем только те, которые передаются рекурсивно и зависят от позиции в дереве
   // expandedFolders, folderFilters, selectedComponent и т.д. убраны
}

export const TreeNodeComponent: React.FC<TreeNodeComponentProps> = ({
   node,
   level,
   parentBlocked = false,
   parentSwitchDisabled = false,
}) => {
   if (node.type === 'folder') {
      return (
         <FolderNode
            node={node}
            level={level}
            parentBlocked={parentBlocked}
                        parentSwitchDisabled={parentSwitchDisabled}
         />
      );
   }

   return (
      <FileNode
         node={node}
         level={level}
         parentBlocked={parentBlocked}
                     />
   );
};
