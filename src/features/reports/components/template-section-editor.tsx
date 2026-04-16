'use client';

import { useCallback, useRef } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import type { ReportSection, TemplateSections } from '../reports.types';

interface TemplateSectionEditorProps {
  sections: TemplateSections;
  onChange: (sections: TemplateSections) => void;
}

export function TemplateSectionEditor({ sections, onChange }: TemplateSectionEditorProps) {
  const t = useTranslations('reportsTemplates');
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const enabledCount = sections.sectionOrder.filter((s) => sections[s]).length;

  const handleToggle = useCallback(
    (section: ReportSection, checked: boolean) => {
      // Prevent disabling all sections
      if (!checked && enabledCount <= 1) return;
      onChange({ ...sections, [section]: checked });
    },
    [sections, onChange, enabledCount]
  );

  const handleMove = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const newOrder = [...sections.sectionOrder];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      onChange({ ...sections, sectionOrder: newOrder });

      // Maintain focus on the moved item's button
      requestAnimationFrame(() => {
        const key = `${direction}-${targetIndex}`;
        buttonRefs.current[key]?.focus();
      });
    },
    [sections, onChange]
  );

  return (
    <div className="space-y-1.5">
      <Label>{t('form.sections')}</Label>
      <p className="type-caption text-muted-foreground">{t('form.sectionsHint')}</p>
      <ul className="space-y-1 rounded-md border border-border p-2">
        {sections.sectionOrder.map((section, index) => {
          const isEnabled = sections[section];
          const isFirst = index === 0;
          const isLast = index === sections.sectionOrder.length - 1;

          return (
            <li
              key={section}
              className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                isEnabled ? '' : 'opacity-50'
              }`}
            >
              <Checkbox
                id={`section-${section}`}
                checked={isEnabled}
                onCheckedChange={(checked) => handleToggle(section, checked === true)}
                disabled={isEnabled && enabledCount <= 1}
              />
              <Label
                htmlFor={`section-${section}`}
                className="flex-1 cursor-pointer text-sm font-normal"
              >
                {t(`sections.${section}` as never)}
              </Label>
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={isFirst}
                  onClick={() => handleMove(index, 'up')}
                  aria-label={t('form.moveUp', {
                    section: t(`sections.${section}` as never),
                  })}
                  ref={(el) => {
                    buttonRefs.current[`up-${index}`] = el;
                  }}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={isLast}
                  onClick={() => handleMove(index, 'down')}
                  aria-label={t('form.moveDown', {
                    section: t(`sections.${section}` as never),
                  })}
                  ref={(el) => {
                    buttonRefs.current[`down-${index}`] = el;
                  }}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
