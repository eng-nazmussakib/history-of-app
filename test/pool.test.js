import { describe, expect, test } from 'vitest';
import { pinSslMode } from '../src/server/db/pool.js';

describe('pinSslMode', () => {
  test('pins Neon-style sslmode=require to verify-full, keeping other params', () => {
    const out = new URL(pinSslMode('postgresql://u:p@ep-x-pooler.example.neon.tech/neondb?sslmode=require&channel_binding=require'));
    expect(out.searchParams.get('sslmode')).toBe('verify-full');
    expect(out.searchParams.get('channel_binding')).toBe('require');
    expect(out.hostname).toBe('ep-x-pooler.example.neon.tech');
    expect(out.password).toBe('p');
  });

  test.each([
    'postgresql:///history_of?host=/var/run/postgresql',
    'postgresql://u@db/x?sslmode=verify-full',
    'postgresql://u@db/x?sslmode=disable',
    'postgresql://u@db/x?uselibpqcompat=true&sslmode=require',
    'not a url',
  ])('leaves %s unchanged', (url) => expect(pinSslMode(url)).toBe(url));
});
