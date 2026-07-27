import axios from 'axios';

const authClient = axios.create({
  baseURL: process.env.AUTH_SERVICE_URL,
  timeout: 5000,
});

/**
 * Fetches user details in bulk for an array of user IDs.
 * @param {Array<string>} userIds 
 * @returns {Promise<Object>} Object mapping userId to user object: { [userId]: userData }
 */
export async function getUsersByIds(userIds) {
  if (!userIds || userIds.length === 0) return {};

  try {
    // Calls GET /users/bulk?ids=id1,id2,id3 on your auth service
    const response = await authClient.get('/users/bulk', {
      params: { ids: userIds.join(',') },
    });

    // Expects response.data to be an array or map of users
    const users = response.data;

    if (Array.isArray(users)) {
      return users.reduce((acc, user) => {
        acc[String(user._id || user.id)] = user;
        return acc;
      }, {});
    }

    return users || {};
  } catch (error) {
    console.error('Failed to fetch bulk users from auth service:', error.message);
    return {};
  }
}

export default authClient;