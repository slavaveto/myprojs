'use client';

import React, { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { clsx } from 'clsx';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Bold, Italic, Trash2, Highlighter, Baseline } from 'lucide-react';

// Custom Bubble Menu (Full version for Notes)
const NoteBubbleMenu = ({ editor }: { editor: any }) => {
    const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        const updatePosition = () => {
            const { from, to, empty } = editor.state.selection;
            if (empty) {
                setPosition(null);
                return;
            }
            const { view } = editor;
            const start = view.coordsAtPos(from);
            const end = view.coordsAtPos(to);
            const left = (start.left + end.right) / 2;
            const top = start.top - 50; 
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
            style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
            onMouseDown={(e) => e.preventDefault()}
        >
             <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={clsx("p-1.5 rounded-md hover:bg-default-100 transition-colors text-default-500", editor.isActive('bold') && 'text-primary bg-primary/10 font-bold')}
                title="Bold"
            >
                <Bold size={16} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={clsx("p-1.5 rounded-md hover:bg-default-100 transition-colors text-default-500", editor.isActive('italic') && 'text-primary bg-primary/10 italic')}
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
                    editor.isActive('highlight', { color: '#facc15' }) ? 'bg-[#facc15]/20 text-[#facc15]' : 'text-[#facc15] hover:bg-default-100'
                )}
                title="Yellow Highlight"
            >
                <Highlighter size={16} />
            </button>
            
            <button
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#f87171' }).run()}
                className={clsx(
                    "p-1.5 rounded-md transition-colors",
                    editor.isActive('highlight', { color: '#f87171' }) ? 'bg-[#f87171]/20 text-[#f87171]' : 'text-[#f87171] hover:bg-default-100'
                )}
                title="Red Highlight"
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
                    editor.isActive('textStyle', { color: '#3b82f6' }) ? 'bg-primary/10 text-[#3b82f6]' : 'text-[#3b82f6] hover:bg-default-100'
                )}
                title="Blue Text"
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
                    editor.isActive('textStyle', { color: '#ef4444' }) ? 'bg-danger/10 text-[#ef4444]' : 'text-[#ef4444] hover:bg-default-100'
                )}
                title="Red Text"
            >
                <Baseline size={16} />
            </button>

            <div className="w-px h-4 bg-default-200 mx-1" />

             <button
                onClick={() => editor.chain().focus().unsetAllMarks().run()}
                className="p-1.5 rounded-md hover:bg-danger/10 text-default-400 hover:text-danger transition-colors ml-1"
                title="Clear formatting"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
};

interface NoteEditorProps {
    value: string;
    onSave: (val: string) => void;
    placeholder?: string;
    className?: string;
    id?: string;
}

export const NoteEditor = ({ value, onSave, placeholder = "Type your notes...", className, id }: NoteEditorProps) => {
    const initialContentRef = React.useRef(value);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit, // Full starter kit (includes lists, headings etc for notes)
            Placeholder.configure({
                placeholder: placeholder,
                emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-default-300 before:float-left before:h-0 before:pointer-events-none',
            }),
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: clsx(
                    'prose prose-sm max-w-none focus:outline-none min-h-[150px] p-0 text-foreground/90 leading-relaxed',
                    className
                ),
            },
        },
        onBlur: ({ editor }) => {
            const html = editor.getHTML();
            const isEmpty = editor.isEmpty;
            const finalVal = isEmpty ? '' : html;
            
            if (finalVal !== initialContentRef.current) {
                onSave(finalVal);
                initialContentRef.current = finalVal;
            }
        },
    });

    // Sync external value changes (carefully, to avoid loop)
    useEffect(() => {
        if (editor && value !== editor.getHTML() && value !== initialContentRef.current) {
             // Only update if external value changed significantly and is different from current
             // Simple check: if editor is focused, we probably shouldn't overwrite unless specific conditions met
             // But for tasks detail switching, we MUST update.
             if (!editor.isFocused) {
                 editor.commands.setContent(value);
                 initialContentRef.current = value;
             }
        }
        // Handle initial load or task switch
        if (editor && value !== initialContentRef.current) {
             editor.commands.setContent(value);
             initialContentRef.current = value;
        }
    }, [value, editor]);

    return (
        <div className="relative w-full h-full group" id={id}>
            {editor && <NoteBubbleMenu editor={editor} />}
            <EditorContent editor={editor} className="w-full h-full" />
        </div>
    );
};

