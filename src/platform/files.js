export async function shareText(title, text) {
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, dialogTitle: title });
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

export async function downloadText(filename, text) {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({
      path: filename,
      data: btoa(unescape(encodeURIComponent(text))),
      directory: Directory.Documents,
    });
    return true;
  } catch {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }
}
