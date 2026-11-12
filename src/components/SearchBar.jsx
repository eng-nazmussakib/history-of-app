'use client';

import { useState } from 'react';
import { useNavigation } from '../navigation/NavigationProvider.jsx';

export default function SearchBar({ initialQuery = '' }) {
  const [value, setValue] = useState(initialQuery);
  const [pending, setPending] = useState(false);
  const { navigate } = useNavigation();

  async function handleSubmit(e) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    setPending(true);
    try {
      await navigate(`/search?q=${encodeURIComponent(q)}`);
    } finally {
      setPending(false);
    }
  }

  // Without JavaScript the form still works: it's a plain GET to /search.
  return (
    <form className="search" role="search" action="/search" method="get" onSubmit={handleSubmit}>
      <label htmlFor="search-input" className="visually-hidden">
        Search a term
      </label>
      <svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        id="search-input"
        name="q"
        className="search__input"
        type="search"
        placeholder="Search a country…"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button className="search__button" type="submit" disabled={pending}>
        {pending ? 'Searching…' : 'Search'}
      </button>
    </form>
  );
}
