import React, { useState, useEffect } from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  MeasuringStrategy
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/app/types';

// Простой компонент элемента списка (аналог TaskRow)
function SimpleTaskRow({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none',
    opacity: isDragging ? 0.3 : 1,
    border: '1px solid #e5e7eb',
    padding: '8px 12px',
    marginBottom: '4px',
    backgroundColor: 'white',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  };

  return (
    <div ref={setNodeRef} style={style}>
        {/* Drag Handle */}
        <div 
            {...attributes} 
            {...listeners}
            className="cursor-grab p-1 bg-gray-100 rounded hover:bg-gray-200 active:cursor-grabbing"
        >
            :::
        </div>
        
        {/* Content */}
        <div 
            className="flex-1"
            dangerouslySetInnerHTML={{ __html: task.content || 'No content' }} 
        />
        
        {/* ID for debug */}
        <span className="text-xs text-gray-400">#{task.id.slice(0, 4)}</span>
    </div>
  );
}

interface SimpleDnDTestProps {
    tasks?: Task[];
}

export function SimpleDnDTest({ tasks: initialTasks }: SimpleDnDTestProps) {
  // Local state for immediate updates, though in real app we update DB
  const [items, setItems] = useState<Task[]>(initialTasks || []);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
      if (initialTasks) {
          setItems(initialTasks);
      }
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            delay: 0,
            tolerance: 0,
        }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(t => t.id === active.id);
        const newIndex = items.findIndex(t => t.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  }

  const activeItem = items.find(t => t.id === activeId);

  return (
    <div className="w-full h-full bg-gray-50 overflow-y-auto p-4">
      <h2 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">
          Simple DnD (Real Tasks: {items.length})
      </h2>
      
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        measuring={{
            droppable: {
                strategy: MeasuringStrategy.Always,
            }
        }}
      >
        <SortableContext 
          items={items.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map(task => <SimpleTaskRow key={task.id} task={task} />)}
        </SortableContext>
        
        <DragOverlay>
            {activeItem ? (
                <div className="p-2 bg-blue-50 border-2 border-blue-500 rounded shadow-xl flex items-center gap-2">
                     <div className="cursor-grabbing p-1 bg-gray-100 rounded">:::</div>
                     <div dangerouslySetInnerHTML={{ __html: activeItem.content || '' }} />
                </div>
            ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

