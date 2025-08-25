
import { TokenPair } from '@/types/mimirTypes';

export class TradingPairService {
  static async getTradingPairs(): Promise<TokenPair[]> {
    try {
      // In a real implementation, this would fetch from the API
      // For now, return hardcoded popular pairs
      return [
        { from: 'VOI', to: 'USDC', label: 'VOI/USDC', popular: true },
        { from: 'VOI', to: 'UNIT', label: 'VOI/UNIT', popular: true },
        { from: 'UNIT', to: 'USDC', label: 'UNIT/USDC', popular: true },
        { from: 'UNIT', to: 'VOI', label: 'UNIT/VOI' },
        { from: 'USDC', to: 'VOI', label: 'USDC/VOI' },
        { from: 'USDC', to: 'UNIT', label: 'USDC/UNIT' },
      ];
    } catch (error) {
      console.error('Error fetching trading pairs:', error);
      return [];
    }
  }
}
