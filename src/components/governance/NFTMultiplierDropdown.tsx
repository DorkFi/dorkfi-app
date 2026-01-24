import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";

// Import NFT images
import nftBuilder from "@/assets/nft-builder.webp";
import nftGuardian from "@/assets/nft-guardian.webp";
import nftPioneer from "@/assets/nft-pioneer.png";
import nftAdvocate from "@/assets/nft-advocate.webp";

export interface GovernanceNFT {
  id: string;
  name: string;
  multiplier: number;
  image: string;
}

interface NFTMultiplierDropdownProps {
  userNFTs?: GovernanceNFT[];
  onMultiplierChange?: (multiplier: number) => void;
}

// Mock data - in production this would come from wallet
const mockUserNFTs: GovernanceNFT[] = [
  {
    id: "1",
    name: "Dork V1",
    multiplier: 0.15,
    image: nftBuilder,
  },
  {
    id: "2",
    name: "Chubs",
    multiplier: 0.10,
    image: nftGuardian,
  },
  {
    id: "3",
    name: "Dorks V2",
    multiplier: 0.05,
    image: nftPioneer,
  },
  {
    id: "4",
    name: "Chubs",
    multiplier: 0.05,
    image: nftAdvocate,
  },
];

// Exported helper functions for use in other components
export const calculateNFTMultiplier = (nfts: GovernanceNFT[]): number => {
  return 1 + nfts.reduce((sum, nft) => sum + nft.multiplier, 0);
};

export const getDefaultNFTs = (): GovernanceNFT[] => mockUserNFTs;

export const NFTMultiplierDropdown = ({
  userNFTs = mockUserNFTs,
  onMultiplierChange,
}: NFTMultiplierDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    align: "start",
    slidesToScroll: 1,
    containScroll: "trimSnaps"
  });

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const hasNFTs = userNFTs.length > 0;
  const totalMultiplier = useMemo(() => {
    const multiplier = calculateNFTMultiplier(userNFTs);
    onMultiplierChange?.(multiplier);
    return multiplier;
  }, [userNFTs, onMultiplierChange]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex items-center justify-between w-full p-3 rounded-lg transition-all duration-200",
          "bg-muted/30 hover:bg-muted/50 border border-border/50",
          hasNFTs && "ring-1 ring-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.1)]"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            NFT Power Multipliers
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
        <div
          className={cn(
            "px-2 py-0.5 rounded-md text-xs font-semibold",
            hasNFTs
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {totalMultiplier.toFixed(2)}×
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="mt-2 rounded-lg border border-border/50 bg-background/80 backdrop-blur-sm overflow-hidden">
          {hasNFTs ? (
            <div className="p-4">
              {/* Carousel with navigation */}
              <div className="flex items-center gap-2">
                {/* Left Arrow */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted shrink-0"
                  onClick={scrollPrev}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                {/* NFT Carousel */}
                <div className="overflow-hidden flex-1" ref={emblaRef}>
                  <div className="flex gap-3">
                    {userNFTs.map((nft) => (
                      <div
                        key={nft.id}
                        className="flex-[0_0_auto] min-w-0 w-[120px]"
                      >
                        <div className="flex flex-col items-center p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors duration-150">
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-20 h-20 rounded-lg object-cover ring-1 ring-border/50"
                          />
                          <p className="text-sm font-medium text-foreground mt-2 text-center truncate w-full">
                            {nft.name}
                          </p>
                          <span className="text-xs font-semibold text-primary mt-1 px-2 py-0.5 rounded-full bg-primary/10">
                            +{nft.multiplier.toFixed(2)}×
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Arrow */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted shrink-0"
                  onClick={scrollNext}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                No governance NFTs detected
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Learn how to earn governance NFTs
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
