export type Status = 'have' | 'want';

export interface Can {
  id: string;
  status: Status;
  name: string;          // display name as on the can, e.g. "Red Bull Winter Edition Iced Vita Berry"
  flavor?: string;       // free text, any language
  tagline?: string;      // text printed on the can
  country?: string;      // where found / label language, free text
  barcode?: string;      // EAN-8/13/UPC digits
  imageUrl?: string;     // Open Food Facts image (hotlinked), never user-uploaded
  color?: string;        // main colour of the can, hex (picked, or read from the photo)
  size?: string;         // can size id, see can3d/specs.ts (default slim250)
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;     // tombstone (soft delete)
}
