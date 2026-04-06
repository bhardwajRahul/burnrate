/**
 * Recursively collects {@link File} instances from a {@link FileSystemDirectoryHandle},
 * setting `webkitRelativePath` when possible (matches directory input behavior).
 */
export async function filesFromDirectoryHandle(root: FileSystemDirectoryHandle): Promise<File[]> {
  const acc: File[] = [];
  const rootName = root.name;

  async function walk(dir: FileSystemDirectoryHandle, prefix: string): Promise<void> {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        const rel = prefix ? `${prefix}/${name}` : `${rootName}/${name}`;
        try {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: rel,
            configurable: true,
          });
        } catch {
          /* ignore */
        }
        acc.push(file);
      } else {
        const nextPrefix = prefix ? `${prefix}/${name}` : `${rootName}/${name}`;
        await walk(handle as FileSystemDirectoryHandle, nextPrefix);
      }
    }
  }

  await walk(root, '');
  return acc;
}

export function canUseDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && typeof window.showDirectoryPicker === 'function';
}
