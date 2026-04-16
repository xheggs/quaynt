'use client';

import { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Over,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import type { Prompt } from '../prompt-set.types';
import { reorderPrompts } from '../prompt-set.api';
import { PromptEditor } from './prompt-editor';

interface PromptListProps {
  promptSetId: string;
  prompts: Prompt[];
  onDeletePrompt: (promptId: string) => void;
}

export function PromptList({
  promptSetId,
  prompts: initialPrompts,
  onDeletePrompt,
}: PromptListProps) {
  const t = useTranslations('promptSets');
  const [items, setItems] = useState(initialPrompts);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync with parent when prompts change
  if (initialPrompts !== items && !activeId) {
    const initialIds = initialPrompts.map((p) => p.id).join(',');
    const currentIds = items.map((p) => p.id).join(',');
    if (initialIds !== currentIds) {
      setItems(initialPrompts);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const reorderMutation = useApiMutation<{ reordered: boolean }, string[]>({
    mutationFn: (promptIds) => reorderPrompts(promptSetId, promptIds),
    invalidateKeys: [queryKeys.promptSets.detail(promptSetId)],
    successMessage: t('prompts.reorder.success'),
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((p) => p.id === active.id);
      const newIndex = items.findIndex((p) => p.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      const newIds = newItems.map((p) => p.id);
      reorderMutation.mutate(newIds, {
        onError: () => setItems(initialPrompts),
      });
    },
    [items, initialPrompts, reorderMutation]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  if (items.length === 0) {
    return (
      <EmptyState
        variant="inline"
        icon={FileText}
        title={t('prompts.empty.title')}
        description={t('prompts.empty.description')}
      />
    );
  }

  const activePrompt = activeId ? items.find((p) => p.id === activeId) : null;

  const announcements = {
    onDragStart: ({ active }: { active: { id: UniqueIdentifier } }) => {
      const index = items.findIndex((p) => p.id === active.id);
      return t('dnd.pickedUp', { position: index + 1 });
    },
    onDragOver: ({ over }: { active: { id: UniqueIdentifier }; over: Over | null }) => {
      if (!over) return '';
      const index = items.findIndex((p) => p.id === over.id);
      return t('dnd.movedTo', { position: index + 1 });
    },
    onDragEnd: ({ over }: { active: { id: UniqueIdentifier }; over: Over | null }) => {
      if (!over) return '';
      const index = items.findIndex((p) => p.id === over.id);
      return t('dnd.droppedAt', { position: index + 1 });
    },
    onDragCancel: () => t('dnd.cancelled'),
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((prompt) => (
            <SortablePromptItem
              key={prompt.id}
              prompt={prompt}
              promptSetId={promptSetId}
              onDelete={onDeletePrompt}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activePrompt && (
          <Card className="p-4 opacity-80 shadow-lg">
            <Badge variant="outline" className="text-xs">
              #{activePrompt.order + 1}
            </Badge>
            <p className="mt-2 truncate text-sm text-muted-foreground">{activePrompt.template}</p>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface SortablePromptItemProps {
  prompt: Prompt;
  promptSetId: string;
  onDelete: (promptId: string) => void;
}

function SortablePromptItem({ prompt, promptSetId, onDelete }: SortablePromptItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prompt.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'z-10 opacity-50' : ''}
      {...attributes}
    >
      <PromptEditor
        prompt={prompt}
        promptSetId={promptSetId}
        onDelete={onDelete}
        dragHandleProps={listeners}
      />
    </div>
  );
}
