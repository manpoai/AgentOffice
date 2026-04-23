export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function createImageHtml(src: string, w = 300, h = 200): string {
  return `<div style="width:100%;height:100%;border-radius:0;overflow:hidden;"><img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`;
}

export function extractDroppedImageFiles(e: DragEvent): File[] {
  const files: File[] = [];
  if (e.dataTransfer?.files) {
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const f = e.dataTransfer.files[i];
      if (f.type.startsWith('image/')) files.push(f);
    }
  }
  return files;
}

export function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || file.name.endsWith('.svg');
}
