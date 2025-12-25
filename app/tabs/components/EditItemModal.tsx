import React, { useEffect, useState } from 'react';
import {
   Modal,
   ModalContent,
   ModalHeader,
   ModalBody,
   ModalFooter,
   Button,
   Input,
   Select,
   SelectItem,
   Textarea,
} from '@heroui/react';
import { UIElement } from '@/utils/providers/localization/types';

interface EditItemModalProps {
   isOpen: boolean;
   onClose: () => void;
   onSave: (data: Partial<UIElement>) => Promise<void>;
   item: UIElement | null; // null if creating new
   tabs: { id: string; label: string }[];
   defaultTab: string;
}

export const EditItemModal = ({
   isOpen,
   onClose,
   onSave,
   item,
   tabs,
   defaultTab,
}: EditItemModalProps) => {
   const [formData, setFormData] = useState<Partial<UIElement>>({
      tab_id: defaultTab,
      item_id: '',
      ru: '',
      uk: '',
      en: '',
   });
   const [isSaving, setIsSaving] = useState(false);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      if (isOpen) {
         if (item) {
            setFormData({ ...item, tab_id: item.tab_id || 'misc' });
         } else {
            setFormData({
               tab_id: defaultTab === 'misc' ? 'misc' : defaultTab,
               item_id: '',
               ru: '',
               uk: '',
               en: '',
            });
         }
         setError(null);
      }
   }, [isOpen, item, defaultTab]);

   const handleSave = async () => {
      if (!formData.item_id) {
         setError('Item ID is required');
         return;
      }

      setIsSaving(true);
      setError(null);

      try {
         await onSave(formData);
         onClose();
      } catch (err: any) {
         setError(err.message || 'Failed to save');
      } finally {
         setIsSaving(false);
      }
   };

   return (
      <Modal isOpen={isOpen} onOpenChange={onClose} size="2xl" scrollBehavior="inside">
         <ModalContent>
            {(onClose) => (
               <>
                  <ModalHeader className="flex flex-col gap-1">
                     {item ? 'Edit Translation' : 'New Translation'}
                  </ModalHeader>
                  <ModalBody>
                     <div className="flex flex-col gap-4">
                        {error && (
                           <div className="p-3 bg-danger-50 text-danger text-small rounded-md border border-danger-200">
                              {error}
                           </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                           <Input
                              label="Key (Item ID)"
                              placeholder="e.g., btn_save"
                              value={formData.item_id}
                              onValueChange={(val) => setFormData(prev => ({ ...prev, item_id: val }))}
                              isDisabled={!!item} // Cannot change ID of existing item
                              isRequired
                              description="Must be unique across all tabs"
                           />
                           <Select
                              label="Tab"
                              selectedKeys={formData.tab_id ? [formData.tab_id] : []}
                              onChange={(e) => setFormData(prev => ({ ...prev, tab_id: e.target.value }))}
                              classNames={{
                                 trigger: "cursor-pointer"
                               }}
                           >
                              {tabs.map(tab => (
                                 <SelectItem key={tab.id}>
                                    {tab.label}
                                 </SelectItem>
                              ))}
                           </Select>
                        </div>

                        <div className="flex flex-col gap-3">
                           <Textarea
                              label="Russian (RU)"
                              placeholder="Текст на русском"
                              value={formData.ru}
                              onValueChange={(val) => setFormData(prev => ({ ...prev, ru: val }))}
                              minRows={2}
                           />
                           <Textarea
                              label="Ukrainian (UK)"
                              placeholder="Текст українською"
                              value={formData.uk}
                              onValueChange={(val) => setFormData(prev => ({ ...prev, uk: val }))}
                              minRows={2}
                           />
                           <Textarea
                              label="English (EN)"
                              placeholder="Text in English"
                              value={formData.en}
                              onValueChange={(val) => setFormData(prev => ({ ...prev, en: val }))}
                              minRows={2}
                           />
                        </div>
                     </div>
                  </ModalBody>
                  <ModalFooter>
                     <Button color="danger" variant="light" onPress={onClose}>
                        Cancel
                     </Button>
                     <Button color="primary" onPress={handleSave} isLoading={isSaving}>
                        Save
                     </Button>
                  </ModalFooter>
               </>
            )}
         </ModalContent>
      </Modal>
   );
};

