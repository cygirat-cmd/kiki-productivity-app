import { expect } from 'vitest';
(globalThis as any).expect = expect;
await import('@testing-library/jest-dom');
