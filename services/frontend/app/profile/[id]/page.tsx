import ProfileHeader from '@/components/profile/ProfileHeader';

interface ProfilePageProps {
  // Next.js 16: params is a Promise and must be awaited before use.
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;

  return (
    <div className="profile-page">
      <ProfileHeader userId={id} />
      {/* ProfileTabs, ProfilePosts, SuggestedConnections land in later phases */}
    </div>
  );
}