import React, { useState, useEffect, useRef, useMemo } from 'react';
import Popup from './popup';
import PopupConfirm from './popupConfirm';

// XHR-based upload for real progress events
function xhrUpload(url, formData, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
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

    xhr.addEventListener('error', () => resolve({ success: false, error: 'Network error' }));

    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

// Ordered quality tiers — must match SIZE_TIERS in imageProcessor.js
const QUALITY_TIERS = ['thumb', 'medium', 'high', 'full'];

// Preload a URL into the browser's image cache via Image().
// Resolves when cached (or on abort/error) — never rejects, so callers must check signal.aborted.
function preloadImage(url, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const img = new Image();
    const onAbort = () => { img.src = ''; resolve(); };
    signal?.addEventListener('abort', onAbort, { once: true });
    img.onload = () => { signal?.removeEventListener('abort', onAbort); resolve(); };
    img.onerror = () => { signal?.removeEventListener('abort', onAbort); resolve(); };
    img.src = url;
  });
}

function buildQuery(filter, cacheKey, size) {
  const params = new URLSearchParams();
  if (filter) params.set('filter', filter);
  if (cacheKey) params.set('v', String(cacheKey));
  if (size) params.set('size', size);
  const str = params.toString();
  return str ? `?${str}` : '';
}

function PhotoViewer({
  domain,
  recordId,
  filter,
  defaultImage = '/images/NoPhoto.png',
  fitToSquare = false,
  style = {}
}) {
  const [cacheKey, setCacheKey] = useState(() => Date.now());
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageCount, setImageCount] = useState(0);

  // Map<n:number, tier:string> — tracks the highest quality loaded for each photo.
  // Quality only moves up via setQuality(); never downgraded.
  const [imageQuality, setImageQuality] = useState(new Map());

  const [uploadProgress, setUploadProgress] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddPhotoPopup, setShowAddPhotoPopup] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const containerRef = useRef(null);

  // AbortController for the currently active priority upgrade chain.
  // Cancelled and replaced whenever the viewed photo changes.
  const upgradeControllerRef = useRef(null);

  // setTimeout IDs for background staggered thumb loads.
  const bgTimerIdsRef = useRef([]);

  // Tracks `n-tier` strings we've already started loading, preventing duplicate fetches.
  const loadedTiersRef = useRef(new Set());

  // Prevents background thumb loading from firing more than once per data load cycle.
  const bgThumbsStartedRef = useRef(false);

  // Sync-readable mirrors of state/memo values for use inside async callbacks.
  // React state is stale inside closures that span multiple renders.
  const imageQualityRef = useRef(new Map());
  const getImageUrlRef = useRef(null);

  useEffect(() => { imageQualityRef.current = imageQuality; }, [imageQuality]);

  // Measure the container so we can cap the image height when fitToSquare is on
  useEffect(() => {
    if (!fitToSquare || !containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [fitToSquare]);

  const imageDisplayHeight = fitToSquare && containerSize.width > 0
    ? Math.min(containerSize.width, containerSize.height)
    : null;

  const encodedId = recordId ? encodeURIComponent(recordId) : null;
  const base = domain && encodedId ? `/api/images/${domain}/${encodedId}` : null;

  const getImageUrl = useMemo(() => {
    if (!base) return () => defaultImage;
    return (n, size) => `${base}/photo/${n}${buildQuery(filter, cacheKey, size)}`;
  }, [base, filter, cacheKey]);

  // Keep ref in sync so async upgrade chains always use the freshest URL builder.
  getImageUrlRef.current = getImageUrl;

  const fetchCount = useMemo(() => {
    if (!base) return null;
    return async () => {
      const res = await fetch(`${base}/count${buildQuery(filter)}`, { credentials: 'include' });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.total ?? 0;
    };
  }, [base, filter]);

  const uploadFn = useMemo(() => {
    if (!base) return null;
    return async (blob, onProgress) => {
      const fd = new FormData();
      fd.append('image', blob, `upload_${Date.now()}.jpg`);
      const result = await xhrUpload(`${base}${buildQuery(filter)}`, fd, onProgress);
      if (result.success) setCacheKey(Date.now()); // triggers reset useEffect via getImageUrl change
      return result;
    };
  }, [base, filter]);

  const deleteFn = useMemo(() => {
    if (!base) return null;
    return async (n) => {
      const headRes = await fetch(`${base}/photo/${n}${buildQuery(filter, cacheKey)}`, {
        method: 'HEAD',
        credentials: 'include'
      });
      const filename = headRes.headers.get('X-Filename');
      if (!filename) return { success: false, error: 'Could not resolve filename' };

      const res = await fetch(`${base}/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setCacheKey(Date.now()); // triggers reset useEffect via getImageUrl change
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error || `Server error ${res.status}` };
    };
  }, [base, filter, cacheKey]);

  // Move quality up for photo n. Never downgrades — ignored if tier is not an improvement.
  const setQuality = (n, tier) => {
    setImageQuality(prev => {
      const currentIndex = QUALITY_TIERS.indexOf(prev.get(n) ?? '');
      const newIndex = QUALITY_TIERS.indexOf(tier);
      if (newIndex <= currentIndex) return prev;
      return new Map(prev).set(n, tier);
    });
  };

  // Cancel the active priority upgrade, if any.
  const cancelActiveUpgrade = () => {
    upgradeControllerRef.current?.abort();
    upgradeControllerRef.current = null;
  };

  // Run the priority upgrade chain for photo n, starting from its current quality.
  // Cancels any existing priority upgrade first.
  const runPriorityUpgrade = (n) => {
    const currentTier = imageQualityRef.current.get(n);
    const startIndex = currentTier ? QUALITY_TIERS.indexOf(currentTier) + 1 : 0;
    if (startIndex >= QUALITY_TIERS.length) return; // already at full — nothing to do

    cancelActiveUpgrade();
    const controller = new AbortController();
    upgradeControllerRef.current = controller;

    (async () => {
      for (let i = startIndex; i < QUALITY_TIERS.length; i++) {
        if (controller.signal.aborted) return;
        const tier = QUALITY_TIERS[i];
        loadedTiersRef.current.add(`${n}-${tier}`);
        await preloadImage(getImageUrlRef.current(n, tier), controller.signal);
        if (controller.signal.aborted) return;
        setQuality(n, tier);
      }
    })();
  };

  // Once photo 1 reaches full quality, kick off background thumb loads for all remaining photos.
  // Staggered by 400ms per photo to avoid saturating bandwidth on a slow connection.
  useEffect(() => {
    if (bgThumbsStartedRef.current || imageCount <= 1) return;
    if (imageQuality.get(1) !== 'full') return;
    bgThumbsStartedRef.current = true;

    let delay = 0;
    for (let n = 2; n <= imageCount; n++) {
      if (loadedTiersRef.current.has(`${n}-thumb`)) continue;
      const capturedN = n;
      const id = setTimeout(() => {
        if (loadedTiersRef.current.has(`${capturedN}-thumb`)) return;
        loadedTiersRef.current.add(`${capturedN}-thumb`);
        const img = new Image();
        img.onload = () => setQuality(capturedN, 'thumb');
        img.src = getImageUrlRef.current(capturedN, 'thumb');
      }, delay);
      bgTimerIdsRef.current.push(id);
      delay += 400;
    }
  }, [imageQuality, imageCount]);

  // When the gallery is open and the current photo changes, immediately prioritize upgrading
  // that photo. This cancels any in-progress upgrade for the previous photo.
  useEffect(() => {
    if (!isExpanded || imageCount === 0) return;
    runPriorityUpgrade(currentIndex + 1);
  }, [currentIndex, isExpanded, imageCount]);

  const loadInitialData = async () => {
    try {
      const count = await fetchCount();
      setImageCount(count);
      setDataLoaded(true);
      setIsLoadingInitial(false); // card becomes interactive now; image upgrades in background

      if (count > 0) {
        // Priority upgrade photo 1 from thumb → medium → high → full.
        // Background thumbs for all other photos are triggered by the imageQuality useEffect above
        // once photo 1 reaches 'full'.
        cancelActiveUpgrade();
        const controller = new AbortController();
        upgradeControllerRef.current = controller;

        for (let i = 0; i < QUALITY_TIERS.length; i++) {
          if (controller.signal.aborted) break;
          const tier = QUALITY_TIERS[i];
          loadedTiersRef.current.add(`1-${tier}`);
          await preloadImage(getImageUrlRef.current(1, tier), controller.signal);
          if (controller.signal.aborted) break;
          setQuality(1, tier);
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      setImageCount(0);
      setImageQuality(new Map());
      setDataLoaded(true);
      setIsLoadingInitial(false);
    }
  };

  // Full reset and reload whenever the source identity changes (domain, recordId, filter, cacheKey).
  useEffect(() => {
    if (!fetchCount) return;
    cancelActiveUpgrade();
    bgTimerIdsRef.current.forEach(clearTimeout);
    bgTimerIdsRef.current = [];
    loadedTiersRef.current = new Set();
    bgThumbsStartedRef.current = false;
    setImageQuality(new Map());
    setImageCount(0);
    setDataLoaded(false);
    setIsLoadingInitial(true);
    loadInitialData();
  }, [fetchCount, getImageUrl]);

  // Cleanup on unmount
  useEffect(() => () => {
    cancelActiveUpgrade();
    bgTimerIdsRef.current.forEach(clearTimeout);
  }, []);

  const handleExpand = () => setIsExpanded(true);

  const handleImageClick = () => {
    if (isLoadingInitial || uploadProgress !== null) return;
    if (imageCount === 0) setShowAddPhotoPopup(true);
    else handleExpand();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select a valid image file'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File size too large. Please select an image smaller than 10MB'); return; }
    doUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const doUpload = async (blob) => {
    try {
      setUploadProgress(0);
      const result = await uploadFn(blob, (pct) => setUploadProgress(pct));
      if (result.success) {
        setUploadProgress(null);
        // uploadFn called setCacheKey — the reset useEffect handles the full reload.
      } else {
        setUploadProgress(null);
        alert(`Failed to upload photo: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      setUploadProgress(null);
      alert('Error uploading photo. Please check your connection and try again.');
    }
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      const result = await deleteFn(currentIndex + 1);
      if (result.success) {
        setIsExpanded(false);
        setCurrentIndex(0);
        // deleteFn called setCacheKey — the reset useEffect handles the full reload.
      } else {
        alert(`Failed to delete photo: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Error deleting photo. Please check your connection and try again.');
    }
  };

  const isUploading = uploadProgress !== null;
  const isInteractive = !isLoadingInitial && !isUploading;
  const cameraIcon = (!dataLoaded || imageCount === 0) ? 'photo_camera' : 'expand_content';

  // Card preview: shows photo 1 at whatever quality is available, upgrading automatically.
  const photo1Tier = imageQuality.get(1);
  const cardImageSrc = isLoadingInitial
    ? '/images/loading.png'
    : imageCount === 0
      ? defaultImage
      : photo1Tier
        ? getImageUrl(1, photo1Tier)
        : '/images/loading.png';

  // Main gallery display — best quality loaded so far for that photo.
  const getDisplayUrl = (index) => {
    const n = index + 1;
    const tier = imageQuality.get(n);
    return tier ? getImageUrl(n, tier) : '/images/loading.png';
  };

  // Thumbnail strip — always requests thumb tier.
  // The browser loads these independently; they'll be cache hits if background loading already ran.
  const getThumbUrl = (index) => getImageUrl(index + 1, 'thumb');

  if (!domain || !recordId) {
    return (
      <div style={{ ...style, borderRadius: '5px', overflow: 'hidden' }}>
        <img src={defaultImage} alt="no photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{
          ...style,
          position: 'relative',
          borderRadius: '5px',
          overflow: 'hidden',
          cursor: isInteractive ? 'pointer' : 'default',
          opacity: isLoadingInitial ? 0.8 : 1,
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={handleImageClick}
        onMouseEnter={(e) => { if (isInteractive) e.currentTarget.style.filter = 'brightness(0.9)'; }}
        onMouseLeave={(e) => { if (isInteractive) e.currentTarget.style.filter = 'brightness(1)'; }}
      >
        {isUploading && (
          <div style={{
            position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', zIndex: 10, gap: '10px', padding: '16px'
          }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '28px' }}>cloud_upload</span>
            <span style={{ color: 'white', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em' }}>UPLOADING</span>
            <div style={{ width: '80%', height: '6px', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#4CAF50', borderRadius: '3px', transition: 'width 0.15s ease' }} />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{uploadProgress}%</span>
          </div>
        )}

        <div style={{
          width: '100%',
          height: imageDisplayHeight != null ? `${imageDisplayHeight}px` : '100%',
          flexShrink: 0,
          position: 'relative',
        }}>
          <img
            src={cardImageSrc}
            alt="photo"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.src = defaultImage; }}
          />
        </div>

        {isInteractive && (
          <div style={{
            position: 'absolute', bottom: '8px', right: '8px',
            backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: '50%',
            padding: '6px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '18px' }}>{cameraIcon}</span>
          </div>
        )}
      </div>

      {/* Native camera capture — triggers the device camera app directly */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
      {/* File picker — used from the gallery toolbar for uploading from storage */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      <Popup isOpen={isExpanded} onClose={() => setIsExpanded(false)} title="Photos" height="90vh">
        {dataLoaded ? (
          <PhotoGallery
            imageCount={imageCount}
            currentIndex={currentIndex}
            onIndexChange={setCurrentIndex}
            onAddPhoto={() => cameraInputRef.current?.click()}
            onUploadPhoto={() => fileInputRef.current?.click()}
            onDelete={deleteFn ? () => setShowDeleteConfirm(true) : null}
            onPrevious={() => setCurrentIndex(i => Math.max(0, i - 1))}
            onNext={() => setCurrentIndex(i => Math.min(imageCount - 1, i + 1))}
            getDisplayUrl={getDisplayUrl}
            getThumbUrl={getThumbUrl}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
          />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <img src="/images/loading.png" alt="Loading..." style={{ width: '64px', height: '64px' }} />
          </div>
        )}
      </Popup>

      <Popup isOpen={showAddPhotoPopup} onClose={() => setShowAddPhotoPopup(false)} title="Add Photo" height="auto">
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', padding: '24px' }}>
          <button
            onClick={() => { setShowAddPhotoPopup(false); cameraInputRef.current?.click(); }}
            style={{ backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', padding: '12px 24px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span className="material-symbols-outlined">add_a_photo</span>
            Take Photo
          </button>
          <button
            onClick={() => { setShowAddPhotoPopup(false); fileInputRef.current?.click(); }}
            style={{ backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', padding: '12px 24px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span className="material-symbols-outlined">upload</span>
            Upload Photo
          </button>
        </div>
      </Popup>

      <PopupConfirm
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Photo"
        message={`Are you sure you want to delete this photo?<br/><br/><span style="color:#dc3545;font-weight:bold">This action cannot be undone.</span>`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}


function PhotoGallery({
  imageCount, currentIndex, onIndexChange, onAddPhoto, onUploadPhoto,
  onDelete, onPrevious, onNext, getDisplayUrl, getThumbUrl, isUploading, uploadProgress
}) {
  const [compact, setCompact] = useState(false);
  const wrapperRef = useRef(null);
  const counterRef = useRef(null);
  const toolbarRef = useRef(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => {
      const counter = counterRef.current;
      const toolbar = toolbarRef.current;
      if (!counter || !toolbar) return;
      const gap = 10;
      setCompact(counter.getBoundingClientRect().right + gap >= toolbar.getBoundingClientRect().left);
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  if (imageCount === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '20px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#ccc' }}>photo_camera</span>
        <p style={{ color: '#666', fontSize: '18px' }}>No photos found</p>
        <div style={{ display: 'flex', gap: '15px' }}>
          {[
            { icon: 'add_a_photo', color: '#4CAF50', label: 'Take Photo', action: onAddPhoto },
            { icon: 'upload', color: '#2196F3', label: 'Upload Photo', action: onUploadPhoto }
          ].map(({ icon, color, label, action }) => (
            <button key={label} onClick={action} style={{ backgroundColor: color, color: 'white', border: 'none', borderRadius: '5px', padding: '12px 24px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const topRightButtons = [
    { icon: 'add_a_photo', label: 'Take Photo', action: onAddPhoto },
    { icon: 'upload', label: 'Upload Photo', action: onUploadPhoto },
    ...(onDelete ? [{ icon: 'delete', label: 'Delete Photo', action: onDelete, color: '#c0392b' }] : [])
  ];

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {isUploading && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20, gap: '10px', padding: '16px' }}>
          <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '36px' }}>cloud_upload</span>
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em' }}>UPLOADING</span>
          <div style={{ width: '60%', height: '6px', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#4CAF50', borderRadius: '3px', transition: 'width 0.15s ease' }} />
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{uploadProgress}%</span>
        </div>
      )}

      <div ref={counterRef} style={{ position: 'absolute', top: '15px', left: '15px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 12px', borderRadius: '20px', fontSize: '16px', fontWeight: 'bold', zIndex: 10 }}>
        {currentIndex + 1}/{imageCount}
      </div>

      <div ref={toolbarRef} style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10, display: 'flex', gap: '10px' }}>
        {topRightButtons.map(({ icon, label, action, color }) => (
          <button key={label} onClick={action} style={{ backgroundColor: color ?? 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '20px', padding: '8px 12px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: compact ? 0 : '5px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>
            {!compact && label}
          </button>
        ))}
      </div>

      {/* Main display — shows best quality loaded so far, updating automatically as higher tiers arrive */}
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <img
          src={getDisplayUrl(currentIndex)}
          alt={`photo ${currentIndex + 1}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={(e) => { e.target.src = '/images/loading.png'; }}
        />
      </div>

      {imageCount > 1 && (
        <>
          {currentIndex > 0 && (
            <button onClick={onPrevious} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <span className="material-symbols-outlined">arrow_back_ios</span>
            </button>
          )}
          {currentIndex < imageCount - 1 && (
            <button onClick={onNext} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <span className="material-symbols-outlined">arrow_forward_ios</span>
            </button>
          )}
        </>
      )}

      {/* Thumbnail strip — always uses thumb tier URLs; lightweight for slow connections */}
      {imageCount > 1 && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '10px', maxWidth: '80%', overflowX: 'auto' }}>
          {Array.from({ length: imageCount }, (_, index) => (
            <div key={index} onClick={() => onIndexChange(index)} style={{ width: '40px', height: '40px', borderRadius: '5px', overflow: 'hidden', cursor: 'pointer', border: index === currentIndex ? '2px solid #4CAF50' : '2px solid transparent', flexShrink: 0 }}>
              <img
                src={getThumbUrl(index)}
                alt={`thumbnail ${index + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.src = '/images/loading.png'; }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PhotoViewer;