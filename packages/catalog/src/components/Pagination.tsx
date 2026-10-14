import React from 'react';
import { PaginationMeta } from '../api/productApi';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ meta, onPageChange }) => {
  const { page, totalPages, hasPrev, hasNext } = meta;

  // Generate range of page numbers
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <nav className="pagination" aria-label="Catalog pagination">
      <button
        type="button"
        className="pagination__btn pagination__prev"
        disabled={!hasPrev}
        onClick={() => onPageChange(page - 1)}
        aria-label="Go to previous page"
      >
        &larr; Prev
      </button>

      {start > 1 && (
        <>
          <button
            type="button"
            className="pagination__btn pagination__num"
            onClick={() => onPageChange(1)}
          >
            1
          </button>
          {start > 2 && <span className="pagination__ellipsis">...</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`pagination__btn pagination__num ${p === page ? 'pagination__btn--active' : ''}`}
          onClick={() => onPageChange(p)}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="pagination__ellipsis">...</span>}
          <button
            type="button"
            className="pagination__btn pagination__num"
            onClick={() => onPageChange(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        type="button"
        className="pagination__btn pagination__next"
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
        aria-label="Go to next page"
      >
        Next &rarr;
      </button>
    </nav>
  );
};

export default Pagination;
