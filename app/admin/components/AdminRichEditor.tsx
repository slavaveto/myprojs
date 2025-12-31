'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { clsx } from 'clsx';
import { Bold, Italic, Trash2, Highlighter, Baseline, ChevronDown, Check } from 'lucide-react';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('AdminRichEditor');

const COLORS = [
   { label: 'Default', value: null, class: 'bg-default-200' }, // Сброс
   { label: 'Red', value: '#ef4444', class: 'bg-[#ef4444]' },
   { label: 'Orange', value: '#f97316', class: 'bg-[#f97316]' },
   { label: 'Yellow', value: '#eab308', class: 'bg-[#eab308]' },
   { label: 'Green', value: '#22c55e', class: 'bg-[#22c55e]' },
   { label: 'Blue', value: '#3b82f6', class: 'bg-[#3b82f6]' },
   { label: 'Purple', value: '#a855f7', class: 'bg-[#a855f7]' },
];

const ColorPicker = ({ 
   icon: Icon, 
   activeColor, 
   onChange, 
   title 
}: { 
   icon: any, 
   activeColor: string | null, 
   onChange: (color: string | null) => void,
   title: string
}) => {
   const [isOpen, setIsOpen] = useState(false);
   const wrapperRef = useRef<HTMLDivElement>(null);

   // Закрытие при клике вне
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
            setIsOpen(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   return (
      <div className="relative" ref={wrapperRef}>
         <button
            onClick={() => setIsOpen(!isOpen)}
            className={clsx(
               "flex items-center gap-0.5 p-1.5 rounded-md transition-colors",
               activeColor ? 'bg-default-100' : 'hover:bg-default-100'
            )}
            title={title}
            type="button"
         >
            <Icon 
               size={16} 
               style={{ color: activeColor || 'currentColor' }} 
               className={!activeColor ? "text-default-500" : ""}
            />
            <ChevronDown size={10} className="text-default-400" />
         </button>

         {isOpen && (
            <div className="absolute top-full mt-1 left-0 p-2 bg-content1 rounded-lg shadow-lg border border-default-200 grid grid-cols-4 gap-1 z-50 w-[140px]">
               {COLORS.map((color) => (
                  <button
                     key={color.label}
                     onClick={() => {
                        onChange(color.value);
                        setIsOpen(false);
                     }}
                     className={clsx(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                        color.class,
                        // Для дефолтного цвета (сброс) добавим иконку крестика или просто серый круг
                        color.value === null && "border border-default-300 relative"
                     )}
                     title={color.label}
                     type="button"
                  >
                     {activeColor === color.value && (
                        <Check size={12} className="text-white drop-shadow-md" strokeWidth={3} />
                     )}
                     {color.value === null && !activeColor && (
                        <div className="w-full h-[1px] bg-default-400 absolute rotate-45" />
                     )}
                  </button>
               ))}
            </div>
         )}
      </div>
   );
};

// Встроенный CustomBubbleMenu
const AdminBubbleMenu = ({ editor }: { editor: any }) => {
   const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

   useEffect(() => {
      const updatePosition = () => {
         const { from, to, empty } = editor.state.selection;
         
         if (empty) {
            setPosition(null);
            return;
         }

         const { view } = editor;
         if (!view || !view.coordsAtPos) return;

         const start = view.coordsAtPos(from);
         const end = view.coordsAtPos(to);
         
         const left = (start.left + end.right) / 2;
         const top = start.top - 50;

         setPosition({ top, left });
      };

      editor.on('selectionUpdate', updatePosition);
      editor.on('blur', () => {
         // Не скрываем сразу, если кликнули внутрь меню (например, в колорпикер)
         // Но так как меню в портале или fixed, блюр редактора сработает.
         // Оставим пока так, если будет закрываться при выборе цвета - поправим.
         // UPD: Blur срабатывает при потере фокуса редактором. Клик в кнопку меню - это потеря фокуса.
         // Чтобы меню не исчезало, нужно preventDefault на кнопках (уже есть onMouseDown).
         // Но для попапа внутри меню...
         // Сделаем простую задержку или проверку фокуса? 
         // Самый простой способ: BubbleMenu титпапа сам хендлит это. 
         // Но мы пишем свое. 
         // Пока оставим setPosition(null), но кнопки должны иметь onMouseDown={(e) => e.preventDefault()}
         // ColorPicker - это отдельный компонент, там кнопки тоже должны превентить.
      });

      return () => {
         editor.off('selectionUpdate', updatePosition);
         editor.off('blur', () => {}); // cleanup
      };
   }, [editor]);

   // Чтобы меню не мигало/исчезало при клике, нужно аккуратно с блюром.
   // В текущей реализации blur скрывает меню. Это проблема для ColorPicker.
   // Решение: не скрывать меню по blur, если фокус ушел ВНУТРЬ меню.
   // Но так как это fixed div, фокус может уйти в никуда.
   // Просто уберем скрытие по blur для нашего кастомного меню, оно и так зависит от selection.
   // Если selection empty -> menu hidden. Если кликнули мимо -> selection empty (обычно).
   // НО selection остается, если кликнуть в UI.
   // Tiptap обычно скрывает меню если фокус ушел из редактора.
   
   if (!position) return null;

   const getCurrentColor = (type: 'textStyle' | 'highlight') => {
       // Ищем активный цвет среди наших констант
       for (const color of COLORS) {
           if (color.value && editor.isActive(type, { color: color.value })) {
               return color.value;
           }
       }
       return null;
   };

   return (
      <div 
         className="fixed z-50 flex items-center gap-0.5 p-1 rounded-lg bg-content1 shadow-medium border border-default-200 animate-in fade-in zoom-in-95 duration-100"
         style={{ 
             top: position.top, 
             left: position.left, 
             transform: 'translateX(-50%)' 
         }}
         onMouseDown={(e) => {
            // Важно! Предотвращаем потерю фокуса редактором при клике на само меню
            e.preventDefault(); 
         }} 
      >
         <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={clsx(
               "p-1.5 rounded-md hover:bg-default-100 transition-colors text-default-500",
               editor.isActive('bold') && 'text-primary bg-primary/10 font-bold'
            )}
            type="button"
            title="Bold"
         >
            <Bold size={16} />
         </button>
         
         <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={clsx(
               "p-1.5 rounded-md hover:bg-default-100 transition-colors text-default-500",
               editor.isActive('italic') && 'text-primary bg-primary/10 italic'
            )}
            type="button"
            title="Italic"
         >
            <Italic size={16} />
         </button>

         <div className="w-px h-4 bg-default-200 mx-1" />

         {/* Highlight Picker */}
         <ColorPicker 
            icon={Highlighter}
            title="Highlight Color"
            activeColor={getCurrentColor('highlight')}
            onChange={(color) => {
               if (color) editor.chain().focus().toggleHighlight({ color }).run();
               else editor.chain().focus().unsetHighlight().run();
            }}
         />

         {/* Text Color Picker */}
         <ColorPicker 
            icon={Baseline}
            title="Text Color"
            activeColor={getCurrentColor('textStyle')}
            onChange={(color) => {
               if (color) editor.chain().focus().setColor(color).run();
               else editor.chain().focus().unsetColor().run();
            }}
         />

         <div className="w-px h-4 bg-default-200 mx-1" />

         <button
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
            className="p-1.5 rounded-md hover:bg-danger/10 text-default-400 hover:text-danger transition-colors"
            title="Clear formatting"
            type="button"
         >
            <Trash2 size={16} />
         </button>
      </div>
   );
};

interface AdminRichEditorProps {
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
   onBlur?: () => void;
   className?: string;
   disabled?: boolean;
}

// @ref:admin-rich-editor
// Компонент Rich Text Editor специально для админки. Полностью изолирован от основного приложения.
export const AdminRichEditor = ({ 
   value, 
   onChange, 
   placeholder = 'Write something...', 
   onBlur,
   className,
   disabled = false
}: AdminRichEditorProps) => {

   const editor = useEditor({
      immediatelyRender: false,
      extensions: [
         StarterKit.configure({
            heading: false,
            codeBlock: false,
            bulletList: false, // Пока отключаем списки для простоты, если нужно - включим
            orderedList: false,
         }),
         Placeholder.configure({
            placeholder,
            emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-default-400 before:float-left before:h-0 before:pointer-events-none',
         }),
         TextStyle,
         Color,
         Highlight.configure({
            multicolor: true,
         }),
      ],
      content: value,
      editable: !disabled,
      editorProps: {
         attributes: {
            class: clsx(
               'min-h-[100px] w-full rounded-medium px-3 py-2 outline-none transition-colors',
               'bg-default-100 hover:bg-default-200 focus:bg-default-100',
               'data-[hover=true]:bg-default-200 group-data-[focus=true]:bg-default-100',
               'text-small text-foreground',
               'focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background', // Стили фокуса похожие на HeroUI Input
               className
            ),
         },
      },
      onUpdate: ({ editor }) => {
         const html = editor.getHTML();
         // Если редактор пуст (только теги p), возвращаем пустую строку
         const isEmpty = editor.isEmpty;
         onChange(isEmpty ? '' : html);
      },
      onBlur: () => {
         if (onBlur) onBlur();
      },
   });

   // Синхронизация значения извне, если оно изменилось (но аккуратно, чтобы не сбить курсор при наборе)
   useEffect(() => {
      if (editor && value !== editor.getHTML()) {
         // Простая проверка. Для продакшена лучше сравнивать контент глубже, 
         // но для админки и простых кейсов сойдет, чтобы обновить начальное состояние.
         // Важно: это сработает, если данные пришли с сервера ПОСЛЕ инициализации.
         if (editor.getText() === '' && value === '') return; // Избегаем цикла пустых обновлений
         
         // Обновляем только если редактор не в фокусе, чтобы не мешать вводу,
         // ЛИБО если это первое наполнение (пустой редактор).
         if (!editor.isFocused || editor.isEmpty) {
             editor.commands.setContent(value);
         }
      }
   }, [value, editor]);

   // Обновление состояния disabled
   useEffect(() => {
      editor?.setEditable(!disabled);
   }, [disabled, editor]);

   if (!editor) {
      return null;
   }

   return (
      <div className="admin-rich-editor relative group">
         {editor && <AdminBubbleMenu editor={editor} />}
         
         <EditorContent editor={editor} />
      </div>
   );
};

