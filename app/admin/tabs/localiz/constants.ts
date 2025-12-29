import { DropAnimation, defaultDropAnimationSideEffects } from '@dnd-kit/core';

export const TABS = [
   { id: 'entry', label: 'Entry Screen' },
   { id: 'room', label: 'Room Screen' },
   { id: 'misc', label: 'Misc' },
];

export const dropAnimationConfig: DropAnimation = {
   sideEffects: defaultDropAnimationSideEffects({
      styles: {
         active: {
            opacity: '0.4',
         },
      },
   }),
};

