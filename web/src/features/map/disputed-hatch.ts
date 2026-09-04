import { DISPUTED_HATCH_IMAGE } from "./open-historia-map-style";

const createDisputedHatchImage = (): ImageData | null => {
  const size = 12;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.clearRect(0, 0, size, size);
  context.strokeStyle = "rgba(255,255,255,0.85)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-3, size + 3);
  context.lineTo(size + 3, -3);
  context.moveTo(-3, 3);
  context.lineTo(3, -3);
  context.moveTo(size - 3, size + 3);
  context.lineTo(size + 3, size - 3);
  context.stroke();
  return context.getImageData(0, 0, size, size);
};

export const ensureDisputedHatchImage = (map: {
  hasImage: (id: string) => boolean;
  addImage: (id: string, image: ImageData) => void;
}): void => {
  if (map.hasImage(DISPUTED_HATCH_IMAGE)) return;
  const image = createDisputedHatchImage();
  if (image !== null) map.addImage(DISPUTED_HATCH_IMAGE, image);
};
