import React, { useState, useEffect, useRef } from 'react';
import Popup from './popup';

function PhotoViewer({ 
  cowTag, 
  imageType, 
  style = {}, 
  alternateDefaultPhoto = false // Use NoPhoto.png if false
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [loadedImages, setLoadedImages] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [initialImage, setInitialImage] = useState('/images/loading.png');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Get the appropriate default image
  const getDefaultImage = () => {
    if (alternateDefaultPhoto) {
      return '/images/NoPhoto.png';
    }
    return imageType === 'headshot' ? '/images/NoHead.png' : '/images/NoBody.png';
  };

  // Load initial image and count on component mount
  useEffect(() => {
    if (cowTag) {
      setDataLoaded(false);
      setIsLoadingInitial(true);
      setInitialImage('/images/loading.png');
      loadInitialData();
    } else {
      // No cow tag (unknown animal), show default immediately
      const defaultUrl = getDefaultImage();
      setInitialImage(defaultUrl);
      setImageCount(0);
      setLoadedImages(new Map());
      setDataLoaded(true);
      setIsLoadingInitial(false);
    }
  }, [cowTag, imageType, alternateDefaultPhoto]);

  const loadInitialData = async () => {
    if (!cowTag) return;
    
    try {
      setIsLoadingInitial(true);
      setDataLoaded(false);
      
      // Check if this is a medical image request
      const isMedical = cowTag.startsWith('medical_');
      const apiPath = isMedical 
        ? `/api/medical/${encodeURIComponent(cowTag.replace('medical_', ''))}/image-count`
        : `/api/cow/${encodeURIComponent(cowTag)}/image-count`;
      
      // Get image count first
      const countResponse = await fetch(apiPath, {
        credentials: 'include'
      });
      
      if (countResponse.ok) {
        const countData = await countResponse.json();
        const count = isMedical 
          ? countData.issues || 0
          : (imageType === 'headshot' ? countData.headshots : countData.bodyshots);
        setImageCount(count);
        
        if (count > 0) {
          // Load first image
          const imageUrl = isMedical
            ? `/api/medical/${encodeURIComponent(cowTag.replace('medical_', ''))}/image/${imageType}/1`
            : `/api/cow/${encodeURIComponent(cowTag)}/image/${imageType}/1`;
          setInitialImage(imageUrl);
          setLoadedImages(new Map([[1, imageUrl]]));
        } else {
          // No images, use default
          const defaultUrl = getDefaultImage();
          setInitialImage(defaultUrl);
          setLoadedImages(new Map());
        }
        
        setDataLoaded(true);
        setIsLoadingInitial(false);
      } else {
        // Error response - still show defaults but after loading is done
        console.error('Failed to get image count:', countResponse.status);
        const defaultUrl = getDefaultImage();
        setInitialImage(defaultUrl);
        setImageCount(0);
        setLoadedImages(new Map());
        setDataLoaded(true);
        setIsLoadingInitial(false);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Network error or other issue - show defaults after loading
      const defaultUrl = getDefaultImage();
      setInitialImage(defaultUrl);
      setImageCount(0);
      setLoadedImages(new Map());
      setDataLoaded(true);
      setIsLoadingInitial(false);
    }
  };

  const loadNextImage = async (n) => {
    if (loadedImages.has(n) || n > imageCount) return;
    
    try {
      const isMedical = cowTag.startsWith('medical_');
      const imageUrl = isMedical
        ? `/api/medical/${encodeURIComponent(cowTag.replace('medical_', ''))}/image/${imageType}/${n}`
        : `/api/cow/${encodeURIComponent(cowTag)}/image/${imageType}/${n}`;
      setLoadedImages(prev => new Map(prev.set(n, imageUrl)));
    } catch (error) {
      console.error(`Error loading image ${n}:`, error);
    }
  };

  const handleExpand = async () => {
    setIsExpanded(true);
    
    // Start progressive loading
    if (imageCount > 1 && !loadedImages.has(2)) {
      await loadNextImage(2);
      
      // Continue loading remaining images sequentially
      for (let i = 3; i <= imageCount; i++) {
        setTimeout(() => loadNextImage(i), (i - 2) * 200); // Stagger requests
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < imageCount - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleImageClick = () => {
    // Don't allow clicks if no cowTag (unknown animal) or still loading
    if (!cowTag || isLoadingInitial) {
      return;
    }

    // If showing default image, try to open camera
    if (imageCount === 0) {
      triggerFileUpload();
    } else {
      handleExpand();
    }
  };

  const openCamera = async () => {
    try {
      // Check if we're on HTTPS or localhost (required for camera on iOS)
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        alert('Camera access requires HTTPS connection on mobile devices');
        return;
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera not supported on this device/browser');
        return;
      }

      // Request camera access with more specific constraints for mobile
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setShowCamera(true);
      
      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      
      let errorMessage = 'Camera access denied or not available';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please enable camera access in your browser settings and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera not supported on this browser.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      }
      
      alert(errorMessage);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        await uploadPhoto(blob);
      }
    }, 'image/jpeg', 0.8);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }
      
      // Validate file size (e.g., 10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        alert('File size too large. Please select an image smaller than 10MB');
        return;
      }
      
      uploadPhoto(file);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const uploadPhoto = async (blob) => {
    try {
      setIsLoading(true);
      
      const isMedical = cowTag.startsWith('medical_');
      const recordId = isMedical ? cowTag.replace('medical_', '') : null;
      
      const formData = new FormData();
      if (isMedical) {
        formData.append('image', blob, `medical_${recordId}_${Date.now()}.jpg`);
        formData.append('imageType', imageType);
      } else {
        formData.append('image', blob, `${cowTag}_${imageType}_${Date.now()}.jpg`);
        formData.append('imageType', imageType);
      }

      const uploadUrl = isMedical 
        ? `/api/medical/${recordId}/upload-image`
        : `/api/cow/${encodeURIComponent(cowTag)}/upload-image`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        closeCamera();
        // Refresh the component data with proper loading states
        setIsLoadingInitial(true);
        setInitialImage('/images/loading.png');
        setDataLoaded(false);
        await loadInitialData();
        alert('Photo uploaded successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to upload photo: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Error uploading photo. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const getCurrentImageUrl = (index) => {
    const imageNum = index + 1;
    if (loadedImages.has(imageNum)) {
      return loadedImages.get(imageNum);
    }
    return '/images/loading.png';
  };

  const isDefaultImage = (url) => {
    return url === '/images/NoHead.png' || url === '/images/NoBody.png' || url === '/images/NoPhoto.png';
  };

  // Determine if this is a clickable/interactive photo viewer
  const isInteractive = cowTag && !isLoadingInitial;

  return (
    <>
      <div 
        style={{ 
          ...style,
          position: 'relative',
          borderRadius: '5px',
          overflow: 'hidden',
          cursor: isInteractive ? 'pointer' : 'default',
          transition: 'filter 0.2s ease',
          opacity: isLoadingInitial ? 0.8 : 1
        }}
        onClick={handleImageClick}
        onMouseEnter={(e) => {
          if (isInteractive) e.target.style.filter = 'brightness(0.9)';
        }}
        onMouseLeave={(e) => {
          if (isInteractive) e.target.style.filter = 'brightness(1)';
        }}
      >
        <img 
          src={isLoadingInitial ? '/images/loading.png' : (initialImage || '/images/loading.png')}
          alt={`cow ${imageType}`}
          style={{ 
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            // Only set default on error if we're not still loading initial data
            if (!isLoadingInitial) {
              e.target.src = getDefaultImage();
            }
          }}
        />

        {/* Expand icon - only show for interactive viewers */}
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
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}>
            <span 
              className="material-symbols-outlined" 
              style={{ 
                color: 'white', 
                fontSize: '18px' 
              }}
            >
              {(!dataLoaded || imageCount === 0) ? 'photo_camera' : 'expand_content'}
            </span>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Gallery Popup - only show for valid cowTag */}
      {cowTag && (
        <Popup
          isOpen={isExpanded}
          onClose={() => setIsExpanded(false)}
          title="Photos"
          height="90vh"
        >
          {dataLoaded && (
            <PhotoGallery 
              cowTag={cowTag}
              imageType={imageType}
              imageCount={imageCount}
              loadedImages={loadedImages}
              currentIndex={currentIndex}
              onIndexChange={setCurrentIndex}
              onAddPhoto={openCamera}
              onUploadPhoto={triggerFileUpload}
              onPrevious={handlePrevious}
              onNext={handleNext}
              getCurrentImageUrl={getCurrentImageUrl}
            />
          )}
          {!dataLoaded && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%' 
            }}>
              <img src="/images/loading.png" alt="Loading..." style={{ width: '64px', height: '64px' }} />
            </div>
          )}
        </Popup>
      )}

      {/* Camera Popup - only show for valid cowTag */}
      {cowTag && (
        <Popup
          isOpen={showCamera}
          onClose={closeCamera}
          title="Take Photo"
          width="80vw"
          height="80vh"
          maxWidth="600px"
          maxHeight="600px"
        >
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                borderRadius: '5px'
              }}
            />
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {/* Buttons container */}
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '15px',
              alignItems: 'center'
            }}>
              {/* Take photo button */}
              <button
                onClick={capturePhoto}
                disabled={isLoading}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '60px',
                  height: '60px',
                  fontSize: '24px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                <span className="material-symbols-outlined">
                  {isLoading ? 'hourglass_empty' : 'photo_camera'}
                </span>
              </button>

              {/* Upload photo button */}
              <button
                onClick={triggerFileUpload}
                disabled={isLoading}
                style={{
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '60px',
                  height: '60px',
                  fontSize: '24px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                <span className="material-symbols-outlined">upload</span>
              </button>
              
              {/* Close button */}
              <button
                onClick={closeCamera}
                style={{
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '60px',
                  height: '60px',
                  fontSize: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}

// Gallery component for the popup content (unchanged)
function PhotoGallery({ 
  cowTag, 
  imageType, 
  imageCount, 
  loadedImages, 
  currentIndex, 
  onIndexChange, 
  onAddPhoto,
  onUploadPhoto,
  onPrevious,
  onNext,
  getCurrentImageUrl
}) {
  if (imageCount === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        gap: '20px'
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#ccc' }}>
          photo_camera
        </span>
        <p style={{ color: '#666', fontSize: '18px' }}>No photos found</p>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            onClick={onAddPhoto}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span className="material-symbols-outlined">add_a_photo</span>
            Take Photo
          </button>
          <button
            onClick={onUploadPhoto}
            style={{
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span className="material-symbols-outlined">upload</span>
            Upload Photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Image counter - top left */}
      <div style={{
        position: 'absolute',
        top: '15px',
        left: '15px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '20px',
        fontSize: '16px',
        fontWeight: 'bold',
        zIndex: 10
      }}>
        {currentIndex + 1}/{imageCount}
      </div>

      {/* Add photo buttons - top right */}
      <div style={{
        position: 'absolute',
        top: '15px',
        right: '15px',
        zIndex: 10,
        display: 'flex',
        gap: '10px'
      }}>
        <button
          onClick={onAddPhoto}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            add_a_photo
          </span>
          Take Photo
        </button>
        <button
          onClick={onUploadPhoto}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            upload
          </span>
          Upload Photo
        </button>
      </div>

      {/* Main image */}
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000'
      }}>
        <img
          src={getCurrentImageUrl(currentIndex)}
          alt={`${imageType} ${currentIndex + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
          onError={(e) => {
            e.target.src = '/images/loading.png';
          }}
        />
      </div>

      {/* Navigation arrows */}
      {imageCount > 1 && (
        <>
          {/* Previous button */}
          {currentIndex > 0 && (
            <button
              onClick={onPrevious}
              style={{
                position: 'absolute',
                left: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              <span className="material-symbols-outlined">arrow_back_ios</span>
            </button>
          )}

          {/* Next button */}
          {currentIndex < imageCount - 1 && (
            <button
              onClick={onNext}
              style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              <span className="material-symbols-outlined">arrow_forward_ios</span>
            </button>
          )}
        </>
      )}

      {/* Thumbnail strip at bottom for multiple images */}
      {imageCount > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '10px',
          borderRadius: '10px',
          maxWidth: '80%',
          overflowX: 'auto'
        }}>
          {Array.from({ length: imageCount }, (_, index) => (
            <div
              key={index}
              onClick={() => onIndexChange(index)}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '5px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: index === currentIndex ? '2px solid #4CAF50' : '2px solid transparent',
                flexShrink: 0
              }}
            >
              <img
                src={getCurrentImageUrl(index)}
                alt={`thumbnail ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  e.target.src = '/images/loading.png';
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PhotoViewer;