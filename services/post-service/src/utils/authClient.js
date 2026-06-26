import axios from 'axios';

const authClient = axios.create({
  baseURL: process.env.AUTH_SERVICE_URL,
  timeout: 5000,
});

export default authClient;
