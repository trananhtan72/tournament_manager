import { redirect } from "next/navigation";

// Notifications sent before the console had tabs link to /organizer/[slug]/[eventId].
export default async function LegacyEventPage({
  params,
}: PageProps<"/organizer/[slug]/[eventId]">) {
  const { slug, eventId } = await params;
  redirect(`/organizer/${slug}/entries/${eventId}`);
}
