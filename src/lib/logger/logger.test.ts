import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';

describe('createLogger', () => {
  it('debug forwards to console.debug with module context merged with extra context', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    try {
      const logger = createLogger('my-module');
      logger.debug('hello world', { requestId: 'abc' });
      expect(spy).toHaveBeenCalledWith('[debug] hello world', {
        module: 'my-module',
        requestId: 'abc',
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('info forwards to console.info with only the module context when no extra context given', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      const logger = createLogger('my-module');
      logger.info('started');
      expect(spy).toHaveBeenCalledWith('[info] started', { module: 'my-module' });
    } finally {
      spy.mockRestore();
    }
  });

  it('warn forwards to console.warn with module context merged with extra context', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const logger = createLogger('sync');
      logger.warn('name not found', { name: 'Nonexistent' });
      expect(spy).toHaveBeenCalledWith('[warn] name not found', {
        module: 'sync',
        name: 'Nonexistent',
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('error forwards to console.error with only the module context when no extra context given', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const logger = createLogger('sync');
      logger.error('fatal');
      expect(spy).toHaveBeenCalledWith('[error] fatal', { module: 'sync' });
    } finally {
      spy.mockRestore();
    }
  });
});
