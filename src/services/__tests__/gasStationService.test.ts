/**
 * Tests for GasStationService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import GasStationService, { MintingRequest } from '../gasStationService';

describe('GasStationService', () => {
  describe('validateMintingRequest', () => {
    it('should validate a valid minting request', () => {
      const request: MintingRequest = {
        tokenSymbol: 'VOI',
        amount: '100',
        recipientAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        networkId: 'voi-mainnet',
        tokenStandard: 'network',
        decimals: 6,
      };

      const result = GasStationService.validateMintingRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid recipient address', () => {
      const request: MintingRequest = {
        tokenSymbol: 'VOI',
        amount: '100',
        recipientAddress: 'invalid-address',
        networkId: 'voi-mainnet',
        tokenStandard: 'network',
        decimals: 6,
      };

      const result = GasStationService.validateMintingRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid recipient address');
    });

    it('should reject missing required fields', () => {
      const request: MintingRequest = {
        tokenSymbol: '',
        amount: '',
        recipientAddress: '',
        networkId: 'voi-mainnet',
        tokenStandard: 'network',
        decimals: 6,
      };

      const result = GasStationService.validateMintingRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require contract ID for ARC200 tokens', () => {
      const request: MintingRequest = {
        tokenSymbol: 'UNIT',
        amount: '100',
        recipientAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        networkId: 'voi-mainnet',
        tokenStandard: 'arc200',
        decimals: 8,
      };

      const result = GasStationService.validateMintingRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Contract ID is required for ARC200 tokens');
    });

    it('should require asset ID for ASA tokens', () => {
      const request: MintingRequest = {
        tokenSymbol: 'USDC',
        amount: '100',
        recipientAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        networkId: 'algorand-mainnet',
        tokenStandard: 'asa',
        decimals: 6,
      };

      const result = GasStationService.validateMintingRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Asset ID is required for ASA tokens');
    });
  });

  describe('getTokenMintingInfo', () => {
    it('should return correct info for network tokens', () => {
      const info = GasStationService.getTokenMintingInfo(
        'VOI',
        'Voi',
        6,
        'network'
      );

      expect(info.symbol).toBe('VOI');
      expect(info.name).toBe('Voi');
      expect(info.decimals).toBe(6);
      expect(info.tokenStandard).toBe('network');
      expect(info.isMintable).toBe(true);
      expect(info.mintingCost).toBe('Free');
      expect(info.description).toContain('Native VOI tokens');
    });

    it('should return correct info for ARC200 tokens', () => {
      const info = GasStationService.getTokenMintingInfo(
        'UNIT',
        'Unit',
        8,
        'arc200',
        '123456'
      );

      expect(info.symbol).toBe('UNIT');
      expect(info.name).toBe('Unit');
      expect(info.decimals).toBe(8);
      expect(info.tokenStandard).toBe('arc200');
      expect(info.isMintable).toBe(true);
      expect(info.mintingCost).toBe('~0.001 ALGO');
      expect(info.description).toContain('ARC200 smart contract');
      expect(info.contractId).toBe('123456');
    });

    it('should return correct info for ASA tokens', () => {
      const info = GasStationService.getTokenMintingInfo(
        'USDC',
        'USD Coin',
        6,
        'asa',
        undefined,
        '31566704'
      );

      expect(info.symbol).toBe('USDC');
      expect(info.name).toBe('USD Coin');
      expect(info.decimals).toBe(6);
      expect(info.tokenStandard).toBe('asa');
      expect(info.isMintable).toBe(true);
      expect(info.mintingCost).toBe('~0.001 ALGO');
      expect(info.description).toContain('Algorand Standard Asset');
      expect(info.assetId).toBe('31566704');
    });
  });

  describe('getSupportedNetworks', () => {
    it('should return list of supported networks', () => {
      const networks = GasStationService.getSupportedNetworks();
      expect(networks).toContain('voi-mainnet');
      expect(networks).toContain('voi-testnet');
      expect(networks).toContain('algorand-mainnet');
      expect(networks).toContain('algorand-testnet');
    });
  });

  describe('isNetworkSupported', () => {
    it('should return true for supported networks', () => {
      expect(GasStationService.isNetworkSupported('voi-mainnet')).toBe(true);
      expect(GasStationService.isNetworkSupported('algorand-testnet')).toBe(true);
    });

    it('should return false for unsupported networks', () => {
      expect(GasStationService.isNetworkSupported('ethereum-mainnet')).toBe(false);
      expect(GasStationService.isNetworkSupported('base-mainnet')).toBe(false);
    });
  });

  describe('getAvailableGasStationTokens', () => {
    it('should return gas station tokens for VOI mainnet', () => {
      const tokens = GasStationService.getAvailableGasStationTokens('voi-mainnet');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].symbol).toBe('VOI');
      expect(tokens[0].isMintable).toBe(true);
    });

    it('should return empty array for networks without gas station config', () => {
      const tokens = GasStationService.getAvailableGasStationTokens('algorand-mainnet');
      expect(tokens).toHaveLength(0);
    });
  });

  describe('isTokenAvailableInGasStation', () => {
    it('should return true for VOI token on VOI mainnet', () => {
      expect(GasStationService.isTokenAvailableInGasStation('voi-mainnet', 'VOI')).toBe(true);
    });

    it('should return false for non-gas station tokens', () => {
      expect(GasStationService.isTokenAvailableInGasStation('voi-mainnet', 'ALGO')).toBe(false);
      expect(GasStationService.isTokenAvailableInGasStation('algorand-mainnet', 'ALGO')).toBe(false);
    });
  });

  describe('getGasStationTokenConfig', () => {
    it('should return token config for gas station tokens', () => {
      const config = GasStationService.getGasStationTokenConfig('voi-mainnet', 'VOI');
      expect(config).toBeDefined();
      expect(config?.symbol).toBe('VOI');
    });

    it('should return null for non-gas station tokens', () => {
      const config = GasStationService.getGasStationTokenConfig('voi-mainnet', 'ALGO');
      expect(config).toBeNull();
    });
  });
});
