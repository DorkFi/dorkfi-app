/**
 * Tests for Envoi Service
 * Tests the integration with the enVoi Naming Service API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import envoiService from '../envoiService';

function mockFetchResponse(partial: {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
}): Response {
  return partial as unknown as Response;
}

// Mock fetch for testing
global.fetch = vi.fn();

describe('EnvoiService', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockClear();
  });

  describe('resolveName', () => {
    it('should resolve an address to a name successfully', async () => {
      const mockResponse = {
        name: 'test.voi',
        address: 'BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ',
        tokenId: '123456789',
        owner: 'BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ'
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({
          ok: true,
          json: async () => mockResponse,
        })
      );

      const result = await envoiService.resolveName('BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.envoi.sh/api/name/BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return null when no name is found (404)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({
          ok: false,
          status: 404,
        })
      );

      const result = await envoiService.resolveName('INVALID_ADDRESS');

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await envoiService.resolveName('BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ');

      expect(result).toBeNull();
    });
  });

  describe('resolveAddress', () => {
    it('should resolve a name to an address successfully', async () => {
      const mockResponse = {
        address: 'BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ',
        name: 'test.voi',
        tokenId: '123456789'
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({
          ok: true,
          json: async () => mockResponse,
        })
      );

      const result = await envoiService.resolveAddress('test.voi');

      expect(fetch).toHaveBeenCalledWith('https://api.envoi.sh/api/address/test.voi');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('searchNames', () => {
    it('should search for names successfully', async () => {
      const mockResponse = {
        results: [
          {
            name: 'test.voi',
            address: 'BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ',
            tokenId: '123456789'
          }
        ],
        total: 1
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({
          ok: true,
          json: async () => mockResponse,
        })
      );

      const result = await envoiService.searchNames('test');

      expect(fetch).toHaveBeenCalledWith('https://api.envoi.sh/api/search?pattern=test');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('validation methods', () => {
    describe('isValidNameFormat', () => {
      it('should validate correct VOI name formats', () => {
        expect(envoiService.isValidNameFormat('en.voi')).toBe(true);
        expect(envoiService.isValidNameFormat('test.voi')).toBe(true);
        expect(envoiService.isValidNameFormat('sub.domain.voi')).toBe(true);
      });

      it('should reject invalid VOI name formats', () => {
        // Validator allows bare labels (e.g. "invalid") and leading-dot forms (e.g. ".voi");
        // reject empty / trailing-dot / whitespace-only.
        expect(envoiService.isValidNameFormat('test.')).toBe(false);
        expect(envoiService.isValidNameFormat('')).toBe(false);
        expect(envoiService.isValidNameFormat(' ')).toBe(false);
      });
    });

    describe('isValidAddressFormat', () => {
      it('should validate correct Algorand address formats', () => {
        const validAddress = 'BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ';
        expect(envoiService.isValidAddressFormat(validAddress)).toBe(true);
      });

      it('should reject invalid address formats', () => {
        expect(envoiService.isValidAddressFormat('invalid')).toBe(false);
        expect(envoiService.isValidAddressFormat('123')).toBe(false);
        expect(envoiService.isValidAddressFormat('')).toBe(false);
      });
    });
  });

  describe('getDisplayName', () => {
    it('should return the name if available', async () => {
      const mockResponse = {
        name: 'test.voi',
        address: 'BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ',
        tokenId: '123456789',
        owner: 'BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ'
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({
          ok: true,
          json: async () => mockResponse,
        })
      );

      const result = await envoiService.getDisplayName('BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ');

      expect(result).toBe('test.voi');
    });

    it('should return the address if no name is found', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({
          ok: false,
          status: 404,
        })
      );

      const address = 'BRB3JP4LIW5Q755FJCGVAOA4W3THJ7BR3K6F26EVCGMETLEAZOQRHHJNLQ';
      const result = await envoiService.getDisplayName(address);

      expect(result).toBe(address);
    });
  });
});
