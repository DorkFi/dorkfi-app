import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useWallet } from "@txnlab/use-wallet-react";

// List of approved wallet addresses
const APPROVED_ADDRESSES = [
  "CKZEQGRYNVTMCDD2GAD2VN7U5FE4YZWUWGUUC2LXO6F5JFUJAQUZWDZDAI",
  "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ",
  "EEPCI5R5WCC7EX7THSIHYENKVOXZG4QDBMHNZ6EK5423K3XYNGELXD3IGE",
  "EM6YOBT4UOMEGWZO74OLOSA55V6EH6DUQSCAJA6FNMQ5IS5U3GZXBUR2OI",
  "7UBGYVIHJKBIDSVZABRZSGAMN55HZSBX4MK3VBCHVM6F7OIWSGEN3Z75L4",
  "FV6ULFQITUJF5NLUFWCPAW3X2IWKAKFN6L257WQUER2H3JHRXM2BKJYJHA",
  "XUEIIIMV7BCFRPILBJSQGZFBJH7EIWQOSMHEM2YDWMBA7GPRF4SXQBSXJM",
  "CRI5WQWSLYN7TT4LNJYWHK4LICMOX6QR6HCSSTOG3TVNWFG2HB4G2EKIQQ",
];

interface AuthGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

export default function AuthGuard({
  children,
  fallbackPath = "/",
}: AuthGuardProps) {
  const { activeAccount } = useWallet();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuthorization = async () => {
      if (!activeAccount?.address) {
        setIsAuthorized(false);
        setIsChecking(false);
        return;
      }

      // Check if the connected address is in the approved list
      const isApproved = APPROVED_ADDRESSES.includes(activeAccount.address);
      setIsAuthorized(isApproved);
      setIsChecking(false);
    };

    checkAuthorization();
  }, [activeAccount?.address]);

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking authorization...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authorized
  if (!isAuthorized) {
    return <Navigate to={fallbackPath} replace />;
  }

  // Render children if authorized
  return <>{children}</>;
}
