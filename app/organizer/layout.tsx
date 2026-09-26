// The organizer console is a desktop tool for data entry and monitoring, not
// a document to be read on a phone — so unlike the rest of the app it gets a
// wide column instead of the narrow one set by pages that opt into it
// themselves (see app/layout.tsx's <main>), leaving room for a real overview:
// side-by-side match lists, wide tables, multi-column forms.
export default function OrganizerLayout({ children }: LayoutProps<"/organizer">) {
  return <div className="mx-auto w-full max-w-6xl">{children}</div>;
}
