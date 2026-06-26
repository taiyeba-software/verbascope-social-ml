import ProfileHeader from '@/components/profile/ProfileHeader';

interface ProfilePageProps {
  params: { id: string };
}

export default function ProfilePage({ params }: ProfilePageProps) {
  return (
    <div className="profile-page">
      <ProfileHeader userId={params.id} />
      {/* ProfileTabs, ProfilePosts, SuggestedConnections land in later phases */}
    </div>
  );
}