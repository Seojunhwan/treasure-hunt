import { describe, it, expect } from 'vitest';
import { validateJoinUrl } from '../server/settings.js';

describe('validateJoinUrl', () => {
  it('accepts http(s) and normalizes', () => {
    expect(validateJoinUrl(' https://game.example.com ')).toEqual({ url: 'https://game.example.com/' });
    expect(validateJoinUrl('http://10.0.0.5:8080/?x=1').url).toBe('http://10.0.0.5:8080/?x=1');
  });
  it('empty means default', () => {
    expect(validateJoinUrl('')).toEqual({ url: '' });
    expect(validateJoinUrl(undefined)).toEqual({ url: '' });
  });
  it('rejects other schemes and junk', () => {
    expect(validateJoinUrl('javascript:alert(1)').error).toBeTruthy();
    expect(validateJoinUrl('file:///etc/passwd').error).toBeTruthy();
    expect(validateJoinUrl('not a url').error).toBeTruthy();
    expect(validateJoinUrl('https://a.com/' + 'x'.repeat(400)).error).toBeTruthy();
  });
});
