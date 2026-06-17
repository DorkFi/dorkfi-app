/**
 * Build portfolio `user` state with `computed` totals from API/chain user payload.
 */
export function applyPortfolioUserComputed(
  user: Record<string, unknown>
): Record<string, unknown> | null {
  if (!user.globalUserData || !Array.isArray(user.globalUserData)) {
    return null;
  }

  const globalCollateralValue =
    user.globalUserData
      .map((item: Record<string, unknown>) =>
        BigInt(item.totalCollateralValue as string | number)
      )
      .reduce((acc: bigint, curr: bigint) => acc + curr, BigInt(0)) /
    BigInt(1e12);

  const globalBorrowValue =
    user.globalUserData
      .map((item: Record<string, unknown>) =>
        BigInt(item.totalBorrowValue as string | number)
      )
      .reduce((acc: bigint, curr: bigint) => acc + curr, BigInt(0)) /
    BigInt(1e12);

  const globalNetPortfolioValue = globalCollateralValue - globalBorrowValue;

  const networkValues: Record<
    string,
    { collateral: number; borrow: number; netValue: number }
  > = {};

  user.globalUserData.forEach((item: Record<string, unknown>) => {
    const network = String(item.network || "unknown");
    const collateralValue = Number(
      BigInt(String(item.totalCollateralValue ?? 0)) / BigInt(1e12)
    );
    const borrowValue = Number(
      BigInt(String(item.totalBorrowValue ?? 0)) / BigInt(1e12)
    );
    const netValue = collateralValue - borrowValue;

    if (!networkValues[network]) {
      networkValues[network] = { collateral: 0, borrow: 0, netValue: 0 };
    }

    networkValues[network].collateral += collateralValue;
    networkValues[network].borrow += borrowValue;
    networkValues[network].netValue += netValue;
  });

  const deposits: Record<string, unknown>[] = [];
  const borrows: Record<string, unknown>[] = [];
  if (user.userData && Array.isArray(user.userData)) {
    user.userData.forEach((item: Record<string, unknown>) => {
      if (BigInt(String(item.scaledDeposits ?? 0)) > BigInt(0)) {
        deposits.push(item);
      }
      if (BigInt(String(item.scaledBorrows ?? 0)) > BigInt(0)) {
        borrows.push(item);
      }
    });
  }

  return {
    ...user,
    computed: {
      globalCollateralValue: Number(globalCollateralValue),
      globalBorrowValue: Number(globalBorrowValue),
      globalNetPortfolioValue: Number(globalNetPortfolioValue),
      networkValues,
      deposits,
      borrows,
    },
  };
}

export function extractUserProfileAvatar(
  user: Record<string, unknown>
): string | null {
  const avatarUrl = user.avatar ?? user.avatarImage ?? user.profileImage;
  return typeof avatarUrl === "string" && avatarUrl.length > 0
    ? avatarUrl
    : null;
}
