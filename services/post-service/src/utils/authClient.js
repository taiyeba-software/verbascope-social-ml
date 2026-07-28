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
    // Calls GET /api/users/bulk?ids=id1,id2,id3 on the auth service.
    // Was previously missing the /api prefix (`/users/bulk`), which
    // doesn't match any registered route — every call 404'd, so every
    // saved post's author lookup silently returned {} and fell back
    // to null/"Anonymous" downstream.
    const response = await authClient.get('/api/users/bulk', {
      params: { ids: userIds.join(',') },
    });

    // The auth-service wraps the array in an object: { users: [...] },
    // the same shape post.controller.js already relies on
    // (`usersRes.data.users.map(...)`). This used to only handle a bare
    // array, so the wrapped-object case fell through and returned the
    // raw { users: [...] } object unchanged instead of an id-keyed map —
    // every `authors[someId]` lookup downstream then missed, silently
    // falling back to null.
    const payload = response.data;
    const users = Array.isArray(payload) ? payload : payload?.users;

    if (Array.isArray(users)) {
      return users.reduce((acc, user) => {
        acc[String(user._id || user.id)] = user;
        return acc;
      }, {});
    }

    return {};
  } catch (error) {
    console.error('Failed to fetch bulk users from auth service:', error.message);
    return {};
  }
}

export default authClient;