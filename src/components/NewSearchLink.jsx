// "← New search": back to the start page. A plain link, so it works before
// hydration too; the browser entry turns it into a client-side navigation,
// and the header search box resets because its key (the page query) changes.
export default function NewSearchLink() {
  return (
    <a className="new-search" href="/">
      <span aria-hidden="true">←</span> New search
    </a>
  );
}
