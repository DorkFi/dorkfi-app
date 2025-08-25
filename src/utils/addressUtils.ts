
export const shortenAddress = (address: string, chars: number = 4): string => {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};
