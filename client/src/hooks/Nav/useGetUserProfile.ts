import { useQuery } from '@tanstack/react-query';

export function useGetUserProfile(enabled: boolean = true, token?: string) {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/user/profile', {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        throw new Error('Failed to fetch profile');
      }
      return res.json();
    },
    enabled,
  });
}
