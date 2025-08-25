
import React from 'react';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

interface LiquidationPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isMobile: boolean;
}

export default function LiquidationPagination({
  currentPage,
  totalPages,
  onPageChange,
  isMobile
}: LiquidationPaginationProps) {
  if (totalPages <= 1) return null;

  if (isMobile) {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
            return (
              <PaginationItem key={pageNumber}>
                <PaginationLink
                  onClick={() => onPageChange(pageNumber)}
                  isActive={pageNumber === currentPage}
                  className="cursor-pointer"
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
