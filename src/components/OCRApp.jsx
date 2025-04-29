import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

 
function OCRApp() {
  const [image, setImage] = useState(null);
  const [ocrResult, setOcrResult] = useState('');
  const [progress, setProgress] = useState('');
  const [isCropping, setIsCropping] = useState(false);
  const [contrast, setContrast] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [languages, setLanguages] = useState({
    eng: 'English',
    ces: 'Czech',
    spa: 'Spanish',
    fra: 'French',
    deu: 'German',
    ita: 'Italian',
    por: 'Portuguese',
    pol: 'Polish',
    ron: 'Romanian',
    hun: 'Hungarian',
    rus: 'Russian',
  });
  const [selectedLanguage, setSelectedLanguage] = useState('eng');

  const previewImageRef = useRef(null);
  const originalImageRef = useRef(null);
  const workerRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const endXRef = useRef(0);
  const endYRef = useRef(0);
  const currentFileRef = useRef(null);
  
  
  useEffect(() => {
    const initializeWorker = async (language) => {
      try {
        if (!workerRef.current?.worker) {
          const worker = await createWorker();
          workerRef.current = { worker };
          workerRef.current.worker.addEventListener('message', (event) => {
          if (event.data.status === 'recognizing text') {
            const prog = Math.round(event.data.progress * 100);
            setProgress(`Processing: ${prog}%`);
          } else if (event.data.status === 'loading tesseract core') {
            setProgress("Loading core...");
          } else {setProgress("Processing...");}});
          await workerRef.current.worker.loadLanguage(language);
          await workerRef.current.worker.initialize(language);
        };
      } catch (error) {
        console.error('Worker initialization error:', error);
        setOcrResult('Error initializing OCR worker. Check console for details.');
      }
    };

    initializeWorker(selectedLanguage);
  }, []);


  const loadImage = async (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });

  const handleFile = async (file) => {
    try {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        await setPreviewImage(e.target.result);
        currentFileRef.current = file;
        document.getElementById('downloadButton').style.display = "block";
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error during image upload handling:', error);
    }
  };

  const adjustContrastBrightness = (imageData, contrastValue, brightnessValue) => {
    const data = imageData.data;
    const factor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = factor * (data[i] - 128) + 128 + brightnessValue; // Red
      data[i + 1] = factor * (data[i + 1] - 128) + 128 + brightnessValue; // Green
      data[i + 2] = factor * (data[i + 2] - 128) + 128 + brightnessValue; // Blue
    }
    return imageData;
  };

  const startCropping = (event) => {
    if (!isCropping) return;
    const rect = previewImageRef.current.getBoundingClientRect();
    startXRef.current = event.clientX - rect.left;
    startYRef.current = event.clientY - rect.top;
    if (startXRef.current < 0) startXRef.current = 0;
    if (startYRef.current < 0) startYRef.current = 0;
    previewImageRef.current.addEventListener('mousemove', drawCropRect);
  };

  const drawCropRect = (event) => {
    if (!isCropping) return;
    const rect = previewImageRef.current.getBoundingClientRect();
    endXRef.current = event.clientX - rect.left;
    endYRef.current = event.clientY - rect.top;
    if (endXRef.current < 0) endXRef.current = 0;
    if (endYRef.current < 0) endYRef.current = 0;
    const canvas = document.createElement('canvas');
    canvas.width = previewImageRef.current.width;
    canvas.height = previewImageRef.current.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(previewImageRef.current, 0, 0);
    const x = Math.min(startXRef.current, endXRef.current);
    const y = Math.min(startYRef.current, endYRef.current);
    const width = Math.abs(endXRef.current - startXRef.current);
    const height = Math.abs(endYRef.current - startYRef.current);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  };

  const endCropping = (event) => {
    if (!isCropping) return;
    previewImageRef.current.removeEventListener('mousemove', drawCropRect);
    cropImage();
  };

  const cropImage = async () => {
    if (originalImageRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.abs(endXRef.current - startXRef.current);
      canvas.height = Math.abs(endYRef.current - startYRef.current);
      const ctx = canvas.getContext('2d');
      const x = Math.min(startXRef.current, endXRef.current);
      const y = Math.min(startYRef.current, endYRef.current);
      ctx.drawImage(originalImageRef.current, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      setRotationAngle(0);
      setContrast(0);
      setBrightness(0);
      await setPreviewImage(dataUrl);
      currentFileRef.current = await dataURLtoFile(dataUrl, currentFileRef.current.name);
      setIsCropping(false);
    }
  };

  const performOCR = async (imageFile) => {
    if (!workerRef.current) {
      throw new Error('OCR worker not initialized.');
    } else {
      const {
        data: {
          text
        }
      } = await workerRef.current.worker.recognize(imageFile);
      return text;
    }
  };

  const ocrClick = async () => {
    const file = currentFileRef.current;
    if (!file) {
      alert('Please select an image first.');
      return;
    }
    if (selectedLanguage === null) {
      alert("Please select a language.");
      return;
    }
    if (!workerRef.current)
      await initializeWorker(selectedLanguage);
    try {
      const text = await performOCR(file);
      setOcrResult(text);
    } catch (error) {
      console.error('OCR Error:', error);
      setOcrResult('Error during OCR. Please check the console for details.');
    }
  };

  const clear = () => {
    setOcrResult("");
    setImage(null);
    originalImageRef.current = null;
    currentFileRef.current = null;
    setProgress('');
    document.getElementById('downloadButton').style.display = "none";
    setContrast(100);
    setBrightness(100);
    setRotationAngle(0);
  };

  const applyTransformations = async (grayscale = false) => {
    let image;
    if (originalImageRef.current == null) {
      if(previewImageRef.current.src == "") return;
        originalImageRef.current = await loadImage(previewImageRef.current.src);
    } 
    image = originalImageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = originalImageRef.current.naturalWidth;
    canvas.height = originalImageRef.current.naturalHeight;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotationAngle * Math.PI / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageData = adjustContrastBrightness(imageData, contrast, brightness);
    if (grayscale) {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
      ctx.putImageData(imageData, 0, 0);
    } else {
      ctx.putImageData(imageData, 0, 0);
    }
    const dataUrl = canvas.toDataURL("image/png");
    await setPreviewImage(dataUrl);
    if (!currentFileRef.current.name) {
      currentFileRef.current.name = "temp.png";
    }
    currentFileRef.current = await dataURLtoFile(dataUrl, currentFileRef.current.name);
  };

  const setPreviewImage = async (src) => new Promise(resolve => {
    previewImageRef.current.onload = () => resolve();
    previewImageRef.current.src = src;
    setImage(previewImageRef.current.src);
  });

  const dataURLtoFile = (dataurl, filename) => new Promise((resolve, reject) => {
    fetch(dataurl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], filename, {
          type: blob.type
        });
        resolve(file);
      })
      .catch(error => {
        reject(error);
      });
  });

  const download = () => {
    if (ocrResult) {
      const blob = new Blob([ocrResult], {
        type: 'text/plain'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ocr-result.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert("There is no text to download");
    }
  };

  const handleImageChange = (event) => {
    handleFile(event.target.files[0]);
  }

  const handleContrastChange = async (event) => {
    setContrast(event.target.value);
    await applyTransformations();
  }
  const handleBrightnessChange = async (event) => {
    setBrightness(Number(event.target.value) - 100);
    await applyTransformations();
  }

  const handleCropButtonClick = () => {
    setIsCropping(true);
    startXRef.current = 0;
    startYRef.current = 0;
    endXRef.current = 0;
    endYRef.current = 0;
    previewImageRef.current.addEventListener('mousedown', startCropping);
    previewImageRef.current.addEventListener('mouseleave', endCropping);
    previewImageRef.current.addEventListener('mouseout', endCropping);
    previewImageRef.current.addEventListener('mouseup', endCropping);
  }

  const handleCopyButtonClick = () => {
    if (ocrResult) {
      navigator.clipboard.writeText(ocrResult)
        .then(() => {
          alert('Text copied to clipboard!')
        }).catch(err => {
          console.error('Failed to copy text: ', err);
        });
    }
  }

  const handleRotateButtonClick = () => {
    setRotationAngle((rotationAngle + 90) % 360);
    applyTransformations();
  }

  const handleGrayscaleButtonClick = () => {
    applyTransformations(true);
  }

  const handleLanguageChange = (event) => {
    setSelectedLanguage(event.target.value);
  }

  return (<div>
      <input type="file" id="imageUpload" onChange={handleImageChange}/>
      <br />
 {image && <p>Preview</p>}
 {image && <br />}

      <img ref={previewImageRef} id="previewImage" src={image} alt="Preview" style={{maxWidth: '500px', maxHeight: '500px'}}/>
      <br />
      <label htmlFor="languageSelect">Language:</label>
      <select id="languageSelect" onChange={handleLanguageChange} value={selectedLanguage}>
        {Object.keys(languages).map(langCode => (
          <option key={langCode} value={langCode}>{languages[langCode]}</option>
        ))}
      </select>
      <br />
      <button id="ocrButton" onClick={ocrClick}>Perform OCR</button>      <button id="clearButton" onClick={clear}>Clear</button>
      
      <button id="downloadButton" onClick={download} style={{display: 'none'}}>Download</button>
      <br/>
      <div id='progressIndicator'>{progress}</div>
      <br/>
      <textarea id="ocrResult" value={ocrResult} readOnly style={{width: '500px', height: '200px'}}></textarea>
    </div>
  );
}

export default OCRApp;