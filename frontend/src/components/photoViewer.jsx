import React, { useState, useEffect, useRef } from 'react';
import Popup from './popup';
import PopupConfirm from './popupConfirm';

function PhotoViewer({
  fetchCount,       // async () => number
  getImageUrl,      // (n: number) => string
  uploadFn,         // async (blob, onProgress: (0-100) => void) => { success, error }
  deleteFn,         // optional: async (n: number) => { success, error }
  defaultImage,     // string — shown when count is 0
  style = {}
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [loadedImages, setLoadedImages] = useState(new Map());
  const [uploadProgress, setUploadProgress] = useState(null); // null = not uploading, 0-100 = uploading
  const [showCamera, setShowCamera] = useState(false);
  const [initialImage, setInitialImage] = useState('/images/loading.png');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!fetchCount) return;
    setDataLoaded(false);
    setIsLoadingInitial(true);
    setInitialImage('/images/loading.png');
    loadInitialData();
  }, [fetchCount, getImageUrl]);

  const loadInitialData = async () => {
    try {
      const count = await fetchCount();
      setImageCount(count);

      if (count > 0) {
        const url = getImageUrl(1);
        setInitialImage(url);
        setLoadedImages(new Map([[1, url]]));
      } else {
        setInitialImage(defaultImage);
        setLoadedImages(new Map());
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      setInitialImage(defaultImage);
      setImageCount(0);
      setLoadedImages(new Map());
    } finally {
      setDataLoaded(true);
      setIsLoadingInitial(false);
    }
  };

  const loadNextImage = (n) => {
    if (loadedImages.has(n) || n > imageCount) return;
    const url = getImageUrl(n);
    setLoadedImages(prev => new Map(prev.set(n, url)));
  };

  const handleExpand = () => {
    setIsExpanded(true);

    if (imageCount > 1 && !loadedImages.has(2)) {
      loadNextImage(2);
      for (let i = 3; i <= imageCount; i++) {
        setTimeout(() => loadNextImage(i), (i - 2) * 200);
      }
    }
  };

  const handleImageClick = () => {
    if (isLoadingInitial || uploadProgress !== null) return;
    if (imageCount === 0) {
      triggerFileUpload();
    } else {
      handleExpand();
    }
  };

  const openCamera = async () => {
    try {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        alert('Camera access requires HTTPS connection on mobile devices');
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Camera not supported on this device/browser');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      streamRef.current = stream;
      setShowCamera(true);

      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch (error) {
      const messages = {
        NotAllowedError: 'Camera permission denied. Please enable camera access in your browser settings.',
        NotFoundError: 'No camera found on this device.',
        NotSupportedError: 'Camera not supported on this browser.',
        NotReadableError: 'Camera is already in use by another application.'
      };
      alert(messages[error.name] || 'Camera access denied or not available');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (blob) await doUpload(blob);
    }, 'image/jpeg', 0.8);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size too large. Please select an image smaller than 10MB');
      return;
    }

    doUpload(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileUpload = () => fileInputRef.current?.click();

  const doUpload = async (blob) => {
    try {
      setUploadProgress(0);
      closeCamera();

      const result = await uploadFn(blob, (pct) => setUploadProgress(pct));

      if (result.success) {
        setUploadProgress(null);
        setIsLoadingInitial(true);
        setInitialImage('/images/loading.png');
        setDataLoaded(false);
        await loadInitialData();
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

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  const getCurrentImageUrl = (index) => {
    const n = index + 1;
    return loadedImages.get(n) ?? '/images/loading.png';
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    const n = currentIndex + 1;
    try {
      const result = await deleteFn(n);
      if (result.success) {
        setIsExpanded(false);
        setCurrentIndex(0);
        setIsLoadingInitial(true);
        setInitialImage('/images/loading.png');
        setDataLoaded(false);
        await loadInitialData();
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

  return (
    <>
      <div
        style={{
          ...style,
          position: 'relative',
          borderRadius: '5px',
          overflow: 'hidden',
          cursor: isInteractive ? 'pointer' : 'default',
          opacity: isLoadingInitial ? 0.8 : 1
        }}
        onClick={handleImageClick}
        onMouseEnter={(e) => { if (isInteractive) e.currentTarget.style.filter = 'brightness(0.9)'; }}
        onMouseLeave={(e) => { if (isInteractive) e.currentTarget.style.filter = 'brightness(1)'; }}
      >
        {/* Upload progress overlay */}
        {isUploading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            gap: '10px',
            padding: '16px'
          }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '28px' }}>
              cloud_upload
            </span>
            <span style={{ color: 'white', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em' }}>
              UPLOADING
            </span>
            <div style={{
              width: '80%',
              height: '6px',
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                backgroundColor: '#4CAF50',
                borderRadius: '3px',
                transition: 'width 0.15s ease'
              }} />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
              {uploadProgress}%
            </span>
          </div>
        )}

        <img
          src={isLoadingInitial ? '/images/loading.png' : initialImage}
          alt="photo"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            if (!isLoadingInitial) e.target.src = defaultImage;
          }}
        />

        {isInteractive && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '50%',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '18px' }}>
              {cameraIcon}
            </span>
          </div>
        )}
      </div>

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
            loadedImages={loadedImages}
            currentIndex={currentIndex}
            onIndexChange={setCurrentIndex}
            onAddPhoto={openCamera}
            onUploadPhoto={triggerFileUpload}
            onDelete={deleteFn ? () => setShowDeleteConfirm(true) : null}
            onPrevious={() => setCurrentIndex(i => Math.max(0, i - 1))}
            onNext={() => setCurrentIndex(i => Math.min(imageCount - 1, i + 1))}
            getCurrentImageUrl={getCurrentImageUrl}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
          />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <img src="/images/loading.png" alt="Loading..." style={{ width: '64px', height: '64px' }} />
          </div>
        )}
      </Popup>

      <Popup isOpen={showCamera} onClose={closeCamera} title="Take Photo" width="80vw" height="80vh" maxWidth="600px" maxHeight="600px">
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '15px',
            alignItems: 'center'
          }}>
            {[
              { icon: 'photo_camera', color: '#4CAF50', action: capturePhoto },
              { icon: 'upload', color: '#2196F3', action: triggerFileUpload },
              { icon: 'close', color: '#f44336', action: closeCamera }
            ].map(({ icon, color, action }) => (
              <button
                key={icon}
                onClick={action}
                style={{
                  backgroundColor: color,
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '60px',
                  height: '60px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span className="material-symbols-outlined">{icon}</span>
              </button>
            ))}
          </div>
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

// PhotoGallery is unchanged in structure, just cleaned of route-specific props
function PhotoGallery({
  imageCount,
  currentIndex,
  onIndexChange,
  onAddPhoto,
  onUploadPhoto,
  onDelete,
  onPrevious,
  onNext,
  getCurrentImageUrl,
  isUploading,
  uploadProgress
}) {
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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Upload progress overlay */}
      {isUploading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          gap: '10px',
          padding: '16px'
        }}>
          <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '36px' }}>
            cloud_upload
          </span>
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em' }}>
            UPLOADING
          </span>
          <div style={{
            width: '60%',
            height: '6px',
            backgroundColor: 'rgba(255,255,255,0.25)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${uploadProgress}%`,
              backgroundColor: '#4CAF50',
              borderRadius: '3px',
              transition: 'width 0.15s ease'
            }} />
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
            {uploadProgress}%
          </span>
        </div>
      )}
      
      <div style={{ position: 'absolute', top: '15px', left: '15px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 12px', borderRadius: '20px', fontSize: '16px', fontWeight: 'bold', zIndex: 10 }}>
        {currentIndex + 1}/{imageCount}
      </div>

      <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10, display: 'flex', gap: '10px' }}>
        {topRightButtons.map(({ icon, label, action, color }) => (
          <button
            key={label}
            onClick={action}
            style={{
              backgroundColor: color ?? 'rgba(0,0,0,0.7)',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 12px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <img
          src={getCurrentImageUrl(currentIndex)}
          alt={`photo ${currentIndex + 1}`}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
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

      {imageCount > 1 && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '10px', maxWidth: '80%', overflowX: 'auto' }}>
          {Array.from({ length: imageCount }, (_, index) => (
            <div key={index} onClick={() => onIndexChange(index)} style={{ width: '40px', height: '40px', borderRadius: '5px', overflow: 'hidden', cursor: 'pointer', border: index === currentIndex ? '2px solid #4CAF50' : '2px solid transparent', flexShrink: 0 }}>
              <img src={getCurrentImageUrl(index)} alt={`thumbnail ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = '/images/loading.png'; }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PhotoViewer;