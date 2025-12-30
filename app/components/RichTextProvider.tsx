'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { clsx } from 'clsx';
import { Bold, Italic, Trash2 } from 'lucide-react';

interface EditorCallbacks {
    onSave: (val: string) => void;
    onCancel?: () => void;
    onBlur?: (val: string) => void;
}

interface RichTextContextType {
    activeId: string | null;
    activate: (id: string, initialContent: string, callbacks: EditorCallbacks) => void;
    deactivate: () => void;
    editor: Editor | null;
}

export const RichTextContext = createContext<RichTextContextType | null>(null);

export const useRichText = () => {
    const context = useContext(RichTextContext);
    if (!context) {
        throw new Error('useRichText must be used within a RichTextProvider');
    }
    return context;
};

// --- Custom Floating Menu Component (Moved here) ---
const CustomBubbleMenu = ({ editor }: { editor: any }) => {
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
            const start = view.coordsAtPos(from);
            const end = view.coordsAtPos(to);
            
            // Calculate center
            const left = (start.left + end.right) / 2;
            const top = start.top - 40; // 40px above

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
            className="fixed z-50 flex items-center gap-1 p-1 rounded-lg bg-content1 shadow-medium border border-default-200 animate-in fade-in zoom-in-95 duration-100"
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
                    "p-1 rounded hover:bg-default-100 transition-colors",
                    editor.isActive('bold') ? 'text-primary bg-primary/10' : 'text-default-500'
                )}
                type="button"
            >
                <Bold size={14} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={clsx(
                    "p-1 rounded hover:bg-default-100 transition-colors",
                    editor.isActive('italic') ? 'text-primary bg-primary/10' : 'text-default-500'
                )}
                type="button"
            >
                <Italic size={14} />
            </button>
            
            <div className="w-px h-4 bg-default-200 mx-1" />
            
            <button
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#facc15' }).run()}
                className={clsx(
                    "w-5 h-5 rounded-full border border-default-200 hover:scale-110 transition-transform",
                    editor.isActive('highlight', { color: '#facc15' }) && 'ring-2 ring-offset-1 ring-primary'
                )}
                style={{ backgroundColor: '#facc15' }}
                type="button"
            />
            
             <button
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#f87171' }).run()}
                className={clsx(
                    "w-5 h-5 rounded-full border border-default-200 hover:scale-110 transition-transform",
                    editor.isActive('highlight', { color: '#f87171' }) && 'ring-2 ring-offset-1 ring-primary'
                )}
                style={{ backgroundColor: '#f87171' }}
                type="button"
            />

             <button
                onClick={() => editor.chain().focus().unsetAllMarks().run()}
                className="p-1 rounded hover:bg-default-100 transition-colors text-default-400 ml-1"
                title="Clear formatting"
                type="button"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
};

export const RichTextProvider = ({ children }: { children: React.ReactNode }) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const callbacksRef = useRef<EditorCallbacks | null>(null);
    const initialContentRef = useRef<string>("");

    const handleSave = useCallback(() => {
        if (!activeId || !callbacksRef.current || !editor) return;

        const html = editor.getHTML();
        const isEmpty = editor.isEmpty;
        const finalVal = isEmpty ? '' : html;
        
        // Check if changed
        if (finalVal !== initialContentRef.current) {
             callbacksRef.current.onSave(finalVal);
             if (callbacksRef.current.onBlur) {
                 callbacksRef.current.onBlur(finalVal);
             }
        }
    }, [activeId]);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                bulletList: false,
                orderedList: false,
            }),
            Placeholder.configure({
                placeholder: "Empty", // Will be overridden dynamically if needed? No, usually placeholder is per cell. But we can update options.
                emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-default-300 before:float-left before:h-0 before:pointer-events-none',
            }),
            TextStyle,
            Color,
            Highlight.configure({
                multicolor: true,
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: clsx(
                    'outline-none min-h-[24px] w-full break-words whitespace-pre-wrap leading-normal flex items-center focus:bg-primary-50/50 dark:focus:bg-primary-900/20 rounded px-1 py-[1px] transition-colors',
                ),
            },
            handleKeyDown: (view, event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    // Manually trigger save logic
                    handleSave(); 
                    // We don't deactivate here? Or should we? Usually Enter in table -> save and stay or next?
                    // Original behavior: save on Enter.
                    // But if we press Enter, we probably want to keep focus? 
                    // Actually original behavior was: handleKeyDown returns true -> preventDefault.
                    // And useEffect listener called onSave.
                    // Let's call deactivate() to act like "submit"?
                    // User said: "Enter to save".
                    // If we deactivate, the editor disappears and view mode appears.
                    // Let's keep it consistent: Enter -> Save -> Deactivate (Blur)
                    
                    // Actually, let's just blur the editor, which triggers onBlur -> save
                    (event.target as HTMLElement).blur();
                    return true; 
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    if (callbacksRef.current?.onCancel) callbacksRef.current.onCancel();
                    setActiveId(null);
                    return true;
                }
                return false;
            }
        },
    });

    // Handle blur
    useEffect(() => {
        if (!editor) return;
        
        const onBlur = () => {
            handleSave();
            setActiveId(null);
        };
        
        editor.on('blur', onBlur);
        return () => {
            editor.off('blur', onBlur);
        };
    }, [editor, handleSave]);

    const activate = useCallback((id: string, initialContent: string, callbacks: EditorCallbacks) => {
        if (!editor) return;

        // If we are already active on this ID, do nothing
        if (activeId === id) return;

        // If we were active elsewhere, save previous (handled by blur usually, but let's be safe?)
        // Blur event fires when focus moves.
        
        callbacksRef.current = callbacks;
        initialContentRef.current = initialContent;
        
        // Update placeholder if needed (not easy with extension config, but we can rely on CSS attr if we passed it down?)
        // Placeholder extension uses extension config. 
        // We can ignore placeholder dynamic update for now or try to reconfigure.
        
        editor.commands.setContent(initialContent);
        setActiveId(id);
        
        // Focus
        requestAnimationFrame(() => {
            editor.commands.focus('end');
        });

    }, [editor, activeId]);

    const deactivate = useCallback(() => {
        setActiveId(null);
        editor?.commands.blur();
    }, [editor]);

    return (
        <RichTextContext.Provider value={{ activeId, activate, deactivate, editor }}>
            {children}
            {editor && activeId && <CustomBubbleMenu editor={editor} />}
        </RichTextContext.Provider>
    );
};

