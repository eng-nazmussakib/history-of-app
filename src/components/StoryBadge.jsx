'use client';

import { useRef } from 'react';
import { formatYear } from '../lib/dates.js';
import { badgeNameClass } from '../lib/badge.js';
import useIsTruncated from '../hooks/useIsTruncated.js';

// The round "The Story of …" badge. Long names shrink (see lib/badge.js); a
// name that still doesn't fit is cut to three lines with "…", and the full
// name appears in a tooltip on hover or keyboard focus.
export default function StoryBadge({ term, as: Heading = 'h1' }) {
  const nameRef = useRef(null);
  const truncated = useIsTruncated(nameRef, term.name);

  return (
    <div className="story-badge">
      <div
        className={`story-badge__circle${truncated ? ' has-tooltip' : ''}`}
        data-tooltip={truncated ? term.name : undefined}
        tabIndex={truncated ? 0 : undefined}
      >
        <span className="story-badge__the">The Story of</span>
        <Heading ref={nameRef} className={badgeNameClass(term.name)}>
          {term.name}
        </Heading>
      </div>
      {term.span && (
        <div className="story-badge__ribbon">
          <span>
            {formatYear(term.span.from)} – {formatYear(term.span.to)}
          </span>
        </div>
      )}
    </div>
  );
}
