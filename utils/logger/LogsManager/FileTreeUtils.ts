// utils/logger/LogsManager/FileTreeUtils.ts
import { createLogger } from '@/utils/logger/Logger';

const componentLogger = createLogger('FileTreeUtils');

// Типы
export interface LoggerInfo {
   name: string;
   color: string;
   file: string;
   line: number;
}

export interface LoggerCallInfo {
   componentName: string;
   method: string;
   message: string;
   file: string;
   line: number;
   providedLine?: number;
   data?: string;
}

export interface LoggerConfig {
   enabled: boolean;
   color: string;
   lastChanged?: number;
   filePath?: string;
   createdAt?: number;
   isHidden?: boolean; // New flag for hidden components
}

export interface TreeNode {
   type: 'folder' | 'file';
   name: string;
   path: string;
   children?: TreeNode[];
   childrenMap?: Record<string, TreeNode>;
   loggerInfo?: LoggerInfo;
   loggerCount?: number;
}

// Функция для построения дерева файлов
export function buildFileTree(
   loggers: LoggerInfo[],
   getLoggerCallsCount: (componentName: string, file: string) => number,
   rootPath?: string // Опциональный корневой путь для обрезки
): TreeNode[] {
   const tree: Record<string, TreeNode> = {};

   // Фильтруем логгеры с реальными вызовами
   const loggersWithCalls = loggers.filter((logger) => {
      const callsCount = getLoggerCallsCount(logger.name, logger.file);
      return callsCount > 0;
   });

   loggersWithCalls.forEach((logger) => {
      let cleanPath = logger.file.startsWith('/') ? logger.file.slice(1) : logger.file;
      
      // Если задан rootPath, проверяем начинается ли путь с него
      if (rootPath) {
         // Убираем leading slash из rootPath если есть
         const cleanRoot = rootPath.startsWith('/') ? rootPath.slice(1) : rootPath;
         
         if (cleanPath.startsWith(cleanRoot)) {
            // Отрезаем rootPath из начала пути
            cleanPath = cleanPath.slice(cleanRoot.length);
            // Если остался слэш в начале - убираем
            if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
         }
      }

      const pathParts = cleanPath.split('/');

      // Убираем префикс "app/" для корневых папок (только если не использовали rootPath)
      if (!rootPath && pathParts[0] === 'app' && pathParts.length > 1) {
         pathParts.shift(); // Убираем "app"
      }

      // Создаем путь к файлу, создавая все папки по пути
      let currentNode = tree;
      let currentPath = '';

      // Проходим по всем частям пути кроме последней (которая файл)
      for (let i = 0; i < pathParts.length - 1; i++) {
         const folderName = pathParts[i];
         currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

         // Создаем папку если её нет
         if (!currentNode[folderName]) {
            currentNode[folderName] = {
               type: 'folder',
               name: folderName,
               path: currentPath,
               children: [],
            };
         }

         // Переходим в эту папку - нужно создать объект для её детей
         if (!currentNode[folderName].childrenMap) {
            currentNode[folderName].childrenMap = {};
         }
         currentNode = currentNode[folderName].childrenMap!;
      }

      // Добавляем файл
      const fileName = pathParts[pathParts.length - 1].replace(/\.(tsx?|jsx?)$/, '');
      const callsCount = getLoggerCallsCount(logger.name, logger.file);

      // ВАЖНО: Не перезаписываем папки файлами с одинаковыми именами!
      // Если уже есть узел с таким именем и это папка - добавляем суффикс
      let actualFileName = fileName;
      if (currentNode[fileName] && currentNode[fileName].type === 'folder') {
         actualFileName = `${fileName}_file`;
         componentLogger.warning(
            `Конфликт имён: папка и файл "${fileName}". Файл переименован в "${actualFileName}"`);
      }

      // Path формируем ПОСЛЕ переименования
      const filePath = currentPath ? `${currentPath}/${actualFileName}` : actualFileName;

      currentNode[actualFileName] = {
         type: 'file',
         name: logger.name,
         path: filePath,
         loggerInfo: logger,
         loggerCount: callsCount,
      };
   });

   // Преобразуем в массив и сортируем (папки сверху, потом файлы)
   const convertToArray = (level: Record<string, TreeNode>): TreeNode[] => {
      const nodes = Object.values(level);

      nodes.forEach((node) => {
         if (node.type === 'folder') {
            // Преобразуем childrenMap в массив children
            if (node.childrenMap) {
               node.children = convertToArray(node.childrenMap);
            } else {
               node.children = [];
            }
         }
      });

      return nodes.sort((a, b) => {
         // Файлы сверху
         if (a.type !== b.type) {
            return a.type === 'file' ? -1 : 1;
         }
         // Алфавитный порядок
         return a.name.localeCompare(b.name);
      });
   };

   const result = convertToArray(tree);
   return result;
}

