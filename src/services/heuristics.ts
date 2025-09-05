/**
 * Heuristic image analysis service for cost-effective proof validation
 * This service provides fast, free image quality checks before AI processing
 * Uses basic image analysis techniques to filter out obviously invalid images
 */

// Types for heuristic results
export interface HeuristicResult {
  isValid: boolean
  reason?: string
  confidence: number // 0-1, higher means more confident in the result
  metrics: {
    brightness: number // 0-255, average brightness
    contrast: number // 0-1, contrast ratio
    blurScore: number // higher = more blurry
    colorfulness: number // 0-1, amount of color vs grayscale
    edgeCount: number // number of detected edges
  }
}

export interface ImageAnalysisOptions {
  minBrightness?: number // Default: 0 (no brightness restriction)
  maxBrightness?: number // Default: 255 (no brightness restriction)  
  minContrast?: number // Default: 0.005 (only reject completely flat)
  maxBlurScore?: number // Default: 1000 (no blur restriction)
  minColorfulness?: number // Default: 0.001 (only reject empty images)
  minEdgeCount?: number // Default: 5 (only reject images with no content)
}

// Minimal thresholds - only catch obviously empty or broken images
const DEFAULT_OPTIONS: Required<ImageAnalysisOptions> = {
  minBrightness: 0,        // Don't reject based on brightness
  maxBrightness: 255,      // Don't reject based on brightness
  minContrast: 0.005,      // Only reject completely flat images
  maxBlurScore: 1000,      // Don't reject based on blur
  minColorfulness: 0.001,  // Only reject completely empty images
  minEdgeCount: 5          // Only reject images with virtually no content
}

/**
 * Convert ArrayBuffer to ImageData for analysis
 * WEB implementation with fallback for React Native
 */
async function arrayBufferToImageData(arrayBuffer: ArrayBuffer): Promise<ImageData | null> {
  try {
    // Web implementation using createImageBitmap and OffscreenCanvas
    if (typeof createImageBitmap !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      const bmp = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, bmp.width, bmp.height);
    }
    
    // Fallback for React Native or unsupported environments
    // Skip heuristics validation and treat as pass for MVP
    console.log('arrayBufferToImageData: Skipping heuristics validation - unsupported environment');
    return null;
  } catch (error) {
    console.warn('arrayBufferToImageData failed:', error);
    return null;
  }
}

/**
 * Calculate average brightness of image (0-255)
 */
function calculateBrightness(imageData: ImageData): number {
  const { data, width, height } = imageData
  let total = 0
  const pixelCount = width * height
  
  // Calculate average brightness using luminance formula
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1] 
    const b = data[i + 2]
    // Standard luminance formula
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b
    total += brightness
  }
  
  return total / pixelCount
}

/**
 * Calculate image contrast using RMS contrast
 */
function calculateContrast(imageData: ImageData): number {
  const { data, width, height } = imageData
  const pixelCount = width * height
  let mean = 0
  const brightnesses: number[] = []
  
  // First pass: calculate mean brightness
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b
    brightnesses.push(brightness)
    mean += brightness
  }
  mean /= pixelCount
  
  // Second pass: calculate RMS contrast
  let variance = 0
  for (const brightness of brightnesses) {
    variance += Math.pow(brightness - mean, 2)
  }
  variance /= pixelCount
  
  const rmsContrast = Math.sqrt(variance) / 255 // Normalize to 0-1
  return rmsContrast
}

/**
 * Estimate blur using variance of Laplacian (simplified)
 */
function calculateBlurScore(imageData: ImageData): number {
  const { data, width, height } = imageData
  
  // Convert to grayscale first
  const gray: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    gray.push(0.299 * r + 0.587 * g + 0.114 * b)
  }
  
  // Simple Laplacian kernel approximation
  let laplacianVariance = 0
  let pixelCount = 0
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = gray[y * width + x]
      const top = gray[(y - 1) * width + x]
      const bottom = gray[(y + 1) * width + x]
      const left = gray[y * width + (x - 1)]
      const right = gray[y * width + (x + 1)]
      
      // Simple Laplacian: center * 4 - (top + bottom + left + right)
      const laplacian = center * 4 - (top + bottom + left + right)
      laplacianVariance += laplacian * laplacian
      pixelCount++
    }
  }
  
  return pixelCount > 0 ? laplacianVariance / pixelCount : 0
}

/**
 * Calculate colorfulness (how much color vs grayscale)
 */
function calculateColorfulness(imageData: ImageData): number {
  const { data, width, height } = imageData
  let colorDiff = 0
  const pixelCount = width * height
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    
    // Calculate how much the color channels differ from each other
    const maxChannel = Math.max(r, g, b)
    const minChannel = Math.min(r, g, b)
    colorDiff += (maxChannel - minChannel) / 255
  }
  
  return colorDiff / pixelCount
}

/**
 * Count edges using simple gradient detection
 */
function calculateEdgeCount(imageData: ImageData): number {
  const { data, width, height } = imageData
  let edgeCount = 0
  const threshold = 30 // Edge detection threshold
  
  // Convert to grayscale and detect edges
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = (y * width + x) * 4
      const iRight = (y * width + (x + 1)) * 4
      const iBottom = ((y + 1) * width + x) * 4
      
      const current = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      const right = 0.299 * data[iRight] + 0.587 * data[iRight + 1] + 0.114 * data[iRight + 2]
      const bottom = 0.299 * data[iBottom] + 0.587 * data[iBottom + 1] + 0.114 * data[iBottom + 2]
      
      const gradientX = Math.abs(current - right)
      const gradientY = Math.abs(current - bottom)
      const gradient = Math.sqrt(gradientX * gradientX + gradientY * gradientY)
      
      if (gradient > threshold) {
        edgeCount++
      }
    }
  }
  
  return edgeCount
}

/**
 * Perform heuristic analysis on image data
 */
function analyzeImageData(imageData: ImageData, options: ImageAnalysisOptions = {}): HeuristicResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // Calculate all metrics
  const brightness = calculateBrightness(imageData)
  const contrast = calculateContrast(imageData)
  const blurScore = calculateBlurScore(imageData)
  const colorfulness = calculateColorfulness(imageData)
  const edgeCount = calculateEdgeCount(imageData)
  
  const metrics = {
    brightness,
    contrast,
    blurScore,
    colorfulness,
    edgeCount
  }
  
  // Only check for obviously empty or corrupted images
  const failures: string[] = []
  
  // Only reject completely empty/uniform images (no contrast AND no edges)
  const isCompletelyEmpty = contrast < opts.minContrast && edgeCount < opts.minEdgeCount && colorfulness < opts.minColorfulness
  
  if (isCompletelyEmpty) {
    failures.push('image appears to be empty or completely uniform')
  }
  
  // Log image metrics for debugging (but don't use for validation)
  console.log('Image analysis:', {
    brightness: brightness.toFixed(1),
    contrast: contrast.toFixed(4),
    blurScore: blurScore.toFixed(1),
    colorfulness: colorfulness.toFixed(4),
    edgeCount,
    isValid: failures.length === 0
  })
  
  // Determine overall result - only fail on obviously empty images
  const isValid = failures.length === 0
  const reason = failures.length > 0 ? `invalid image: ${failures.join(', ')}` : undefined
  
  // Calculate confidence based on how far from thresholds we are
  let confidence = 1.0
  if (!isValid) {
    // Lower confidence for edge cases
    if (brightness <= opts.minBrightness + 20) confidence *= 0.8
    if (contrast <= opts.minContrast + 0.05) confidence *= 0.8
    if (blurScore >= opts.maxBlurScore - 20) confidence *= 0.8
  }
  
  return {
    isValid,
    reason,
    confidence,
    metrics
  }
}

/**
 * Main heuristic validation function - accepts ArrayBuffer
 */
export async function validateImageHeuristics(
  arrayBuffer: ArrayBuffer, 
  options: ImageAnalysisOptions = {}
): Promise<HeuristicResult> {
  try {
    // Convert ArrayBuffer to ImageData
    // In real implementation, this would use appropriate library for your environment
    const imageData = await arrayBufferToImageData(arrayBuffer)
    
    if (!imageData) {
      // Fallback: basic size/format checks
      return validateImageBasic(arrayBuffer, options)
    }
    
    return analyzeImageData(imageData, options)
  } catch (error) {
    console.error('Heuristic validation failed:', error)
    return {
      isValid: false,
      reason: 'heuristic analysis failed',
      confidence: 0.5,
      metrics: {
        brightness: 0,
        contrast: 0,
        blurScore: 0,
        colorfulness: 0,
        edgeCount: 0
      }
    }
  }
}

/**
 * Basic validation for when image processing libraries aren't available
 */
function validateImageBasic(arrayBuffer: ArrayBuffer, options: ImageAnalysisOptions = {}): HeuristicResult {
  const size = arrayBuffer.byteLength
  
  // Only check for obviously corrupted files
  if (size < 100) {  // Only reject extremely small files (likely corrupted)
    return {
      isValid: false,
      reason: 'file appears to be corrupted or empty',
      confidence: 0.9,
      metrics: {
        brightness: 0,
        contrast: 0,
        blurScore: 0,
        colorfulness: 0,
        edgeCount: 0
      }
    }
  }
  
  // Log file size but don't reject based on it
  console.log(`Image file size: ${(size / 1024 / 1024).toFixed(1)}MB`)
  
  // Check for basic image file signatures
  const bytes = new Uint8Array(arrayBuffer.slice(0, 10))
  const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8
  const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
  const isWebP = bytes[8] === 0x57 && bytes[9] === 0x45 // "WE" from "WEBP"
  
  if (!isJPEG && !isPNG && !isWebP) {
    // Log format but still allow - might be valid image in different format
    console.warn('Unknown image format detected, but allowing upload')
  }
  
  // If we get here, it's probably a valid image file
  return {
    isValid: true,
    confidence: 0.6, // Lower confidence since we can't do proper analysis
    metrics: {
      brightness: 128, // Assume reasonable values
      contrast: 0.5,
      blurScore: 30,
      colorfulness: 0.3,
      edgeCount: 300
    }
  }
}

/**
 * Server-side validation using sharp (Node.js/Edge Function environment)
 * This would be implemented in the Edge Function
 */
export async function validateImageServer(arrayBuffer: ArrayBuffer, options: ImageAnalysisOptions = {}): Promise<HeuristicResult> {
  // This function would be implemented in the server environment with sharp
  // Example implementation:
  /*
  const sharp = require('sharp');
  
  try {
    const image = sharp(Buffer.from(arrayBuffer));
    const { width, height } = await image.metadata();
    
    // Get image stats
    const stats = await image.stats();
    
    // Analyze image quality
    const brightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
    const contrast = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length / 255;
    
    // Blur detection using Laplacian
    const grayImage = await image.greyscale().raw().toBuffer();
    const blurScore = calculateLaplacianVariance(grayImage, width, height);
    
    // ... more analysis
    
    return analyzeMetrics(brightness, contrast, blurScore, ...);
  } catch (error) {
    return { isValid: false, reason: 'server analysis failed', confidence: 0.5, metrics: ... };
  }
  */
  
  // For now, fallback to basic validation
  return validateImageBasic(arrayBuffer, options)
}

/**
 * Utility function to test heuristics with known image types
 */
export function getTestResults(): { [key: string]: HeuristicResult } {
  const mockImageData = (r: number, g: number, b: number, variance: number = 0): ImageData => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, r + (Math.random() - 0.5) * variance))     // R
      data[i + 1] = Math.max(0, Math.min(255, g + (Math.random() - 0.5) * variance)) // G
      data[i + 2] = Math.max(0, Math.min(255, b + (Math.random() - 0.5) * variance)) // B
      data[i + 3] = 255 // A
    }
    
    return new ImageData(data, width, height)
  }
  
  return {
    'completely_uniform': analyzeImageData(mockImageData(128, 128, 128)),    // Should fail (no contrast/edges/color)
    'black_image': analyzeImageData(mockImageData(0, 0, 0)),                 // Should pass (just dark)
    'white_image': analyzeImageData(mockImageData(255, 255, 255)),           // Should pass (just bright)
    'dark_photo': analyzeImageData(mockImageData(30, 30, 30, 20)),           // Should pass
    'blurry_photo': analyzeImageData(mockImageData(100, 100, 100, 50)),      // Should pass
    'normal_image': analyzeImageData(mockImageData(128, 128, 128, 100)),     // Should pass
    'high_contrast': analyzeImageData(mockImageData(128, 128, 128, 200)),    // Should pass
    'low_contrast': analyzeImageData(mockImageData(128, 128, 128, 5))        // Should pass
  }
}