'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { clsx } from 'clsx';
import { Bold, Italic, Trash2, Highlighter, Baseline } from 'lucide-react';

interface EditorCallbacks {
    onSave: (val: string) => void;
    onCancel?: () => void;
    onBlur?: (val: string) => void;
}

interface RichTextContextType {
    activeId: string | null;
    activate: (id: string, initialContent: string, callbacks: EditorCallbacks, event?: React.MouseEvent) => void;
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
            const top = start.top - 50; // Чуть выше из-за размера меню

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
                        ? 'bg-[#facc15]/20 text-[#facc15]' 
                        : 'text-[#facc15] hover:bg-default-100'
                )}
                style={{ backgroundColor: '' }}
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
                        ? 'bg-[#f87171]/20 text-[#f87171]' 
                        : 'text-[#f87171] hover:bg-default-100'
                )}
                style={{ backgroundColor: '' }}
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
                className="p-1.5 rounded-md hover:bg-danger/10 text-default-400 hover:text-danger transition-colors ml-1"
                title="Clear formatting"
                type="button"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
};

export const RichTextProvider = ({ children }: { children: React.ReactNode }) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const callbacksRef = useRef<EditorCallbacks | null>(null);
    const initialContentRef = useRef<string>("");

    const isSwitchingRef = useRef(false);

    const handleSave = useCallback(() => {
        if (!activeId || !callbacksRef.current || !editor) return;

        const html = editor.getHTML();
        const isEmpty = editor.isEmpty;
        const finalVal = isEmpty ? '' : html;
        
        // Check if changed
        if (finalVal !== initialContentRef.current) {
             callbacksRef.current.onSave(finalVal);
        }
        
        // Always call onBlur if provided, regardless of changes
        // This is crucial for deleting empty new tasks
        if (callbacksRef.current.onBlur) {
            callbacksRef.current.onBlur(finalVal);
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
                    'rich-editor-cell focus:bg-blue-100 dark:focus:bg-black',
                ),
            },
            handleKeyDown: (view, event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    // Just blur to trigger save via onBlur handler
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
            if (isSwitchingRef.current) return; // Ignore blur during switch
            handleSave();
            setActiveId(null);
        };
        
        editor.on('blur', onBlur);
        return () => {
            editor.off('blur', onBlur);
        };
    }, [editor, handleSave]);

    const activate = useCallback((id: string, initialContent: string, callbacks: EditorCallbacks, event?: React.MouseEvent) => {
        if (!editor) return;

        // If we are already active on this ID, do nothing
        if (activeId === id) return;

        // Force save previous editor state before switching
        if (activeId) {
            handleSave();
            isSwitchingRef.current = true;
        }

        // Capture coords immediately
        const coords = event ? { left: event.clientX, top: event.clientY } : null;

        callbacksRef.current = callbacks;
        initialContentRef.current = initialContent;
        
        editor.commands.setContent(initialContent);
        setActiveId(id);
        
        // Focus
        requestAnimationFrame(() => {
            isSwitchingRef.current = false;
            if (coords) {
                const pos = editor.view.posAtCoords(coords);
                if (pos) {
                    editor.commands.setTextSelection(pos.pos);
                    editor.commands.focus();
                    return;
                }
            }
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

