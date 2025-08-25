
import { TokenService } from './tokenService';
import { PriceService } from './priceService';
import { TradingPairService } from './tradingPairService';

export class MimirApiService {
  // Token methods
  static getTokens = TokenService.getTokens.bind(TokenService);
  
  // Trading pair methods
  static getTradingPairs = TradingPairService.getTradingPairs.bind(TradingPairService);
  
  // Price methods
  static getOHLCData = PriceService.getOHLCData.bind(PriceService);
  static getPriceHistory = PriceService.getPriceHistory.bind(PriceService);
}
