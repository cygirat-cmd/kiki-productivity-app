declare module 'lottie-web' {
  export interface AnimationItem {
    play(): void;
    pause(): void;
    stop(): void;
    destroy(): void;
    addEventListener(name: 'complete' | 'loopComplete' | 'enterFrame' | 'segmentStart' | 'config_ready' | 'data_ready' | 'loaded_images' | 'DOMLoaded' | 'error', callback: () => void): void;
    removeEventListener(name: 'complete' | 'loopComplete' | 'enterFrame' | 'segmentStart' | 'config_ready' | 'data_ready' | 'loaded_images' | 'DOMLoaded' | 'error', callback: () => void): void;
    setSpeed(speed: number): void;
    setDirection(direction: number): void;
    setLoop(loop: boolean): void;
    goToAndStop(value: number, isFrame?: boolean): void;
    goToAndPlay(value: number, isFrame?: boolean): void;
    playSegments(segments: number[] | number[][], forceFlag?: boolean): void;
    setSubframe(flag: boolean): void;
    getDuration(inFrames?: boolean): number;
    resize(): void;
  }

  export interface AnimationConfig {
    container: Element;
    renderer?: 'svg' | 'canvas' | 'html';
    loop?: boolean;
    autoplay?: boolean;
    animationData?: any;
    path?: string;
    rendererSettings?: any;
    name?: string;
  }

  export function loadAnimation(params: AnimationConfig): AnimationItem;
  export function destroy(): void;
  export function registerAnimation(): void;
  export function setSpeed(speed: number): void;
  export function setDirection(direction: number): void;
  export function searchAnimations(): void;

  const lottie: {
    loadAnimation: typeof loadAnimation;
    destroy: typeof destroy;
    registerAnimation: typeof registerAnimation;
    setSpeed: typeof setSpeed;
    setDirection: typeof setDirection;
    searchAnimations: typeof searchAnimations;
  };

  export default lottie;
}