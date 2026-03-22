import React, { useMemo } from 'react';
import PhotoViewer from './PhotoViewer';

// XHR-based upload so we get real progress events
function xhrUpload(url, formData, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true });
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ success: false, error: data.error });
        } catch {
          resolve({ success: false, error: `Server error ${xhr.status}` });
        }
      }
    });

    xhr.addEventListener('error', () => {
      resolve({ success: false, error: 'Network error' });
    });

    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

function AnimalPhotoViewer({ cowTag, imageType, style = {}, alternateDefaultPhoto = false }) {
  const isMedical = cowTag?.startsWith('medical_');
  const recordId = isMedical ? cowTag.replace('medical_', '') : null;
  const encodedTag = cowTag ? encodeURIComponent(cowTag) : null;

  const defaultImage = alternateDefaultPhoto
    ? '/images/NoPhoto.png'
    : imageType === 'headshot' ? '/images/NoHead.png' : '/images/NoBody.png';

  const fetchCount = useMemo(() => {
    if (!cowTag) return null;

    return async () => {
      const url = isMedical
        ? `/api/medical/${encodeURIComponent(recordId)}/image-count`
        : `/api/cow/${encodedTag}/image-count`;

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return 0;

      const data = await res.json();
      return isMedical
        ? data.issues ?? 0
        : imageType === 'headshot' ? data.headshots ?? 0 : data.bodyshots ?? 0;
    };
  }, [cowTag, imageType]);

  const getImageUrl = useMemo(() => {
    if (!cowTag) return () => defaultImage;

    return (n) => isMedical
      ? `/api/medical/${encodeURIComponent(recordId)}/image/${imageType}/${n}`
      : `/api/cow/${encodedTag}/image/${imageType}/${n}`;
  }, [cowTag, imageType]);

  const uploadFn = useMemo(() => {
    if (!cowTag) return null;

    return async (blob, onProgress) => {
      const formData = new FormData();
      const filename = isMedical
        ? `medical_${recordId}_${Date.now()}.jpg`
        : `${cowTag}_${imageType}_${Date.now()}.jpg`;

      formData.append('image', blob, filename);
      formData.append('imageType', imageType);

      const url = isMedical
        ? `/api/medical/${encodeURIComponent(recordId)}/images`
        : `/api/cow/${encodedTag}/upload-image`;

      return xhrUpload(url, formData, onProgress);
    };
  }, [cowTag, imageType]);

  const deleteFn = useMemo(() => {
    if (!cowTag) return null;

    return async (n) => {
        const getUrl = isMedical
            ? `/api/medical/${encodeURIComponent(recordId)}/image/${imageType}/${n}`
            : `/api/cow/${cowTag}/image/${imageType}/${n}`;

        const headRes = await fetch(getUrl, { method: 'HEAD', credentials: 'include' });
        const filename = headRes.headers.get('X-Filename');
        if (!filename) return { success: false, error: 'Could not resolve filename' };

        const deleteUrl = isMedical
            ? `/api/medical/${encodeURIComponent(recordId)}/images/${encodeURIComponent(filename)}`
            : `/api/cow/${cowTag}/images/${encodeURIComponent(filename)}`;

        const res = await fetch(deleteUrl, { method: 'DELETE', credentials: 'include' });
        if (res.ok) return { success: true };
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || `Server error ${res.status}` };
    };
}, [cowTag, imageType]);

  if (!cowTag) {
    return (
      <div style={{ ...style, borderRadius: '5px', overflow: 'hidden' }}>
        <img src={defaultImage} alt="no photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }

  return (
    <PhotoViewer
      fetchCount={fetchCount}
      getImageUrl={getImageUrl}
      uploadFn={uploadFn}
      deleteFn={deleteFn}
      defaultImage={defaultImage}
      style={style}
    />
  );
}

export default AnimalPhotoViewer;