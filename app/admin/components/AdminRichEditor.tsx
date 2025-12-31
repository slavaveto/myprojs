'use client';

import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { clsx } from 'clsx';
import { Bold, Italic, Trash2, Highlighter, Baseline } from 'lucide-react';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('AdminRichEditor');

// Встроенный CustomBubbleMenu, так как стандартный из @tiptap/react иногда капризничает с типами
const AdminBubbleMenu = ({ editor }: { editor: any }) => {
   const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

   useEffect(() => {
      const updatePosition = () => {
         const { from, to, empty } = editor.state.selection;
         
         if (empty) {
            setPosition(null);
            return;
         }

         // Get coordinates
         const { view } = editor;
         // Защита от ошибок, если view еще не готов
         if (!view || !view.coordsAtPos) return;

         const start = view.coordsAtPos(from);
         const end = view.coordsAtPos(to);
         
         // Calculate center
         const left = (start.left + end.right) / 2;
         const top = start.top - 50; // Чуть выше из-за увеличения меню

         setPosition({ top, left });
      };

      editor.on('selectionUpdate', updatePosition);
      editor.on('blur', () => setPosition(null));

      return () => {
         editor.off('selectionUpdate', updatePosition);
         editor.off('blur', () => setPosition(null));
      };
   }, [editor]);

   if (!position) return null;

   return (
      <div 
         className="fixed z-50 flex items-center gap-0.5 p-1 rounded-lg bg-content1 shadow-medium border border-default-200 animate-in fade-in zoom-in-95 duration-100"
         style={{ 
             top: position.top, 
             left: position.left, 
             transform: 'translateX(-50%)' 
         }}
         onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
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

         {/* Highlights */}
         <button
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#facc15' }).run()}
            className={clsx(
               "p-1.5 rounded-md transition-colors",
               editor.isActive('highlight', { color: '#facc15' }) 
                  ? 'bg-[#facc15]/20 text-[#facc15]' // Оставляем цвет, добавляем фон
                  : 'text-[#facc15] hover:bg-default-100'
            )}
            title="Yellow Highlight"
            type="button"
         >
           <Highlighter size={16} />
         </button>
         
         <button
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#f87171' }).run()}
            className={clsx(
               "p-1.5 rounded-md transition-colors",
               editor.isActive('highlight', { color: '#f87171' }) 
                  ? 'bg-[#f87171]/20 text-[#f87171]' // Оставляем цвет, добавляем фон
                  : 'text-[#f87171] hover:bg-default-100'
            )}
            title="Red Highlight"
            type="button"
         >
            <Highlighter size={16} />
         </button>

         <div className="w-px h-4 bg-default-200 mx-1" />

         {/* Text Colors */}
         <button
            onClick={() => {
               if (editor.isActive('textStyle', { color: '#3b82f6' })) {
                  editor.chain().focus().unsetColor().run();
               } else {
                  editor.chain().focus().setColor('#3b82f6').run();
               }
            }}
            className={clsx(
               "p-1.5 rounded-md transition-colors",
               editor.isActive('textStyle', { color: '#3b82f6' }) 
                  ? 'bg-primary/10 text-[#3b82f6]' 
                  : 'text-[#3b82f6] hover:bg-default-100'
            )}
            title="Blue Text"
            type="button"
         >
            <Baseline size={16} />
         </button>

         <button
            onClick={() => {
               if (editor.isActive('textStyle', { color: '#ef4444' })) {
                  editor.chain().focus().unsetColor().run();
               } else {
                  editor.chain().focus().setColor('#ef4444').run();
               }
            }}
            className={clsx(
               "p-1.5 rounded-md transition-colors",
               editor.isActive('textStyle', { color: '#ef4444' }) 
                  ? 'bg-danger/10 text-[#ef4444]' 
                  : 'text-[#ef4444] hover:bg-default-100'
            )}
            title="Red Text"
            type="button"
         >
            <Baseline size={16} />
         </button>

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

