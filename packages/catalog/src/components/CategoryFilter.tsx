import React from 'react';

interface CategoryFilterProps {
  categories: string[];
  selected: string;
  onChange: (category: string) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selected,
  onChange,
}) => {
  return (
    <div className="category-filter" role="toolbar" aria-label="Filter by category">
      <button
        type="button"
        className={`category-filter__btn ${!selected ? 'category-filter__btn--active' : ''}`}
        onClick={() => onChange('')}
        aria-pressed={!selected}
      >
        All Categories
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          className={`category-filter__btn ${selected === cat ? 'category-filter__btn--active' : ''}`}
          onClick={() => onChange(selected === cat ? '' : cat)}
          aria-pressed={selected === cat}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
