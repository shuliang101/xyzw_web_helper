/**
 * 将Canvas导出为图片并下载
 * 兼容处理移动端大图导出问题。这里不调用系统分享，导出按钮应直接触发下载。
 * @param {HTMLCanvasElement} canvas - canvas元素
 * @param {string} filename - 文件名
 */
export const downloadCanvasAsImage = (canvas, filename) => {
  try {
    // 优先尝试使用 toBlob，因为它处理大文件更有效率且不容易崩溃
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob || blob.size === 0) {
          console.error('Canvas转换Blob失败');
          fallbackToDataURL(canvas, filename);
          return;
        }

        downloadBlob(blob, filename);
      }, 'image/png');
    } else {
      fallbackToDataURL(canvas, filename);
    }
  } catch (e) {
    console.error('导出图片出错:', e);
    fallbackToDataURL(canvas, filename);
  }
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // 兼容某些移动端浏览器，添加到body
  document.body.appendChild(link);
  
  try {
      link.click();
  } catch (e) {
      console.error("Link click failed", e);
  }
  
  // 清理
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

const fallbackToDataURL = (canvas, filename) => {
  try {
    const imgUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error('DataURL导出失败:', e);
    alert('导出图片失败，图片可能过大');
  }
};
