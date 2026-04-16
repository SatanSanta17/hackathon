'use client';

import { useRef, useState } from 'react';
import Cropper, { type ReactCropperElement } from 'react-cropper';
import { Loader2 } from 'lucide-react';
import 'react-cropper/node_modules/cropperjs/dist/cropper.css';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageCropModalProps {
  imageFile: File;
  aspectRatio: number;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (blob: Blob) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageCropModal({
  imageFile,
  aspectRatio,
  isOpen,
  onClose,
  onCropComplete,
  className,
}: ImageCropModalProps) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [previewUrl] = useState(() => URL.createObjectURL(imageFile));

  const handleCrop = async () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    setIsCropping(true);

    try {
      const canvas = cropper.getCroppedCanvas({
        width: 1280,
        height: 720,
      });

      canvas.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob);
          }
          setIsCropping(false);
        },
        'image/webp',
        0.9,
      );
    } catch (err: unknown) {
      console.error('Crop image error:', err);
      setIsCropping(false);
    }
  };

  const handleClose = () => {
    URL.revokeObjectURL(previewUrl);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={cn('sm:max-w-xl', className)}
        showCloseButton={!isCropping}
      >
        <DialogHeader>
          <DialogTitle>Crop Cover Image</DialogTitle>
          <DialogDescription>
            Adjust the crop region. The cover image will be saved at 1280×720 (16:9).
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-md">
          <Cropper
            ref={cropperRef}
            src={previewUrl}
            style={{ height: 360, width: '100%' }}
            aspectRatio={aspectRatio}
            guides={true}
            viewMode={1}
            dragMode="move"
            autoCropArea={1}
            background={false}
            responsive={true}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCropping}>
            Cancel
          </Button>
          <Button onClick={handleCrop} disabled={isCropping}>
            {isCropping ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Cropping...
              </>
            ) : (
              'Crop & Upload'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
