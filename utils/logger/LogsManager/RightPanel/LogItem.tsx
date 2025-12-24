// utils/logger/LogsManager/RightPanel/LogItem.tsx
import React, { useState } from 'react';
import { Switch, Popover, PopoverTrigger, PopoverContent, Input, Select, SelectItem, Button } from '@heroui/react';
import { 
   Pin, Trash2, Edit3, Info, Rocket, CheckCircle, AlertTriangle, AlertCircle, FileJson 
} from 'lucide-react';
import clsx from 'clsx';
import { AVAILABLE_COLORS, COLOR_MAP } from '@/utils/logger/services/loggerColors';
import { LoggerCallInfo, LoggerConfig } from './types';

interface LogItemProps {
   loggerCall: LoggerCallInfo;
   config: LoggerConfig;
   isBlocked: boolean;
   isGrouped: boolean;
   isNewLog: boolean;
   isHighlighted?: boolean; // Added isHighlighted prop
   pinnedLogs: string[];
   componentColor: string;
   loggerCallKey: string;
   loggerCallConfigKey: string;
   updateLoggerCallConfig: (call: LoggerCallInfo, config: Partial<LoggerConfig>) => void;
   setPinnedLogs: (logs: string[] | ((prev: string[]) => string[])) => void;
   onDeleteLog: (file: string, line: number) => void;
   onEditLog: (file: string, line: number, message: string, method: string) => Promise<void>;
}

export const LogItem = ({
   loggerCall,
   config,
   isBlocked,
   isGrouped,
   isNewLog,
   isHighlighted, // Added isHighlighted
   pinnedLogs,
   componentColor,
   loggerCallKey,
   loggerCallConfigKey,
   updateLoggerCallConfig,
   setPinnedLogs,
   onDeleteLog,
   onEditLog,
}: LogItemProps) => {
   const [isPopoverOpen, setIsPopoverOpen] = useState(false);
   const [isEditPopoverOpen, setIsEditPopoverOpen] = useState(false);
   const [isDeletePopoverOpen, setIsDeletePopoverOpen] = useState(false);
   const logRef = React.useRef<HTMLDivElement>(null); // Added ref

   // Scroll into view if highlighted
   React.useEffect(() => {
      if (isHighlighted && logRef.current) {
         logRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
   }, [isHighlighted]);

   const [editMessage, setEditMessage] = useState(loggerCall.message);
   const [editMethod, setEditMethod] = useState(loggerCall.method);

   const logColor = config.color || 'black';
   const logColorInfo = AVAILABLE_COLORS.find((c) => c.key === logColor);
   const shouldBeTransparent = isBlocked || !config.enabled;

   // Icons mapping
   const methodIcons = {
      info: Info,
      start: Rocket,
      end: CheckCircle,
      success: CheckCircle,
      error: AlertCircle,
      warning: AlertTriangle,
   };
   const methodColors = {
      info: 'text-default-500',
      start: 'text-orange-400',
      end: 'text-green-600',
      success: 'text-green-600',
      error: 'text-red-500',
      warning: 'text-yellow-500',
   };
   const Icon = methodIcons[loggerCall.method as keyof typeof methodIcons];
   const iconColor = methodColors[loggerCall.method as keyof typeof methodColors];

   return (
      <div className={`flex items-center gap-0 ${shouldBeTransparent ? 'opacity-50' : 'opacity-100'}`}>
         
         {/* Pin Button */}
         <button
            onClick={(e) => {
               e.stopPropagation();
               setPinnedLogs((prev) =>
                  prev.includes(loggerCallConfigKey)
                     ? prev.filter((k) => k !== loggerCallConfigKey)
                     : [...prev, loggerCallConfigKey]
               );
            }}
            className={clsx(
               'p-1 rounded transition-colors cursor-pointer shrink-0 relative mr-2',
               pinnedLogs.includes(loggerCallConfigKey)
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary'
                  : 'hover:bg-default-200 text-default-400'
            )}
            style={{ top: pinnedLogs.includes(loggerCallConfigKey) ? '0px' : '1px' }}
            title={pinnedLogs.includes(loggerCallConfigKey) ? 'Открепить лог' : 'Закрепить лог'}
         >
            <Pin size={16} className={pinnedLogs.includes(loggerCallConfigKey) ? 'fill-current' : ''} />
         </button>

         {/* Color Picker Popover */}
         <Popover placement="left" isOpen={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger>
               <button
                  className="shrink-0 mr-2 w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform border-2 border-default-300"
                  style={{
                     backgroundColor: logColor === 'black' ? '#d4d4d8' : logColorInfo?.hex || '#d4d4d8',
                  }}
               />
            </PopoverTrigger>
            <PopoverContent className="p-2">
               <div className="grid grid-cols-5 gap-2">
                  {AVAILABLE_COLORS.map((color) => (
                     <button
                        key={color.key}
                        onClick={() => {
                           updateLoggerCallConfig(loggerCall, { color: color.key });
                           setIsPopoverOpen(false);
                        }}
                        className={`w-6 h-6 rounded-full hover:scale-110 transition-transform cursor-pointer ${
                           logColor === color.key ? 'ring-2 ring-offset-2 ring-primary' : color.key === 'black' ? 'border-2 border-default-300' : ''
                        }`}
                        style={{ backgroundColor: color.key === 'black' ? '#d4d4d8' : color.hex }}
                        title={color.label}
                     />
                  ))}
               </div>
            </PopoverContent>
         </Popover>

         {/* Log Content Card */}
         {loggerCall.data ? (
            <Popover placement="top-end" showArrow>
               <PopoverTrigger>
                  <div
                     ref={logRef} // Added ref
                     className={`p-2 rounded-lg cursor-pointer hover:bg-default-100 transition-colors relative ${
                        !isGrouped && logColor === 'black' ? 'border border-gray-300 dark:border-gray-600' : ''
                     }`}
                     style={{
                        width: 'calc(100% - 64px)',
                        fontSize: '14px',
                        ...(logColor !== 'black' || isGrouped
                           ? {
                                borderWidth: isGrouped ? '2px' : '1px',
                                borderStyle: 'solid',
                                borderColor: isGrouped ? '#fb923c' : logColorInfo?.hex,
                             }
                           : {}),
                        // Combine styles for new logs and highlighted logs
                        ...((isNewLog || isHighlighted) ? { 
                            outline: isHighlighted ? '2px solid #3b82f6' : '1.5px dashed #f59e0b', // Blue solid for highlight, Orange dashed for new
                            outlineOffset: '2px',
                            boxShadow: isHighlighted ? '0 0 10px rgba(59, 130, 246, 0.5)' : undefined
                         } : {}),
                        WebkitFontSmoothing: 'subpixel-antialiased',
                     }}
                  >
                     {/* Actions Overlay: Edit */}
                     <div className="absolute top-1 right-1 flex gap-1 z-10">
                        {/* Edit Button */}
                        <Popover placement="top" isOpen={isEditPopoverOpen} onOpenChange={setIsEditPopoverOpen}>
                           <PopoverTrigger>
                              <button
                                 onClick={(e) => { e.stopPropagation(); }}
                                 className="p-1 rounded transition-colors cursor-pointer hover:bg-default-200 text-default-400 hover:text-primary"
                                 title="Редактировать лог"
                              >
                                 <Edit3 size={14} />
                              </button>
                           </PopoverTrigger>
                           <PopoverContent className="p-4">
                              <div className="flex flex-col gap-3 w-[400px]">
                                 <div className="text-sm font-semibold mb-2">Редактировать лог</div>
                                 <Input label="Сообщение" value={editMessage} onChange={(e) => setEditMessage(e.target.value)} size="sm" variant="bordered" />
                                 <Select 
                                    label="Тип" 
                                    selectedKeys={[editMethod]} 
                                    onSelectionChange={(keys) => { const s = Array.from(keys)[0]; if(s) setEditMethod(s.toString()); }} 
                                    size="sm" variant="bordered"
                                    classNames={{
                                       trigger: "cursor-pointer"
                                     }}
                                 >
                                    <SelectItem key="info" startContent={<Info size={16} className="text-default-500" />}>Info</SelectItem>
                                    <SelectItem key="success" startContent={<CheckCircle size={16} className="text-green-600" />}>Success</SelectItem>
                                    <SelectItem key="warning" startContent={<AlertTriangle size={16} className="text-yellow-500" />}>Warning</SelectItem>
                                    <SelectItem key="error" startContent={<AlertCircle size={16} className="text-red-500" />}>Error</SelectItem>
                                    <SelectItem key="start" startContent={<Rocket size={16} className="text-orange-400" />}>Start</SelectItem>
                                    <SelectItem key="end" startContent={<CheckCircle size={16} className="text-green-600" />}>End</SelectItem>
                                 </Select>
                                 <div className="flex gap-2 mt-2">
                                    <Button size="sm" color="default" variant="flat" onPress={() => { setEditMessage(loggerCall.message); setEditMethod(loggerCall.method); setIsEditPopoverOpen(false); }} className="flex-1">Отмена</Button>
                                    <Button size="sm" color="primary" variant="solid" onPress={async () => { await onEditLog(loggerCall.file, loggerCall.line, editMessage, editMethod); setIsEditPopoverOpen(false); }} className="flex-1">Сохранить</Button>
                                 </div>
                              </div>
                           </PopoverContent>
                        </Popover>
                     </div>

                     {/* Content: Header */}
                     <div className="flex items-center gap-1 mb-1">
                        <span className="-font-medium opacity-60" style={{ color: COLOR_MAP[componentColor] || COLOR_MAP.black }}>
                           [{loggerCall.componentName}]
                        </span>
                        {Icon && <Icon size={18} className={iconColor} style={{ marginTop: '0px' }} />}
                        <span className={loggerCall.providedLine && loggerCall.line !== loggerCall.providedLine ? 'text-red-500 font-medium' : 'text-default-600 font-medium'}>
                           ({loggerCall.line})
                        </span>
                        <FileJson size={16} className="text-blue-500 ml-1" />
                     </div>
                     {/* Content: Message */}
                     <div className="flex items-center gap-1"><span>{loggerCall.message}</span></div>
                  </div>
               </PopoverTrigger>
               <PopoverContent className="w-[400px]">
                  <div className="p-3">
                     {/* Popover Detail View */}
                     <div className="flex items-center gap-1 mb-2">
                        <span className="-font-medium opacity-60" style={{ color: COLOR_MAP[componentColor] || COLOR_MAP.black }}>
                           [{loggerCall.componentName}]
                        </span>
                        {Icon && <Icon size={18} className={iconColor} />}
                        <span className={loggerCall.providedLine && loggerCall.line !== loggerCall.providedLine ? 'text-red-500 font-medium' : 'text-default-600 font-medium'}>
                           ({loggerCall.line})
                        </span>
                     </div>
                     <div className="mb-3"><span>{loggerCall.message}</span></div>
                     <div className="border-t border-default-200 pt-2">
                        <div className="text-[14px] w-[350px] bg-default-100 p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap">
                           {(() => {
                              try {
                                 if (typeof loggerCall.data === 'string') {
                                    const parsed = JSON.parse(loggerCall.data);
                                    return `{${Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(', ')}}`;
                                 }
                                 return `{${Object.entries(loggerCall.data).map(([k, v]) => `${k}: ${v}`).join(', ')}}`;
                              } catch {
                                 return String(loggerCall.data);
                              }
                           })()}
                        </div>
                     </div>
                  </div>
               </PopoverContent>
            </Popover>
         ) : (
            // No Data View
            <div
               ref={logRef} // Added ref
               className={`p-2 rounded-lg relative ${!isGrouped && logColor === 'black' ? 'border border-gray-300 dark:border-gray-600' : ''}`}
               style={{
                  width: 'calc(100% - 64px)',
                  fontSize: '14px',
                  ...(logColor !== 'black' || isGrouped
                     ? { borderWidth: isGrouped ? '2px' : '1px', borderStyle: 'solid', borderColor: isGrouped ? '#fb923c' : logColorInfo?.hex }
                     : {}),
                  // Combine styles for new logs and highlighted logs
                  ...((isNewLog || isHighlighted) ? { 
                      outline: isHighlighted ? '2px solid #3b82f6' : '1.5px dashed #f59e0b', // Blue solid for highlight, Orange dashed for new
                      outlineOffset: '2px',
                      boxShadow: isHighlighted ? '0 0 10px rgba(59, 130, 246, 0.5)' : undefined
                   } : {}),
                  WebkitFontSmoothing: 'subpixel-antialiased',
               }}
            >
               {/* Actions Overlay: Edit (Same as above, could be extracted further) */}
                <div className="absolute top-1 right-1 flex gap-1 z-10">
                        {/* Edit Button */}
                        <Popover placement="top" isOpen={isEditPopoverOpen} onOpenChange={setIsEditPopoverOpen}>
                           <PopoverTrigger>
                              <button
                                 onClick={(e) => { e.stopPropagation(); }}
                                 className="p-1 rounded transition-colors cursor-pointer hover:bg-default-200 text-default-400 hover:text-primary"
                                 title="Редактировать лог"
                              >
                                 <Edit3 size={14} />
                              </button>
                           </PopoverTrigger>
                           <PopoverContent className="p-4">
                              <div className="flex flex-col gap-3 w-[400px]">
                                 <div className="text-sm font-semibold mb-2">Редактировать лог</div>
                                 <Input label="Сообщение" value={editMessage} onChange={(e) => setEditMessage(e.target.value)} size="sm" variant="bordered" />
                                 <Select 
                                    label="Тип" 
                                    selectedKeys={[editMethod]} 
                                    onSelectionChange={(keys) => { const s = Array.from(keys)[0]; if(s) setEditMethod(s.toString()); }} 
                                    size="sm" variant="bordered"
                                    classNames={{
                                       trigger: "cursor-pointer"
                                     }}
                                 >
                                    <SelectItem key="info" startContent={<Info size={16} className="text-default-500" />}>Info</SelectItem>
                                    <SelectItem key="success" startContent={<CheckCircle size={16} className="text-green-600" />}>Success</SelectItem>
                                    <SelectItem key="warning" startContent={<AlertTriangle size={16} className="text-yellow-500" />}>Warning</SelectItem>
                                    <SelectItem key="error" startContent={<AlertCircle size={16} className="text-red-500" />}>Error</SelectItem>
                                    <SelectItem key="start" startContent={<Rocket size={16} className="text-orange-400" />}>Start</SelectItem>
                                    <SelectItem key="end" startContent={<CheckCircle size={16} className="text-green-600" />}>End</SelectItem>
                                 </Select>
                                 <div className="flex gap-2 mt-2">
                                    <Button size="sm" color="default" variant="flat" onPress={() => { setEditMessage(loggerCall.message); setEditMethod(loggerCall.method); setIsEditPopoverOpen(false); }} className="flex-1">Отмена</Button>
                                    <Button size="sm" color="primary" variant="solid" onPress={async () => { await onEditLog(loggerCall.file, loggerCall.line, editMessage, editMethod); setIsEditPopoverOpen(false); }} className="flex-1">Сохранить</Button>
                                 </div>
                              </div>
                           </PopoverContent>
                        </Popover>
                     </div>

                  {/* Content: Header */}
                  <div className="flex items-center gap-1 mb-1">
                     <span className="-font-medium opacity-60" style={{ color: COLOR_MAP[componentColor] || COLOR_MAP.black }}>
                        [{loggerCall.componentName}]
                     </span>
                  {Icon && <Icon size={18} className={iconColor} style={{ marginTop: '0px' }} />}
                  <span className={loggerCall.providedLine && loggerCall.line !== loggerCall.providedLine ? 'text-red-500 font-medium' : 'text-default-600 font-medium'}>
                     ({loggerCall.line})
                  </span>
               </div>
               {/* Content: Message */}
               <div className="flex items-center gap-1"><span>{loggerCall.message}</span></div>
            </div>
         )}

         {/* Switch */}
         <Switch
            size="sm"
            color={config.enabled ? 'primary' : 'default'}
            classNames={{ wrapper: config.enabled ? undefined : 'bg-danger-100' }}
            className="scale-60 shrink-0"
            isSelected={config.enabled}
            onValueChange={(enabled) => updateLoggerCallConfig(loggerCall, { enabled })}
         />

         {/* Delete Button */}
         <Popover placement="left" isOpen={isDeletePopoverOpen} onOpenChange={setIsDeletePopoverOpen}>
            <PopoverTrigger>
               <button className="p-1 rounded transition-colors cursor-pointer shrink-0 hover:bg-red-100 dark:hover:bg-red-900/30 text-default-400 hover:text-red-500" title="Удалить лог">
                  <Trash2 size={16} />
               </button>
            </PopoverTrigger>
            <PopoverContent className="p-3">
               <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">Удалить лог из файла?</div>
                  <div className="flex gap-2">
                     <button onClick={() => setIsDeletePopoverOpen(false)} className="flex-1 px-3 cursor-pointer py-1.5 rounded-lg bg-default-200 hover:bg-default-300 text-default-700 text-sm font-medium transition-colors">Отмена</button>
                     <button onClick={() => { onDeleteLog(loggerCall.file, loggerCall.line); setIsDeletePopoverOpen(false); }} className="flex-1 px-3 cursor-pointer py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors">Удалить</button>
                  </div>
               </div>
            </PopoverContent>
         </Popover>
      </div>
   );
};
