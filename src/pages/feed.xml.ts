import { GET as getFeed } from './feed.js';

export async function GET(context) {
  return getFeed(context);
}
