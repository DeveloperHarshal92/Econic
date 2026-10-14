import React, { useState, useEffect } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search by name, description, or keyword...',
}) => {
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange(query.trim());
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
  };

  return (
    <form className="search-bar" role="search" onSubmit={handleSubmit}>
      <label htmlFor="catalog-search-input" className="sr-only">
        Search products
      </label>
      <div className="search-bar__inner">
        <span className="search-bar__icon" aria-hidden="true">
          🔍
        </span>
        <input
          id="catalog-search-input"
          type="search"
          className="search-bar__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search products"
        />
        {query && (
          <button
            type="button"
            className="search-bar__clear"
            onClick={handleClear}
            aria-label="Clear search query"
          >
            ✕
          </button>
        )}
        <button type="submit" className="search-bar__submit">
          Search
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
