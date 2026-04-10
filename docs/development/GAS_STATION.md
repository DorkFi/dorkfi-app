# Gas Station Feature

The Gas Station is a new page in the DorkFi application that allows users to mint tokens as needed across different networks. It provides a unified interface for minting various types of tokens including network tokens, ARC200 smart contract tokens, and Algorand Standard Assets (ASA).

## Features

### 🎯 Core Functionality
- **Multi-Network Support**: Works with VOI Mainnet, VOI Testnet, Algorand Mainnet, and Algorand Testnet
- **Token Type Support**: Supports network tokens, ARC200 tokens, and ASA tokens
- **Network-Aware**: Automatically detects available tokens based on the current network
- **Wallet Integration**: Seamlessly integrates with connected wallets
- **Real-time Validation**: Validates minting requests before processing

### 🔧 Technical Features
- **Service Architecture**: Clean separation of concerns with dedicated service layer
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Robust error handling and user feedback
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Accessibility**: Follows accessibility best practices

## Architecture

### Components

#### GasStation Page (`/src/pages/GasStation.tsx`)
The main page component that provides the user interface for token minting.

**Key Features:**
- Token selection interface
- Minting form with validation
- Network information display
- Real-time feedback and notifications

#### GasStationService (`/src/services/gasStationService.ts`)
The core service that handles all token minting logic.

**Key Methods:**
- `mintTokens()`: Main minting function
- `validateMintingRequest()`: Request validation
- `getTokenMintingInfo()`: Token information retrieval
- `isNetworkSupported()`: Network compatibility check

### Token Types

#### Network Tokens
- **Examples**: VOI, ALGO
- **Minting Method**: Network faucets or direct minting
- **Cost**: Free
- **Description**: Native tokens of the respective networks

#### ARC200 Tokens
- **Examples**: UNIT, BUIDL, SHELLY
- **Minting Method**: Smart contract minting
- **Cost**: ~0.001 ALGO
- **Description**: ARC200 smart contract tokens with minting capabilities

#### ASA Tokens
- **Examples**: USDC, aVOI, POW
- **Minting Method**: Asset transfer transactions
- **Cost**: ~0.001 ALGO
- **Description**: Algorand Standard Assets with minting permissions

## Usage

### Accessing the Gas Station
1. Navigate to the Gas Station page via the main navigation
2. Ensure your wallet is connected
3. Select your desired network (if not already selected)

### Minting Tokens
1. **Select Token**: Choose from available tokens for the current network
2. **Enter Amount**: Specify the amount to mint
3. **Set Recipient**: Enter the recipient address (defaults to connected wallet)
4. **Validate**: The system automatically validates the request
5. **Mint**: Click "Mint Tokens" to execute the transaction

### Network Switching
- The Gas Station automatically updates available tokens when switching networks
- Only tokens supported by the current network are displayed
- Network-specific minting methods are applied automatically

## Configuration

### Network Configuration
The Gas Station uses the existing network configuration system:

```typescript
// Supported networks
const supportedNetworks = [
  'voi-mainnet',
  'voi-testnet', 
  'algorand-mainnet',
  'algorand-testnet'
];
```

### Token Configuration
Tokens are configured in the main config file (`/src/config/index.ts`):

```typescript
// Example token configuration
VOI: {
  assetId: "0",
  poolId: "41760711",
  contractId: "41877720",
  nTokenId: "42125195",
  decimals: 6,
  name: "VOI",
  symbol: "VOI",
  logoPath: "/lovable-uploads/VOI.png",
  tokenStandard: "network",
}
```

## API Reference

### GasStationService

#### `mintTokens(request: MintingRequest): Promise<MintingResult>`
Main function to mint tokens.

**Parameters:**
- `request`: MintingRequest object containing all necessary information

**Returns:**
- Promise resolving to MintingResult with transaction details

#### `validateMintingRequest(request: MintingRequest): ValidationResult`
Validates a minting request before processing.

**Parameters:**
- `request`: MintingRequest object to validate

**Returns:**
- Object with `isValid` boolean and `errors` array

#### `getTokenMintingInfo(...): TokenMintingInfo`
Retrieves minting information for a token.

**Parameters:**
- Token details (symbol, name, decimals, etc.)

**Returns:**
- TokenMintingInfo object with minting details

### Types

#### MintingRequest
```typescript
interface MintingRequest {
  tokenSymbol: string;
  amount: string;
  recipientAddress: string;
  networkId: NetworkId;
  tokenStandard: TokenStandard;
  contractId?: string;
  assetId?: string;
  decimals: number;
}
```

#### MintingResult
```typescript
interface MintingResult {
  txId: string;
  amount: string;
  token: string;
  network: string;
  recipient: string;
  timestamp: number;
}
```

## Testing

### Unit Tests
The GasStationService includes comprehensive unit tests:

```bash
npm test gasStationService
```

**Test Coverage:**
- Request validation
- Token information retrieval
- Network support checking
- Error handling

### Manual Testing
1. **Network Switching**: Test token availability across different networks
2. **Token Selection**: Verify correct tokens are shown for each network
3. **Form Validation**: Test all validation scenarios
4. **Minting Process**: Test the complete minting workflow
5. **Error Handling**: Test error scenarios and user feedback

## Security Considerations

### Input Validation
- All user inputs are validated before processing
- Address validation using Algorand SDK
- Amount validation to prevent invalid values
- Network compatibility checks

### Transaction Safety
- Simulated transactions for development
- Proper error handling and rollback
- User confirmation before execution
- Transaction status tracking

### Access Control
- Wallet connection required
- Network-specific token access
- Proper permission checks for minting

## Future Enhancements

### Planned Features
- **Real Faucet Integration**: Connect to actual network faucets
- **Transaction History**: Track minting history
- **Batch Minting**: Mint multiple tokens in one transaction
- **Custom Amounts**: Support for custom minting amounts
- **Gas Estimation**: Show estimated transaction costs

### Potential Improvements
- **Faucet Status**: Show faucet availability and limits
- **Minting Limits**: Implement daily/hourly minting limits
- **Advanced Filters**: Filter tokens by type, cost, etc.
- **Favorites**: Save frequently minted tokens
- **Analytics**: Track minting patterns and usage

## Troubleshooting

### Common Issues

#### "No tokens available"
- **Cause**: Network not supported or no tokens configured
- **Solution**: Switch to a supported network or check token configuration

#### "Invalid recipient address"
- **Cause**: Malformed Algorand address
- **Solution**: Verify the address format and try again

#### "Minting failed"
- **Cause**: Network issues or insufficient permissions
- **Solution**: Check network connection and wallet permissions

#### "Token not mintable"
- **Cause**: Token doesn't have minting capabilities
- **Solution**: Select a different token or check token configuration

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
DEBUG=gasStation:*
```

## Contributing

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Navigate to `/gas-station` to test the feature

### Code Style
- Follow existing TypeScript conventions
- Use proper error handling
- Add comprehensive tests
- Update documentation

### Pull Request Process
1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Submit pull request with description

## Support

For issues or questions related to the Gas Station feature:
1. Check the troubleshooting section
2. Review the API documentation
3. Check existing issues in the repository
4. Create a new issue with detailed information

---

**Note**: This feature is currently in development. Some functionality may be simulated for testing purposes. Real network integration will be implemented in future releases.
