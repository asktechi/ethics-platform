import type { ImagePool, ImagePoolItem } from "@/types/db.helpers";

export type ImagePoolWithItems = ImagePool & { items: ImagePoolItem[] };
